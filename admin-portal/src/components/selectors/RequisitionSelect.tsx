import { useCallback } from 'react';
import { AsyncEntitySelect, type AsyncEntityOption } from './AsyncEntitySelect';
import { lookupsService } from '../../services/recruitment/lookups.service';

type Props = {
  value?: string;
  onChange: (value?: string, option?: AsyncEntityOption) => void;
  legalEntityId?: string;
  onlyPosted?: boolean;
  placeholder?: string;
  disabled?: boolean;
  testId?: string;
};

export function RequisitionSelect({
  value,
  onChange,
  legalEntityId,
  onlyPosted = false,
  placeholder = 'Search requisition…',
  disabled = false,
  testId = 'requisition-select',
}: Props) {
  const loadOptions = useCallback(
    (query: string) =>
      lookupsService.searchRequisitions({
        query,
        legalEntityId,
        onlyPosted,
      }),
    [legalEntityId, onlyPosted],
  );

  return (
    <AsyncEntitySelect
      value={value}
      onChange={onChange}
      loadOptions={loadOptions}
      placeholder={placeholder}
      disabled={disabled}
      noResultsText="No requisitions found"
      testId={testId}
    />
  );
}
