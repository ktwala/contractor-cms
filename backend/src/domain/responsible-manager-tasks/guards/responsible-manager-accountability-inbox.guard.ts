import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isResponsibleManagerAccountabilityInboxEnabled } from '../../../core/config/responsible-manager-accountability.config';

@Injectable()
export class ResponsibleManagerAccountabilityInboxGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(_context: ExecutionContext): boolean {
    if (!isResponsibleManagerAccountabilityInboxEnabled(this.config)) {
      throw new ForbiddenException(
        'Sponsor accountability inbox is disabled. Sponsor is an HCM reference on engagements; use IGA/workflow for approvals.',
      );
    }
    return true;
  }
}
