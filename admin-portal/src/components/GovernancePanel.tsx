import { Link } from 'react-router-dom';
import { Card, Section, ui } from '../ui/layout';
import * as styles from '../styles/common';
import { useAccess } from '../hooks/useAccess';

export default function GovernancePanel() {
  const { canAny } = useAccess();

  const items: { label: string; href: string; permission?: string }[] = [
    { label: 'Users', href: '/enterprise/users', permission: 'iam:users:manage' },
    { label: 'Role Templates', href: '/enterprise/roles', permission: 'iam:roles:manage' },
    { label: 'Approval Workflows', href: '/enterprise/workflows', permission: 'iam:roles:manage' },
    { label: 'HR Export (IGA)', href: '/enterprise/hr-export', permission: 'hr:read' },
  ];

  const visibleItems = items.filter((i) => !i.permission || canAny([i.permission]));

  if (visibleItems.length === 0) return null;

  return (
    <Section title="Governance & Integrations" subtitle="Access control, workflows, and HR feed.">
      <Card>
        <div style={{ padding: ui.space.lg, display: 'flex', flexWrap: 'wrap', gap: ui.space.sm }}>
          {visibleItems.map(({ label, href }) => (
            <Link
              key={href}
              to={href}
              style={{
                padding: '10px 16px',
                borderRadius: 10,
                border: `1px solid ${styles.colors.borderLight}`,
                fontSize: 14,
                fontWeight: 600,
                color: styles.colors.textPrimary,
                textDecoration: 'none',
                background: 'white',
              }}
            >
              {label}
            </Link>
          ))}
        </div>
      </Card>
    </Section>
  );
}
