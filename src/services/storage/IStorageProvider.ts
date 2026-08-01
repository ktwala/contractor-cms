/**
 * Storage Provider Interface
 * Defines the contract that all storage providers must implement
 */

export interface StorageMetadata {
  contentType?: string;
  contentLength?: number;
  lastModified?: Date;
  etag?: string;
  [key: string]: any;
}

export interface UploadOptions {
  metadata?: Record<string, string>;
  contentType?: string;
  encrypt?: boolean;
  tags?: Record<string, string>;
}

export interface DownloadOptions {
  decrypt?: boolean;
}

export interface ListOptions {
  prefix?: string;
  maxKeys?: number;
  startAfter?: string;
}

export interface StorageObject {
  key: string;
  size: number;
  lastModified: Date;
  etag?: string;
  metadata?: StorageMetadata;
}

export interface UploadResult {
  key: string;
  etag?: string;
  versionId?: string;
  location?: string;
}

export interface DownloadResult {
  data: Buffer;
  metadata: StorageMetadata;
  contentType?: string;
}

/**
 * Storage Provider Interface
 */
export interface IStorageProvider {
  /**
   * Initialize the storage provider
   */
  initialize(): Promise<void>;

  /**
   * Upload a file to storage
   */
  upload(key: string, data: Buffer | string, options?: UploadOptions): Promise<UploadResult>;

  /**
   * Download a file from storage
   */
  download(key: string, options?: DownloadOptions): Promise<DownloadResult>;

  /**
   * Delete a file from storage
   */
  delete(key: string): Promise<void>;

  /**
   * Check if a file exists
   */
  exists(key: string): Promise<boolean>;

  /**
   * Get file metadata
   */
  getMetadata(key: string): Promise<StorageMetadata>;

  /**
   * List files in storage
   */
  list(options?: ListOptions): Promise<StorageObject[]>;

  /**
   * Copy a file within storage
   */
  copy(sourceKey: string, destinationKey: string): Promise<UploadResult>;

  /**
   * Move a file within storage
   */
  move(sourceKey: string, destinationKey: string): Promise<UploadResult>;

  /**
   * Generate a pre-signed URL for downloading
   */
  getSignedUrl(key: string, expiresIn: number): Promise<string>;

  /**
   * Get storage provider name
   */
  getProviderName(): string;

  /**
   * Get storage health status
   */
  healthCheck(): Promise<{ healthy: boolean; message?: string }>;
}
