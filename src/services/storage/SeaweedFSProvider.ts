import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command, CopyObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { IStorageProvider, StorageMetadata, UploadOptions, DownloadOptions, ListOptions, StorageObject, UploadResult, DownloadResult } from './IStorageProvider';
import { SeaweedFSConfig } from '../../config/storage';
import { Logger } from '@nestjs/common';
import { EncryptionService } from './EncryptionService';

/**
 * SeaweedFS Storage Provider
 * Uses S3-compatible API to interact with SeaweedFS
 */
export class SeaweedFSProvider implements IStorageProvider {
  private client: S3Client;
  private config: SeaweedFSConfig;
  private logger: Logger;
  private encryption?: EncryptionService;
  private initialized: boolean = false;

  constructor(config: SeaweedFSConfig, encryptionService?: EncryptionService) {
    this.config = config;
    this.logger = new Logger('SeaweedFSProvider');
    this.encryption = encryptionService;

    // Initialize S3 client for SeaweedFS
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region || 'us-east-1', // SeaweedFS doesn't care about region
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
      forcePathStyle: true, // Required for SeaweedFS S3 compatibility
      tls: config.useSSL !== false,
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Test connection by listing objects
      await this.client.send(new ListObjectsV2Command({
        Bucket: this.config.bucket,
        MaxKeys: 1,
      }));

      this.initialized = true;
      this.logger.log(`SeaweedFS storage initialized: ${this.config.endpoint}`);
    } catch (error) {
      this.logger.error('Failed to initialize SeaweedFS storage', error);
      throw new Error(`SeaweedFS initialization failed: ${error}`);
    }
  }

  async upload(key: string, data: Buffer | string, options?: UploadOptions): Promise<UploadResult> {
    try {
      let uploadData = Buffer.isBuffer(data) ? data : Buffer.from(data);

      // Encrypt if requested
      if (options?.encrypt && this.encryption) {
        uploadData = await this.encryption.encrypt(uploadData);
      }

      const command = new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: uploadData,
        ContentType: options?.contentType || 'application/octet-stream',
        Metadata: options?.metadata,
        ServerSideEncryption: 'AES256', // SeaweedFS supports server-side encryption
        Tagging: options?.tags ? this.formatTags(options.tags) : undefined,
      });

      const response = await this.client.send(command);

      this.logger.log(`File uploaded to SeaweedFS: ${key}`);

      return {
        key,
        etag: response.ETag,
        versionId: response.VersionId,
        location: `${this.config.endpoint}/${this.config.bucket}/${key}`,
      };
    } catch (error) {
      this.logger.error(`Failed to upload file to SeaweedFS: ${key}`, error);
      throw error;
    }
  }

  async download(key: string, options?: DownloadOptions): Promise<DownloadResult> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        throw new Error('No data received from SeaweedFS');
      }

      let data = await this.streamToBuffer(response.Body);

      // Decrypt if requested
      if (options?.decrypt && this.encryption) {
        data = await this.encryption.decrypt(data);
      }

      this.logger.log(`File downloaded from SeaweedFS: ${key}`);

      return {
        data,
        metadata: {
          contentType: response.ContentType,
          contentLength: response.ContentLength,
          lastModified: response.LastModified,
          etag: response.ETag,
          ...response.Metadata,
        },
        contentType: response.ContentType,
      };
    } catch (error) {
      this.logger.error(`Failed to download file from SeaweedFS: ${key}`, error);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      });

      await this.client.send(command);

      this.logger.log(`File deleted from SeaweedFS: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete file from SeaweedFS: ${key}`, error);
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.getMetadata(key);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  async getMetadata(key: string): Promise<StorageMetadata> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      });

      const response = await this.client.send(command);

      return {
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        lastModified: response.LastModified,
        etag: response.ETag,
        ...response.Metadata,
      };
    } catch (error) {
      this.logger.error(`Failed to get metadata from SeaweedFS: ${key}`, error);
      throw error;
    }
  }

  async list(options?: ListOptions): Promise<StorageObject[]> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.config.bucket,
        Prefix: options?.prefix,
        MaxKeys: options?.maxKeys || 1000,
        StartAfter: options?.startAfter,
      });

      const response = await this.client.send(command);

      const objects: StorageObject[] = (response.Contents || []).map(obj => ({
        key: obj.Key!,
        size: obj.Size || 0,
        lastModified: obj.LastModified || new Date(),
        etag: obj.ETag,
      }));

      this.logger.log(`Listed ${objects.length} objects from SeaweedFS`);

      return objects;
    } catch (error) {
      this.logger.error('Failed to list objects from SeaweedFS', error);
      throw error;
    }
  }

  async copy(sourceKey: string, destinationKey: string): Promise<UploadResult> {
    try {
      const command = new CopyObjectCommand({
        Bucket: this.config.bucket,
        CopySource: `${this.config.bucket}/${sourceKey}`,
        Key: destinationKey,
      });

      const response = await this.client.send(command);

      this.logger.log(`File copied in SeaweedFS: ${sourceKey} -> ${destinationKey}`);

      return {
        key: destinationKey,
        etag: response.CopyObjectResult?.ETag,
        location: `${this.config.endpoint}/${this.config.bucket}/${destinationKey}`,
      };
    } catch (error) {
      this.logger.error(`Failed to copy file in SeaweedFS: ${sourceKey} -> ${destinationKey}`, error);
      throw error;
    }
  }

  async move(sourceKey: string, destinationKey: string): Promise<UploadResult> {
    try {
      // Copy then delete
      const result = await this.copy(sourceKey, destinationKey);
      await this.delete(sourceKey);

      this.logger.log(`File moved in SeaweedFS: ${sourceKey} -> ${destinationKey}`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to move file in SeaweedFS: ${sourceKey} -> ${destinationKey}`, error);
      throw error;
    }
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      });

      const url = await getSignedUrl(this.client, command, { expiresIn });

      this.logger.log(`Generated signed URL for SeaweedFS: ${key}`);

      return url;
    } catch (error) {
      this.logger.error(`Failed to generate signed URL for SeaweedFS: ${key}`, error);
      throw error;
    }
  }

  getProviderName(): string {
    return 'SeaweedFS';
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      await this.client.send(new ListObjectsV2Command({
        Bucket: this.config.bucket,
        MaxKeys: 1,
      }));

      return { healthy: true };
    } catch (error: any) {
      return {
        healthy: false,
        message: `SeaweedFS health check failed: ${error.message}`,
      };
    }
  }

  /**
   * Helper: Convert stream to buffer
   */
  private async streamToBuffer(stream: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: any[] = [];
      stream.on('data', (chunk: any) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  /**
   * Helper: Format tags for S3 API
   */
  private formatTags(tags: Record<string, string>): string {
    return Object.entries(tags)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
  }
}
