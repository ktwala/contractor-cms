import { IStorageProvider, UploadOptions, DownloadOptions, ListOptions, StorageObject, UploadResult, DownloadResult, StorageMetadata } from './IStorageProvider';
import { SeaweedFSProvider } from './SeaweedFSProvider';
import { S3Provider } from './S3Provider';
import { LocalProvider } from './LocalProvider';
import { EncryptionService } from './EncryptionService';
import { storageConfig, StorageProvider as StorageProviderType } from '../../config/storage';
import { Logger } from '@nestjs/common';

/**
 * Unified Storage Service
 * Provides a single interface for all storage operations, automatically
 * selecting the configured provider (SeaweedFS, S3, Azure, or Local)
 */
export class StorageService {
  private static instance: StorageService;
  private provider: IStorageProvider;
  private logger: Logger;
  private encryption?: EncryptionService;

  private constructor() {
    this.logger = new Logger('StorageService');

    // Initialize encryption service if enabled
    if (storageConfig.encryption?.enabled) {
      this.encryption = new EncryptionService(storageConfig.encryption);
      this.logger.log('Storage encryption enabled');
    }

    // Create appropriate provider
    this.provider = this.createProvider(storageConfig.provider);
    this.logger.log(`Storage provider initialized: ${this.provider.getProviderName()}`);
  }

  /**
   * Get singleton instance
   */
  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * Initialize storage provider
   */
  async initialize(): Promise<void> {
    await this.provider.initialize();
    this.logger.log('Storage service initialized');
  }

  /**
   * Upload a file
   */
  async uploadFile(
    key: string,
    data: Buffer | string,
    options?: UploadOptions
  ): Promise<UploadResult> {
    // Auto-enable encryption for sensitive files
    const shouldEncrypt = options?.encrypt ?? this.shouldEncryptFile(key);

    return await this.provider.upload(key, data, {
      ...options,
      encrypt: shouldEncrypt,
    });
  }

  /**
   * Upload payment file (with automatic encryption and metadata)
   */
  async uploadPaymentFile(
    fileName: string,
    content: string | Buffer,
    metadata: {
      batchId: string;
      batchNumber: string;
      format: string;
      totalAmount: number;
      totalTransactions: number;
      checksum: string;
    }
  ): Promise<UploadResult> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const key = `payment-files/${year}/${month}/${fileName}`;

    return await this.uploadFile(key, content, {
      contentType: this.getContentType(fileName),
      encrypt: true, // Always encrypt payment files
      metadata: {
        batchId: metadata.batchId,
        batchNumber: metadata.batchNumber,
        format: metadata.format,
        totalAmount: metadata.totalAmount.toString(),
        totalTransactions: metadata.totalTransactions.toString(),
        checksum: metadata.checksum,
        uploadedAt: new Date().toISOString(),
      },
      tags: {
        type: 'payment-file',
        year: year.toString(),
        month: month,
        format: metadata.format,
      },
    });
  }

  /**
   * Download a file
   */
  async downloadFile(key: string, options?: DownloadOptions): Promise<DownloadResult> {
    // Auto-enable decryption for encrypted files
    const shouldDecrypt = options?.decrypt ?? this.shouldEncryptFile(key);

    return await this.provider.download(key, {
      ...options,
      decrypt: shouldDecrypt,
    });
  }

  /**
   * Download payment file
   */
  async downloadPaymentFile(key: string): Promise<DownloadResult> {
    return await this.downloadFile(key, { decrypt: true });
  }

  /**
   * Delete a file
   */
  async deleteFile(key: string): Promise<void> {
    await this.provider.delete(key);
  }

  /**
   * Check if file exists
   */
  async fileExists(key: string): Promise<boolean> {
    return await this.provider.exists(key);
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(key: string): Promise<StorageMetadata> {
    return await this.provider.getMetadata(key);
  }

  /**
   * List files
   */
  async listFiles(options?: ListOptions): Promise<StorageObject[]> {
    return await this.provider.list(options);
  }

  /**
   * List payment files for a specific year/month
   */
  async listPaymentFiles(year?: number, month?: number): Promise<StorageObject[]> {
    const y = year || new Date().getFullYear();
    const m = month ? String(month).padStart(2, '0') : '';

    const prefix = m
      ? `payment-files/${y}/${m}/`
      : `payment-files/${y}/`;

    return await this.listFiles({ prefix });
  }

  /**
   * Copy a file
   */
  async copyFile(sourceKey: string, destinationKey: string): Promise<UploadResult> {
    return await this.provider.copy(sourceKey, destinationKey);
  }

  /**
   * Move a file
   */
  async moveFile(sourceKey: string, destinationKey: string): Promise<UploadResult> {
    return await this.provider.move(sourceKey, destinationKey);
  }

  /**
   * Generate a signed URL for downloading
   */
  async getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    return await this.provider.getSignedUrl(key, expiresIn);
  }

  /**
   * Get provider name
   */
  getProviderName(): string {
    return this.provider.getProviderName();
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; provider: string; message?: string }> {
    const health = await this.provider.healthCheck();
    return {
      ...health,
      provider: this.provider.getProviderName(),
    };
  }

  /**
   * Archive old payment files (move to archive folder)
   */
  async archivePaymentFile(key: string): Promise<UploadResult> {
    const archiveKey = key.replace('payment-files/', 'payment-files/archive/');
    return await this.moveFile(key, archiveKey);
  }

  /**
   * Create provider based on configuration
   */
  private createProvider(providerType: StorageProviderType): IStorageProvider {
    switch (providerType) {
      case 'seaweedfs':
        if (!storageConfig.seaweedfs) {
          throw new Error('SeaweedFS configuration is missing');
        }
        return new SeaweedFSProvider(storageConfig.seaweedfs, this.encryption);

      case 's3':
        if (!storageConfig.s3) {
          throw new Error('S3 configuration is missing');
        }
        return new S3Provider(storageConfig.s3, this.encryption);

      case 'local':
        if (!storageConfig.local) {
          throw new Error('Local storage configuration is missing');
        }
        return new LocalProvider(storageConfig.local, this.encryption);

      case 'azure':
        throw new Error('Azure Blob Storage provider not yet implemented');

      default:
        throw new Error(`Unknown storage provider: ${providerType}`);
    }
  }

  /**
   * Determine if a file should be encrypted based on path/type
   */
  private shouldEncryptFile(key: string): boolean {
    // Always encrypt payment files
    if (key.includes('payment-files/')) return true;

    // Encrypt bank account data
    if (key.includes('bank-accounts/')) return true;

    // Encrypt sensitive documents
    if (key.includes('documents/')) return true;

    // Default: no encryption
    return false;
  }

  /**
   * Get content type based on file extension
   */
  private getContentType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();

    const contentTypes: Record<string, string> = {
      txt: 'text/plain',
      csv: 'text/csv',
      pdf: 'application/pdf',
      json: 'application/json',
      xml: 'application/xml',
      zip: 'application/zip',
    };

    return contentTypes[ext || ''] || 'application/octet-stream';
  }
}

// Export singleton instance
export const storageService = StorageService.getInstance();
