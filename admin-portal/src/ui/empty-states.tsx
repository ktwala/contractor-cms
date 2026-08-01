import React from 'react';
import { EmptyState } from './layout';
import * as styles from '../styles/common';

export type EmptyStateAction = React.ReactNode;

export function ForbiddenEmptyState(props: {
  feature: string;
  description?: string;
  action?: EmptyStateAction;
}) {
  return (
    <EmptyState
      icon={<LockIcon />}
      title={`You don't have access to ${props.feature}`}
      description={
        props.description ??
        'Contact your Tenant Admin if you believe this is a mistake.'
      }
      action={props.action}
    />
  );
}

export function UnavailableEmptyState(props: {
  feature: string;
  description?: string;
  action?: EmptyStateAction;
}) {
  return (
    <EmptyState
      icon={<InfoIcon />}
      title={`${props.feature} not available`}
      description={
        props.description ??
        'This may not be enabled for this tenant yet.'
      }
      action={props.action}
    />
  );
}

export function EmptyListState(props: {
  title: string;
  description?: string;
  action?: EmptyStateAction;
}) {
  return (
    <EmptyState
      icon={<InboxIcon />}
      title={props.title}
      description={props.description}
      action={props.action}
    />
  );
}

// --- icons (inline, dependency-free) ---

function IconFrame(props: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: 42,
        height: 42,
        borderRadius: 12,
        background: styles.colors.background,
        border: `1px solid ${styles.colors.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {props.children}
    </div>
  );
}

function LockIcon() {
  return (
    <IconFrame>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={styles.colors.textSecondary}>
        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0v4" />
        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 11h12v10H6z" />
      </svg>
    </IconFrame>
  );
}

function InfoIcon() {
  return (
    <IconFrame>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={styles.colors.textSecondary}>
        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01" />
        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 14v-4" />
        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
      </svg>
    </IconFrame>
  );
}

function InboxIcon() {
  return (
    <IconFrame>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={styles.colors.textSecondary}>
        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M22 12h-6l-2 3h-4l-2-3H2" />
        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 7l2-3h10l2 3v13H5z" />
      </svg>
    </IconFrame>
  );
}
