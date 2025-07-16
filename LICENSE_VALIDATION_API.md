# License Validation API Documentation

## Overview
This document describes the JSON API format for license validation in the TaskRep application. The system automatically retrieves client ID from the database and domain from request headers, requiring only the License Manager Server URL as input.

## License Validation Request

### Endpoint
```
POST /api/license/validate
```

### Headers
```
Content-Type: application/json
x-user-id: {authenticated-user-id}
```

### Request Body
```json
{
  "licenseManagerUrl": "https://license-manager.example.com"
}
```

### Request Body Fields
- **licenseManagerUrl** (string, required): The URL of the license manager server for validation
  - For development: User-provided URL
  - For production: Will be a fixed, pre-configured URL

### Automatically Retrieved Values
The following values are automatically extracted by the system:
- **clientId**: Retrieved from the first license record in the database
- **domain**: Extracted from request headers (origin/host), with protocol and port stripped
- **licenseKey**: Retrieved from database license record
- **checksum**: Retrieved from database license record

## License Validation Response

### Success Response (200 OK)
```json
{
  "valid": true,
  "message": "License is valid and active",
  "validated_at": "2025-07-16T09:30:00.000Z",
  "expires_at": "2028-07-16T08:53:03.887Z",
  "subscription_data": {
    "type": "Paid",
    "properties": {
      "Users": {
        "type": "integer",
        "minimum": 1,
        "maximum": 50
      }
    },
    "required": ["Users"]
  }
}
```

### Invalid License Response (200 OK)
```json
{
  "valid": false,
  "message": "License has expired",
  "validated_at": "2025-07-16T09:30:00.000Z",
  "expires_at": "2024-01-01T00:00:00.000Z"
}
```

### Error Responses

#### Missing License Manager URL (400 Bad Request)
```json
{
  "error": "licenseManagerUrl is required"
}
```

#### No License in Database (404 Not Found)
```json
{
  "valid": false,
  "message": "No license found in database"
}
```

#### Authentication Error (401 Unauthorized)
```json
{
  "error": "User ID required"
}
```

#### Server Error (500 Internal Server Error)
```json
{
  "error": "Failed to validate license"
}
```

## External License Manager API

The TaskRep application sends the following request to the external license manager:

### Request to License Manager
```json
{
  "client_id": "efe2ae66-b484-4923-9e28-5f04df532c0e",
  "app_id": "8103dc0aa1d352f5c0c574c06eeb2893",
  "license_key": "encrypted-license-key-string",
  "checksum": "computed-checksum-value",
  "domain": "my-app.replit.app"
}
```

### Expected Response from License Manager
```json
{
  "valid": true,
  "status": "Valid",
  "message": "License validated successfully",
  "validated_at": "2025-07-16T09:30:00.000Z",
  "expires_at": "2028-07-16T08:53:03.887Z",
  "subscription_data": {
    "type": "Paid",
    "properties": {
      "Users": {
        "type": "integer",
        "minimum": 1,
        "maximum": 50
      }
    },
    "required": ["Users"]
  }
}
```

## Development vs Production Behavior

### Development Mode
- User manually inputs License Manager Server URL
- System uses database client ID and extracts domain from headers
- Single-form validation process

### Production Mode (Future)
- Fixed License Manager Server URL (pre-configured)
- Single-button validation (no user input required)
- Automatic background validation with caching

## Security Features

1. **Authentication Required**: Only admin users can trigger license validation
2. **Automatic Data Retrieval**: Client ID and domain cannot be manipulated by user input
3. **Encrypted Storage**: License keys and checksums are stored encrypted in database
4. **Request Validation**: All requests validated against database records
5. **Error Handling**: Comprehensive error responses for debugging

## Example Usage

### Frontend JavaScript
```javascript
const validateLicense = async (licenseManagerUrl) => {
  const response = await fetch('/api/license/validate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': currentUser.id
    },
    body: JSON.stringify({
      licenseManagerUrl: licenseManagerUrl
    })
  });
  
  return await response.json();
};
```

### Usage in React Component
```jsx
const handleValidate = async () => {
  try {
    const result = await validateLicense('https://license-server.example.com');
    if (result.valid) {
      console.log('License is valid:', result.message);
    } else {
      console.log('License is invalid:', result.message);
    }
  } catch (error) {
    console.error('Validation failed:', error);
  }
};
```