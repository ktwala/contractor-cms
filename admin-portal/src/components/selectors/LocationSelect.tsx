import { useCallback } from 'react';
import { AsyncEntitySelect, type AsyncEntityOption } from './AsyncEntitySelect';
import { lookupsService } from '../../services/recruitment/lookups.service';

type Props = {
  value?: string;
  onChange: (value?: string, option?: AsyncEntityOption) => void;
  legalEntityId?: string;
  placeholder?: string;
  disabled?: boolean;
  testId?: string;
  closedLabel?: string;
};

export function LocationSelect({
  value,
  onChange,
  legalEntityId,
  placeholder = 'Search office / site…',
  disabled = false,
  testId = 'location-select',
  closedLabel,
}: Props) {
  const loadOptions = useCallback(
    (query: string) =>
      lookupsService.searchWorkLocations({
        query,
        legalEntityId,
      }),
    [legalEntityId],
  );

  return (
    <AsyncEntitySelect
      value={value}
      onChange={onChange}
      loadOptions={loadOptions}
      placeholder={placeholder}
      disabled={disabled}
      noResultsText="No locations found"
      testId={testId}
      closedLabel={closedLabel}
    />
  );
}
