// admin-portal/src/ui/layout.tsx
import React from 'react';
import * as styles from '../styles/common';

export const ui = {
  // spacing scale (consistent "rhythm" everywhere)
  space: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
  },
  radius: {
    sm: 10,
    md: 14,
    lg: 18,
  },
  shadow: {
    sm: '0 1px 2px rgba(0,0,0,0.06)',
    md: '0 8px 24px rgba(0,0,0,0.08)',
  },
  border: `1px solid ${styles.colors.border}`,
};

// -------------------------
// Layout primitives
// -------------------------

export function AppShell(props: {
  sidebar: React.ReactNode;
  header: React.ReactNode;
  children: React.ReactNode;
  sidebarWidth: number;
}) {
  const { sidebar, header, children, sidebarWidth } = props;

  return (
    <div style={{ minHeight: '100vh', background: styles.colors.background, display: 'flex' }}>
      {sidebar}
      <div
        style={{
          flex: 1,
          marginLeft: sidebarWidth,
          transition: 'margin-left 0.2s ease',
          minWidth: 0,
        }}
      >
        {header}
        <main style={{ padding: ui.space.lg, maxWidth: 1200, margin: '0 auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}

export function TopBar(props: { left?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <header
      style={{
        height: 64,
        background: 'white',
        borderBottom: ui.border,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 ${ui.space.lg}px`,
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: ui.space.md, minWidth: 0 }}>
        {props.left}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: ui.space.md }}>
        {props.right}
      </div>
    </header>
  );
}

export function Stack(props: { gap?: number; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: props.gap ?? ui.space.lg, ...props.style }}>
      {props.children}
    </div>
  );
}

export function Grid(props: { cols?: string | number; gap?: number; children: React.ReactNode; style?: React.CSSProperties }) {
  const cols = typeof props.cols === 'number' ? `repeat(${props.cols}, 1fr)` : (props.cols ?? '1fr 1fr');
  return (
    <div style={{ display: 'grid', gridTemplateColumns: cols, gap: props.gap ?? ui.space.lg, ...props.style }}>
      {props.children}
    </div>
  );
}

export function Page(props: { title?: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: ui.space.lg }}>
      {(props.title || props.actions) && (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: ui.space.lg }}>
          <div style={{ minWidth: 0 }}>
            {props.title && (
              <div style={{ fontSize: 22, fontWeight: 800, color: styles.colors.textPrimary, display: 'flex', alignItems: 'center', gap: ui.space.sm }}>
                {props.title}
              </div>
            )}
            {props.subtitle != null && props.subtitle !== '' && (
              <div style={{ marginTop: 6, color: styles.colors.textSecondary, fontSize: 13 }}>
                {props.subtitle}
              </div>
            )}
          </div>
          {props.actions && <div style={{ flexShrink: 0 }}>{props.actions}</div>}
        </div>
      )}

      {props.children}
    </div>
  );
}

export function Card(props: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: 'white',
        border: ui.border,
        borderRadius: ui.radius.md,
        boxShadow: ui.shadow.sm,
        padding: ui.space.lg,
        ...props.style,
      }}
    >
      {props.children}
    </div>
  );
}

export function CardHeader(props: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: ui.space.md, marginBottom: ui.space.md }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 800, color: styles.colors.textPrimary }}>{props.title}</div>
        {props.subtitle && (
          <div style={{ marginTop: 4, color: styles.colors.textSecondary, fontSize: 13 }}>
            {props.subtitle}
          </div>
        )}
      </div>
      {props.right && <div style={{ flexShrink: 0 }}>{props.right}</div>}
    </div>
  );
}

export function Section(props: { title: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: ui.space.md }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: ui.space.md }}>
        <div>
          <div style={{ fontWeight: 800, color: styles.colors.textPrimary }}>{props.title}</div>
          {props.subtitle && (
            <div style={{ marginTop: 4, color: styles.colors.textSecondary, fontSize: 13 }}>
              {props.subtitle}
            </div>
          )}
        </div>
        {props.right && <div style={{ flexShrink: 0 }}>{props.right}</div>}
      </div>
      {props.children}
    </div>
  );
}

export function EmptyState(props: { title: string; description?: React.ReactNode; icon?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card>
      <div style={{ display: 'flex', gap: ui.space.md, alignItems: 'flex-start' }}>
        {props.icon && <div style={{ flexShrink: 0 }}>{props.icon}</div>}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, color: styles.colors.textPrimary }}>{props.title}</div>
          {props.description && (
            <div style={{ marginTop: 6, color: styles.colors.textSecondary, fontSize: 13 }}>
              {props.description}
            </div>
          )}
          {props.action && <div style={{ marginTop: ui.space.md }}>{props.action}</div>}
        </div>
      </div>
    </Card>
  );
}

export function Banner(props: { variant?: 'error' | 'warn' | 'warning' | 'info' | 'success'; children: React.ReactNode; style?: React.CSSProperties }) {
  const v = props.variant === 'warning' ? 'warn' : props.variant ?? 'info';
  const bg = v === 'error' ? '#fef2f2' : v === 'warn' ? '#fffbeb' : v === 'success' ? '#f0fdf4' : '#eff6ff';
  const border = v === 'error' ? styles.colors.danger : v === 'warn' ? styles.colors.warning : v === 'success' ? '#16a34a' : styles.colors.info;
  const color = v === 'error' ? '#991b1b' : v === 'warn' ? '#92400e' : v === 'success' ? '#166534' : '#1e40af';
  return (
    <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: ui.space.lg, background: bg, borderLeft: `4px solid ${border}`, color, ...props.style }}>
      {props.children}
    </div>
  );
}

// -------------------------
// Tabs primitives (optional for pages like EmployeeDetail)
// -------------------------

export function TabsBar(props: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        padding: 6,
        background: 'white',
        border: ui.border,
        borderRadius: ui.radius.md,
        boxShadow: ui.shadow.sm,
        overflowX: 'auto',
      }}
    >
      {props.children}
    </div>
  );
}

export function Tab(props: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={props.onClick}
      type="button"
      style={{
        border: 'none',
        cursor: 'pointer',
        padding: '10px 12px',
        borderRadius: 10,
        background: props.active ? styles.colors.background : 'transparent',
        color: props.active ? styles.colors.textPrimary : styles.colors.textSecondary,
        fontWeight: props.active ? 800 : 600,
        whiteSpace: 'nowrap',
      }}
    >
      {props.children}
    </button>
  );
}
