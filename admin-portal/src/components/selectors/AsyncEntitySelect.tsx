import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import * as styles from '../../styles/common';

export type AsyncEntityOption = {
  id: string;
  label: string;
  subtitle?: string;
  meta?: Record<string, unknown>;
};

type Props = {
  value?: string;
  onChange: (value?: string, option?: AsyncEntityOption) => void;
  loadOptions: (query: string) => Promise<AsyncEntityOption[]>;
  placeholder?: string;
  disabled?: boolean;
  noResultsText?: string;
  testId?: string;
  /** When there is no selected id, show this text while the dropdown is closed (e.g. legacy string from API). */
  closedLabel?: string;
};

const dropdown: CSSProperties = {
  position: 'absolute',
  zIndex: 30,
  marginTop: 8,
  maxHeight: 256,
  width: '100%',
  overflow: 'auto',
  borderRadius: 10,
  border: `1px solid ${styles.colors.border}`,
  background: styles.colors.cardBg,
  boxShadow: styles.shadows.cardHover,
};

const optionBtn: CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '10px 12px',
  textAlign: 'left',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '0.875rem',
};

export function AsyncEntitySelect({
  value,
  onChange,
  loadOptions,
  placeholder = 'Search…',
  disabled = false,
  noResultsText = 'No results',
  testId,
  closedLabel,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<AsyncEntityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<AsyncEntityOption | undefined>();

  const displayValue = useMemo(() => {
    if (open) return query;
    if (selectedOption?.label) return selectedOption.label;
    if (!value && closedLabel) return closedLabel;
    return '';
  }, [open, query, selectedOption, value, closedLabel]);

  useEffect(() => {
    let mounted = true;

    async function run() {
      setLoading(true);
      try {
        const result = await loadOptions(query);
        if (!mounted) return;
        setOptions((prev) => {
          const byId = new Map<string, AsyncEntityOption>();
          for (const item of [...prev, ...result]) byId.set(item.id, item);
          return Array.from(byId.values());
        });
        if (value) {
          const matched = result.find((x) => x.id === value);
          if (matched) setSelectedOption(matched);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (open) void run();
    return () => {
      mounted = false;
    };
  }, [open, query, loadOptions, value]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!value) {
      setSelectedOption(undefined);
      return;
    }
    const existing = options.find((x) => x.id === value);
    if (existing) setSelectedOption(existing);
  }, [value, options]);

  const inputStyle: CSSProperties = {
    ...styles.formInput,
    paddingRight: value && !disabled ? '2.25rem' : undefined,
  };

  return (
    <div style={{ position: 'relative' }} ref={containerRef} data-testid={testId}>
      <input
        value={displayValue}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        placeholder={placeholder}
        disabled={disabled}
        style={inputStyle}
      />
      {value && !disabled && (
        <button
          type="button"
          onClick={() => {
            setSelectedOption(undefined);
            setQuery('');
            onChange(undefined, undefined);
          }}
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: styles.colors.textMuted,
            fontSize: 12,
          }}
          aria-label="Clear selection"
        >
          ✕
        </button>
      )}

      {open && !disabled && (
        <div style={dropdown}>
          {loading ? (
            <div style={{ padding: '10px 12px', fontSize: '0.875rem', color: styles.colors.textMuted }}>Loading…</div>
          ) : options.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: '0.875rem', color: styles.colors.textMuted }}>{noResultsText}</div>
          ) : (
            options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setSelectedOption(option);
                  setOpen(false);
                  setQuery('');
                  onChange(option.id, option);
                }}
                style={optionBtn}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = styles.colors.background;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
                data-testid={testId ? `${testId}-option-${option.id}` : undefined}
              >
                <div style={{ fontWeight: 600, color: styles.colors.textPrimary }}>{option.label}</div>
                {option.subtitle && (
                  <div style={{ fontSize: '0.75rem', color: styles.colors.textMuted, marginTop: 2 }}>{option.subtitle}</div>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
