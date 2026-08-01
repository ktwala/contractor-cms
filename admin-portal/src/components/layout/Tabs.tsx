import { spacing } from '../../styles/tokens';
import { colors } from '../../styles/common';

export interface TabDef {
  key: string;
  label: string;
  badge?: string;
}

interface TabsProps {
  tabs: TabDef[];
  activeKey: string;
  onSelect: (key: string) => void;
  variant?: 'underline' | 'pill';
}

export default function Tabs({ tabs, activeKey, onSelect, variant = 'underline' }: TabsProps) {
  if (variant === 'pill') {
    return (
      <div style={{ display: 'flex', gap: 4, marginBottom: spacing.blockGap }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => onSelect(t.key)}
            type="button"
            style={{
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 600,
              border: 'none',
              borderRadius: 999,
              cursor: 'pointer',
              background: activeKey === t.key ? colors.primary : 'transparent',
              color: activeKey === t.key ? 'white' : colors.textSecondary,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {t.label}
            {t.badge && (
              <span
                style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  borderRadius: 999,
                  background: activeKey === t.key ? 'rgba(255,255,255,0.3)' : '#f1f5f9',
                  color: activeKey === t.key ? 'white' : colors.textMuted,
                }}
              >
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 24,
        borderBottom: '1px solid #e2e8f0',
        marginBottom: spacing.blockGap,
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onSelect(t.key)}
          type="button"
          style={{
            background: 'none',
            border: 'none',
            padding: '10px 0',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            position: 'relative' as const,
            color: activeKey === t.key ? colors.textPrimary : colors.textMuted,
            borderBottom: activeKey === t.key ? '3px solid #6366f1' : '3px solid transparent',
            marginBottom: -1,
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          {t.label}
          {t.badge && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 11,
                background: '#f1f5f9',
                padding: '2px 6px',
                borderRadius: 999,
                color: colors.textMuted,
              }}
            >
              {t.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
