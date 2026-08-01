import { Link } from 'react-router-dom';
import { Card, Section, ui } from '../ui/layout';
import * as styles from '../styles/common';

type OrganisationLinksProps = {
  legalEntities: number;
  orgUnits: number;
  costCenters: number;
  companyGroups: number;
  positions: number;
};

const formatCount = (n: number | null | undefined) => (n === null || n === undefined ? '—' : String(n));

export default function OrganisationLinks({
  legalEntities,
  orgUnits,
  costCenters,
  companyGroups,
  positions,
}: OrganisationLinksProps) {
  const links = [
    { label: 'Legal Entities', href: '/enterprise/legal-entities', count: legalEntities },
    { label: 'Company Groups', href: '/enterprise/company-groups', count: companyGroups },
    { label: 'Org Structure', href: '/enterprise/org-structure', count: orgUnits },
    { label: 'Positions', href: '/enterprise/positions', count: positions },
    { label: 'Cost Centers', href: '/enterprise/cost-centers', count: costCenters },
  ];

  return (
    <Section title="Organisation structure" subtitle="Master data and structure.">
      <Card>
        <div style={{ padding: ui.space.lg, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: ui.space.lg }}>
          {links.map(({ label, href, count }) => (
            <Link
              key={href}
              to={href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                padding: 12,
                borderRadius: 10,
                border: `1px solid ${styles.colors.borderLight}`,
                textDecoration: 'none',
                color: 'inherit',
                background: 'transparent',
                transition: 'background 0.15s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(0,0,0,0.02)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: styles.colors.textMuted, textTransform: 'uppercase' }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: styles.colors.textPrimary }}>{formatCount(count)}</div>
            </Link>
          ))}
        </div>
      </Card>
    </Section>
  );
}
