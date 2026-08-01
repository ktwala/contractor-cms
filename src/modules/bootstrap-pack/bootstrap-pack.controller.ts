import {
  BadRequestException,
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { BootstrapPackService } from './bootstrap-pack.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AnyPermissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Controller('api/enterprise/bootstrap-pack')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class BootstrapPackController {
  constructor(private readonly service: BootstrapPackService) {}

  @Post('parse')
  @AnyPermissions('data_import:read', 'data_import:write', 'iam:legal_entities:manage')
  @UseInterceptors(FileInterceptor('file'))
  parse(@UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer) {
      throw new BadRequestException('File is required');
    }
    if (!file.originalname?.toLowerCase().endsWith('.zip')) {
      throw new BadRequestException('File must be a ZIP archive');
    }
    const { zip, ...result } = this.service.parsePack(file.buffer);
    return result;
  }

  @Post('import')
  @AnyPermissions('data_import:write', 'data_import:publish', 'iam:legal_entities:manage')
  @UseInterceptors(FileInterceptor('file'))
  async import(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('sub') userId: string,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('File is required');
    }
    if (!file.originalname?.toLowerCase().endsWith('.zip')) {
      throw new BadRequestException('File must be a ZIP archive');
    }
    return this.service.importPack(file.buffer, file.originalname, userId);
  }
}
