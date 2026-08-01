import * as crypto from 'crypto';
import { Logger } from '@nestjs/common';
import { EncryptionConfig } from '../../config/storage';

/**
 * Encryption Service for Storage
 * Provides client-side encryption for sensitive files
 */
export class EncryptionService {
  private config: EncryptionConfig;
  private logger: Logger;
  private key: Buffer;

  constructor(config: EncryptionConfig) {
    this.config = config;
    this.logger = new Logger('EncryptionService');

    // Decode base64 key to Buffer
    this.key = Buffer.from(config.key, 'base64');

    if (this.key.length !== 32) {
      throw new Error('Encryption key must be 256 bits (32 bytes)');
    }
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  async encrypt(data: Buffer): Promise<Buffer> {
    try {
      const algorithm = this.config.algorithm;
      const ivLength = this.config.ivLength || 16;

      // Generate random IV
      const iv = crypto.randomBytes(ivLength);

      // Create cipher
      const cipher = crypto.createCipheriv(algorithm, this.key, iv);

      // Encrypt data
      const encrypted = Buffer.concat([
        cipher.update(data),
        cipher.final(),
      ]);

      // For GCM, get auth tag
      let authTag: Buffer | undefined;
      if (algorithm === 'aes-256-gcm') {
        authTag = (cipher as any).getAuthTag();
      }

      // Format: [IV][AuthTag (if GCM)][Encrypted Data]
      const result = authTag
        ? Buffer.concat([iv, authTag, encrypted])
        : Buffer.concat([iv, encrypted]);

      this.logger.debug(`Data encrypted with ${algorithm}`);

      return result;
    } catch (error) {
      this.logger.error('Encryption failed', error);
      throw new Error(`Encryption failed: ${error}`);
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  async decrypt(encryptedData: Buffer): Promise<Buffer> {
    try {
      const algorithm = this.config.algorithm;
      const ivLength = this.config.ivLength || 16;

      // Extract IV
      const iv = encryptedData.slice(0, ivLength);
      let authTag: Buffer | undefined;
      let encrypted: Buffer;

      if (algorithm === 'aes-256-gcm') {
        // Extract auth tag (16 bytes for GCM)
        authTag = encryptedData.slice(ivLength, ivLength + 16);
        encrypted = encryptedData.slice(ivLength + 16);
      } else {
        encrypted = encryptedData.slice(ivLength);
      }

      // Create decipher
      const decipher = crypto.createDecipheriv(algorithm, this.key, iv);

      // Set auth tag for GCM
      if (authTag) {
        (decipher as any).setAuthTag(authTag);
      }

      // Decrypt data
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);

      this.logger.debug(`Data decrypted with ${algorithm}`);

      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed', error);
      throw new Error(`Decryption failed: ${error}`);
    }
  }

  /**
   * Generate a new encryption key (256-bit)
   */
  static generateKey(): string {
    const key = crypto.randomBytes(32);
    return key.toString('base64');
  }

  /**
   * Hash data using SHA-256
   */
  hash(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate HMAC for data integrity
   */
  generateHMAC(data: Buffer): string {
    return crypto.createHmac('sha256', this.key).update(data).digest('hex');
  }

  /**
   * Verify HMAC
   */
  verifyHMAC(data: Buffer, hmac: string): boolean {
    const computed = this.generateHMAC(data);
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hmac));
  }
}
