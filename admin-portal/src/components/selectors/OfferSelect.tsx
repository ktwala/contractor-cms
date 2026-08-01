import { useCallback } from 'react';
import { AsyncEntitySelect, type AsyncEntityOption } from './AsyncEntitySelect';
import { lookupsService } from '../../services/recruitment/lookups.service';

type Props = {
  value?: string;
  onChange: (value?: string, option?: AsyncEntityOption) => void;
  legalEntityId?: string;
  acceptedOnly?: boolean;
  placeholder?: string;
  disabled?: boolean;
  testId?: string;
};

export function OfferSelect({
  value,
  onChange,
  legalEntityId,
  acceptedOnly = false,
  placeholder = 'Select candidate (accepted offer)…',
  disabled = false,
  testId = 'offer-select',
}: Props) {
  const loadOptions = useCallback(
    (query: string) =>
      lookupsService.searchOffers({
        query,
        legalEntityId,
        acceptedOnly,
      }),
    [legalEntityId, acceptedOnly],
  );

  return (
    <AsyncEntitySelect
      value={value}
      onChange={onChange}
      loadOptions={loadOptions}
      placeholder={placeholder}
      disabled={disabled}
      noResultsText="No matching offers found"
      testId={testId}
    />
  );
}
