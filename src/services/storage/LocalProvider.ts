import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { IStorageProvider, StorageMetadata, UploadOptions, DownloadOptions, ListOptions, StorageObject, UploadResult, DownloadResult } from './IStorageProvider';
import { LocalConfig } from '../../config/storage';
import { Logger } from '@nestjs/common';
import { EncryptionService } from './EncryptionService';

/**
 * Local Filesystem Storage Provider
 * Stores files on the local filesystem
 */
export class LocalProvider implements IStorageProvider {
  private config: LocalConfig;
  private logger: Logger;
  private encryption?: EncryptionService;
  private initialized: boolean = false;

  constructor(config: LocalConfig, encryptionService?: EncryptionService) {
    this.config = config;
    this.logger = new Logger('LocalProvider');
    this.encryption = encryptionService;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      if (this.config.createIfNotExists) {
        await fs.mkdir(this.config.basePath, { recursive: true });
      }

      // Test write access
      const testFile = path.join(this.config.basePath, '.test');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);

      this.initialized = true;
      this.logger.log(`Local storage initialized: ${this.config.basePath}`);
    } catch (error) {
      this.logger.error('Failed to initialize local storage', error);
      throw new Error(`Local storage initialization failed: ${error}`);
    }
  }

  async upload(key: string, data: Buffer | string, options?: UploadOptions): Promise<UploadResult> {
    try {
      let uploadData = Buffer.isBuffer(data) ? data : Buffer.from(data);

      if (options?.encrypt && this.encryption) {
        uploadData = await this.encryption.encrypt(uploadData);
      }

      const filePath = this.getFullPath(key);
      const dirPath = path.dirname(filePath);

      // Create directory if it doesn't exist
      await fs.mkdir(dirPath, { recursive: true });

      // Write file
      await fs.writeFile(filePath, uploadData);

      // Write metadata
      if (options?.metadata || options?.tags) {
        await this.writeMetadata(key, {
          ...options.metadata,
          ...options.tags,
          contentType: options.contentType,
          uploadedAt: new Date().toISOString(),
        });
      }

      // Calculate etag (MD5 hash)
      const etag = crypto.createHash('md5').update(uploadData).digest('hex');

      this.logger.log(`File uploaded to local storage: ${key}`);

      return {
        key,
        etag,
        location: filePath,
      };
    } catch (error) {
      this.logger.error(`Failed to upload file to local storage: ${key}`, error);
      throw error;
    }
  }

  async download(key: string, options?: DownloadOptions): Promise<DownloadResult> {
    try {
      const filePath = this.getFullPath(key);
      let data = await fs.readFile(filePath);

      if (options?.decrypt && this.encryption) {
        data = Buffer.from(await this.encryption.decrypt(data));
      }

      const metadata = await this.readMetadata(key);
      const stats = await fs.stat(filePath);

      this.logger.log(`File downloaded from local storage: ${key}`);

      return {
        data,
        metadata: {
          ...metadata,
          contentLength: stats.size,
          lastModified: stats.mtime,
        },
        contentType: metadata.contentType,
      };
    } catch (error) {
      this.logger.error(`Failed to download file from local storage: ${key}`, error);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const filePath = this.getFullPath(key);
      await fs.unlink(filePath);

      // Delete metadata file
      const metadataPath = this.getMetadataPath(key);
      try {
        await fs.unlink(metadataPath);
      } catch (err) {
        // Metadata file might not exist
      }

      this.logger.log(`File deleted from local storage: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete file from local storage: ${key}`, error);
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = this.getFullPath(key);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(key: string): Promise<StorageMetadata> {
    try {
      const filePath = this.getFullPath(key);
      const stats = await fs.stat(filePath);
      const metadata = await this.readMetadata(key);

      return {
        ...metadata,
        contentLength: stats.size,
        lastModified: stats.mtime,
      };
    } catch (error) {
      this.logger.error(`Failed to get metadata from local storage: ${key}`, error);
      throw error;
    }
  }

  async list(options?: ListOptions): Promise<StorageObject[]> {
    try {
      const prefix = options?.prefix || '';
      const searchPath = path.join(this.config.basePath, prefix);
      const objects: StorageObject[] = [];

      const walk = async (dir: string) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            await walk(fullPath);
          } else if (!entry.name.endsWith('.metadata.json')) {
            const key = path.relative(this.config.basePath, fullPath).replace(/\\/g, '/');
            const stats = await fs.stat(fullPath);

            objects.push({
              key,
              size: stats.size,
              lastModified: stats.mtime,
            });

            if (options?.maxKeys && objects.length >= options.maxKeys) {
              break;
            }
          }
        }
      };

      await walk(searchPath);

      this.logger.log(`Listed ${objects.length} objects from local storage`);

      return objects;
    } catch (error) {
      this.logger.error('Failed to list objects from local storage', error);
      throw error;
    }
  }

  async copy(sourceKey: string, destinationKey: string): Promise<UploadResult> {
    try {
      const sourcePath = this.getFullPath(sourceKey);
      const destPath = this.getFullPath(destinationKey);
      const destDir = path.dirname(destPath);

      await fs.mkdir(destDir, { recursive: true });
      await fs.copyFile(sourcePath, destPath);

      // Copy metadata
      try {
        const sourceMetadataPath = this.getMetadataPath(sourceKey);
        const destMetadataPath = this.getMetadataPath(destinationKey);
        await fs.copyFile(sourceMetadataPath, destMetadataPath);
      } catch (err) {
        // Metadata might not exist
      }

      const data = await fs.readFile(destPath);
      const etag = crypto.createHash('md5').update(data).digest('hex');

      this.logger.log(`File copied in local storage: ${sourceKey} -> ${destinationKey}`);

      return {
        key: destinationKey,
        etag,
        location: destPath,
      };
    } catch (error) {
      this.logger.error(`Failed to copy file in local storage: ${sourceKey} -> ${destinationKey}`, error);
      throw error;
    }
  }

  async move(sourceKey: string, destinationKey: string): Promise<UploadResult> {
    try {
      const result = await this.copy(sourceKey, destinationKey);
      await this.delete(sourceKey);

      this.logger.log(`File moved in local storage: ${sourceKey} -> ${destinationKey}`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to move file in local storage: ${sourceKey} -> ${destinationKey}`, error);
      throw error;
    }
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    // For local storage, we'll just return a file:// URL
    // In a real implementation, you might use a local web server with signed tokens
    const filePath = this.getFullPath(key);
    return `file://${filePath}`;
  }

  getProviderName(): string {
    return 'Local Filesystem';
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      const testFile = path.join(this.config.basePath, '.healthcheck');
      await fs.writeFile(testFile, 'ok');
      await fs.unlink(testFile);

      return { healthy: true };
    } catch (error: any) {
      return {
        healthy: false,
        message: `Local storage health check failed: ${error.message}`,
      };
    }
  }

  private getFullPath(key: string): string {
    return path.join(this.config.basePath, key);
  }

  private getMetadataPath(key: string): string {
    return this.getFullPath(key) + '.metadata.json';
  }

  private async writeMetadata(key: string, metadata: Record<string, any>): Promise<void> {
    const metadataPath = this.getMetadataPath(key);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  private async readMetadata(key: string): Promise<Record<string, any>> {
    try {
      const metadataPath = this.getMetadataPath(key);
      const data = await fs.readFile(metadataPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }
}
