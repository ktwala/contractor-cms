# Storage System Documentation

Complete guide to the payroll platform's storage system with support for SeaweedFS, AWS S3, Azure Blob Storage, and local filesystem.

## Table of Contents

- [Overview](#overview)
- [Supported Providers](#supported-providers)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [SeaweedFS Setup](#seaweedfs-setup)
- [AWS S3 Setup](#aws-s3-setup)
- [Migration Guide](#migration-guide)
- [Security](#security)
- [API Reference](#api-reference)

## Overview

The storage system provides a unified interface for storing and retrieving payment files, documents, and other sensitive data. It features:

- ✅ **Multi-Provider Support** - SeaweedFS, S3, Azure, Local filesystem
- 🔒 **Automatic Encryption** - AES-256-GCM client-side encryption
- 📦 **Seamless Provider Switching** - Change providers without code changes
- 🚀 **High Performance** - Optimized for payroll file operations
- 📊 **Metadata Support** - Rich metadata and tagging
- 🔍 **Health Monitoring** - Built-in health checks

## Supported Providers

### 1. SeaweedFS (Recommended)
**Best for:** Self-hosted deployments, data sovereignty, cost control

**Pros:**
- Full data control (on-premise)
- S3-compatible API
- Lower costs (no cloud fees)
- POPIA compliant (data stays in SA)
- High performance with local deployment

**Cons:**
- Requires self-management
- Need to handle backups and redundancy

### 2. AWS S3
**Best for:** Cloud deployments, global scalability

**Pros:**
- Fully managed service
- 99.999999999% durability
- Global infrastructure
- Advanced features (versioning, lifecycle, etc.)

**Cons:**
- Ongoing costs (storage + egress)
- Data stored with third party
- Compliance complexity for POPIA

### 3. Azure Blob Storage
**Best for:** Microsoft Azure environments

**Pros:**
- Integrated with Azure ecosystem
- Good for hybrid cloud setups

**Cons:**
- Similar cost structure to AWS
- Different API (not S3-compatible)

### 4. Local Filesystem
**Best for:** Development, testing, small deployments

**Pros:**
- Simple setup
- No external dependencies
- Fast for local development

**Cons:**
- Not scalable
- No redundancy
- Limited to single server

## Quick Start

### Development Setup (SeaweedFS)

1. **Start SeaweedFS with Docker Compose:**

```bash
# Start all SeaweedFS services
docker-compose -f docker-compose.seaweedfs.yml up -d

# Check status
docker-compose -f docker-compose.seaweedfs.yml ps

# View logs
docker-compose -f docker-compose.seaweedfs.yml logs -f seaweedfs-s3
```

2. **Configure Environment:**

```bash
cp .env.storage.example .env.storage
# Edit .env.storage with your preferences
```

3. **Test the Connection:**

```bash
# Using curl to test S3 endpoint
curl http://localhost:8333/

# List buckets
aws s3 ls --endpoint-url http://localhost:8333
```

### Production Setup (SeaweedFS)

See [SeaweedFS Setup](#seaweedfs-setup) section for production deployment.

## Configuration

### Environment Variables

```bash
# Storage Provider Selection
STORAGE_PROVIDER=seaweedfs  # Options: seaweedfs, s3, azure, local

# SeaweedFS Configuration
SEAWEED_ENDPOINT=http://localhost:8333
SEAWEED_BUCKET=payroll-files
SEAWEED_ACCESS_KEY=admin
SEAWEED_SECRET_KEY=admin

# Encryption (Required for production)
STORAGE_ENCRYPTION_ENABLED=true
STORAGE_ENCRYPTION_KEY=<your-256-bit-key-in-base64>

# Generate encryption key:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Provider-Specific Configuration

#### SeaweedFS

```bash
SEAWEED_ENDPOINT=http://seaweedfs-s3:8333
SEAWEED_VOLUME_ENDPOINT=http://seaweedfs-volume:8080
SEAWEED_BUCKET=payroll-files
SEAWEED_ACCESS_KEY=payroll
SEAWEED_SECRET_KEY=<strong-secret-key>
SEAWEED_USE_SSL=false
```

#### AWS S3

```bash
S3_REGION=af-south-1  # Johannesburg region
S3_BUCKET=payroll-files
AWS_ACCESS_KEY_ID=<your-access-key>
AWS_SECRET_ACCESS_KEY=<your-secret-key>
S3_USE_SSL=true
```

#### Local Filesystem

```bash
LOCAL_STORAGE_PATH=./data/storage
```

## SeaweedFS Setup

### Docker Compose (Development)

Already configured in `docker-compose.seaweedfs.yml`. Services included:

- **Master Server** (9333) - Cluster coordination
- **Volume Servers** (8080, 8081) - Data storage
- **Filer** (8888) - File/directory structure
- **S3 Gateway** (8333) - S3-compatible API
- **WebDAV** (7333) - Web interface

**Access Points:**
- S3 API: `http://localhost:8333`
- Master UI: `http://localhost:9333`
- Filer UI: `http://localhost:8888`
- WebDAV: `http://localhost:7333`

### Kubernetes (Production)

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: seaweedfs-master
spec:
  serviceName: seaweedfs-master
  replicas: 3
  selector:
    matchLabels:
      app: seaweedfs-master
  template:
    metadata:
      labels:
        app: seaweedfs-master
    spec:
      containers:
      - name: seaweedfs
        image: chrislusf/seaweedfs:latest
        command:
          - /usr/bin/weed
          - master
          - -mdir=/data
          - -ip=$(POD_IP)
          - -peers=seaweedfs-master-0.seaweedfs-master:9333,seaweedfs-master-1.seaweedfs-master:9333,seaweedfs-master-2.seaweedfs-master:9333
        env:
        - name: POD_IP
          valueFrom:
            fieldRef:
              fieldPath: status.podIP
        ports:
        - containerPort: 9333
        volumeMounts:
        - name: data
          mountPath: /data
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi
```

### Production Best Practices

1. **Replication Strategy:**
   ```bash
   -defaultReplication=001  # 1 copy, no replication
   -defaultReplication=010  # 2 copies on different racks
   -defaultReplication=100  # 2 copies in different data centers
   ```

2. **Volume Configuration:**
   ```bash
   -max=500  # Maximum 500GB per volume server
   -dataCenter=za-jhb  # Data center identifier
   -rack=rack1  # Rack identifier
   ```

3. **Security:**
   - Change default credentials in `seaweed-config/s3.json`
   - Enable SSL/TLS for production
   - Use firewall rules to restrict access
   - Implement network segmentation

4. **Backup Strategy:**
   ```bash
   # Backup volume data
   rsync -av /data/seaweed-data/ /backup/seaweed-$(date +%Y%m%d)/

   # Or use SeaweedFS built-in backup
   weed backup -dir=/data -target=s3://backup-bucket/
   ```

## AWS S3 Setup

### 1. Create S3 Bucket

```bash
# Using AWS CLI
aws s3 mb s3://payroll-files --region af-south-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket payroll-files \
  --versioning-configuration Status=Enabled

# Enable server-side encryption
aws s3api put-bucket-encryption \
  --bucket payroll-files \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'
```

### 2. Create IAM User

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:PutObjectTagging",
        "s3:GetObjectTagging"
      ],
      "Resource": [
        "arn:aws:s3:::payroll-files",
        "arn:aws:s3:::payroll-files/*"
      ]
    }
  ]
}
```

### 3. Configure Lifecycle Rules

```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket payroll-files \
  --lifecycle-configuration file://s3-lifecycle.json
```

**s3-lifecycle.json:**
```json
{
  "Rules": [
    {
      "Id": "ArchiveOldPayments",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "payment-files/"
      },
      "Transitions": [
        {
          "Days": 90,
          "StorageClass": "STANDARD_IA"
        },
        {
          "Days": 365,
          "StorageClass": "GLACIER"
        }
      ]
    }
  ]
}
```

## Migration Guide

### Migrating Between Providers

```typescript
import { StorageService } from './services/storage/StorageService';
import { SeaweedFSProvider } from './services/storage/SeaweedFSProvider';
import { S3Provider } from './services/storage/S3Provider';

async function migrateToS3() {
  const source = new SeaweedFSProvider(seaweedfsConfig);
  const destination = new S3Provider(s3Config);

  // List all files
  const files = await source.list({ prefix: 'payment-files/' });

  for (const file of files) {
    console.log(`Migrating: ${file.key}`);

    // Download from source
    const data = await source.download(file.key);

    // Upload to destination
    await destination.upload(file.key, data.data, {
      metadata: data.metadata,
    });

    console.log(`✓ Migrated: ${file.key}`);
  }

  console.log(`Migration complete: ${files.length} files`);
}
```

### Bulk Migration Script

```bash
#!/bin/bash
# migrate-storage.sh

SOURCE_PROVIDER="seaweedfs"
TARGET_PROVIDER="s3"

echo "Starting storage migration from $SOURCE_PROVIDER to $TARGET_PROVIDER..."

# Export configuration
export STORAGE_PROVIDER=$SOURCE_PROVIDER
node scripts/export-files.js > files.json

# Import to new provider
export STORAGE_PROVIDER=$TARGET_PROVIDER
node scripts/import-files.js < files.json

echo "Migration complete!"
```

## Security

### Encryption

**Client-Side Encryption (AES-256-GCM):**
- Enabled by default for payment files
- Encryption key stored securely in environment variables
- Automatic encryption/decryption on upload/download

**Server-Side Encryption:**
- SeaweedFS: AES-256
- AWS S3: AES-256 or KMS
- Azure: Service-managed or customer-managed keys

### Access Control

**SeaweedFS:**
```json
{
  "identities": [
    {
      "name": "payroll-service",
      "credentials": [{
        "accessKey": "payroll",
        "secretKey": "<strong-secret>"
      }],
      "actions": ["Read", "Write", "List"]
    }
  ]
}
```

**S3 Bucket Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Deny",
    "Principal": "*",
    "Action": "s3:*",
    "Resource": "arn:aws:s3:::payroll-files/*",
    "Condition": {
      "Bool": {"aws:SecureTransport": "false"}
    }
  }]
}
```

### Compliance (POPIA)

For South African data protection compliance:

1. **Data Residency:**
   - Use SeaweedFS hosted in SA, OR
   - Use AWS S3 in `af-south-1` region (Cape Town)

2. **Encryption:**
   - Enable client-side encryption
   - Use server-side encryption
   - Encrypt data in transit (HTTPS)

3. **Access Logging:**
   - Enable access logs
   - Monitor file access patterns
   - Implement audit trails

4. **Data Retention:**
   - Configure lifecycle policies
   - Auto-archive old files
   - Secure deletion after retention period

## API Reference

### StorageService

```typescript
import { storageService } from './services/storage/StorageService';

// Upload file
const result = await storageService.uploadFile('path/to/file.txt', data, {
  contentType: 'text/plain',
  encrypt: true,
  metadata: { batchId: '123' },
  tags: { type: 'payment' }
});

// Download file
const file = await storageService.downloadFile('path/to/file.txt');
console.log(file.data); // Buffer
console.log(file.metadata); // Metadata object

// List files
const files = await storageService.listFiles({
  prefix: 'payment-files/2025/',
  maxKeys: 100
});

// Delete file
await storageService.deleteFile('path/to/file.txt');

// Check if exists
const exists = await storageService.fileExists('path/to/file.txt');

// Get signed URL (for temporary access)
const url = await storageService.getSignedDownloadUrl('path/to/file.txt', 3600);

// Health check
const health = await storageService.healthCheck();
console.log(health.healthy); // true/false
console.log(health.provider); // 'SeaweedFS'
```

### Payment-Specific Operations

```typescript
// Upload payment file (auto-encrypts)
const result = await storageService.uploadPaymentFile(
  'PAYMENT_PB202512001_20251228.txt',
  fileContent,
  {
    batchId: 'batch-123',
    batchNumber: 'PB202512001',
    format: 'eft',
    totalAmount: 250000,
    totalTransactions: 50,
    checksum: 'abc123...'
  }
);

// Download payment file (auto-decrypts)
const file = await storageService.downloadPaymentFile(
  'payment-files/2025/12/PAYMENT_PB202512001.txt'
);

// List payment files for specific period
const files = await storageService.listPaymentFiles(2025, 12);

// Archive old payment file
await storageService.archivePaymentFile('payment-files/2024/01/old-file.txt');
```

---

## Troubleshooting

### SeaweedFS Connection Issues

**Problem:** Cannot connect to SeaweedFS S3 endpoint

**Solution:**
```bash
# Check if services are running
docker-compose -f docker-compose.seaweedfs.yml ps

# Check logs
docker-compose -f docker-compose.seaweedfs.yml logs seaweedfs-s3

# Test S3 endpoint
curl http://localhost:8333/
```

### Encryption Key Issues

**Problem:** Encryption/decryption fails

**Solution:**
- Verify key is 256-bit (32 bytes) base64-encoded
- Generate new key: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
- Ensure same key is used for encryption and decryption

### Permission Issues

**Problem:** Access denied errors

**Solution:**
- Check SeaweedFS credentials in `seaweed-config/s3.json`
- Verify AWS IAM permissions
- Check file/directory permissions for local storage

---

## Performance Optimization

### SeaweedFS

1. **Use Local Volumes:**
   ```yaml
   volumes:
     - /mnt/fast-ssd/seaweed-data:/data
   ```

2. **Tune Volume Server:**
   ```bash
   -max=500  # Limit volume size
   -compactionMBps=50  # Compaction speed
   -readTimeout=3s
   ```

3. **Use Multiple Volume Servers:**
   - Distribute load across multiple servers
   - Use different disks/volumes
   - Configure replication for redundancy

### S3

1. **Use Transfer Acceleration:**
   ```typescript
   endpoint: 'https://payroll-files.s3-accelerate.amazonaws.com'
   ```

2. **Multipart Upload for Large Files:**
   - Automatically handled by AWS SDK
   - Configure part size: 5MB - 100MB

---

**For additional help, contact the DevOps team or refer to:**
- [SeaweedFS Documentation](https://github.com/seaweedfs/seaweedfs/wiki)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- Internal DevOps Wiki
