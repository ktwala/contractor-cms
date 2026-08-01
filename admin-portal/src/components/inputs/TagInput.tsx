import { useMemo, useState, type CSSProperties } from 'react';
import * as styles from '../../styles/common';

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
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

export function TagInput({
  value,
  onChange,
  placeholder = 'Type a skill and press Enter',
  disabled = false,
  testId = 'tag-input',
}: Props) {
  const [input, setInput] = useState('');
  const normalized = useMemo(() => value.map((v) => v.trim()).filter(Boolean), [value]);

  function addTag(raw: string) {
    const next = raw.trim();
    if (!next) return;
    if (normalized.some((x) => x.toLowerCase() === next.toLowerCase())) return;
    onChange([...normalized, next]);
    setInput('');
  }

  function removeTag(tag: string) {
    onChange(normalized.filter((x) => x !== tag));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid={testId}>
      <input
        style={styles.input}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag(input);
          } else if (e.key === 'Backspace' && !input && normalized.length) {
            removeTag(normalized[normalized.length - 1]);
          }
        }}
        onBlur={() => {
          if (input.trim()) addTag(input);
        }}
        placeholder={placeholder}
        disabled={disabled}
      />
      {normalized.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {normalized.map((tag) => (
            <div key={tag} style={chip} data-testid={`${testId}-chip-${tag}`}>
              <span>{tag}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
                  aria-label={`Remove ${tag}`}
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
