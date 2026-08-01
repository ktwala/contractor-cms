import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { AsyncEntityOption } from './AsyncEntitySelect';
import { UserSelect } from './UserSelect';

type Props = {
  value: string[];
  onChange: (values: string[], options: AsyncEntityOption[]) => void;
  legalEntityId?: string;
  placeholder?: string;
  disabled?: boolean;
  testId?: string;
};

const chip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  borderRadius: 999,
  background: '#f1f5f9',
  padding: '4px 12px',
  fontSize: '0.875rem',
  color: '#334155',
};

export function MultiUserSelect({
  value,
  onChange,
  legalEntityId,
  placeholder = 'Add interviewer…',
  disabled = false,
  testId = 'multi-user-select',
}: Props) {
  const [selectedOptions, setSelectedOptions] = useState<AsyncEntityOption[]>([]);
  const selectedMap = useMemo(() => new Set(value), [value]);

  useEffect(() => {
    setSelectedOptions((prev) => prev.filter((o) => value.includes(o.id)));
  }, [value]);

  function handleAdd(nextValue?: string, option?: AsyncEntityOption) {
    if (!nextValue || !option) return;
    if (selectedMap.has(nextValue)) return;
    const nextValues = [...value, nextValue];
    const nextOptions = [...selectedOptions, option];
    setSelectedOptions(nextOptions);
    onChange(nextValues, nextOptions);
  }

  function handleRemove(id: string) {
    const nextValues = value.filter((v) => v !== id);
    const nextOptions = selectedOptions.filter((o) => o.id !== id);
    setSelectedOptions(nextOptions);
    onChange(nextValues, nextOptions);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid={testId}>
      <UserSelect
        value={undefined}
        onChange={handleAdd}
        legalEntityId={legalEntityId}
        placeholder={placeholder}
        disabled={disabled}
        testId={`${testId}-picker`}
      />
      {selectedOptions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {selectedOptions.map((option) => (
            <div key={option.id} style={chip} data-testid={`${testId}-chip-${option.id}`}>
              <span>{option.label}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(option.id)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
                  aria-label={`Remove ${option.label}`}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
