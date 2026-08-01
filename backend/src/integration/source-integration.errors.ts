import { ForbiddenException } from '@nestjs/common';
import { ContractorAuthorityMode, SupplierAuthorityMode } from '@prisma/client';
import { SourceSystemId } from './contracts/source-system.codes';

export const SOURCE_ADAPTER_DISABLED = 'SOURCE_ADAPTER_DISABLED';

export class SourceAdapterDisabledException extends ForbiddenException {
  constructor(
    sourceSystemId: SourceSystemId,
    supplierAuthorityMode?: SupplierAuthorityMode,
    contractorAuthorityMode?: ContractorAuthorityMode,
  ) {
    super({
      statusCode: 403,
      message: `Source adapter ${sourceSystemId} is not enabled for this tenant authority configuration.`,
      error: 'Forbidden',
      code: SOURCE_ADAPTER_DISABLED,
      sourceSystemId,
      supplierAuthorityMode,
      contractorAuthorityMode,
    });
  }
}
