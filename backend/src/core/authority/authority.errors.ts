import { ForbiddenException } from '@nestjs/common';
import { SUPPLIER_MASTER_CREATION_FORBIDDEN } from './authority.constants';

export class SupplierMasterCreationForbiddenException extends ForbiddenException {
  constructor(supplierAuthorityMode: string) {
    super({
      statusCode: 403,
      message:
        'Supplier master records must be created in the authoritative upstream system (Oracle Procurement). CMS governs compliance and operational trust only.',
      error: 'Forbidden',
      code: SUPPLIER_MASTER_CREATION_FORBIDDEN,
      supplierAuthorityMode,
    });
  }
}
