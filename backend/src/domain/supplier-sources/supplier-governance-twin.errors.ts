import { BadRequestException, ConflictException } from '@nestjs/common';

export const SUPPLIER_SOURCE_IDENTITY_IMMUTABLE = 'SUPPLIER_SOURCE_IDENTITY_IMMUTABLE';
export const SUPPLIER_STAGING_NOT_PROMOTABLE = 'SUPPLIER_STAGING_NOT_PROMOTABLE';
export const SUPPLIER_ORACLE_EXTERNAL_ID_CONFLICT = 'SUPPLIER_ORACLE_EXTERNAL_ID_CONFLICT';

export class SupplierSourceIdentityImmutableException extends BadRequestException {
  constructor(field: string) {
    super({
      statusCode: 400,
      message: `Supplier ${field} is immutable after Oracle governance link.`,
      error: 'Bad Request',
      code: SUPPLIER_SOURCE_IDENTITY_IMMUTABLE,
      field,
    });
  }
}

export class SupplierStagingNotPromotableException extends BadRequestException {
  constructor(matchStatus: string, reason: string) {
    super({
      statusCode: 400,
      message: reason,
      error: 'Bad Request',
      code: SUPPLIER_STAGING_NOT_PROMOTABLE,
      matchStatus,
    });
  }
}

export class SupplierOracleExternalIdConflictException extends ConflictException {
  constructor(externalSupplierId: string, existingSupplierId: string) {
    super({
      statusCode: 409,
      message:
        'Another CMS governance profile is already linked to this Oracle supplier id.',
      error: 'Conflict',
      code: SUPPLIER_ORACLE_EXTERNAL_ID_CONFLICT,
      externalSupplierId,
      existingSupplierId,
    });
  }
}
