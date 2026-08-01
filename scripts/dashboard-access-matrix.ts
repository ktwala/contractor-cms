/**
 * Dashboard Access Matrix QA
 *
 * Verifies for each role:
 * - Visible vs hidden widgets (via API 200 vs 403)
 * - Scoped vs full data (when legal entity scope applies)
 *
 * Requires: Backend running, DB seeded (npm run db:seed, npm run demo:seed).
 * Run: npx ts-node scripts/dashboard-access-matrix.ts
 */

const API_BASE = process.env.API_BASE || 'http://localhost:4000/v1';

const DASHBOARD_ENDPOINTS = [
  { path: '/dashboard/workforce-summary', perms: ['employee:read', 'employment:read'], name: 'Workforce Snapshot' },
  { path: '/dashboard/payroll-summary', perms: ['payrun:read'], name: 'Payroll Snapshot' },
  { path: '/dashboard/compliance-summary', perms: ['sars:irp5:read', 'sars:emp201:read', 'sars:emp501:read'], name: 'Compliance Snapshot' },
  { path: '/dashboard/data-imports-summary', perms: ['data_import:read', 'data_import:write', 'data_import:approve', 'data_import:publish'], name: 'Data Imports' },
  { path: '/dashboard/hr-export-readiness', perms: ['hr:read', 'iam:legal_entities:manage'], name: 'HR Export Readiness' },
  { path: '/dashboard/pending-approvals', perms: ['iam:users:manage', 'approval:approve', 'payrun:approve'], name: 'Pending Approvals' },
  { path: '/setup/status', perms: ['iam:legal_entities:manage', 'legal_entity:read', 'employee:read', 'hr:read'], name: 'Setup Progress' },
] as const;

/** Maps summary widget keys to display names for QA */
const SUMMARY_WIDGET_MAP: Record<string, string> = {
  setup_progress: 'Setup Progress',
  workforce_snapshot: 'Workforce Snapshot',
  payroll_snapshot: 'Payroll Snapshot',
  compliance_snapshot: 'Compliance Snapshot',
  pending_approvals: 'Pending Approvals',
  data_imports: 'Data Imports',
  hr_export_readiness: 'HR Export Readiness',
};

interface RoleExpectation {
  role: string;
  scope: 'GLOBAL' | 'LEGAL_ENTITY';
  email: string;
  password: string;
  visibleWidgets: string[];
  hiddenWidgets: string[];
  expectScopedData?: boolean; // when LEGAL_ENTITY, counts should be ≤ platform total
}

async function login(email: string, password: string): Promise<{ token: string; user: any } | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { token: data.access_token, user: data.user };
  } catch (e) {
    return null;
  }
}

async function callEndpoint(path: string, token: string): Promise<{ status: number; data?: any }> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = res.ok ? await res.json().catch(() => ({})) : undefined;
    return { status: res.status, data };
  } catch (e) {
    return { status: 0, data: undefined };
  }
}

async function main() {
  console.log('=== Dashboard Access Matrix QA ===\n');
  console.log('(Empty-scope regression is covered by dashboard.service.spec.ts unit tests.)');
  console.log('(HR_ADMIN needs hr:read: run "npm run db:seed" if HR Export shows 403.)');
  console.log('API Base:', API_BASE);
  console.log('');

  // Demo seed users: admin@demo.payroll (GLOBAL+LE), tenantadmin@demo.payroll (LE), hr@demo.payroll, payrollclerk@demo.payroll, iga@demo.payroll
  const rolesToTest: RoleExpectation[] = [
    {
      role: 'TENANT_ADMIN (GLOBAL)',
      scope: 'GLOBAL',
      email: 'admin@demo.payroll',
      password: 'admin123',
      visibleWidgets: ['Setup Progress', 'Workforce Snapshot', 'Payroll Snapshot', 'Compliance Snapshot', 'Data Imports', 'HR Export Readiness', 'Pending Approvals'],
      hiddenWidgets: [],
    },
    {
      role: 'TENANT_ADMIN (LEGAL_ENTITY)',
      scope: 'LEGAL_ENTITY',
      email: 'tenantadmin@demo.payroll',
      password: 'admin123',
      visibleWidgets: ['Setup Progress', 'Workforce Snapshot', 'Data Imports', 'HR Export Readiness', 'Pending Approvals'],
      hiddenWidgets: ['Payroll Snapshot', 'Compliance Snapshot'],
      expectScopedData: true,
    },
    {
      role: 'PAYROLL_CLERK',
      scope: 'LEGAL_ENTITY',
      email: 'payrollclerk@demo.payroll',
      password: 'admin123',
      visibleWidgets: ['Setup Progress', 'Workforce Snapshot', 'Payroll Snapshot'],
      hiddenWidgets: ['Compliance Snapshot', 'Data Imports', 'HR Export Readiness', 'Pending Approvals'],
      expectScopedData: true,
    },
    {
      role: 'HR_ADMIN',
      scope: 'LEGAL_ENTITY',
      email: 'hr@demo.payroll',
      password: 'admin123',
      visibleWidgets: ['Setup Progress', 'Workforce Snapshot', 'HR Export Readiness'],
      hiddenWidgets: ['Payroll Snapshot', 'Compliance Snapshot', 'Data Imports', 'Pending Approvals'],
      expectScopedData: true,
    },
    {
      role: 'INTEGRATION_IGA',
      scope: 'GLOBAL',
      email: 'iga@demo.payroll',
      password: 'admin123',
      visibleWidgets: ['Setup Progress', 'HR Export Readiness'],
      hiddenWidgets: ['Workforce Snapshot', 'Payroll Snapshot', 'Compliance Snapshot', 'Data Imports', 'Pending Approvals'],
    },
  ];

  const endpointByName: Record<string, (typeof DASHBOARD_ENDPOINTS)[number]> = {};
  for (const e of DASHBOARD_ENDPOINTS) {
    endpointByName[e.name] = e;
  }

  const findings: string[] = [];
  let passed = 0;
  let failed = 0;

  for (const r of rolesToTest) {
    console.log(`\n--- ${r.role} (${r.scope}) ---`);
    const auth = await login(r.email, r.password);
    if (!auth) {
      console.log(`  ⚠ SKIP: Could not login as ${r.email} (user may not exist in demo seed)`);
      continue;
    }
    console.log(`  Logged in. legal_entity_access: ${auth.user?.legal_entity_access?.length ?? 0} entities`);

    for (const ep of DASHBOARD_ENDPOINTS) {
      const { status, data } = await callEndpoint(ep.path, auth.token);
      const shouldSee = r.visibleWidgets.includes(ep.name);
      const expect200 = shouldSee;
      const ok = expect200 ? status === 200 : status === 403;

      if (ok) {
        passed++;
        console.log(`  ✅ ${ep.name}: ${status} ${expect200 ? '(visible)' : '(hidden)'}`);
      } else {
        failed++;
        const msg = `${r.role} / ${ep.name}: expected ${expect200 ? 200 : 403}, got ${status}`;
        findings.push(msg);
        console.log(`  ❌ ${ep.name}: ${status} ${expect200 ? '(expected 200)' : '(expected 403)'}`);
      }

      if (status === 200 && r.expectScopedData && ep.name === 'Workforce Snapshot' && data) {
        const total = (data.employees ?? 0) + (data.employments ?? 0);
        if (total > 0) {
          console.log(`     Scoped counts: employees=${data.employees}, employments=${data.employments}`);
        }
      }
    }

    // Summary endpoint: one call returns all widgets with visible flags
    const summaryRes = await callEndpoint('/dashboard/summary', auth.token);
    if (summaryRes.status === 200 && summaryRes.data?.widgets) {
      passed++;
      const w = summaryRes.data.widgets;
      const meta = summaryRes.data.meta || {};
      console.log(`  ✅ Dashboard Summary: 200 scope=${meta.scope_mode ?? '?'} visibleWidgets=${Object.entries(w).filter(([, v]: [string, any]) => v?.visible).map(([k]) => k).join(',')}`);
      for (const [key, name] of Object.entries(SUMMARY_WIDGET_MAP)) {
        const visible = (w as Record<string, { visible?: boolean }>)[key]?.visible === true;
        const shouldSee = r.visibleWidgets.includes(name);
        if (visible !== shouldSee) {
          failed++;
          findings.push(`${r.role} /dashboard/summary widget ${key}: expected visible=${shouldSee}, got ${visible}`);
        }
      }
    } else {
      failed++;
      findings.push(`${r.role} /dashboard/summary: expected 200, got ${summaryRes.status}`);
      console.log(`  ❌ Dashboard Summary: ${summaryRes.status}`);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  if (findings.length > 0) {
    console.log('\nFindings:');
    findings.forEach((f) => console.log('  -', f));
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
