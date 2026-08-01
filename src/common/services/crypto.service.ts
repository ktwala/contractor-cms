import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * CryptoService - Field-level encryption for sensitive data
 *
 * Uses AES-256-GCM for authenticated encryption of sensitive fields like:
 * - Bank account numbers
 * - National ID numbers
 * - Tax identification numbers
 *
 * Format: {iv}:{authTag}:{ciphertext} (all base64 encoded)
 */
@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 16; // 128 bits
  private readonly authTagLength = 16; // 128 bits
  private readonly keyLength = 32; // 256 bits
  private readonly saltLength = 32; // 256 bits
  private encryptionKey: Buffer | null = null;

  constructor(private readonly configService: ConfigService) {
    this.initializeEncryptionKey();
  }

  /**
   * Initialize encryption key from environment
   */
  private initializeEncryptionKey(): void {
    const masterKey = this.configService.get<string>('ENCRYPTION_MASTER_KEY');

    if (!masterKey) {
      this.logger.warn(
        'ENCRYPTION_MASTER_KEY not set. Encryption will be disabled. ' +
        'This is CRITICAL for production environments!',
      );
      return;
    }

    if (masterKey.length < 32) {
      throw new Error(
        'ENCRYPTION_MASTER_KEY must be at least 32 characters long',
      );
    }

    // Derive encryption key from master key using PBKDF2
    const salt = this.configService.get<string>('ENCRYPTION_SALT') || 'payroll-platform-salt-v1';

    this.encryptionKey = crypto.pbkdf2Sync(
      masterKey,
      salt,
      100000, // iterations
      this.keyLength,
      'sha256',
    );

    this.logger.log('Encryption service initialized successfully');
  }

  /**
   * Encrypt a plaintext string
   *
   * @param plaintext - The data to encrypt
   * @returns Encrypted string in format: {iv}:{authTag}:{ciphertext}
   * @throws Error if encryption key is not initialized or encryption fails
   */
  encrypt(plaintext: string): string {
    if (!this.encryptionKey) {
      throw new Error(
        'Encryption key not initialized. Set ENCRYPTION_MASTER_KEY environment variable.',
      );
    }

    if (!plaintext || plaintext.trim() === '') {
      throw new Error('Cannot encrypt empty or null value');
    }

    try {
      // Generate random IV for this encryption
      const iv = crypto.randomBytes(this.ivLength);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

      // Encrypt the data
      let encrypted = cipher.update(plaintext, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      // Return format: {iv}:{authTag}:{ciphertext}
      return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
    } catch (error) {
      this.logger.error(`Encryption failed: ${error.message}`, error.stack);
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt an encrypted string
   *
   * @param ciphertext - The encrypted data in format: {iv}:{authTag}:{ciphertext}
   * @returns Decrypted plaintext string
   * @throws Error if decryption fails or format is invalid
   */
  decrypt(ciphertext: string): string {
    if (!this.encryptionKey) {
      throw new Error(
        'Encryption key not initialized. Set ENCRYPTION_MASTER_KEY environment variable.',
      );
    }

    if (!ciphertext || ciphertext.trim() === '') {
      throw new Error('Cannot decrypt empty or null value');
    }

    try {
      // Parse the encrypted format
      const parts = ciphertext.split(':');

      if (parts.length !== 3) {
        throw new Error(
          `Invalid encrypted format. Expected 3 parts, got ${parts.length}`,
        );
      }

      const [ivBase64, authTagBase64, encryptedData] = parts;

      // Convert from base64
      const iv = Buffer.from(ivBase64, 'base64');
      const authTag = Buffer.from(authTagBase64, 'base64');

      // Validate IV and authTag lengths
      if (iv.length !== this.ivLength) {
        throw new Error(`Invalid IV length: ${iv.length}`);
      }

      if (authTag.length !== this.authTagLength) {
        throw new Error(`Invalid auth tag length: ${authTag.length}`);
      }

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      // Decrypt the data
      let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error(`Decryption failed: ${error.message}`);
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Check if a string is encrypted (matches our format)
   *
   * @param value - String to check
   * @returns true if the string appears to be encrypted
   */
  isEncrypted(value: string): boolean {
    if (!value) return false;

    const parts = value.split(':');
    if (parts.length !== 3) return false;

    // Basic validation: check if parts are base64
    try {
      const iv = Buffer.from(parts[0], 'base64');
      const authTag = Buffer.from(parts[1], 'base64');

      return iv.length === this.ivLength && authTag.length === this.authTagLength;
    } catch {
      return false;
    }
  }

  /**
   * Re-encrypt data with a new key (for key rotation)
   *
   * @param ciphertext - Currently encrypted data
   * @param newKey - New encryption key (32 bytes)
   * @returns Re-encrypted data
   */
  reEncrypt(ciphertext: string, newKey: Buffer): string {
    if (newKey.length !== this.keyLength) {
      throw new Error(`New key must be ${this.keyLength} bytes`);
    }

    // Decrypt with current key
    const plaintext = this.decrypt(ciphertext);

    // Store current key
    const oldKey = this.encryptionKey;

    // Temporarily use new key
    this.encryptionKey = newKey;

    try {
      // Encrypt with new key
      const newCiphertext = this.encrypt(plaintext);
      return newCiphertext;
    } finally {
      // Restore old key
      this.encryptionKey = oldKey;
    }
  }

  /**
   * Get encryption status
   *
   * @returns Information about encryption configuration
   */
  getEncryptionStatus(): {
    isEnabled: boolean;
    algorithm: string;
    keyLength: number;
  } {
    return {
      isEnabled: this.encryptionKey !== null,
      algorithm: this.algorithm,
      keyLength: this.keyLength * 8, // bits
    };
  }
}
