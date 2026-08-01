import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import {
  assertSupplierEntityAccess,
  applySupplierEntityScope,
} from '../../core/auth/utils/supplier-scope.helper';
import { isKnownEvidenceDocType } from './supplier-evidence-catalog';
import { resolveSupplierJurisdictionCode } from './supplier-jurisdiction.constants';
import { SupplierEvidenceChecklistService } from './supplier-evidence-checklist.service';
import { CreateSupplierDocumentDto } from './dto/create-supplier-document.dto';
import { UpdateSupplierDocumentDto } from './dto/update-supplier-document.dto';
import { EvidenceChecklistResult } from './supplier-evidence.types';

export type SupplierDocumentView = {
  id: string;
  supplierId: string;
  type: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  expiryDate: string | null;
  notes: string | null;
  uploadedBy: string;
  uploadedAt: string;
  updatedAt: string;
  expired: boolean;
};

@Injectable()
export class SupplierDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly evidenceChecklist: SupplierEvidenceChecklistService,
  ) {}

  private presentDocument(
    doc: {
      id: string;
      supplierId: string;
      type: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
      expiryDate: Date | null;
      notes: string | null;
      uploadedBy: string;
      uploadedAt: Date;
      updatedAt: Date;
    },
    now = new Date(),
  ): SupplierDocumentView {
    const expired =
      doc.expiryDate != null && doc.expiryDate.getTime() < now.getTime();
    return {
      id: doc.id,
      supplierId: doc.supplierId,
      type: doc.type,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
      expiryDate: doc.expiryDate?.toISOString() ?? null,
      notes: doc.notes,
      uploadedBy: doc.uploadedBy,
      uploadedAt: doc.uploadedAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
      expired,
    };
  }

  private async loadSupplierOrThrow(
    accessContext: AccessContext,
    supplierId: string,
  ) {
    assertSupplierEntityAccess(accessContext, supplierId);
    const where: Record<string, unknown> = { id: supplierId };
    if (!accessContext.isGlobalAccess) {
      where.organizationId = accessContext.targetOrganizationId;
    }
    applySupplierEntityScope(where, accessContext);

    const supplier = await this.prisma.supplier.findFirst({ where });
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }
    return supplier;
  }

  async getChecklist(
    accessContext: AccessContext,
    supplierId: string,
  ): Promise<EvidenceChecklistResult> {
    await this.loadSupplierOrThrow(accessContext, supplierId);
    return this.evidenceChecklist.buildChecklistForSupplier(supplierId);
  }

  async listDocuments(
    accessContext: AccessContext,
    supplierId: string,
  ): Promise<SupplierDocumentView[]> {
    await this.loadSupplierOrThrow(accessContext, supplierId);
    const docs = await this.prisma.supplierDocument.findMany({
      where: { supplierId },
      orderBy: [{ type: 'asc' }, { uploadedAt: 'desc' }],
    });
    return docs.map((d) => this.presentDocument(d));
  }

  async createDocument(
    accessContext: AccessContext,
    supplierId: string,
    dto: CreateSupplierDocumentDto,
  ): Promise<SupplierDocumentView> {
    const supplier = await this.loadSupplierOrThrow(accessContext, supplierId);

    const jurisdiction = resolveSupplierJurisdictionCode(
      supplier.country,
      supplier.countryCode,
    );

    if (!isKnownEvidenceDocType(dto.type, jurisdiction)) {
      throw new BadRequestException(
        `Unknown evidence document type "${dto.type}" for jurisdiction ${jurisdiction}`,
      );
    }

    const filePath =
      dto.filePath?.trim() ||
      `uploads/suppliers/${supplierId}/${dto.type}/${Date.now()}-${dto.fileName}`;

    const expiryDate = dto.expiryDate ? new Date(dto.expiryDate) : null;

    const created = await this.prisma.supplierDocument.create({
      data: {
        supplierId,
        type: dto.type,
        fileName: dto.fileName.trim(),
        filePath,
        fileSize: dto.fileSize,
        mimeType: dto.mimeType.trim(),
        expiryDate,
        notes: dto.notes?.trim() || null,
        uploadedBy: accessContext.actorUserId,
      },
    });

    await this.auditService.logAction(
      accessContext.actorUserId,
      'SUPPLIER_DOCUMENT_ADDED',
      'SupplierDocument',
      created.id,
      null,
      {
        supplierId,
        type: created.type,
        fileName: created.fileName,
        expiryDate: created.expiryDate,
      },
      { organizationId: supplier.organizationId },
    );

    if (
      created.expiryDate &&
      created.expiryDate.getTime() < Date.now()
    ) {
      await this.auditService.logAction(
        accessContext.actorUserId,
        'SUPPLIER_DOCUMENT_EXPIRED',
        'SupplierDocument',
        created.id,
        null,
        { expiryDate: created.expiryDate },
        { organizationId: supplier.organizationId },
      );
    }

    return this.presentDocument(created);
  }

  async updateDocument(
    accessContext: AccessContext,
    supplierId: string,
    documentId: string,
    dto: UpdateSupplierDocumentDto,
  ): Promise<SupplierDocumentView> {
    const supplier = await this.loadSupplierOrThrow(accessContext, supplierId);

    const existing = await this.prisma.supplierDocument.findFirst({
      where: { id: documentId, supplierId },
    });
    if (!existing) {
      throw new NotFoundException('Supplier document not found');
    }

    const expiryDate =
      dto.expiryDate === undefined
        ? existing.expiryDate
        : dto.expiryDate === null
          ? null
          : new Date(dto.expiryDate);

    const updated = await this.prisma.supplierDocument.update({
      where: { id: documentId },
      data: {
        fileName: dto.fileName?.trim() ?? existing.fileName,
        expiryDate,
        notes:
          dto.notes === undefined ? existing.notes : dto.notes?.trim() || null,
      },
    });

    await this.auditService.logAction(
      accessContext.actorUserId,
      'SUPPLIER_DOCUMENT_UPDATED',
      'SupplierDocument',
      documentId,
      {
        fileName: existing.fileName,
        expiryDate: existing.expiryDate,
        notes: existing.notes,
      },
      {
        fileName: updated.fileName,
        expiryDate: updated.expiryDate,
        notes: updated.notes,
      },
      { organizationId: supplier.organizationId },
    );

    const now = new Date();
    const wasExpired =
      existing.expiryDate != null && existing.expiryDate.getTime() < now.getTime();
    const isExpired =
      updated.expiryDate != null && updated.expiryDate.getTime() < now.getTime();

    if (isExpired && !wasExpired) {
      await this.auditService.logAction(
        accessContext.actorUserId,
        'SUPPLIER_DOCUMENT_EXPIRED',
        'SupplierDocument',
        documentId,
        { expiryDate: existing.expiryDate },
        { expiryDate: updated.expiryDate },
        { organizationId: supplier.organizationId },
      );
    }

    return this.presentDocument(updated);
  }
}
