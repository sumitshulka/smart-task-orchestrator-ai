#!/usr/bin/env tsx
// Add default passwords to migrated users
import { storage } from '../server/storage';
import bcrypt from 'bcrypt';

async function addPasswords() {
  console.log('🔐 Adding default passwords to migrated users...');
  
  try {
    const users = await storage.getAllUsers();
    const defaultPassword = 'tempPassword123'; // Users should change this
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    
    for (const user of users) {
      try {
        await storage.updateUser(user.id, {
          password_hash: hashedPassword,
          is_admin: user.email.includes('sumits') ? true : false, // Make sumits admin
        });
        console.log(`✓ Added password for: ${user.email}`);
      } catch (error) {
        console.log(`⚠️  Failed to update password for: ${user.email}`);
      }
    }
    
    console.log('🎉 Password setup completed!');
    console.log('');
    console.log('🔑 Login with any of these users:');
    for (const user of users) {
      console.log(`   ${user.email} / tempPassword123`);
    }
    console.log('');
    console.log('⚠️  Important: Users should change their passwords after first login!');
    
  } catch (error) {
    console.error('❌ Password setup failed:', error);
  }
}

addPasswords();