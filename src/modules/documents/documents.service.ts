import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { DocumentStorageService } from './services/document-storage.service';
import {
  DocumentCategory,
  DocumentStatus,
  DocumentPriority,
  CreateDocumentTypeDto,
  UpdateDocumentTypeDto,
  UploadDocumentDto,
  UpdateDocumentDto,
  VerifyDocumentDto,
  DocumentResponseDto,
  DocumentListQueryDto,
  CreateDocumentRequestDto,
  BulkDocumentRequestDto,
  DocumentRequestResponseDto,
  ExpiringDocumentsQueryDto,
  ExpiringDocumentDto,
  ExpiryDashboardDto,
  EmployeeDocumentChecklistDto,
  OrganizationComplianceDto,
  BulkVerifyDto,
  BulkArchiveDto,
  BulkOperationResultDto,
  DocumentAccessAction,
} from './dto/documents.dto';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: DocumentStorageService,
  ) {}

  // ============================================================================
  // DOCUMENT TYPES
  // ============================================================================

  async createDocumentType(
    organizationId: string,
    dto: CreateDocumentTypeDto,
  ): Promise<any> {
    return this.prisma.documentType.create({
      data: {
        organizationId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        category: dto.category,
        isRequired: dto.isRequired,
        requiresExpiry: dto.requiresExpiry,
        requiresVerification: dto.requiresVerification,
        defaultExpiryMonths: dto.defaultExpiryMonths,
        expiryWarningDays: dto.expiryWarningDays,
        expiryReminderDays: dto.expiryReminderDays,
        allowedMimeTypes: dto.allowedMimeTypes,
        maxFileSizeMb: dto.maxFileSizeMb,
        retentionYears: dto.retentionYears,
        sortOrder: dto.sortOrder,
      },
    });
  }

  async updateDocumentType(
    organizationId: string,
    documentTypeId: string,
    dto: UpdateDocumentTypeDto,
  ): Promise<any> {
    const docType = await this.prisma.documentType.findFirst({
      where: { id: documentTypeId, organizationId },
    });

    if (!docType) {
      throw new NotFoundException('Document type not found');
    }

    return this.prisma.documentType.update({
      where: { id: documentTypeId },
      data: dto,
    });
  }

  async getDocumentTypes(
    organizationId: string,
    category?: DocumentCategory,
  ): Promise<any[]> {
    return this.prisma.documentType.findMany({
      where: {
        OR: [{ organizationId: null }, { organizationId }],
        isActive: true,
        ...(category && { category }),
      },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async initializeDefaultDocumentTypes(organizationId: string): Promise<void> {
    const defaultTypes = [
      // Identity Documents
      { code: 'ID_DOCUMENT', name: 'ID Document', category: 'IDENTITY', requiresExpiry: true },
      { code: 'PASSPORT', name: 'Passport', category: 'IDENTITY', requiresExpiry: true },
      { code: 'DRIVERS_LICENSE', name: "Driver's License", category: 'LICENSE', requiresExpiry: true },

      // Employment Documents
      { code: 'EMPLOYMENT_CONTRACT', name: 'Employment Contract', category: 'EMPLOYMENT', isRequired: true },
      { code: 'OFFER_LETTER', name: 'Offer Letter', category: 'EMPLOYMENT' },
      { code: 'TERMINATION_LETTER', name: 'Termination Letter', category: 'EMPLOYMENT' },
      { code: 'NDA', name: 'Non-Disclosure Agreement', category: 'COMPLIANCE' },

      // Qualifications
      { code: 'DEGREE_CERTIFICATE', name: 'Degree Certificate', category: 'QUALIFICATION' },
      { code: 'DIPLOMA', name: 'Diploma', category: 'QUALIFICATION' },
      { code: 'PROFESSIONAL_CERT', name: 'Professional Certification', category: 'QUALIFICATION', requiresExpiry: true },

      // Tax & Banking
      { code: 'TAX_NUMBER', name: 'Tax Number Registration', category: 'TAX' },
      { code: 'BANK_CONFIRMATION', name: 'Bank Account Confirmation', category: 'BANKING' },

      // Immigration
      { code: 'WORK_PERMIT', name: 'Work Permit', category: 'IMMIGRATION', requiresExpiry: true, isRequired: false },
      { code: 'VISA', name: 'Visa', category: 'IMMIGRATION', requiresExpiry: true },

      // Medical
      { code: 'MEDICAL_CERTIFICATE', name: 'Medical Certificate', category: 'MEDICAL' },
      { code: 'FITNESS_CERTIFICATE', name: 'Fitness to Work Certificate', category: 'MEDICAL', requiresExpiry: true },

      // Compliance
      { code: 'POLICY_ACKNOWLEDGMENT', name: 'Policy Acknowledgment', category: 'COMPLIANCE' },
      { code: 'CODE_OF_CONDUCT', name: 'Code of Conduct Acknowledgment', category: 'COMPLIANCE' },
    ];

    for (const docType of defaultTypes) {
      await this.prisma.documentType.upsert({
        where: {
          organizationId_code: {
            organizationId,
            code: docType.code,
          },
        },
        update: {},
        create: {
          organizationId,
          code: docType.code,
          name: docType.name,
          category: docType.category as DocumentCategory,
          isRequired: docType.isRequired || false,
          requiresExpiry: docType.requiresExpiry || false,
        },
      });
    }

    this.logger.log(`Initialized default document types for organization ${organizationId}`);
  }

  // ============================================================================
  // DOCUMENT UPLOAD & MANAGEMENT
  // ============================================================================

  async uploadDocument(
    organizationId: string,
    dto: UploadDocumentDto,
    file: Express.Multer.File,
    uploadedBy: string,
  ): Promise<DocumentResponseDto> {
    // Validate document type
    const documentType = await this.prisma.documentType.findFirst({
      where: {
        id: dto.documentTypeId,
        OR: [{ organizationId: null }, { organizationId }],
        isActive: true,
      },
    });

    if (!documentType) {
      throw new NotFoundException('Document type not found');
    }

    // Validate MIME type
    if (!documentType.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed. Allowed types: ${documentType.allowedMimeTypes.join(', ')}`,
      );
    }

    // Validate file size
    const maxSizeBytes = documentType.maxFileSizeMb * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new BadRequestException(
        `File size exceeds maximum allowed (${documentType.maxFileSizeMb}MB)`,
      );
    }

    // Validate employee exists
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    // Check for existing latest version
    const existingDocument = await this.prisma.document.findFirst({
      where: {
        employeeId: dto.employeeId,
        documentTypeId: dto.documentTypeId,
        isLatestVersion: true,
        status: { notIn: ['ARCHIVED'] },
      },
    });

    // Upload file to storage
    const storedFile = await this.storageService.uploadFile(file, {
      organizationId,
      employeeId: dto.employeeId,
      documentTypeCode: documentType.code,
    });

    // Determine version number
    const version = existingDocument ? existingDocument.version + 1 : 1;

    // Create document record
    const document = await this.prisma.$transaction(async (tx) => {
      // Mark previous version as not latest
      if (existingDocument) {
        await tx.document.update({
          where: { id: existingDocument.id },
          data: { isLatestVersion: false },
        });
      }

      // Create new document
      const newDoc = await tx.document.create({
        data: {
          employeeId: dto.employeeId,
          documentTypeId: dto.documentTypeId,
          organizationId,
          fileName: storedFile.fileName,
          originalFileName: storedFile.originalFileName,
          mimeType: storedFile.mimeType,
          fileSizeBytes: storedFile.fileSizeBytes,
          storagePath: storedFile.storagePath,
          storageProvider: storedFile.storageProvider,
          checksumSha256: storedFile.checksumSha256,
          title: dto.title,
          description: dto.description,
          documentNumber: dto.documentNumber,
          issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
          issuingAuthority: dto.issuingAuthority,
          country: dto.country as any,
          status: documentType.requiresVerification ? 'UPLOADED' : 'VERIFIED',
          version,
          isLatestVersion: true,
          previousVersionId: existingDocument?.id,
          isConfidential: dto.isConfidential,
          visibleToEmployee: dto.visibleToEmployee,
          tags: dto.tags || [],
          metadata: dto.metadata || {},
          uploadedBy,
        },
        include: {
          employee: true,
          documentType: true,
        },
      });

      // Create expiry alerts if document has expiry date
      if (newDoc.expiryDate) {
        await this.createExpiryAlerts(tx, newDoc.id, newDoc.expiryDate, documentType.expiryReminderDays);
      }

      // Check if this fulfills any pending document requests
      await tx.documentRequest.updateMany({
        where: {
          employeeId: dto.employeeId,
          documentTypeId: dto.documentTypeId,
          status: 'PENDING',
        },
        data: {
          status: 'UPLOADED',
          fulfilledAt: new Date(),
          documentId: newDoc.id,
        },
      });

      return newDoc;
    });

    return this.mapDocumentToDto(document);
  }

  async getDocument(
    organizationId: string,
    documentId: string,
    userId: string,
  ): Promise<DocumentResponseDto> {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, organizationId },
      include: {
        employee: true,
        documentType: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Log access
    await this.logAccess(documentId, userId, DocumentAccessAction.VIEW);

    return this.mapDocumentToDto(document);
  }

  async updateDocument(
    organizationId: string,
    documentId: string,
    dto: UpdateDocumentDto,
  ): Promise<DocumentResponseDto> {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, organizationId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const updated = await this.prisma.document.update({
      where: { id: documentId },
      data: {
        title: dto.title,
        description: dto.description,
        documentNumber: dto.documentNumber,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        issuingAuthority: dto.issuingAuthority,
        isConfidential: dto.isConfidential,
        visibleToEmployee: dto.visibleToEmployee,
        tags: dto.tags,
        metadata: dto.metadata,
      },
      include: {
        employee: true,
        documentType: true,
      },
    });

    // Update expiry alerts if expiry date changed
    if (dto.expiryDate && dto.expiryDate !== document.expiryDate?.toISOString()) {
      const docType = await this.prisma.documentType.findUnique({
        where: { id: document.documentTypeId },
      });
      await this.prisma.documentExpiryAlert.deleteMany({ where: { documentId } });
      await this.createExpiryAlerts(
        this.prisma,
        documentId,
        new Date(dto.expiryDate),
        docType?.expiryReminderDays || [30, 14, 7],
      );
    }

    return this.mapDocumentToDto(updated);
  }

  async verifyDocument(
    organizationId: string,
    documentId: string,
    dto: VerifyDocumentDto,
    verifiedBy: string,
  ): Promise<DocumentResponseDto> {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, organizationId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.status !== 'UPLOADED') {
      throw new BadRequestException('Only uploaded documents can be verified');
    }

    const updated = await this.prisma.document.update({
      where: { id: documentId },
      data: {
        status: dto.status,
        verifiedAt: new Date(),
        verifiedBy,
        verificationNotes: dto.notes,
        rejectionReason: dto.status === 'REJECTED' ? dto.rejectionReason : null,
      },
      include: {
        employee: true,
        documentType: true,
      },
    });

    return this.mapDocumentToDto(updated);
  }

  async archiveDocument(
    organizationId: string,
    documentId: string,
    archivedBy: string,
  ): Promise<void> {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, organizationId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    await this.prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'ARCHIVED',
        isLatestVersion: false,
      },
    });

    this.logger.log(`Document ${documentId} archived by ${archivedBy}`);
  }

  async deleteDocument(
    organizationId: string,
    documentId: string,
    deletedBy: string,
  ): Promise<void> {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, organizationId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Delete from storage
    await this.storageService.deleteFile(document.storagePath, document.storageProvider as any);

    // Delete from database
    await this.prisma.document.delete({ where: { id: documentId } });

    this.logger.log(`Document ${documentId} deleted by ${deletedBy}`);
  }

  async listDocuments(
    organizationId: string,
    query: DocumentListQueryDto,
  ): Promise<{ documents: DocumentResponseDto[]; total: number }> {
    const where: any = {
      organizationId,
      isLatestVersion: true,
    };

    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.documentTypeId) where.documentTypeId = query.documentTypeId;
    if (query.status) where.status = query.status;

    if (query.category) {
      where.documentType = { category: query.category };
    }

    if (query.expiringSoon) {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      where.expiryDate = { lte: thirtyDaysFromNow, gt: new Date() };
    }

    if (query.expired) {
      where.expiryDate = { lt: new Date() };
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { originalFileName: { contains: query.search, mode: 'insensitive' } },
        { documentNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.tags?.length) {
      where.tags = { hasSome: query.tags };
    }

    const [documents, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        include: {
          employee: true,
          documentType: true,
        },
        orderBy: { uploadedAt: 'desc' },
        skip: ((query.page || 1) - 1) * (query.limit || 20),
        take: query.limit || 20,
      }),
      this.prisma.document.count({ where }),
    ]);

    return {
      documents: documents.map((doc) => this.mapDocumentToDto(doc)),
      total,
    };
  }

  // ============================================================================
  // DOCUMENT DOWNLOAD
  // ============================================================================

  async downloadDocument(
    organizationId: string,
    documentId: string,
    userId: string,
  ): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, organizationId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Log access
    await this.logAccess(documentId, userId, DocumentAccessAction.DOWNLOAD);

    const buffer = await this.storageService.downloadFile(
      document.storagePath,
      document.storageProvider as any,
    );

    return {
      buffer,
      fileName: document.originalFileName,
      mimeType: document.mimeType,
    };
  }

  // ============================================================================
  // DOCUMENT REQUESTS
  // ============================================================================

  async createDocumentRequest(
    organizationId: string,
    dto: CreateDocumentRequestDto,
    requestedBy: string,
  ): Promise<DocumentRequestResponseDto> {
    const request = await this.prisma.documentRequest.create({
      data: {
        employeeId: dto.employeeId,
        documentTypeId: dto.documentTypeId,
        organizationId,
        requestedBy,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        reason: dto.reason,
        priority: dto.priority,
      },
    });

    return this.getDocumentRequest(organizationId, request.id);
  }

  async createBulkDocumentRequests(
    organizationId: string,
    dto: BulkDocumentRequestDto,
    requestedBy: string,
  ): Promise<{ created: number }> {
    let created = 0;

    for (const employeeId of dto.employeeIds) {
      for (const documentTypeId of dto.documentTypeIds) {
        // Check if request already exists
        const existing = await this.prisma.documentRequest.findFirst({
          where: {
            employeeId,
            documentTypeId,
            status: 'PENDING',
          },
        });

        if (!existing) {
          await this.prisma.documentRequest.create({
            data: {
              employeeId,
              documentTypeId,
              organizationId,
              requestedBy,
              dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
              reason: dto.reason,
              priority: dto.priority,
            },
          });
          created++;
        }
      }
    }

    return { created };
  }

  async getDocumentRequest(
    organizationId: string,
    requestId: string,
  ): Promise<DocumentRequestResponseDto> {
    const request = await this.prisma.documentRequest.findFirst({
      where: { id: requestId, organizationId },
    });

    if (!request) {
      throw new NotFoundException('Document request not found');
    }

    const [employee, documentType] = await Promise.all([
      this.prisma.employee.findUnique({ where: { id: request.employeeId } }),
      this.prisma.documentType.findUnique({ where: { id: request.documentTypeId } }),
    ]);

    const isOverdue = request.dueDate && new Date() > request.dueDate && request.status === 'PENDING';

    return {
      id: request.id,
      employeeId: request.employeeId,
      employeeName: `${employee?.firstName} ${employee?.lastName}`,
      documentTypeId: request.documentTypeId,
      documentTypeName: documentType?.name || '',
      requestedBy: request.requestedBy,
      requestedAt: request.requestedAt.toISOString(),
      dueDate: request.dueDate?.toISOString(),
      reason: request.reason || undefined,
      priority: request.priority as DocumentPriority,
      status: request.status,
      fulfilledAt: request.fulfilledAt?.toISOString(),
      documentId: request.documentId || undefined,
      remindersSent: request.remindersSent,
      lastReminderAt: request.lastReminderAt?.toISOString(),
      isOverdue: isOverdue ?? false,
    };
  }

  async listDocumentRequests(
    organizationId: string,
    filters: {
      employeeId?: string;
      status?: string;
      overdue?: boolean;
    },
  ): Promise<DocumentRequestResponseDto[]> {
    const where: any = { organizationId };

    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.status) where.status = filters.status;
    if (filters.overdue) {
      where.status = 'PENDING';
      where.dueDate = { lt: new Date() };
    }

    const requests = await this.prisma.documentRequest.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    });

    return Promise.all(
      requests.map((r) => this.getDocumentRequest(organizationId, r.id)),
    );
  }

  // ============================================================================
  // EXPIRY TRACKING
  // ============================================================================

  async getExpiringDocuments(
    organizationId: string,
    query: ExpiringDocumentsQueryDto,
  ): Promise<ExpiringDocumentDto[]> {
    const withinDays = query.withinDays || 30;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + withinDays);

    const where: any = {
      organizationId,
      isLatestVersion: true,
      expiryDate: { lte: futureDate },
      status: { notIn: ['ARCHIVED'] },
    };

    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.category) where.documentType = { category: query.category };

    const documents = await this.prisma.document.findMany({
      where,
      include: {
        employee: true,
        documentType: true,
        expiryAlerts: {
          orderBy: { sentAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { expiryDate: 'asc' },
    });

    return documents.map((doc) => {
      const daysUntilExpiry = Math.ceil(
        (doc.expiryDate!.getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000),
      );

      let status: 'WARNING' | 'CRITICAL' | 'EXPIRED';
      if (daysUntilExpiry < 0) {
        status = 'EXPIRED';
      } else if (daysUntilExpiry <= 7) {
        status = 'CRITICAL';
      } else {
        status = 'WARNING';
      }

      return {
        documentId: doc.id,
        employeeId: doc.employeeId,
        employeeName: `${doc.employee.firstName} ${doc.employee.lastName}`,
        documentTypeName: doc.documentType.name,
        documentTypeCategory: doc.documentType.category as DocumentCategory,
        documentNumber: doc.documentNumber || undefined,
        expiryDate: doc.expiryDate!.toISOString(),
        daysUntilExpiry,
        status,
        lastAlertSent: doc.expiryAlerts[0]?.sentAt?.toISOString(),
      };
    });
  }

  async getExpiryDashboard(organizationId: string): Promise<ExpiryDashboardDto> {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const baseWhere: any = {
      organizationId,
      isLatestVersion: true,
      status: { not: DocumentStatus.ARCHIVED },
      expiryDate: { not: null },
    };

    const [
      totalDocuments,
      expiredDocuments,
      expiringWithin7Days,
      expiringWithin30Days,
      expiringWithin90Days,
    ] = await Promise.all([
      this.prisma.document.count({ where: baseWhere }),
      this.prisma.document.count({ where: { ...baseWhere, expiryDate: { lt: now } } }),
      this.prisma.document.count({
        where: { ...baseWhere, expiryDate: { gte: now, lte: in7Days } },
      }),
      this.prisma.document.count({
        where: { ...baseWhere, expiryDate: { gte: now, lte: in30Days } },
      }),
      this.prisma.document.count({
        where: { ...baseWhere, expiryDate: { gte: now, lte: in90Days } },
      }),
    ]);

    // Get by category
    const categoryStats = await this.prisma.document.groupBy({
      by: ['documentTypeId'],
      where: baseWhere,
      _count: true,
    });

    const byCategory: ExpiryDashboardDto['byCategory'] = [];
    const categories = Object.values(DocumentCategory);

    for (const category of categories) {
      const docTypes = await this.prisma.documentType.findMany({
        where: { category, OR: [{ organizationId: null }, { organizationId }] },
      });
      const docTypeIds = docTypes.map((dt) => dt.id);

      if (docTypeIds.length === 0) continue;

      const [total, expired, expiringSoon] = await Promise.all([
        this.prisma.document.count({
          where: { ...baseWhere, documentTypeId: { in: docTypeIds } },
        }),
        this.prisma.document.count({
          where: { ...baseWhere, documentTypeId: { in: docTypeIds }, expiryDate: { lt: now } },
        }),
        this.prisma.document.count({
          where: {
            ...baseWhere,
            documentTypeId: { in: docTypeIds },
            expiryDate: { gte: now, lte: in30Days },
          },
        }),
      ]);

      if (total > 0) {
        byCategory.push({ category, total, expired, expiringSoon });
      }
    }

    return {
      totalDocuments,
      expiredDocuments,
      expiringWithin7Days,
      expiringWithin30Days,
      expiringWithin90Days,
      byCategory,
    };
  }

  // ============================================================================
  // COMPLIANCE CHECKLIST
  // ============================================================================

  async getEmployeeDocumentChecklist(
    organizationId: string,
    employeeId: string,
  ): Promise<EmployeeDocumentChecklistDto> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const documentTypes = await this.prisma.documentType.findMany({
      where: { OR: [{ organizationId: null }, { organizationId }], isActive: true },
      orderBy: [{ isRequired: 'desc' }, { category: 'asc' }, { sortOrder: 'asc' }],
    });

    const documents = await this.prisma.document.findMany({
      where: { employeeId, organizationId, isLatestVersion: true },
    });

    const docMap = new Map(documents.map((d) => [d.documentTypeId, d]));

    let totalRequired = 0;
    let totalUploaded = 0;
    let totalVerified = 0;
    let totalMissing = 0;
    let totalExpired = 0;

    const checklistDocs = documentTypes.map((dt) => {
      const doc = docMap.get(dt.id);
      if (dt.isRequired) totalRequired++;

      let status: string;
      let expiryDate: string | undefined;
      let daysUntilExpiry: number | undefined;

      if (!doc) {
        status = 'MISSING';
        if (dt.isRequired) totalMissing++;
      } else if (doc.expiryDate && doc.expiryDate < new Date()) {
        status = 'EXPIRED';
        totalExpired++;
        expiryDate = doc.expiryDate.toISOString();
        daysUntilExpiry = Math.ceil(
          (doc.expiryDate.getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000),
        );
      } else if (doc.status === 'VERIFIED') {
        status = 'VERIFIED';
        totalVerified++;
        totalUploaded++;
        if (doc.expiryDate) {
          expiryDate = doc.expiryDate.toISOString();
          daysUntilExpiry = Math.ceil(
            (doc.expiryDate.getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000),
          );
        }
      } else if (doc.status === 'REJECTED') {
        status = 'REJECTED';
      } else if (doc.status === 'UPLOADED') {
        status = 'UPLOADED';
        totalUploaded++;
      } else {
        status = 'PENDING';
      }

      return {
        documentTypeId: dt.id,
        documentTypeName: dt.name,
        category: dt.category as DocumentCategory,
        isRequired: dt.isRequired,
        status: status as any,
        documentId: doc?.id,
        expiryDate,
        daysUntilExpiry,
      };
    });

    const completionPercentage =
      totalRequired > 0 ? Math.round((totalVerified / totalRequired) * 100) : 100;

    return {
      employeeId,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      completionPercentage,
      totalRequired,
      totalUploaded,
      totalVerified,
      totalMissing,
      totalExpired,
      documents: checklistDocs,
    };
  }

  // ============================================================================
  // BULK OPERATIONS
  // ============================================================================

  async bulkVerify(
    organizationId: string,
    dto: BulkVerifyDto,
    verifiedBy: string,
  ): Promise<BulkOperationResultDto> {
    let successful = 0;
    const errors: Array<{ documentId: string; error: string }> = [];

    for (const documentId of dto.documentIds) {
      try {
        await this.verifyDocument(organizationId, documentId, {
          status: dto.status,
          notes: dto.notes,
          rejectionReason: dto.rejectionReason,
        }, verifiedBy);
        successful++;
      } catch (err) {
        errors.push({ documentId, error: (err as Error).message });
      }
    }

    return {
      totalRequested: dto.documentIds.length,
      successful,
      failed: errors.length,
      errors,
    };
  }

  async bulkArchive(
    organizationId: string,
    dto: BulkArchiveDto,
    archivedBy: string,
  ): Promise<BulkOperationResultDto> {
    let successful = 0;
    const errors: Array<{ documentId: string; error: string }> = [];

    for (const documentId of dto.documentIds) {
      try {
        await this.archiveDocument(organizationId, documentId, archivedBy);
        successful++;
      } catch (err) {
        errors.push({ documentId, error: (err as Error).message });
      }
    }

    return {
      totalRequested: dto.documentIds.length,
      successful,
      failed: errors.length,
      errors,
    };
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private async createExpiryAlerts(
    tx: any,
    documentId: string,
    expiryDate: Date,
    reminderDays: number[],
  ): Promise<void> {
    for (const days of reminderDays) {
      const alertDate = new Date(expiryDate);
      alertDate.setDate(alertDate.getDate() - days);

      if (alertDate > new Date()) {
        await tx.documentExpiryAlert.create({
          data: {
            documentId,
            alertDate,
            daysBeforeExpiry: days,
          },
        });
      }
    }
  }

  private async logAccess(
    documentId: string,
    userId: string,
    action: DocumentAccessAction,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.prisma.documentAccessLog.create({
      data: {
        documentId,
        userId,
        action,
        ipAddress,
        userAgent,
      },
    });
  }

  private mapDocumentToDto(doc: any): DocumentResponseDto {
    const now = new Date();
    let expiryStatus: 'OK' | 'WARNING' | 'EXPIRED' | undefined;
    let daysUntilExpiry: number | undefined;

    if (doc.expiryDate) {
      daysUntilExpiry = Math.ceil(
        (doc.expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
      );
      if (daysUntilExpiry < 0) {
        expiryStatus = 'EXPIRED';
      } else if (daysUntilExpiry <= 30) {
        expiryStatus = 'WARNING';
      } else {
        expiryStatus = 'OK';
      }
    }

    return {
      id: doc.id,
      employeeId: doc.employeeId,
      employeeName: `${doc.employee.firstName} ${doc.employee.lastName}`,
      documentTypeId: doc.documentTypeId,
      documentTypeName: doc.documentType.name,
      documentTypeCategory: doc.documentType.category,
      fileName: doc.fileName,
      originalFileName: doc.originalFileName,
      mimeType: doc.mimeType,
      fileSizeBytes: doc.fileSizeBytes,
      fileSizeFormatted: this.storageService.formatFileSize(doc.fileSizeBytes),
      title: doc.title,
      description: doc.description,
      documentNumber: doc.documentNumber,
      issueDate: doc.issueDate?.toISOString(),
      expiryDate: doc.expiryDate?.toISOString(),
      issuingAuthority: doc.issuingAuthority,
      country: doc.country,
      status: doc.status,
      version: doc.version,
      isLatestVersion: doc.isLatestVersion,
      verifiedAt: doc.verifiedAt?.toISOString(),
      verifiedBy: doc.verifiedBy,
      verificationNotes: doc.verificationNotes,
      rejectionReason: doc.rejectionReason,
      isConfidential: doc.isConfidential,
      visibleToEmployee: doc.visibleToEmployee,
      tags: doc.tags,
      uploadedBy: doc.uploadedBy,
      uploadedAt: doc.uploadedAt.toISOString(),
      expiryStatus,
      daysUntilExpiry,
    };
  }
}
