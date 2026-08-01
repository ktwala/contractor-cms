import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Page, Card, CardHeader, Section, ui } from '../ui/layout';

type Scope = 'GLOBAL' | 'LEGAL_ENTITY';

type RoleTemplate = {
  key: string;
  name: string;
  domain: 'Governance' | 'HCM' | 'Payroll' | 'SARS' | 'Audit' | 'Integrations' | 'Break-glass';
  scopeDefault: Scope;
  description: string;
  highlights: string[]; // outcome bullets (max 3 in collapsed)
  topPermissions: string[];
  fullPermissions?: string[]; // for scrollable mono list when longer than topPermissions
  sensitive?: boolean;
  sodNote?: string;
};

const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    key: 'TENANT_ADMIN',
    name: 'Tenant Admin',
    domain: 'Governance',
    scopeDefault: 'GLOBAL',
    description: 'Tenant governance: manage IAM, legal entities, and view audit events.',
    highlights: ['Manage users, roles, legal entities', 'View audit events', 'No payroll or SARS access'],
    topPermissions: ['iam:users:manage', 'iam:roles:manage', 'iam:legal_entities:manage', 'audit:events:read'],
  },
  {
    key: 'HR_ADMIN',
    name: 'HR Admin',
    domain: 'HCM',
    scopeDefault: 'LEGAL_ENTITY',
    description: 'Employee master data: joiners/movers/leavers and employment history.',
    highlights: ['Manage employees and employments', 'Lifecycle (joiners/movers/leavers)', 'Feeds IGA/JML'],
    topPermissions: ['employee:read', 'employee:write', 'employment:read', 'employment:write'],
    sensitive: true,
  },
  {
    key: 'PAYROLL_CLERK',
    name: 'Payroll Clerk',
    domain: 'Payroll',
    scopeDefault: 'LEGAL_ENTITY',
    description: 'Prepare payruns and view employee data required for processing.',
    highlights: ['Run payruns (create/calc/submit)', 'Read employee data for processing', 'Cannot approve or pay'],
    topPermissions: ['payrun:read', 'payrun:create', 'payrun:calculate', 'payrun:submit', 'employee:read', 'employment:read'],
    fullPermissions: ['payrun:read', 'payrun:create', 'payrun:edit', 'payrun:snapshot', 'payrun:calculate', 'payrun:submit', 'payrun:trace:read', 'payrun:adjust', 'employee:read', 'employment:read'],
  },
  {
    key: 'PAYROLL_APPROVER',
    name: 'Payroll Approver',
    domain: 'Payroll',
    scopeDefault: 'LEGAL_ENTITY',
    description: 'Approve payruns (Separation of Duties enforced).',
    highlights: ['Approve payruns only', 'No create or edit', 'SoD: cannot approve own'],
    topPermissions: ['payrun:read', 'payrun:approve', 'payrun:trace:read'],
    sodNote: 'Cannot approve payruns they created (PR-SOD-01).',
  },
  {
    key: 'FINANCE_APPROVER',
    name: 'Finance Approver',
    domain: 'Payroll',
    scopeDefault: 'LEGAL_ENTITY',
    description: 'Handle payment and close-out steps (pay/post/finalize).',
    highlights: ['Pay, post to GL, finalize payruns', 'SoD: cannot finalize if paid'],
    topPermissions: ['payrun:read', 'payrun:pay', 'payrun:post', 'payrun:finalize', 'payrun:trace:read'],
    fullPermissions: ['payrun:read', 'payrun:pay', 'payrun:post', 'payrun:finalize', 'payrun:trace:read'],
    sensitive: true,
    sodNote: 'Cannot finalize payruns they paid (PR-SOD-03).',
  },
  {
    key: 'SARS_OFFICER',
    name: 'SARS Officer',
    domain: 'SARS',
    scopeDefault: 'LEGAL_ENTITY',
    description: 'Generate/export statutory reports and run validations.',
    highlights: ['Generate IRP5 + EMP201', 'Export and validate', 'Cannot submit'],
    topPermissions: ['sars:irp5:read', 'sars:irp5:generate', 'sars:emp201:read', 'sars:emp201:generate', 'sars:validation:run'],
    fullPermissions: ['sars:tax_periods:read', 'sars:irp5:read', 'sars:irp5:generate', 'sars:irp5:export', 'sars:emp201:read', 'sars:emp201:generate', 'sars:emp201:export', 'sars:emp501:read', 'sars:emp501:generate', 'sars:emp501:export', 'sars:validation:run'],
    sensitive: true,
  },
  {
    key: 'SARS_APPROVER',
    name: 'SARS Approver',
    domain: 'SARS',
    scopeDefault: 'LEGAL_ENTITY',
    description: 'Submit/approve statutory filings (SoD enforced).',
    highlights: ['Submit EMP201, approve EMP501', 'SoD: generator cannot submit'],
    topPermissions: ['sars:emp201:read', 'sars:emp201:submit', 'sars:emp501:read', 'sars:emp501:approve', 'sars:submission:read'],
    fullPermissions: ['sars:emp201:read', 'sars:emp201:submit', 'sars:submission:manage', 'sars:submission:read', 'sars:emp501:read', 'sars:emp501:approve'],
    sensitive: true,
    sodNote: 'Cannot submit EMP201 they generated. Cannot approve EMP501 they submitted (SARS-SOD-01, SARS-SOD-02).',
  },
  {
    key: 'AUDITOR_READONLY',
    name: 'Auditor (Read-only)',
    domain: 'Audit',
    scopeDefault: 'LEGAL_ENTITY',
    description: 'Read-only oversight across payruns, SARS and audit events.',
    highlights: ['Read-only payrun, SARS, audit', 'Traceability', 'No exports'],
    topPermissions: ['payrun:read', 'payrun:trace:read', 'sars:irp5:read', 'sars:emp201:read', 'sars:emp501:read', 'audit:events:read'],
  },
  {
    key: 'INTEGRATION_IGA',
    name: 'Integration: IGA',
    domain: 'Integrations',
    scopeDefault: 'GLOBAL',
    description: 'Service role for HR export delta feed to IGA (read-only).',
    highlights: ['HR export API only', 'No UI admin actions', 'For connectors'],
    topPermissions: ['hr:read'],
  },
  {
    key: 'PLATFORM_SUPERADMIN',
    name: 'Platform Superadmin (Break-glass)',
    domain: 'Break-glass',
    scopeDefault: 'GLOBAL',
    description: 'Emergency access only. Use time-bound assignment and approvals.',
    highlights: ['All permissions', 'Break-glass only', 'Time-bound recommended'],
    topPermissions: ['(all permissions)'],
    sensitive: true,
  },
];

const WHO_IS_THIS_FOR: { domain: string; personas: string }[] = [
  { domain: 'Governance', personas: 'Tenant Admin' },
  { domain: 'HCM', personas: 'HR' },
  { domain: 'Payroll', personas: 'Clerk / Approver / Finance' },
  { domain: 'SARS', personas: 'SARS Officer / SARS Approver' },
  { domain: 'Audit', personas: 'Auditor (read-only)' },
  { domain: 'Integrations', personas: 'IGA' },
  { domain: 'Break-glass', personas: 'Platform Superadmin' },
];

function DomainPill({ text }: { text: string }) {
  return (
    <span
      style={{
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: 'rgba(79,70,229,0.10)',
        color: 'rgba(79,70,229,0.95)',
      }}
    >
      {text}
    </span>
  );
}

function ScopeChip({ scope }: { scope: 'GLOBAL' | 'LEGAL_ENTITY' }) {
  const isGlobal = scope === 'GLOBAL';
  return (
    <span
      style={{
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        background: isGlobal ? 'rgba(34,197,94,0.12)' : 'rgba(59,130,246,0.12)',
        color: isGlobal ? 'rgba(22,101,52,0.95)' : 'rgba(29,78,216,0.95)',
      }}
    >
      {scope}
    </span>
  );
}

export default function RolesManagement() {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const total = ROLE_TEMPLATES.length;

  const countsByDomain = ROLE_TEMPLATES.reduce<Record<string, number>>((acc, r) => {
    acc[r.domain] = (acc[r.domain] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Page
      title="Role Templates"
      subtitle="Canonical role definitions used across the platform. To assign roles to users, go to Governance → Users."
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link
            to="/enterprise/users"
            style={{
              padding: '10px 18px',
              borderRadius: 12,
              border: '1px solid rgba(79,70,229,0.3)',
              background: 'rgba(79,70,229,0.12)',
              color: 'rgba(79,70,229,0.95)',
              fontWeight: 700,
              fontSize: 13,
              textDecoration: 'none',
            }}
          >
            Manage user access
          </Link>
          <button
            type="button"
            disabled
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              border: '1px solid rgba(0,0,0,0.10)',
              background: 'rgba(0,0,0,0.04)',
              cursor: 'not-allowed',
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            Create Custom Role (Coming soon)
          </button>
        </div>
      }
    >
      <Card>
        <CardHeader
          title="What this page is"
          subtitle="This page defines what each role means (permissions, scope, SoD). Role assignment happens in Governance → Users."
        />
      </Card>

      <Section title="Who is this for?" subtitle="Personas by domain.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {WHO_IS_THIS_FOR.map(({ domain, personas }) => (
            <div key={domain} style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <span style={{ fontWeight: 800, color: 'rgba(0,0,0,0.75)', minWidth: 120 }}>{domain}</span>
              <span style={{ color: 'rgba(0,0,0,0.65)' }}>({personas})</span>
            </div>
          ))}
        </div>
      </Section>

      <Card>
        <CardHeader
          title="Scope legend"
          subtitle="GLOBAL roles apply across the tenant. LEGAL_ENTITY roles apply only to specific companies."
        />
        <div style={{ paddingTop: 12, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 4, color: 'rgba(0,0,0,0.6)' }}>Sensitive</div>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(0,0,0,0.7)' }}>
            Access to pay, bank, tax, or break-glass capabilities
          </p>
        </div>
      </Card>

      <div style={{ height: ui.space.lg }} />

      <Section title="Coverage" subtitle="Domains covered by templates today.">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          {Object.entries(countsByDomain).map(([k, v]) => (
            <span key={k} style={{ fontSize: 13, fontWeight: 700, color: 'rgba(0,0,0,0.70)' }}>
              {k}: {v}
            </span>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 800 }}>
            Total templates: {total}
          </span>
        </div>
      </Section>

      <div style={{ height: ui.space.lg }} />

      <Section
        title="All role templates"
        subtitle="Click a card to expand. GLOBAL = tenant-wide governance & service accounts. LEGAL_ENTITY = operational roles scoped to specific companies."
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: ui.space.md,
          }}
        >
          {ROLE_TEMPLATES.map((r) => {
            const isExpanded = expandedKey === r.key;
            return (
              <div
                key={r.key}
                role="button"
                tabIndex={0}
                onClick={() => setExpandedKey(isExpanded ? null : r.key)}
                onKeyDown={(e) => e.key === 'Enter' && setExpandedKey(isExpanded ? null : r.key)}
                style={{ cursor: 'pointer' }}
              >
                <Card
                  style={{
                    borderColor: isExpanded ? 'rgba(79,70,229,0.4)' : undefined,
                    boxShadow: isExpanded ? '0 1px 3px rgba(79,70,229,0.1)' : undefined,
                  }}
                >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>{r.name}</h3>
                    <DomainPill text={r.domain} />
                    <ScopeChip scope={r.scopeDefault} />
                  </div>
                  <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
                    {isExpanded ? '▼ Hide details' : '▶ View details'}
                  </span>
                </div>

                <ul style={{ margin: '10px 0 0', paddingLeft: 18, color: 'rgba(0,0,0,0.65)', fontSize: 13 }}>
                  {r.highlights.slice(0, 3).map((h) => (
                    <li key={h} style={{ marginBottom: 4 }}>
                      {h}
                    </li>
                  ))}
                </ul>

                {isExpanded && (
                  <>
                    <p style={{ marginTop: 12, marginBottom: 8, color: 'rgba(0,0,0,0.70)', fontSize: 13 }}>
                      {r.description}
                    </p>
                    {r.sensitive && (
                      <div
                        style={{
                          marginBottom: 12,
                          padding: '8px 12px',
                          borderRadius: 8,
                          background: 'rgba(239,68,68,0.08)',
                          border: '1px solid rgba(239,68,68,0.2)',
                          fontSize: 12,
                          fontWeight: 700,
                          color: 'rgba(185,28,28,0.95)',
                        }}
                      >
                        Sensitive — pay, bank, tax, or break-glass. Requires approval for assignment.
                      </div>
                    )}
                    {r.sodNote && (
                      <div
                        style={{
                          marginBottom: 12,
                          padding: '8px 12px',
                          borderRadius: 8,
                          background: 'rgba(79,70,229,0.06)',
                          border: '1px solid rgba(79,70,229,0.15)',
                          fontSize: 12,
                          color: 'rgba(55,48,163,0.95)',
                        }}
                      >
                        {r.sodNote}
                      </div>
                    )}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6, color: 'rgba(0,0,0,0.65)' }}>
                        Key capabilities
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'rgba(0,0,0,0.7)' }}>
                        {r.highlights.map((h) => (
                          <li key={h} style={{ marginBottom: 4 }}>{h}</li>
                        ))}
                      </ul>
                    </div>
                    <div style={{ paddingTop: 12, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                      <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6, color: 'rgba(0,0,0,0.65)' }}>
                        Full permission set
                      </div>
                      <pre
                        style={{
                          margin: 0,
                          padding: 12,
                          background: 'rgba(0,0,0,0.04)',
                          borderRadius: 8,
                          fontSize: 11,
                          fontFamily: 'ui-monospace, monospace',
                          overflow: 'auto',
                          maxHeight: 120,
                        }}
                      >
                        {(r.fullPermissions ?? r.topPermissions).join('\n')}
                      </pre>
                    </div>
                  </>
                )}
                </Card>
              </div>
            );
          })}
        </div>
      </Section>

      <div style={{ marginTop: ui.space.xl, paddingTop: ui.space.lg, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: 'rgba(0,0,0,0.55)', marginBottom: 8 }}>Next steps</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13, color: 'rgba(0,0,0,0.7)' }}>
          <span>✅ Templates (now)</span>
          <span>🔜 Assign roles per legal entity (next)</span>
          <span>🔜 Custom roles + approval workflow for role changes (later)</span>
        </div>
      </div>

      <div style={{ marginTop: ui.space.lg, opacity: 0.8, fontSize: 13, color: 'rgba(0,0,0,0.65)' }}>
        Need to grant access?{' '}
        <Link to="/enterprise/users" style={{ color: 'rgba(79,70,229,0.95)', fontWeight: 700, textDecoration: 'none' }}>
          Go to Users to assign roles.
        </Link>
      </div>
    </Page>
  );
}
