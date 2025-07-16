import crypto from 'crypto';
import { db } from './db';
import { licenses, type License, type InsertLicense } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

export const APP_ID = 'taskrep-task-management'; // TaskRep application ID
const ENCRYPTION_KEY = process.env.LICENSE_ENCRYPTION_KEY || 'taskrep-license-key-2024';

// API Interfaces
export interface LicenseAcquisitionRequest {
  client_id: string;
  app_id: string;
  base_url: string;
}

export interface LicenseAcquisitionResponse {
  license_key: string;
  subscription_type: string;
  valid_till: string; // ISO 8601 format
  checksum: string;
  mutual_key?: string; // Required for proper validation
  subscription_data: {
    type: string;
    properties: {
      Users: {
        type: string;
        minimum: number;
        maximum: number;
      };
    };
    required: string[];
  };
  message: string;
}

export interface LicenseValidationRequest {
  client_id: string;
  app_id: string;
  license_key: string;
  checksum: string;
  domain: string;
}

export interface LicenseValidationResponse {
  valid?: boolean;
  status?: string; // "Valid" or "Invalid"
  message: string;
  validated_at?: string;
  expires_at?: string;
  subscription_data?: any;
}

// Encryption/Decryption functions
function encrypt(text: string): string {
  const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decrypt(encryptedText: string): string {
  const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Checksum calculation - CRITICAL: Use exact order
export function generateChecksum(
  mutualKey: string,
  clientId: string,
  appId: string,
  licenseKey: string,
  endDateISOString: string
): string {
  const checksumData = clientId + appId + licenseKey + endDateISOString;
  const checksum = crypto.createHmac('sha256', mutualKey).update(checksumData).digest('hex');
  return checksum;
}

export class LicenseManager {
  private licenseManagerUrl: string | null = null;
  private validationCache: Map<string, { result: any; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 30 * 1000; // 30 seconds cache
  private pendingValidations: Map<string, Promise<any>> = new Map();

  constructor(licenseManagerUrl?: string) {
    this.licenseManagerUrl = licenseManagerUrl || process.env.LICENSE_MANAGER_URL || null;
  }

  setLicenseManagerUrl(url: string) {
    this.licenseManagerUrl = url;
  }

  // License Acquisition
  async acquireLicense(
    clientId: string,
    baseUrl: string
  ): Promise<{ success: boolean; message: string; license?: License }> {
    if (!this.licenseManagerUrl) {
      throw new Error('License manager URL not configured');
    }

    try {
      const requestPayload: LicenseAcquisitionRequest = {
        client_id: clientId,
        app_id: APP_ID,
        base_url: baseUrl
      };

      const licenseManagerBaseUrl = this.licenseManagerUrl.endsWith('/') ? 
        this.licenseManagerUrl.slice(0, -1) : this.licenseManagerUrl;
      const fullUrl = `${licenseManagerBaseUrl}/api/acquire-license`;
      
      console.log('Acquiring license from:', fullUrl);
      console.log('Request payload:', requestPayload);
      
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`License manager responded with status: ${response.status} - ${errorText}`);
      }

      const licenseResponse: LicenseAcquisitionResponse = await response.json();
      console.log('License response received:', licenseResponse);

      // Validate required fields
      if (!licenseResponse.license_key || !licenseResponse.subscription_type || 
          !licenseResponse.valid_till || !licenseResponse.checksum || 
          !licenseResponse.subscription_data) {
        throw new Error(`Missing required fields in response: ${JSON.stringify(licenseResponse)}`);
      }

      // CRITICAL: Extract mutual_key from response
      if (!licenseResponse.mutual_key) {
        throw new Error(`Missing mutual_key in response. License manager must provide mutual_key for checksum validation.`);
      }

      // Store license with encryption
      const encryptedMutualKey = encrypt(licenseResponse.mutual_key);
      const encryptedSubscriptionData = encrypt(JSON.stringify(licenseResponse.subscription_data));

      const licenseData: InsertLicense = {
        applicationId: APP_ID,
        clientId: clientId,
        licenseKey: licenseResponse.license_key,
        subscriptionType: licenseResponse.subscription_type,
        validTill: new Date(licenseResponse.valid_till),
        mutualKey: encryptedMutualKey,
        checksum: licenseResponse.checksum,
        subscriptionData: encryptedSubscriptionData,
        baseUrl: baseUrl,
        isActive: true,
        lastValidated: new Date()
      };

      // Remove existing licenses for this app and client
      await db.delete(licenses).where(
        and(
          eq(licenses.applicationId, APP_ID),
          eq(licenses.clientId, clientId)
        )
      );

      // Insert new license
      const [newLicense] = await db.insert(licenses).values(licenseData).returning();

      return {
        success: true,
        message: 'License acquired successfully',
        license: newLicense
      };
    } catch (error: any) {
      console.error('License acquisition error:', error);
      return {
        success: false,
        message: error.message || 'Failed to acquire license'
      };
    }
  }

  // License Validation with Caching and Deduplication
  async validateLicense(
    clientId: string,
    domain: string
  ): Promise<{ valid: boolean; message: string; license?: License }> {
    try {
      const cacheKey = `${clientId}:${domain}`;
      
      // Check cache first
      const cachedResult = this.validationCache.get(cacheKey);
      if (cachedResult && (Date.now() - cachedResult.timestamp) < this.CACHE_DURATION) {
        return cachedResult.result;
      }

      // Check for pending validation
      const pendingValidation = this.pendingValidations.get(cacheKey);
      if (pendingValidation) {
        return await pendingValidation;
      }

      // Start new validation
      const validationPromise = this.performLicenseValidation(clientId, domain, cacheKey);
      this.pendingValidations.set(cacheKey, validationPromise);

      try {
        const result = await validationPromise;
        return result;
      } finally {
        this.pendingValidations.delete(cacheKey);
      }
    } catch (error: any) {
      console.error('License validation error:', error);
      return {
        valid: false,
        message: error.message || 'License validation failed'
      };
    }
  }

  private async performLicenseValidation(
    clientId: string, 
    domain: string, 
    cacheKey: string
  ): Promise<{ valid: boolean; message: string; license?: License }> {
    try {
      // Get license from database
      const [currentLicense] = await db
        .select()
        .from(licenses)
        .where(
          and(
            eq(licenses.applicationId, APP_ID),
            eq(licenses.clientId, clientId),
            eq(licenses.isActive, true)
          )
        )
        .orderBy(desc(licenses.createdAt))
        .limit(1);

      if (!currentLicense) {
        return { valid: false, message: 'No active license found' };
      }

      // Check expiry
      if (new Date() > new Date(currentLicense.validTill)) {
        return { valid: false, message: 'License has expired' };
      }

      // Decrypt mutual key and calculate checksum
      const mutualKey = decrypt(currentLicense.mutualKey);
      const calculatedChecksum = generateChecksum(
        mutualKey,
        clientId,
        APP_ID,
        currentLicense.licenseKey,
        currentLicense.validTill.toISOString()
      );

      // External validation if URL configured
      if (this.licenseManagerUrl) {
        const validationRequest: LicenseValidationRequest = {
          client_id: clientId,
          app_id: APP_ID,
          license_key: currentLicense.licenseKey,
          checksum: calculatedChecksum,
          domain: currentLicense.baseUrl || domain
        };

        const licenseManagerBaseUrl = this.licenseManagerUrl.endsWith('/') ? 
          this.licenseManagerUrl.slice(0, -1) : this.licenseManagerUrl;
        const validationUrl = `${licenseManagerBaseUrl}/api/validate-license`;

        console.log('Validating license with external server:', validationUrl);
        console.log('Validation request:', validationRequest);

        const response = await fetch(validationUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validationRequest)
        });

        if (!response.ok) {
          throw new Error(`Validation failed with status: ${response.status}`);
        }

        const validationResponse: any = await response.json();
        console.log('Validation response:', validationResponse);
        
        // Handle different response formats
        const isValid = validationResponse.valid === true || 
                        validationResponse.status === 'Valid' ||
                        validationResponse.status === 'valid';

        if (isValid) {
          await db
            .update(licenses)
            .set({ lastValidated: new Date() })
            .where(eq(licenses.id, currentLicense.id));

          const result = {
            valid: true,
            message: validationResponse.message || 'License is valid',
            license: currentLicense
          };

          // Cache successful result
          this.validationCache.set(cacheKey, {
            result,
            timestamp: Date.now()
          });

          return result;
        } else {
          const result = {
            valid: false,
            message: validationResponse.message || 'License validation failed'
          };

          // Cache failed result for shorter time
          this.validationCache.set(cacheKey, {
            result,
            timestamp: Date.now() - (this.CACHE_DURATION - 5000)
          });

          return result;
        }
      } else {
        // Local validation only
        await db
          .update(licenses)
          .set({ lastValidated: new Date() })
          .where(eq(licenses.id, currentLicense.id));

        const result = {
          valid: true,
          message: 'License is valid (local validation)',
          license: currentLicense
        };

        this.validationCache.set(cacheKey, {
          result,
          timestamp: Date.now()
        });

        return result;
      }
    } catch (error: any) {
      console.error('License validation error:', error);
      return {
        valid: false,
        message: error.message || 'License validation failed'
      };
    }
  }

  // Get current license
  async getCurrentLicense(clientId: string): Promise<License | null> {
    try {
      const [currentLicense] = await db
        .select()
        .from(licenses)
        .where(
          and(
            eq(licenses.applicationId, APP_ID),
            eq(licenses.clientId, clientId),
            eq(licenses.isActive, true)
          )
        )
        .orderBy(desc(licenses.createdAt))
        .limit(1);

      return currentLicense || null;
    } catch (error) {
      console.error('Error getting current license:', error);
      return null;
    }
  }

  // Get user limits from subscription data
  async getUserLimits(clientId: string): Promise<{ minimum: number; maximum: number } | null> {
    try {
      const license = await this.getCurrentLicense(clientId);
      if (!license || !license.subscriptionData) {
        return null;
      }

      const subscriptionData = JSON.parse(decrypt(license.subscriptionData));
      const userLimits = subscriptionData.properties?.Users;
      
      if (userLimits && typeof userLimits.minimum === 'number' && typeof userLimits.maximum === 'number') {
        return {
          minimum: userLimits.minimum,
          maximum: userLimits.maximum
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting user limits:', error);
      return null;
    }
  }

  // Check if user count is within limits
  async checkUserLimit(clientId: string, currentUserCount: number): Promise<{ allowed: boolean; message: string; limits?: { minimum: number; maximum: number } }> {
    try {
      const limits = await this.getUserLimits(clientId);
      
      if (!limits) {
        return { allowed: true, message: 'No user limits found in license' };
      }

      if (currentUserCount > limits.maximum) {
        return {
          allowed: false,
          message: `User limit exceeded. Maximum allowed: ${limits.maximum}, current: ${currentUserCount}`,
          limits
        };
      }

      if (currentUserCount < limits.minimum) {
        return {
          allowed: true,
          message: `Below minimum user requirement. Minimum: ${limits.minimum}, current: ${currentUserCount}`,
          limits
        };
      }

      return {
        allowed: true,
        message: `User count within limits (${currentUserCount}/${limits.maximum})`,
        limits
      };
    } catch (error) {
      console.error('Error checking user limit:', error);
      return { allowed: true, message: 'Error checking user limits' };
    }
  }

  // License status summary
  async getLicenseStatus(clientId: string): Promise<{
    hasLicense: boolean;
    isValid: boolean;
    expiresAt?: Date;
    subscriptionType?: string;
    userLimits?: { minimum: number; maximum: number };
    message: string;
  }> {
    try {
      const license = await this.getCurrentLicense(clientId);
      
      if (!license) {
        return {
          hasLicense: false,
          isValid: false,
          message: 'No license found'
        };
      }

      const isExpired = new Date() > new Date(license.validTill);
      const userLimits = await this.getUserLimits(clientId);

      return {
        hasLicense: true,
        isValid: !isExpired,
        expiresAt: new Date(license.validTill),
        subscriptionType: license.subscriptionType,
        userLimits: userLimits || undefined,
        message: isExpired ? 'License has expired' : 'License is active'
      };
    } catch (error) {
      console.error('Error getting license status:', error);
      return {
        hasLicense: false,
        isValid: false,
        message: 'Error checking license status'
      };
    }
  }
}

// Create singleton instance
export const licenseManager = new LicenseManager();