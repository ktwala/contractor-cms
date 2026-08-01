import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command, CopyObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { IStorageProvider, StorageMetadata, UploadOptions, DownloadOptions, ListOptions, StorageObject, UploadResult, DownloadResult } from './IStorageProvider';
import { S3Config } from '../../config/storage';
import { Logger } from '@nestjs/common';
import { EncryptionService } from './EncryptionService';

/**
 * AWS S3 Storage Provider
 * Fully compatible with AWS S3 and S3-compatible services
 */
export class S3Provider implements IStorageProvider {
  private client: S3Client;
  private config: S3Config;
  private logger: Logger;
  private encryption?: EncryptionService;
  private initialized: boolean = false;

  constructor(config: S3Config, encryptionService?: EncryptionService) {
    this.config = config;
    this.logger = new Logger('S3Provider');
    this.encryption = encryptionService;

    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: !!config.endpoint, // Use path-style for custom endpoints
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.client.send(new ListObjectsV2Command({
        Bucket: this.config.bucket,
        MaxKeys: 1,
      }));

      this.initialized = true;
      this.logger.log(`S3 storage initialized: ${this.config.bucket}`);
    } catch (error) {
      this.logger.error('Failed to initialize S3 storage', error);
      throw new Error(`S3 initialization failed: ${error}`);
    }
  }

  async upload(key: string, data: Buffer | string, options?: UploadOptions): Promise<UploadResult> {
    let uploadData = Buffer.isBuffer(data) ? data : Buffer.from(data);

    if (options?.encrypt && this.encryption) {
      uploadData = await this.encryption.encrypt(uploadData);
    }

    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      Body: uploadData,
      ContentType: options?.contentType,
      Metadata: options?.metadata,
      ServerSideEncryption: 'AES256',
      Tagging: options?.tags ? this.formatTags(options.tags) : undefined,
    });

    const response = await this.client.send(command);

    this.logger.log(`File uploaded to S3: ${key}`);

    return {
      key,
      etag: response.ETag,
      versionId: response.VersionId,
      location: `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${key}`,
    };
  }

  async download(key: string, options?: DownloadOptions): Promise<DownloadResult> {
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    });

    const response = await this.client.send(command);

    if (!response.Body) {
      throw new Error('No data received from S3');
    }

    let data = await this.streamToBuffer(response.Body);

    if (options?.decrypt && this.encryption) {
      data = await this.encryption.decrypt(data);
    }

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
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    }));

    this.logger.log(`File deleted from S3: ${key}`);
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
    const response = await this.client.send(new HeadObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    }));

    return {
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      lastModified: response.LastModified,
      etag: response.ETag,
      ...response.Metadata,
    };
  }

  async list(options?: ListOptions): Promise<StorageObject[]> {
    const response = await this.client.send(new ListObjectsV2Command({
      Bucket: this.config.bucket,
      Prefix: options?.prefix,
      MaxKeys: options?.maxKeys || 1000,
      StartAfter: options?.startAfter,
    }));

    return (response.Contents || []).map(obj => ({
      key: obj.Key!,
      size: obj.Size || 0,
      lastModified: obj.LastModified || new Date(),
      etag: obj.ETag,
    }));
  }

  async copy(sourceKey: string, destinationKey: string): Promise<UploadResult> {
    const response = await this.client.send(new CopyObjectCommand({
      Bucket: this.config.bucket,
      CopySource: `${this.config.bucket}/${sourceKey}`,
      Key: destinationKey,
    }));

    return {
      key: destinationKey,
      etag: response.CopyObjectResult?.ETag,
    };
  }

  async move(sourceKey: string, destinationKey: string): Promise<UploadResult> {
    const result = await this.copy(sourceKey, destinationKey);
    await this.delete(sourceKey);
    return result;
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    });

    return await getSignedUrl(this.client, command, { expiresIn });
  }

  getProviderName(): string {
    return 'AWS S3';
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
        message: `S3 health check failed: ${error.message}`,
      };
    }
  }

  private async streamToBuffer(stream: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: any[] = [];
      stream.on('data', (chunk: any) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  private formatTags(tags: Record<string, string>): string {
    return Object.entries(tags)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
  }
}
