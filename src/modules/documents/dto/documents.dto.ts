import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsArray,
  IsUUID,
  Min,
  Max,
  IsUrl,
} from 'class-validator';

// ============================================================================
// ENUMS
// ============================================================================

export enum DocumentCategory {
  IDENTITY = 'IDENTITY',
  EMPLOYMENT = 'EMPLOYMENT',
  QUALIFICATION = 'QUALIFICATION',
  COMPLIANCE = 'COMPLIANCE',
  TAX = 'TAX',
  BANKING = 'BANKING',
  MEDICAL = 'MEDICAL',
  IMMIGRATION = 'IMMIGRATION',
  LICENSE = 'LICENSE',
  PERFORMANCE = 'PERFORMANCE',
  OTHER = 'OTHER',
}

export enum DocumentStatus {
  PENDING_UPLOAD = 'PENDING_UPLOAD',
  UPLOADED = 'UPLOADED',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  ARCHIVED = 'ARCHIVED',
}

export enum DocumentPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum DocumentAccessAction {
  VIEW = 'VIEW',
  DOWNLOAD = 'DOWNLOAD',
  PRINT = 'PRINT',
  SHARE = 'SHARE',
}

export enum StorageProvider {
  LOCAL = 'local',
  S3 = 's3',
  AZURE = 'azure',
  GCS = 'gcs',
}

// ============================================================================
// DOCUMENT TYPE DTOs
// ============================================================================

export class CreateDocumentTypeDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(DocumentCategory)
  category: DocumentCategory;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean = false;

  @IsOptional()
  @IsBoolean()
  requiresExpiry?: boolean = false;

  @IsOptional()
  @IsBoolean()
  requiresVerification?: boolean = true;

  @IsOptional()
  @IsNumber()
  defaultExpiryMonths?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  expiryWarningDays?: number = 30;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  expiryReminderDays?: number[] = [30, 14, 7];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedMimeTypes?: string[] = ['application/pdf', 'image/jpeg', 'image/png'];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  maxFileSizeMb?: number = 10;

  @IsOptional()
  @IsNumber()
  retentionYears?: number;

  @IsOptional()
  @IsNumber()
  sortOrder?: number = 100;
}

export class UpdateDocumentTypeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresExpiry?: boolean;

  @IsOptional()
  @IsNumber()
  expiryWarningDays?: number;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  expiryReminderDays?: number[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedMimeTypes?: string[];

  @IsOptional()
  @IsNumber()
  maxFileSizeMb?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class DocumentTypeResponseDto {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: DocumentCategory;
  isRequired: boolean;
  requiresExpiry: boolean;
  requiresVerification: boolean;
  defaultExpiryMonths?: number;
  expiryWarningDays: number;
  expiryReminderDays: number[];
  allowedMimeTypes: string[];
  maxFileSizeMb: number;
  retentionYears?: number;
  isActive: boolean;
  sortOrder: number;
}

// ============================================================================
// DOCUMENT DTOs
// ============================================================================

export class UploadDocumentDto {
  @IsUUID()
  employeeId: string;

  @IsUUID()
  documentTypeId: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  documentNumber?: string;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  issuingAuthority?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsBoolean()
  isConfidential?: boolean = false;

  @IsOptional()
  @IsBoolean()
  visibleToEmployee?: boolean = true;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  documentNumber?: string;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  issuingAuthority?: string;

  @IsOptional()
  @IsBoolean()
  isConfidential?: boolean;

  @IsOptional()
  @IsBoolean()
  visibleToEmployee?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  metadata?: Record<string, any>;
}

export class VerifyDocumentDto {
  @IsEnum(DocumentStatus)
  status: DocumentStatus.VERIFIED | DocumentStatus.REJECTED;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

export class DocumentResponseDto {
  id: string;
  employeeId: string;
  employeeName: string;
  documentTypeId: string;
  documentTypeName: string;
  documentTypeCategory: DocumentCategory;
  fileName: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  title?: string;
  description?: string;
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  issuingAuthority?: string;
  country?: string;
  status: DocumentStatus;
  version: number;
  isLatestVersion: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
  verificationNotes?: string;
  rejectionReason?: string;
  isConfidential: boolean;
  visibleToEmployee: boolean;
  tags: string[];
  uploadedBy: string;
  uploadedAt: string;
  expiryStatus?: 'OK' | 'WARNING' | 'EXPIRED';
  daysUntilExpiry?: number;
}

export class DocumentListQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  documentTypeId?: string;

  @IsOptional()
  @IsEnum(DocumentCategory)
  category?: DocumentCategory;

  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @IsOptional()
  @IsBoolean()
  expiringSoon?: boolean;

  @IsOptional()
  @IsBoolean()
  expired?: boolean;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

// ============================================================================
// DOCUMENT REQUEST DTOs
// ============================================================================

export class CreateDocumentRequestDto {
  @IsUUID()
  employeeId: string;

  @IsUUID()
  documentTypeId: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsEnum(DocumentPriority)
  priority?: DocumentPriority = DocumentPriority.NORMAL;
}

export class BulkDocumentRequestDto {
  @IsArray()
  @IsUUID('4', { each: true })
  employeeIds: string[];

  @IsArray()
  @IsUUID('4', { each: true })
  documentTypeIds: string[];

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsEnum(DocumentPriority)
  priority?: DocumentPriority = DocumentPriority.NORMAL;
}

export class DocumentRequestResponseDto {
  id: string;
  employeeId: string;
  employeeName: string;
  documentTypeId: string;
  documentTypeName: string;
  requestedBy: string;
  requestedAt: string;
  dueDate?: string;
  reason?: string;
  priority: DocumentPriority;
  status: string;
  fulfilledAt?: string;
  documentId?: string;
  remindersSent: number;
  lastReminderAt?: string;
  isOverdue: boolean;
}

// ============================================================================
// DOCUMENT ACCESS DTOs
// ============================================================================

export class DocumentAccessLogResponseDto {
  id: string;
  documentId: string;
  documentName: string;
  userId: string;
  userName: string;
  action: DocumentAccessAction;
  ipAddress?: string;
  accessedAt: string;
}

// ============================================================================
// EXPIRY TRACKING DTOs
// ============================================================================

export class ExpiringDocumentsQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  withinDays?: number = 30;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsEnum(DocumentCategory)
  category?: DocumentCategory;
}

export class ExpiringDocumentDto {
  documentId: string;
  employeeId: string;
  employeeName: string;
  documentTypeName: string;
  documentTypeCategory: DocumentCategory;
  documentNumber?: string;
  expiryDate: string;
  daysUntilExpiry: number;
  status: 'WARNING' | 'CRITICAL' | 'EXPIRED';
  lastAlertSent?: string;
}

export class ExpiryDashboardDto {
  totalDocuments: number;
  expiredDocuments: number;
  expiringWithin7Days: number;
  expiringWithin30Days: number;
  expiringWithin90Days: number;
  byCategory: Array<{
    category: DocumentCategory;
    total: number;
    expired: number;
    expiringSoon: number;
  }>;
}

// ============================================================================
// COMPLIANCE CHECKLIST DTOs
// ============================================================================

export class EmployeeDocumentChecklistDto {
  employeeId: string;
  employeeName: string;
  completionPercentage: number;
  totalRequired: number;
  totalUploaded: number;
  totalVerified: number;
  totalMissing: number;
  totalExpired: number;
  documents: Array<{
    documentTypeId: string;
    documentTypeName: string;
    category: DocumentCategory;
    isRequired: boolean;
    status: 'MISSING' | 'PENDING' | 'UPLOADED' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
    documentId?: string;
    expiryDate?: string;
    daysUntilExpiry?: number;
  }>;
}

export class OrganizationComplianceDto {
  organizationId: string;
  reportDate: string;
  totalEmployees: number;
  fullyCompliant: number;
  partiallyCompliant: number;
  nonCompliant: number;
  complianceRate: number;
  byDocumentType: Array<{
    documentTypeId: string;
    documentTypeName: string;
    category: DocumentCategory;
    isRequired: boolean;
    totalRequired: number;
    totalUploaded: number;
    totalVerified: number;
    totalMissing: number;
    totalExpired: number;
    complianceRate: number;
  }>;
}

// ============================================================================
// BULK OPERATIONS DTOs
// ============================================================================

export class BulkVerifyDto {
  @IsArray()
  @IsUUID('4', { each: true })
  documentIds: string[];

  @IsEnum(DocumentStatus)
  status: DocumentStatus.VERIFIED | DocumentStatus.REJECTED;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

export class BulkArchiveDto {
  @IsArray()
  @IsUUID('4', { each: true })
  documentIds: string[];

  @IsOptional()
  @IsString()
  reason?: string;
}

export class BulkOperationResultDto {
  totalRequested: number;
  successful: number;
  failed: number;
  errors: Array<{
    documentId: string;
    error: string;
  }>;
}

// ============================================================================
// DOWNLOAD DTOs
// ============================================================================

export class GenerateDownloadUrlDto {
  @IsUUID()
  documentId: string;

  @IsOptional()
  @IsNumber()
  @Min(60)
  @Max(86400)
  expiresInSeconds?: number = 3600; // Default 1 hour
}

export class DownloadUrlResponseDto {
  documentId: string;
  url: string;
  expiresAt: string;
  fileName: string;
  mimeType: string;
}

// ============================================================================
// REPORT DTOs
// ============================================================================

export class DocumentReportQueryDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsEnum(DocumentCategory)
  category?: DocumentCategory;

  @IsOptional()
  @IsUUID()
  employeeId?: string;
}

export class DocumentActivityReportDto {
  period: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalUploads: number;
    totalVerifications: number;
    totalRejections: number;
    totalDownloads: number;
    averageVerificationTime: number; // hours
  };
  byCategory: Array<{
    category: DocumentCategory;
    uploads: number;
    verifications: number;
    rejections: number;
  }>;
  byDay: Array<{
    date: string;
    uploads: number;
    verifications: number;
    downloads: number;
  }>;
}
