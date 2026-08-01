import { useCallback } from 'react';
import { AsyncEntitySelect, type AsyncEntityOption } from './AsyncEntitySelect';
import { lookupsService } from '../../services/recruitment/lookups.service';

type Props = {
  value?: string;
  onChange: (value?: string, option?: AsyncEntityOption) => void;
  placeholder?: string;
  legalEntityId?: string;
  disabled?: boolean;
  testId?: string;
};

export function UserSelect({
  value,
  onChange,
  placeholder = 'Search user…',
  legalEntityId,
  disabled = false,
  testId = 'user-select',
}: Props) {
  const loadOptions = useCallback(
    (query: string) =>
      lookupsService.searchUsers({
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
      noResultsText="No users found"
      testId={testId}
    />
  );
}
