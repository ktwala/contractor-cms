// Admin Portal Design Tokens and Shared Styles
// Slate/Dark theme for admin interface

import type { CSSProperties } from 'react';

export const colors = {
    // Primary - Slate/Indigo theme for admin
    primary: '#4f46e5',
    primaryHover: '#4338ca',

    // Backgrounds
    background: '#f8fafc',
    cardBg: '#ffffff',
    sidebarBg: '#1e293b',
    headerBg: '#0f172a',

    // Text
    text: '#1e293b',
    textPrimary: '#1e293b',
    textSecondary: '#475569',
    textMuted: '#94a3b8',
    textLight: '#f1f5f9',

    // Borders
    border: '#e2e8f0',
    borderLight: '#f1f5f9',

    // Status
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',

    // Gradients
    gradientAdmin: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
    gradientDark: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
};

export const shadows = {
    card: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
    cardHover: '0 10px 25px rgba(0, 0, 0, 0.12), 0 4px 10px rgba(0, 0, 0, 0.08)',
    sidebar: '4px 0 6px rgba(0, 0, 0, 0.1)',
};

// Page Layout (spacing.pagePadding = 24)
export const pageContainer: CSSProperties = {
    padding: 24,
    minHeight: 'calc(100vh - 64px)',
    background: colors.background,
};

// Global layout wrapper (used in AdminLayout)
export const pageShell: CSSProperties = {
    padding: '24px 32px',
    backgroundColor: colors.background,
    minHeight: 'calc(100vh - 64px)',
};

export const pageContent: CSSProperties = {
    maxWidth: 1200,
    margin: '0 auto',
};

// Standardized card base (use everywhere)
export const cardBase: CSSProperties = {
    background: colors.cardBg,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    padding: 20,
};

// Card header pattern
export const cardHeaderStyle: CSSProperties = {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 12,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
};

// 2-column grid (Overview, etc.)
export const gridTwo: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 20,
};

// Profile header (EmployeeDetail)
export const profileHeader: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
};

export const profileName: CSSProperties = {
    fontSize: 28,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
};

export const profileMeta: CSSProperties = {
    marginTop: 6,
    fontSize: 14,
    color: colors.textSecondary,
    display: 'flex',
    gap: 8,
};

export const profileActions: CSSProperties = {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
};

// Tab bar (enterprise sub-nav)
export const tabBar: CSSProperties = {
    display: 'flex',
    gap: 28,
    borderBottom: `1px solid ${colors.border}`,
    marginBottom: 24,
};

export const tabButton: CSSProperties = {
    background: 'none',
    border: 'none',
    padding: '12px 0',
    fontSize: 15,
    fontWeight: 600,
    color: colors.textSecondary,
    cursor: 'pointer',
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
};

export const tabActive: CSSProperties = {
    color: colors.textPrimary,
    borderBottom: '3px solid #6366f1',
    marginBottom: -1,
    position: 'relative',
};

export const pageHeader: CSSProperties = {
    marginBottom: '1.5rem',
};

export const pageTitle: CSSProperties = {
    fontSize: '1.75rem',
    fontWeight: 700,
    color: colors.textPrimary,
    marginBottom: '0.25rem',
};

export const pageSubtitle: CSSProperties = {
    fontSize: '0.95rem',
    color: colors.textSecondary,
};

export const sectionTitle: CSSProperties = {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: colors.textPrimary,
    marginTop: '2rem',
    marginBottom: '1rem',
};

// Cards (aligned with tokens: radius 12, border, subtle shadow)
export const card: CSSProperties = {
    background: colors.cardBg,
    borderRadius: 12,
    border: '1px solid #eee',
    padding: 20,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
};

export const cardHeader: CSSProperties = {
    paddingBottom: '1rem',
    marginBottom: '1rem',
    borderBottom: `1px solid ${colors.borderLight}`,
};

export const cardTitle: CSSProperties = {
    fontSize: '1rem',
    fontWeight: 600,
    color: colors.textPrimary,
};

// Grid Layouts
export const grid2: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '1.5rem',
};

export const grid3: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '1.5rem',
};

export const grid4: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '1.5rem',
};

// Buttons
export const buttonPrimary: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    background: colors.gradientAdmin,
    color: 'white',
    fontWeight: 600,
    fontSize: '0.875rem',
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
};

export const buttonSecondary: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 1rem',
    background: 'white',
    color: colors.textSecondary,
    fontWeight: 500,
    fontSize: '0.875rem',
    borderRadius: '8px',
    border: `1px solid ${colors.border}`,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
};

export const buttonDanger: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 1rem',
    background: '#fee2e2',
    color: '#dc2626',
    fontWeight: 500,
    fontSize: '0.875rem',
    borderRadius: '8px',
    border: '1px solid #fecaca',
    cursor: 'pointer',
};

// Form Elements
export const formLabel: CSSProperties = {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: colors.textPrimary,
    marginBottom: '0.5rem',
};

export const formInput: CSSProperties = {
    width: '100%',
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    border: `1px solid ${colors.border}`,
    borderRadius: '10px',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box',
};

/** Alias for pages that use `styles.input` */
export const input = formInput;

export const formSelect: CSSProperties = {
    ...formInput,
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 0.75rem center',
    backgroundSize: '1.25rem',
    paddingRight: '2.5rem',
};

// Tables
export const table: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
};

export const tableHeader: CSSProperties = {
    background: colors.background,
};

export const tableHeaderCell: CSSProperties = {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
};

export const tableRow: CSSProperties = {
    borderBottom: `1px solid ${colors.borderLight}`,
    transition: 'background 0.15s',
};

export const tableCell: CSSProperties = {
    padding: '12px 16px',
    fontSize: '0.875rem',
    color: colors.textPrimary,
};

export const th = tableHeaderCell;
export const td = tableCell;
export const tr = tableRow;

// Badges
export const badge = (type: 'success' | 'warning' | 'danger' | 'info' | 'default' = 'default'): CSSProperties => {
    const styles: Record<string, { bg: string; color: string }> = {
        success: { bg: '#d1fae5', color: '#065f46' },
        warning: { bg: '#fef3c7', color: '#92400e' },
        danger: { bg: '#fee2e2', color: '#991b1b' },
        info: { bg: '#dbeafe', color: '#1e40af' },
        default: { bg: '#f1f5f9', color: '#475569' },
    };
    const s = styles[type];
    return {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.25rem 0.75rem',
        fontSize: '0.75rem',
        fontWeight: 500,
        borderRadius: '9999px',
        background: s.bg,
        color: s.color,
    };
};

// Icon Container
export const iconContainer = (gradient = colors.gradientAdmin): CSSProperties => ({
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    background: gradient,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginRight: '1rem',
});

// Flex helpers
export const flexBetween: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
};

export const flexStart: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
};

// Tab styles
export const tabContainer: CSSProperties = {
    display: 'flex',
    gap: '0.25rem',
    borderBottom: `1px solid ${colors.border}`,
    marginBottom: '1.5rem',
};

export const tab = (active: boolean): CSSProperties => ({
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: active ? colors.primary : colors.textSecondary,
    borderBottom: active ? `2px solid ${colors.primary}` : '2px solid transparent',
    marginBottom: '-1px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
});

// Loading & Empty states
export const loadingContainer: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem',
};

export const loadingSpinner: CSSProperties = {
    width: '40px',
    height: '40px',
    border: '3px solid #e2e8f0',
    borderTop: `3px solid ${colors.primary}`,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    marginBottom: '1rem',
};

export const emptyState: CSSProperties = {
    textAlign: 'center',
    padding: '3rem',
};

export const emptyStateIcon: CSSProperties = {
    color: colors.textMuted,
    marginBottom: '1rem',
};

export const emptyStateTitle: CSSProperties = {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: colors.textPrimary,
    marginBottom: '0.5rem',
};

export const emptyStateText: CSSProperties = {
    color: colors.textMuted,
    fontSize: '0.875rem',
};

export const spinKeyframes = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
