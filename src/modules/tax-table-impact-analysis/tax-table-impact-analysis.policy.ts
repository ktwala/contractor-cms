import { TtaException } from '../tax-table-authoring/types/error-codes';

const ALLOWED_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'];
const SUPPORTED_COUNTRIES = ['ZA', 'LS'];

export function assertImpactAnalysisAllowed(input: {
  authoringStatus: string;
  countryCode: string;
}): void {
  if (!ALLOWED_STATUSES.includes(input.authoringStatus)) {
    throw new TtaException(
      'TTA_IMPACT_INVALID_STATUS',
      `Impact analysis is only available for versions in ${ALLOWED_STATUSES.join(', ')} status`,
      undefined,
      400,
    );
  }

  if (!SUPPORTED_COUNTRIES.includes(input.countryCode)) {
    throw new TtaException(
      'TTA_IMPACT_UNSUPPORTED_COUNTRY',
      `Impact analysis is not supported for country: ${input.countryCode}`,
      undefined,
      400,
    );
  }
}
