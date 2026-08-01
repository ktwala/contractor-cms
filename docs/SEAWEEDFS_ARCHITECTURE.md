# SeaweedFS Architecture

This document explains the SeaweedFS distributed file storage system used by the Hubsec Workforce Platform for document storage.

## Overview

SeaweedFS is a distributed file system that provides:
- **High availability** through data replication
- **S3-compatible API** for easy integration
- **Scalable storage** that can grow with your needs
- **Fast file access** with O(1) disk seeks

## Architecture Components

The SeaweedFS deployment consists of **3 core component types** and **2 optional gateways**:

### Core Components

| Component | Container | Port(s) | Purpose |
|-----------|-----------|---------|---------|
| **Master** | `payroll-seaweedfs-master` | 9333, 19333 | Cluster coordination, volume placement, topology management |
| **Volume Server 1** | `payroll-seaweedfs-volume-1` | 8080, 18080 | Primary file storage engine |
| **Volume Server 2** | `payroll-seaweedfs-volume-2` | 8081, 18081 | Secondary storage for redundancy |
| **Filer** | `payroll-seaweedfs-filer` | 8888, 18888 | File/directory structure and metadata |

### Gateway Services

| Gateway | Container | Port | Purpose |
|---------|-----------|------|---------|
| **S3 Gateway** | `payroll-seaweedfs-s3` | 8333 | Amazon S3-compatible API endpoint |
| **WebDAV** | `payroll-seaweedfs-webdav` | 7333 | WebDAV access for file browsing |

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    Payroll Application                       │
│            (uses AWS S3 SDK to upload/download files)        │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│               S3 Gateway (port 8333)                        │
│         Amazon S3-compatible API endpoint                   │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Filer (port 8888)                         │
│    Provides file paths, directories, metadata, listings     │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  Volume 1   │   │  Volume 2   │   │  (future)   │
│  port 8080  │   │  port 8081  │   │  volumes    │
│  (primary)  │   │ (redundancy)│   │             │
└─────────────┘   └─────────────┘   └─────────────┘
          │               │
          └───────┬───────┘
                  ▼
┌─────────────────────────────────────────────────────────────┐
│               Master (port 9333)                            │
│    Cluster coordination, volume ID assignment, topology     │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### Master Server
- **Single source of truth** for where data lives
- Assigns volume IDs to new files
- Tracks which volume servers are healthy
- Manages cluster topology and replication strategy
- Configured with `-defaultReplication=001` (1 copy on another volume)

### Volume Servers
- **Actually store the file data** as binary blobs
- Each volume server can host multiple logical volumes
- Configured with `-max=100` (up to 100 volumes per server)
- Two volume servers provide **data redundancy**

### Filer
- Translates human-friendly paths into SeaweedFS blob IDs
- Example: `/payslips/2025/january/EMP001.pdf` → internal file ID
- Provides directory listings and file metadata
- Enables hierarchical file organization

### S3 Gateway
- **Primary integration point** for the application
- Exposes Amazon S3-compatible API
- Allows use of standard AWS SDK libraries
- Supports buckets, objects, and S3 operations

### WebDAV Gateway
- Optional interface for direct file access
- Can be mounted as a network drive
- Useful for debugging and manual file management

## Application Integration

The Hubsec Workforce Platform connects to SeaweedFS through the S3 Gateway:

```typescript
// Example S3 client configuration
const s3Client = new S3Client({
  endpoint: 'http://seaweedfs-s3:8333',
  region: 'us-east-1',  // Required but not used
  forcePathStyle: true, // Required for SeaweedFS
  credentials: {
    accessKeyId: process.env.SEAWEEDFS_ACCESS_KEY,
    secretAccessKey: process.env.SEAWEEDFS_SECRET_KEY
  }
});
```

## Storage Use Cases

The platform uses SeaweedFS for storing:

| Document Type | Bucket/Path | Description |
|---------------|-------------|-------------|
| Payslips | `/payslips/{year}/{month}/` | Generated PDF payslips |
| Tax Certificates | `/tax-certs/{year}/` | IRP5 and other tax documents |
| Employee Documents | `/employees/{id}/documents/` | ID copies, contracts, etc. |
| Company Documents | `/company/` | Policies, templates, logos |
| Expense Receipts | `/expenses/{claim_id}/` | Uploaded receipt images |

## Data Replication

The current configuration (`-defaultReplication=001`) means:
- **0** copies on the same rack
- **0** copies on different racks in the same data center  
- **1** copy on a different volume server

This provides basic redundancy - if Volume Server 1 fails, data is still available on Volume Server 2.

## Scaling

To scale the storage:

1. **Add more volume servers** - Just add new container instances pointing to the same master
2. **Increase volume capacity** - Adjust `-max` parameter for more volumes per server
3. **Add filer replicas** - For higher read throughput on metadata operations

## Data Directories

Local data is persisted in:
```
./seaweed-data/
├── master/     # Master metadata
├── volume1/    # Volume server 1 data
├── volume2/    # Volume server 2 data
└── filer/      # Filer metadata
```

## Health Checks

All services include health checks:
- **Master**: `http://localhost:9333/cluster/status`
- **Volume**: `http://localhost:8080/status`
- **Filer**: `http://localhost:8888/`
- **S3**: `http://localhost:8333/`

## Starting SeaweedFS

```bash
# Start SeaweedFS services
docker-compose -f docker-compose.seaweedfs.yml up -d

# Check status
docker-compose -f docker-compose.seaweedfs.yml ps

# View logs
docker-compose -f docker-compose.seaweedfs.yml logs -f
```

## Related Documentation

- [SeaweedFS Official Documentation](https://github.com/seaweedfs/seaweedfs/wiki)
- [S3 API Compatibility](https://github.com/seaweedfs/seaweedfs/wiki/Amazon-S3-API)
