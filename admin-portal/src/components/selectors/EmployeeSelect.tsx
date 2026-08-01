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
};

export function EmployeeSelect({
  value,
  onChange,
  legalEntityId,
  placeholder = 'Search employee…',
  disabled = false,
  testId = 'employee-select',
}: Props) {
  const loadOptions = useCallback(
    (query: string) =>
      lookupsService.searchEmployees({
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
      noResultsText="No employees found"
      testId={testId}
    />
  );
}
