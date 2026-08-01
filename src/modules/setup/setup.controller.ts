import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SetupService, SetupStatusResponse } from './setup.service';
import { AnyPermissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Controller('setup')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Get('status')
  @AnyPermissions('iam:legal_entities:manage', 'legal_entity:read', 'hr:read', 'employee:read')
  async getStatus(): Promise<SetupStatusResponse> {
    return this.setupService.getStatus();
  }
}
