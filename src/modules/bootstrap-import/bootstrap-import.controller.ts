import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AnyPermissions } from '../../common/decorators/permissions.decorator';
import { BootstrapImportService } from './bootstrap-import.service';

@Controller('v1/enterprise/bootstrap-imports')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class BootstrapImportController {
  constructor(private readonly service: BootstrapImportService) {}

  @Post('upload')
  @AnyPermissions('data_import:write', 'iam:legal_entities:manage')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls' && ext !== 'zip') {
      throw new BadRequestException('Unsupported file type. Upload an .xlsx workbook or .zip bootstrap pack.');
    }
    return this.service.upload(file.buffer, file.originalname, req.user.sub);
  }

  @Get('template/download')
  @AnyPermissions('data_import:read', 'data_import:write', 'iam:legal_entities:manage')
  async downloadTemplate(@Res() res: Response) {
    const buffer = this.service.generateWorkbookTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Hubsec_Workforce_Onboarding_Template.xlsx"');
    res.send(buffer);
  }

  @Get(':id')
  @AnyPermissions('data_import:read', 'data_import:write', 'iam:legal_entities:manage')
  async getById(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Post(':id/run')
  @AnyPermissions('data_import:write', 'data_import:publish', 'iam:legal_entities:manage')
  async run(@Param('id') id: string, @Req() req: any) {
    return this.service.run(id, req.user.sub);
  }

  @Post(':id/cancel')
  @AnyPermissions('data_import:write', 'iam:legal_entities:manage')
  async cancel(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Req() req: any,
  ) {
    return this.service.cancelImport(id, req.user.sub, reason);
  }

  @Post(':id/retry')
  @AnyPermissions('data_import:write', 'data_import:publish', 'iam:legal_entities:manage')
  async retry(@Param('id') id: string, @Req() req: any) {
    return this.service.retryImport(id, req.user.sub);
  }
}
