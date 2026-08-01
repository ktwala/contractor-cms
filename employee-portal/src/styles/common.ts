// Shared styles for consistent modern UI across all pages
// These inline styles ensure reliable rendering in the Docker environment

export const colors = {
    // Primary palette
    primary: '#6366f1',
    primaryLight: '#818cf8',
    primaryDark: '#4f46e5',

    // Accent gradients
    gradientPrimary: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    gradientSuccess: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
    gradientWarning: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
    gradientDanger: 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)',
    gradientInfo: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',

    // Neutrals
    background: '#f8fafc',
    cardBg: '#ffffff',
    border: '#e2e8f0',
    borderLight: '#f1f5f9',

    // Text
    textPrimary: '#1e293b',
    textSecondary: '#64748b',
    textMuted: '#94a3b8',

    // Status
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
};

export const shadows = {
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 1px 3px rgba(0, 0, 0, 0.08)',
    lg: '0 4px 6px rgba(0, 0, 0, 0.07)',
    xl: '0 10px 25px rgba(0, 0, 0, 0.1)',
    card: '0 1px 3px rgba(0,0,0,0.08)',
    cardHover: '0 8px 25px rgba(0,0,0,0.1)',
};

// Page container styles
export const pageContainer: React.CSSProperties = {
    minHeight: '100vh',
    background: colors.background,
    padding: '2rem',
};

// Page header styles
export const pageHeader: React.CSSProperties = {
    marginBottom: '2rem',
};

export const pageTitle: React.CSSProperties = {
    fontSize: '2rem',
    fontWeight: 700,
    color: colors.textPrimary,
    marginBottom: '0.25rem',
};

export const pageSubtitle: React.CSSProperties = {
    color: colors.textSecondary,
    fontSize: '1rem',
};

// Card styles
export const card: React.CSSProperties = {
    background: colors.cardBg,
    borderRadius: '16px',
    padding: '1.5rem',
    boxShadow: shadows.card,
    border: `1px solid ${colors.border}`,
};

export const cardHeader: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: '1rem',
    marginBottom: '1rem',
    borderBottom: `1px solid ${colors.borderLight}`,
};

export const cardTitle: React.CSSProperties = {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: colors.textPrimary,
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
};

// Table styles
export const table: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse' as const,
};

export const tableHeader: React.CSSProperties = {
    background: '#f8fafc',
    borderBottom: `1px solid ${colors.border}`,
};

export const tableHeaderCell: React.CSSProperties = {
    padding: '0.875rem 1.5rem',
    textAlign: 'left' as const,
    fontSize: '0.75rem',
    fontWeight: 600,
    color: colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
};

export const tableRow: React.CSSProperties = {
    borderBottom: `1px solid ${colors.borderLight}`,
    transition: 'background 0.15s ease',
};

export const tableCell: React.CSSProperties = {
    padding: '1rem 1.5rem',
    color: colors.textPrimary,
    fontSize: '0.875rem',
};

// Button styles
export const buttonPrimary: React.CSSProperties = {
    background: colors.gradientPrimary,
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    padding: '0.75rem 1.25rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
    transition: 'all 0.2s ease',
};

export const buttonSecondary: React.CSSProperties = {
    background: 'white',
    color: colors.textPrimary,
    border: `1px solid ${colors.border}`,
    borderRadius: '10px',
    padding: '0.75rem 1.25rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    transition: 'all 0.2s ease',
};

export const buttonDanger: React.CSSProperties = {
    background: colors.danger,
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    padding: '0.75rem 1.25rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
};

// Icon container styles
export const iconContainer = (gradient: string): React.CSSProperties => ({
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: gradient,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
});

export const iconContainerSmall = (bgColor: string): React.CSSProperties => ({
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    background: bgColor,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
});

// Form styles
export const formLabel: React.CSSProperties = {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: colors.textSecondary,
    marginBottom: '0.5rem',
};

export const formInput: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem 1rem',
    background: colors.background,
    border: `2px solid ${colors.border}`,
    borderRadius: '10px',
    fontSize: '0.875rem',
    color: colors.textPrimary,
    outline: 'none',
    transition: 'border-color 0.2s ease',
    boxSizing: 'border-box' as const,
};

export const formSelect: React.CSSProperties = {
    ...formInput,
    cursor: 'pointer',
};

// Badge/Tag styles
export const badge = (type: 'success' | 'warning' | 'danger' | 'info' | 'default'): React.CSSProperties => {
    const bgColors = {
        success: '#d1fae5',
        warning: '#fef3c7',
        danger: '#fee2e2',
        info: '#dbeafe',
        default: '#f1f5f9',
    };
    const textColors = {
        success: '#059669',
        warning: '#d97706',
        danger: '#dc2626',
        info: '#2563eb',
        default: '#64748b',
    };
    return {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.25rem 0.75rem',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: 500,
        background: bgColors[type],
        color: textColors[type],
    };
};

// Empty state styles
export const emptyState: React.CSSProperties = {
    textAlign: 'center' as const,
    padding: '4rem 2rem',
};

export const emptyStateIcon: React.CSSProperties = {
    margin: '0 auto 1rem',
    color: '#cbd5e1',
};

export const emptyStateTitle: React.CSSProperties = {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: colors.textPrimary,
    marginBottom: '0.5rem',
};

export const emptyStateText: React.CSSProperties = {
    color: colors.textSecondary,
    fontSize: '0.875rem',
};

// Loading state styles
export const loadingContainer: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '300px',
    flexDirection: 'column' as const,
    gap: '1rem',
};

export const loadingSpinner: React.CSSProperties = {
    width: '40px',
    height: '40px',
    border: `3px solid ${colors.border}`,
    borderTopColor: colors.primary,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
};

// Grid layouts
export const grid2: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '1.5rem',
};

export const grid3: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '1.5rem',
};

export const grid4: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '1.5rem',
};

// Flex utilities
export const flexBetween: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
};

export const flexCenter: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};

export const flexStart: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
};

// Keyframe animation (to be injected in components)
export const spinKeyframes = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

// Tab styles
export const tabContainer: React.CSSProperties = {
    display: 'flex',
    gap: '0.5rem',
    borderBottom: `1px solid ${colors.border}`,
    marginBottom: '1.5rem',
};

export const tab = (isActive: boolean): React.CSSProperties => ({
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: isActive ? colors.primary : colors.textSecondary,
    borderBottom: isActive ? `2px solid ${colors.primary}` : '2px solid transparent',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginBottom: '-1px',
});

// Section divider
export const sectionTitle: React.CSSProperties = {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: colors.textPrimary,
    marginBottom: '1rem',
    marginTop: '2rem',
};
