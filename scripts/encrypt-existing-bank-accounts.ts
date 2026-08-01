#!/usr/bin/env ts-node
/**
 * Migration Script: Encrypt Existing Bank Account Numbers
 *
 * This script encrypts all plaintext bank account numbers in the database.
 * Run this ONCE after deploying the encryption feature.
 *
 * Usage:
 *   npm run db:encrypt-accounts
 *
 * Prerequisites:
 *   - ENCRYPTION_MASTER_KEY must be set in environment
 *   - Database must be accessible
 *   - Backup database before running!
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

// Encryption configuration (matching CryptoService)
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Derive encryption key from master key
 */
function deriveEncryptionKey(): Buffer {
  const masterKey = process.env.ENCRYPTION_MASTER_KEY;
  const salt = process.env.ENCRYPTION_SALT || 'payroll-platform-salt-v1';

  if (!masterKey) {
    throw new Error('ENCRYPTION_MASTER_KEY environment variable not set');
  }

  if (masterKey.length < 32) {
    throw new Error('ENCRYPTION_MASTER_KEY must be at least 32 characters');
  }

  return crypto.pbkdf2Sync(masterKey, salt, 100000, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt plaintext using AES-256-GCM
 */
function encrypt(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Check if a value is already encrypted
 */
function isEncrypted(value: string): boolean {
  if (!value) return false;

  const parts = value.split(':');
  if (parts.length !== 3) return false;

  try {
    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');

    return iv.length === IV_LENGTH && authTag.length === AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
}

async function main() {
  console.log('🔐 Bank Account Encryption Migration');
  console.log('=====================================\n');

  // Derive encryption key
  console.log('📝 Deriving encryption key...');
  const encryptionKey = deriveEncryptionKey();
  console.log('✅ Encryption key derived successfully\n');

  // Fetch all bank accounts
  console.log('📊 Fetching bank accounts from database...');
  const bankAccounts = await prisma.bankAccount.findMany({
    select: {
      id: true,
      accountNumberEnc: true,
      maskedAccountNumber: true,
      employeeId: true,
    },
  });

  console.log(`✅ Found ${bankAccounts.length} bank account records\n`);

  if (bankAccounts.length === 0) {
    console.log('✨ No bank accounts to encrypt. Exiting.');
    return;
  }

  // Check encryption status
  let alreadyEncrypted = 0;
  let needsEncryption = 0;

  for (const account of bankAccounts) {
    if (isEncrypted(account.accountNumberEnc)) {
      alreadyEncrypted++;
    } else {
      needsEncryption++;
    }
  }

  console.log(`📈 Encryption Status:`);
  console.log(`   Already encrypted: ${alreadyEncrypted}`);
  console.log(`   Needs encryption:  ${needsEncryption}\n`);

  if (needsEncryption === 0) {
    console.log('✨ All bank accounts are already encrypted. Exiting.');
    return;
  }

  // Confirm before proceeding
  console.log('⚠️  WARNING: This will modify bank account data in the database.');
  console.log('⚠️  Make sure you have a backup before proceeding!\n');

  // In production, you might want to add a confirmation prompt here
  // For now, we'll proceed automatically

  console.log('🔄 Starting encryption process...\n');

  let encryptedCount = 0;
  let errorCount = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (const account of bankAccounts) {
    // Skip if already encrypted
    if (isEncrypted(account.accountNumberEnc)) {
      continue;
    }

    try {
      // Encrypt the plaintext account number
      const encryptedAccountNumber = encrypt(account.accountNumberEnc, encryptionKey);

      // Update the database
      await prisma.bankAccount.update({
        where: { id: account.id },
        data: {
          accountNumberEnc: encryptedAccountNumber,
        },
      });

      encryptedCount++;

      if (encryptedCount % 10 === 0) {
        console.log(`   Encrypted ${encryptedCount}/${needsEncryption} accounts...`);
      }
    } catch (error) {
      errorCount++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({ id: account.id, error: errorMessage });

      console.error(`   ❌ Error encrypting account ${account.id}: ${errorMessage}`);
    }
  }

  console.log('\n=====================================');
  console.log('📊 Migration Summary:');
  console.log(`   Successfully encrypted: ${encryptedCount}`);
  console.log(`   Errors:                 ${errorCount}`);
  console.log('=====================================\n');

  if (errorCount > 0) {
    console.log('❌ Errors encountered during migration:');
    errors.forEach((err) => {
      console.log(`   - Account ${err.id}: ${err.error}`);
    });
    console.log('');
    process.exit(1);
  }

  console.log('✅ Migration completed successfully!');
  console.log('🎉 All bank accounts have been encrypted.\n');
}

main()
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
