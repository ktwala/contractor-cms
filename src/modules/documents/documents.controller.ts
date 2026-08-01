import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  Res,
  ParseUUIDPipe,
  HttpStatus,
  HttpCode,
  Headers,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { DocumentsService } from './documents.service';
import {
  CreateDocumentTypeDto,
  UpdateDocumentTypeDto,
  UploadDocumentDto,
  UpdateDocumentDto,
  VerifyDocumentDto,
  DocumentListQueryDto,
  CreateDocumentRequestDto,
  BulkDocumentRequestDto,
  ExpiringDocumentsQueryDto,
  BulkVerifyDto,
  BulkArchiveDto,
  DocumentCategory,
} from './dto/documents.dto';

/**
 * Document Management Controller
 * Handles employee document uploads, verification, expiry tracking, and compliance
 */
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // ============================================================================
  // DOCUMENT TYPES
  // ============================================================================

  @Get('types')
  async getDocumentTypes(
    @Headers('x-organization-id') organizationId: string,
    @Query('category') category?: DocumentCategory,
  ) {
    return this.documentsService.getDocumentTypes(organizationId, category);
  }

  @Post('types')
  async createDocumentType(
    @Headers('x-organization-id') organizationId: string,
    @Body() dto: CreateDocumentTypeDto,
  ) {
    return this.documentsService.createDocumentType(organizationId, dto);
  }

  @Put('types/:id')
  async updateDocumentType(
    @Headers('x-organization-id') organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDocumentTypeDto,
  ) {
    return this.documentsService.updateDocumentType(organizationId, id, dto);
  }

  @Post('types/initialize-defaults')
  @HttpCode(HttpStatus.NO_CONTENT)
  async initializeDefaultDocumentTypes(
    @Headers('x-organization-id') organizationId: string,
  ) {
    await this.documentsService.initializeDefaultDocumentTypes(organizationId);
  }

  // ============================================================================
  // DOCUMENT UPLOAD & MANAGEMENT
  // ============================================================================

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Headers('x-organization-id') organizationId: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.documentsService.uploadDocument(organizationId, dto, file, userId);
  }

  @Get()
  async listDocuments(
    @Headers('x-organization-id') organizationId: string,
    @Query() query: DocumentListQueryDto,
  ) {
    return this.documentsService.listDocuments(organizationId, query);
  }

  @Get(':id')
  async getDocument(
    @Headers('x-organization-id') organizationId: string,
    @Headers('x-user-id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documentsService.getDocument(organizationId, id, userId);
  }

  @Put(':id')
  async updateDocument(
    @Headers('x-organization-id') organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.documentsService.updateDocument(organizationId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDocument(
    @Headers('x-organization-id') organizationId: string,
    @Headers('x-user-id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.documentsService.deleteDocument(organizationId, id, userId);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.NO_CONTENT)
  async archiveDocument(
    @Headers('x-organization-id') organizationId: string,
    @Headers('x-user-id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.documentsService.archiveDocument(organizationId, id, userId);
  }

  // ============================================================================
  // DOCUMENT VERIFICATION
  // ============================================================================

  @Post(':id/verify')
  async verifyDocument(
    @Headers('x-organization-id') organizationId: string,
    @Headers('x-user-id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyDocumentDto,
  ) {
    return this.documentsService.verifyDocument(organizationId, id, dto, userId);
  }

  @Post('bulk/verify')
  async bulkVerifyDocuments(
    @Headers('x-organization-id') organizationId: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: BulkVerifyDto,
  ) {
    return this.documentsService.bulkVerify(organizationId, dto, userId);
  }

  @Post('bulk/archive')
  async bulkArchiveDocuments(
    @Headers('x-organization-id') organizationId: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: BulkArchiveDto,
  ) {
    return this.documentsService.bulkArchive(organizationId, dto, userId);
  }

  // ============================================================================
  // DOCUMENT DOWNLOAD
  // ============================================================================

  @Get(':id/download')
  async downloadDocument(
    @Headers('x-organization-id') organizationId: string,
    @Headers('x-user-id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { buffer, fileName, mimeType } = await this.documentsService.downloadDocument(
      organizationId,
      id,
      userId,
    );

    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  // ============================================================================
  // DOCUMENT REQUESTS
  // ============================================================================

  @Post('requests')
  async createDocumentRequest(
    @Headers('x-organization-id') organizationId: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: CreateDocumentRequestDto,
  ) {
    return this.documentsService.createDocumentRequest(organizationId, dto, userId);
  }

  @Post('requests/bulk')
  async createBulkDocumentRequests(
    @Headers('x-organization-id') organizationId: string,
    @Headers('x-user-id') userId: string,
    @Body() dto: BulkDocumentRequestDto,
  ) {
    return this.documentsService.createBulkDocumentRequests(organizationId, dto, userId);
  }

  @Get('requests')
  async listDocumentRequests(
    @Headers('x-organization-id') organizationId: string,
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string,
    @Query('overdue') overdue?: boolean,
  ) {
    return this.documentsService.listDocumentRequests(organizationId, {
      employeeId,
      status,
      overdue,
    });
  }

  @Get('requests/:id')
  async getDocumentRequest(
    @Headers('x-organization-id') organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documentsService.getDocumentRequest(organizationId, id);
  }

  // ============================================================================
  // EXPIRY TRACKING
  // ============================================================================

  @Get('expiry/dashboard')
  async getExpiryDashboard(
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.documentsService.getExpiryDashboard(organizationId);
  }

  @Get('expiry/expiring')
  async getExpiringDocuments(
    @Headers('x-organization-id') organizationId: string,
    @Query() query: ExpiringDocumentsQueryDto,
  ) {
    return this.documentsService.getExpiringDocuments(organizationId, query);
  }

  // ============================================================================
  // COMPLIANCE CHECKLIST
  // ============================================================================

  @Get('compliance/employee/:employeeId')
  async getEmployeeDocumentChecklist(
    @Headers('x-organization-id') organizationId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
  ) {
    return this.documentsService.getEmployeeDocumentChecklist(organizationId, employeeId);
  }
}

/**
 * Self-Service Document Controller
 * Endpoints for employees to manage their own documents
 */
@Controller('self-service/documents')
export class DocumentSelfServiceController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  async getMyDocuments(
    @Headers('x-organization-id') organizationId: string,
    @Headers('x-user-id') userId: string,
    @Headers('x-employee-id') employeeId: string,
    @Query() query: DocumentListQueryDto,
  ) {
    // Force employee filter to only show their own documents
    query.employeeId = employeeId;
    return this.documentsService.listDocuments(organizationId, query);
  }

  @Get('checklist')
  async getMyDocumentChecklist(
    @Headers('x-organization-id') organizationId: string,
    @Headers('x-employee-id') employeeId: string,
  ) {
    return this.documentsService.getEmployeeDocumentChecklist(organizationId, employeeId);
  }

  @Get('requests')
  async getMyDocumentRequests(
    @Headers('x-organization-id') organizationId: string,
    @Headers('x-employee-id') employeeId: string,
  ) {
    return this.documentsService.listDocumentRequests(organizationId, {
      employeeId,
    });
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadMyDocument(
    @Headers('x-organization-id') organizationId: string,
    @Headers('x-user-id') userId: string,
    @Headers('x-employee-id') employeeId: string,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    // Force employee ID to only allow uploading own documents
    dto.employeeId = employeeId;
    return this.documentsService.uploadDocument(organizationId, dto, file, userId);
  }

  @Get(':id')
  async getMyDocument(
    @Headers('x-organization-id') organizationId: string,
    @Headers('x-user-id') userId: string,
    @Headers('x-employee-id') employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const doc = await this.documentsService.getDocument(organizationId, id, userId);

    // Ensure employee can only view their own documents that are visible to them
    if (doc.employeeId !== employeeId || !doc.visibleToEmployee) {
      throw new Error('Document not found');
    }

    return doc;
  }

  @Get(':id/download')
  async downloadMyDocument(
    @Headers('x-organization-id') organizationId: string,
    @Headers('x-user-id') userId: string,
    @Headers('x-employee-id') employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    // First verify it's the employee's own document
    const doc = await this.documentsService.getDocument(organizationId, id, userId);
    if (doc.employeeId !== employeeId || !doc.visibleToEmployee) {
      throw new Error('Document not found');
    }

    const { buffer, fileName, mimeType } = await this.documentsService.downloadDocument(
      organizationId,
      id,
      userId,
    );

    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  @Get('expiry/expiring')
  async getMyExpiringDocuments(
    @Headers('x-organization-id') organizationId: string,
    @Headers('x-employee-id') employeeId: string,
    @Query('withinDays') withinDays?: number,
  ) {
    return this.documentsService.getExpiringDocuments(organizationId, {
      employeeId,
      withinDays,
    });
  }
}
