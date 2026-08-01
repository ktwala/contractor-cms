import { BadRequestException } from '@nestjs/common';
import { UNSUPPORTED_SUPPLIER_JURISDICTION } from './supplier-jurisdiction.constants';

export class UnsupportedSupplierJurisdictionException extends BadRequestException {
  constructor(jurisdiction: string) {
    super({
      statusCode: 400,
      message: `Unsupported supplier jurisdiction: ${jurisdiction}. Supported jurisdictions: ZA, LS.`,
      error: 'Bad Request',
      code: UNSUPPORTED_SUPPLIER_JURISDICTION,
      jurisdiction,
    });
  }
}
