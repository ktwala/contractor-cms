/**
 * Storage Configuration
 * Supports multiple storage providers: SeaweedFS, AWS S3, Azure Blob Storage
 */

export type StorageProvider = 'seaweedfs' | 's3' | 'azure' | 'local';

export interface StorageConfig {
  provider: StorageProvider;
  seaweedfs?: SeaweedFSConfig;
  s3?: S3Config;
  azure?: AzureConfig;
  local?: LocalConfig;
  encryption?: EncryptionConfig;
}

export interface SeaweedFSConfig {
  endpoint: string;
  volumeEndpoint?: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  useSSL?: boolean;
  region?: string; // Not used by SeaweedFS but required by S3 SDK
}

export interface S3Config {
  endpoint?: string; // For S3-compatible services
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  useSSL?: boolean;
}

export interface AzureConfig {
  connectionString: string;
  containerName: string;
  accountName?: string;
  accountKey?: string;
}

export interface LocalConfig {
  basePath: string;
  createIfNotExists?: boolean;
}

export interface EncryptionConfig {
  enabled: boolean;
  algorithm: 'aes-256-gcm' | 'aes-256-cbc';
  key: string; // Base64 encoded 256-bit key
  ivLength?: number;
}

/**
 * Load storage configuration from environment variables
 */
export function loadStorageConfig(): StorageConfig {
  const provider = (process.env.STORAGE_PROVIDER || 'local') as StorageProvider;

  const config: StorageConfig = {
    provider,
  };

  // SeaweedFS Configuration
  if (provider === 'seaweedfs' || process.env.SEAWEED_ENDPOINT) {
    config.seaweedfs = {
      endpoint: process.env.SEAWEED_ENDPOINT || 'http://localhost:8333',
      volumeEndpoint: process.env.SEAWEED_VOLUME_ENDPOINT || 'http://localhost:8080',
      bucket: process.env.SEAWEED_BUCKET || 'payroll-files',
      accessKey: process.env.SEAWEED_ACCESS_KEY || 'admin',
      secretKey: process.env.SEAWEED_SECRET_KEY || 'admin',
      useSSL: process.env.SEAWEED_USE_SSL === 'true',
      region: 'us-east-1', // Dummy region for S3 SDK
    };
  }

  // AWS S3 Configuration
  if (provider === 's3' || process.env.AWS_ACCESS_KEY_ID) {
    config.s3 = {
      endpoint: process.env.S3_ENDPOINT, // For S3-compatible services
      region: process.env.S3_REGION || process.env.AWS_REGION || 'af-south-1', // Johannesburg
      bucket: process.env.S3_BUCKET || 'payroll-files',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      useSSL: process.env.S3_USE_SSL !== 'false',
    };
  }

  // Azure Blob Storage Configuration
  if (provider === 'azure' || process.env.AZURE_STORAGE_CONNECTION_STRING) {
    config.azure = {
      connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING!,
      containerName: process.env.AZURE_CONTAINER_NAME || 'payroll-files',
      accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME,
      accountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY,
    };
  }

  // Local Filesystem Configuration
  if (provider === 'local') {
    config.local = {
      basePath: process.env.LOCAL_STORAGE_PATH || './data/storage',
      createIfNotExists: true,
    };
  }

  // Encryption Configuration
  if (process.env.STORAGE_ENCRYPTION_ENABLED === 'true') {
    config.encryption = {
      enabled: true,
      algorithm: (process.env.STORAGE_ENCRYPTION_ALGORITHM as any) || 'aes-256-gcm',
      key: process.env.STORAGE_ENCRYPTION_KEY!,
      ivLength: parseInt(process.env.STORAGE_ENCRYPTION_IV_LENGTH || '16', 10),
    };
  }

  return config;
}

/**
 * Validate storage configuration
 */
export function validateStorageConfig(config: StorageConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate provider-specific configuration
  switch (config.provider) {
    case 'seaweedfs':
      if (!config.seaweedfs) {
        errors.push('SeaweedFS configuration is missing');
      } else {
        if (!config.seaweedfs.endpoint) errors.push('SeaweedFS endpoint is required');
        if (!config.seaweedfs.bucket) errors.push('SeaweedFS bucket is required');
        if (!config.seaweedfs.accessKey) errors.push('SeaweedFS access key is required');
        if (!config.seaweedfs.secretKey) errors.push('SeaweedFS secret key is required');
      }
      break;

    case 's3':
      if (!config.s3) {
        errors.push('S3 configuration is missing');
      } else {
        if (!config.s3.region) errors.push('S3 region is required');
        if (!config.s3.bucket) errors.push('S3 bucket is required');
        if (!config.s3.accessKeyId) errors.push('S3 access key ID is required');
        if (!config.s3.secretAccessKey) errors.push('S3 secret access key is required');
      }
      break;

    case 'azure':
      if (!config.azure) {
        errors.push('Azure configuration is missing');
      } else {
        if (!config.azure.connectionString && (!config.azure.accountName || !config.azure.accountKey)) {
          errors.push('Azure connection string or account credentials are required');
        }
        if (!config.azure.containerName) errors.push('Azure container name is required');
      }
      break;

    case 'local':
      if (!config.local) {
        errors.push('Local storage configuration is missing');
      } else {
        if (!config.local.basePath) errors.push('Local storage base path is required');
      }
      break;

    default:
      errors.push(`Unknown storage provider: ${config.provider}`);
  }

  // Validate encryption configuration
  if (config.encryption?.enabled) {
    if (!config.encryption.key) {
      errors.push('Encryption key is required when encryption is enabled');
    } else if (Buffer.from(config.encryption.key, 'base64').length !== 32) {
      errors.push('Encryption key must be a 256-bit (32-byte) key encoded in base64');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Export singleton instance
export const storageConfig = loadStorageConfig();

// Validate on load
const validation = validateStorageConfig(storageConfig);
if (!validation.valid) {
  console.warn('Storage configuration validation failed:', validation.errors);
}
