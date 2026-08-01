import { useCallback } from 'react';
import { AsyncEntitySelect, type AsyncEntityOption } from './AsyncEntitySelect';
import { lookupsService } from '../../services/recruitment/lookups.service';

type Props = {
  value?: string;
  onChange: (value?: string, option?: AsyncEntityOption) => void;
  legalEntityId?: string;
  candidateId?: string;
  allowedStages?: string[];
  placeholder?: string;
  disabled?: boolean;
  testId?: string;
};

export function ApplicationSelect({
  value,
  onChange,
  legalEntityId,
  candidateId,
  allowedStages,
  placeholder = 'Search candidate or requisition…',
  disabled = false,
  testId = 'application-select',
}: Props) {
  const loadOptions = useCallback(
    (query: string) =>
      lookupsService.searchApplications({
        query,
        legalEntityId,
        candidateId,
        allowedStages,
      }),
    [legalEntityId, candidateId, allowedStages],
  );

  return (
    <AsyncEntitySelect
      value={value}
      onChange={onChange}
      loadOptions={loadOptions}
      placeholder={placeholder}
      disabled={disabled}
      noResultsText="No matching applications"
      testId={testId}
    />
  );
}
