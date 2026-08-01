import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { StorageProvider } from '../dto/documents.dto';

export interface StoredFile {
  fileName: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  storagePath: string;
  storageProvider: StorageProvider;
  checksumSha256: string;
}

export interface UploadOptions {
  organizationId: string;
  employeeId: string;
  documentTypeCode: string;
  encrypt?: boolean;
}

export interface DownloadResult {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}

@Injectable()
export class DocumentStorageService {
  private readonly logger = new Logger(DocumentStorageService.name);
  private readonly storageProvider: StorageProvider;
  private readonly localStoragePath: string;
  private readonly maxFileSizeBytes: number;

  constructor(private readonly configService: ConfigService) {
    this.storageProvider =
      (this.configService.get<string>('DOCUMENT_STORAGE_PROVIDER') as StorageProvider) ||
      StorageProvider.LOCAL;
    this.localStoragePath =
      this.configService.get<string>('DOCUMENT_STORAGE_PATH') || './storage/documents';
    this.maxFileSizeBytes =
      (this.configService.get<number>('DOCUMENT_MAX_FILE_SIZE_MB') || 50) * 1024 * 1024;
  }

  /**
   * Upload a file to storage
   */
  async uploadFile(
    file: Express.Multer.File,
    options: UploadOptions,
  ): Promise<StoredFile> {
    // Validate file size
    if (file.size > this.maxFileSizeBytes) {
      throw new BadRequestException(
        `File size exceeds maximum allowed (${this.maxFileSizeBytes / (1024 * 1024)}MB)`,
      );
    }

    // Generate unique filename
    const fileExtension = path.extname(file.originalname);
    const uniqueId = crypto.randomUUID();
    const fileName = `${uniqueId}${fileExtension}`;

    // Calculate checksum
    const checksumSha256 = this.calculateChecksum(file.buffer);

    // Build storage path
    const storagePath = this.buildStoragePath(options, fileName);

    try {
      switch (this.storageProvider) {
        case StorageProvider.LOCAL:
          await this.uploadToLocal(file.buffer, storagePath);
          break;
        case StorageProvider.S3:
          await this.uploadToS3(file.buffer, storagePath, file.mimetype);
          break;
        case StorageProvider.AZURE:
          await this.uploadToAzure(file.buffer, storagePath, file.mimetype);
          break;
        default:
          await this.uploadToLocal(file.buffer, storagePath);
      }

      this.logger.log(`File uploaded: ${storagePath}`);

      return {
        fileName,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
        storagePath,
        storageProvider: this.storageProvider,
        checksumSha256,
      };
    } catch (error) {
      this.logger.error(`Failed to upload file: ${error.message}`);
      throw new InternalServerErrorException('Failed to upload file');
    }
  }

  /**
   * Download a file from storage
   */
  async downloadFile(storagePath: string, storageProvider?: StorageProvider): Promise<Buffer> {
    const provider = storageProvider || this.storageProvider;

    try {
      switch (provider) {
        case StorageProvider.LOCAL:
          return await this.downloadFromLocal(storagePath);
        case StorageProvider.S3:
          return await this.downloadFromS3(storagePath);
        case StorageProvider.AZURE:
          return await this.downloadFromAzure(storagePath);
        default:
          return await this.downloadFromLocal(storagePath);
      }
    } catch (error) {
      this.logger.error(`Failed to download file: ${error.message}`);
      throw new InternalServerErrorException('Failed to download file');
    }
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(storagePath: string, storageProvider?: StorageProvider): Promise<void> {
    const provider = storageProvider || this.storageProvider;

    try {
      switch (provider) {
        case StorageProvider.LOCAL:
          await this.deleteFromLocal(storagePath);
          break;
        case StorageProvider.S3:
          await this.deleteFromS3(storagePath);
          break;
        case StorageProvider.AZURE:
          await this.deleteFromAzure(storagePath);
          break;
        default:
          await this.deleteFromLocal(storagePath);
      }

      this.logger.log(`File deleted: ${storagePath}`);
    } catch (error) {
      this.logger.error(`Failed to delete file: ${error.message}`);
      // Don't throw - deletion failure shouldn't block other operations
    }
  }

  /**
   * Generate a pre-signed URL for direct download
   */
  async generateDownloadUrl(
    storagePath: string,
    expiresInSeconds: number = 3600,
    storageProvider?: StorageProvider,
  ): Promise<string> {
    const provider = storageProvider || this.storageProvider;

    switch (provider) {
      case StorageProvider.LOCAL:
        // For local storage, return an internal endpoint URL
        // The actual file serving is handled by the controller
        return `/api/documents/download/${encodeURIComponent(storagePath)}`;
      case StorageProvider.S3:
        return await this.generateS3PresignedUrl(storagePath, expiresInSeconds);
      case StorageProvider.AZURE:
        return await this.generateAzureSasUrl(storagePath, expiresInSeconds);
      default:
        return `/api/documents/download/${encodeURIComponent(storagePath)}`;
    }
  }

  /**
   * Check if a file exists
   */
  async fileExists(storagePath: string, storageProvider?: StorageProvider): Promise<boolean> {
    const provider = storageProvider || this.storageProvider;

    try {
      switch (provider) {
        case StorageProvider.LOCAL:
          const fullPath = path.join(this.localStoragePath, storagePath);
          await fs.access(fullPath);
          return true;
        case StorageProvider.S3:
          return await this.checkS3FileExists(storagePath);
        case StorageProvider.AZURE:
          return await this.checkAzureFileExists(storagePath);
        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * Copy a file (for versioning)
   */
  async copyFile(
    sourcePath: string,
    destinationPath: string,
    storageProvider?: StorageProvider,
  ): Promise<void> {
    const provider = storageProvider || this.storageProvider;

    try {
      switch (provider) {
        case StorageProvider.LOCAL:
          const sourceFullPath = path.join(this.localStoragePath, sourcePath);
          const destFullPath = path.join(this.localStoragePath, destinationPath);
          await fs.mkdir(path.dirname(destFullPath), { recursive: true });
          await fs.copyFile(sourceFullPath, destFullPath);
          break;
        case StorageProvider.S3:
          await this.copyS3File(sourcePath, destinationPath);
          break;
        case StorageProvider.AZURE:
          await this.copyAzureFile(sourcePath, destinationPath);
          break;
      }
    } catch (error) {
      this.logger.error(`Failed to copy file: ${error.message}`);
      throw new InternalServerErrorException('Failed to copy file');
    }
  }

  // ============================================================================
  // LOCAL STORAGE IMPLEMENTATION
  // ============================================================================

  private async uploadToLocal(buffer: Buffer, storagePath: string): Promise<void> {
    const fullPath = path.join(this.localStoragePath, storagePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);
  }

  private async downloadFromLocal(storagePath: string): Promise<Buffer> {
    const fullPath = path.join(this.localStoragePath, storagePath);
    return await fs.readFile(fullPath);
  }

  private async deleteFromLocal(storagePath: string): Promise<void> {
    const fullPath = path.join(this.localStoragePath, storagePath);
    await fs.unlink(fullPath);
  }

  // ============================================================================
  // S3 STORAGE IMPLEMENTATION (Stub - implement with AWS SDK)
  // ============================================================================

  private async uploadToS3(
    buffer: Buffer,
    storagePath: string,
    mimeType: string,
  ): Promise<void> {
    // Implementation would use @aws-sdk/client-s3
    // const s3Client = new S3Client({ region: this.configService.get('AWS_REGION') });
    // await s3Client.send(new PutObjectCommand({
    //   Bucket: this.configService.get('AWS_S3_BUCKET'),
    //   Key: storagePath,
    //   Body: buffer,
    //   ContentType: mimeType,
    // }));
    throw new Error('S3 storage not implemented');
  }

  private async downloadFromS3(storagePath: string): Promise<Buffer> {
    throw new Error('S3 storage not implemented');
  }

  private async deleteFromS3(storagePath: string): Promise<void> {
    throw new Error('S3 storage not implemented');
  }

  private async generateS3PresignedUrl(
    storagePath: string,
    expiresInSeconds: number,
  ): Promise<string> {
    throw new Error('S3 storage not implemented');
  }

  private async checkS3FileExists(storagePath: string): Promise<boolean> {
    throw new Error('S3 storage not implemented');
  }

  private async copyS3File(sourcePath: string, destinationPath: string): Promise<void> {
    throw new Error('S3 storage not implemented');
  }

  // ============================================================================
  // AZURE STORAGE IMPLEMENTATION (Stub - implement with Azure SDK)
  // ============================================================================

  private async uploadToAzure(
    buffer: Buffer,
    storagePath: string,
    mimeType: string,
  ): Promise<void> {
    // Implementation would use @azure/storage-blob
    throw new Error('Azure storage not implemented');
  }

  private async downloadFromAzure(storagePath: string): Promise<Buffer> {
    throw new Error('Azure storage not implemented');
  }

  private async deleteFromAzure(storagePath: string): Promise<void> {
    throw new Error('Azure storage not implemented');
  }

  private async generateAzureSasUrl(
    storagePath: string,
    expiresInSeconds: number,
  ): Promise<string> {
    throw new Error('Azure storage not implemented');
  }

  private async checkAzureFileExists(storagePath: string): Promise<boolean> {
    throw new Error('Azure storage not implemented');
  }

  private async copyAzureFile(sourcePath: string, destinationPath: string): Promise<void> {
    throw new Error('Azure storage not implemented');
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private buildStoragePath(options: UploadOptions, fileName: string): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    return path.join(
      options.organizationId,
      options.employeeId,
      options.documentTypeCode,
      `${year}`,
      `${month}`,
      fileName,
    );
  }

  private calculateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Validate file checksum
   */
  async validateChecksum(storagePath: string, expectedChecksum: string): Promise<boolean> {
    try {
      const buffer = await this.downloadFile(storagePath);
      const actualChecksum = this.calculateChecksum(buffer);
      return actualChecksum === expectedChecksum;
    } catch {
      return false;
    }
  }

  /**
   * Get file size from storage
   */
  async getFileSize(storagePath: string, storageProvider?: StorageProvider): Promise<number> {
    const provider = storageProvider || this.storageProvider;

    try {
      switch (provider) {
        case StorageProvider.LOCAL:
          const fullPath = path.join(this.localStoragePath, storagePath);
          const stats = await fs.stat(fullPath);
          return stats.size;
        default:
          return 0;
      }
    } catch {
      return 0;
    }
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
