# Hubsec Workforce Platform — UI Testing Plan

## 1. Overview

This document outlines the UI testing strategy for the Hubsec Workforce Platform, covering **Hubsec Workforce Admin** (port 3001) and **Hubsec Workforce Employee Portal** (port 3000). The project uses **Playwright** for end-to-end (E2E) tests.

### 1.1 Test Stack

| Tool | Purpose |
|------|---------|
| Playwright | E2E browser automation (Chrome, Firefox, Safari, Mobile) |
| Jest | Unit tests (backend) |
| jest-e2e | Backend API integration tests |

### 1.2 Prerequisites

- Backend API running on port 3000
- Admin portal running on port 3001
- Employee portal running on port 3002 (when applicable)
- Database seeded with test data (run `npm run db:seed`)

---

## 2. Test Scope

### 2.1 Hubsec Workforce Admin — Enterprise Module

| Area | Routes | Test Focus |
|------|--------|------------|
| **Organisation Overview** | `/enterprise/organisation` | Checklist steps, stats row (Legal Entities, Org Units, Cost Centers, Positions, Employees), diagram, tiles with "Go to page" links |
| **Company Groups** | `/enterprise/company-groups` | List, create, edit, delete group |
| **Legal Entities** | `/enterprise/legal-entities` | List, create entity (ZA/LS) |
| **Cost Centers** | `/enterprise/cost-centers` | List, create, edit, delete cost center |
| **Org Structure** | `/enterprise/org-structure` | Tree view, create org unit, edit, delete, hierarchy |
| **Positions** | `/enterprise/positions` | List, filters (Legal Entity, Org Unit, Status), create position, freeze/close, Vacant indicator in Occupant column |
| **Employment Assignments** | `/enterprise/employment-assignments` | Select legal entity, list employments, Add assignment modal (org unit, position filtered by org unit, cost center auto-fill from position) |
| **Users** | `/enterprise/users` | List users, manage role assignments |
| **Role Templates** | `/enterprise/roles` | List role templates |
| **Approval Workflows** | `/enterprise/workflows` | List, create workflow |
| **Pending Approvals** | `/enterprise/approvals/pending` | List pending, approve/reject |
| **HR Export (IGA)** | `/enterprise/hr-export` | Export preview, validation |

### 2.2 Hubsec Workforce Admin — HCM Module

| Area | Routes | Test Focus |
|------|--------|------------|
| **Employees** | `/enterprise/employees` | List, search, navigate to employee detail |
| **Employee Detail** | `/enterprise/employees/:id` | Overview, employments, assignments, add employment (with position selector) |

### 2.3 Hubsec Workforce Admin — Payroll Module

| Area | Routes | Test Focus |
|------|--------|------------|
| **Calendars** | `/payroll/calendars` | List pay groups, periods |
| **Checklist** | `/payroll/checklist` | Payroll checklist tasks |
| **Exceptions** | `/payroll/exceptions` | Exception list, filters |
| **Forecasting** | `/payroll/forecasting` | Forecast view |
| **Payment Batches** | `/payroll/payment-batches` | List batches, batch detail |
| **Payroll Reports** | `/payroll/reports` | Report generation |
| **SARS Reports** | `/payroll/sars-reports` | SARS export |

### 2.4 Hubsec Workforce Admin — Recruitment Module

| Area | Routes | Test Focus |
|------|--------|------------|
| **Job Requisitions** | `/recruitment/job-requisitions` | List, create requisition |
| **Candidates** | `/recruitment/candidates` | List, add candidate |
| **Interviews** | `/recruitment/interviews` | List, schedule interview |
| **Onboarding** | `/recruitment/onboarding` | Onboarding workflows |

### 2.5 Hubsec Workforce Admin — Admin

| Area | Routes | Test Focus |
|------|--------|------------|
| **Tax Tables** | `/admin/tax-tables` | View/edit tax config |

### 2.6 Hubsec Workforce Employee Portal

| Area | Routes | Test Focus |
|------|--------|------------|
| **Login** | `/login` | Auth flow |
| **Self-service** | Per employee-portal routes | Leave, payslips, profile |

---

## 3. Test Categories

### 3.1 Smoke Tests (Critical Path)

Run on every CI build. ~5–10 min.

- [ ] Login (admin + employee)
- [ ] Organisation Overview loads
- [ ] Positions page loads, table visible
- [ ] Employment Assignments loads, legal entity selector works
- [ ] Employees list loads
- [ ] Navigation between main sections works

### 3.2 Regression Tests (Full Coverage)

Run before releases. ~30–60 min.

- [ ] All pages in scope load without error
- [ ] CRUD flows for: Company Groups, Cost Centers, Org Units, Positions, Legal Entities
- [ ] Employment Assignment create flow (org unit → position → cost center auto-fill)
- [ ] Permission-based visibility (nav items, checklist "Go to page" gating)
- [ ] Filters and search work

### 3.3 Demo Flow Tests (User Journey)

End-to-end narrative for sales demos.

1. **Organisation setup**
   - Create Legal Entity → Create Org Structure → Create Cost Centers → Create Positions
2. **Employee onboarding**
   - Create Employee → Add Employment → Add Assignment (org unit, position, cost center)
3. **Position occupancy**
   - Positions page shows occupant or "Vacant"
4. **Checklist**
   - Organisation Overview checklist reflects Ready/In Progress for each step
   - "Go to page" links work (with permission checks)

---

## 4. Authentication & Fixtures

### 4.1 Admin Login

Current tests use mock JWT via `localStorage`. For real E2E:

```typescript
// Option A: Mock (fast, no backend)
await page.evaluate(() => {
  localStorage.setItem('auth_token', 'mock-admin-jwt');
  localStorage.setItem('admin_permissions', JSON.stringify(['iam:legal_entities:manage', ...]));
});

// Option B: Real login (requires auth endpoint)
await page.goto('/login');
await page.fill('input[name="email"]', process.env.TEST_ADMIN_EMAIL);
await page.fill('input[name="password"]', process.env.TEST_ADMIN_PASSWORD);
await page.click('button[type="submit"]');
```

### 4.2 Test Data

- Use seeded data (e.g. Demo Company, org units, cost centers)
- Or create fixtures in `beforeEach` via API calls
- Isolate tests: avoid mutating shared entities when possible

---

## 5. Selectors & Best Practices

### 5.1 Preferred Selectors

| Priority | Selector | Example |
|----------|----------|---------|
| 1 | `data-testid` | `page.getByTestId('positions-table')` |
| 2 | Role + text | `page.getByRole('button', { name: 'Create position' })` |
| 3 | Label | `page.getByLabel('Legal entity')` |
| 4 | Placeholder | `page.getByPlaceholder('e.g. PAY-001')` |
| 5 | CSS fallback | `page.locator('select[name="legal_entity_id"]')` |

### 5.2 Add data-testid for Key UI

Recommended additions:

```tsx
// Positions.tsx
<table data-testid="positions-table">
<button data-testid="create-position-btn">

// EmploymentAssignments.tsx
<div data-testid="add-assignment-modal">
<select data-testid="org-unit-select">

// OrganisationOverview.tsx
<div data-testid="setup-checklist">
```

### 5.3 Avoid

- `page.waitForTimeout()` — use `expect(locator).toBeVisible()` or `page.waitForSelector()`
- Brittle text: `page.click('text=Create')` — prefer role/name
- Fragile CSS: deep nested classes that change frequently

---

## 6. Playwright Configuration

### 6.1 Current Config (`playwright.config.ts`)

- `baseURL`: `http://localhost:3000` (consider separate configs for admin 3001 vs employee 3002)
- Projects: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- `screenshot: 'only-on-failure'`
- `trace: 'on-first-retry'`

### 6.2 Suggested Updates

```typescript
// Separate projects for each portal
projects: [
  { name: 'admin-portal', testMatch: /admin-portal/, use: { baseURL: 'http://localhost:3001' } },
  { name: 'employee-portal', testMatch: /employee-portal/, use: { baseURL: 'http://localhost:3002' } },
],
```

### 6.3 Running Tests

```bash
# All Playwright tests (start admin + backend first)
npx playwright test

# Admin portal only
npx playwright test admin-portal

# With UI
npx playwright test --ui

# Headed (see browser)
npx playwright test --headed

# Single file
npx playwright test test/playwright/admin-portal.spec.ts
```

---

## 7. Test File Structure

```
test/
├── playwright/
│   ├── admin-portal.spec.ts       # Admin portal E2E
│   ├── employee-portal.spec.ts   # Employee portal E2E
│   ├── fixtures/
│   │   └── auth.ts              # Login helpers
│   └── helpers/
│       └── organisation.ts      # Org setup helpers
├── e2e/                          # Backend API tests (Jest)
└── performance/
    └── benchmark.js
```

---

## 8. Implementation Priorities

### Phase 1 — Smoke (Week 1)

1. Fix Playwright baseURL for admin portal (3001)
2. Implement real or stable mock login
3. Smoke: Organisation Overview, Positions, Employment Assignments, Employees

### Phase 2 — Core Flows (Week 2–3)

1. Add `data-testid` to critical elements
2. Positions: create, filters, Vacant display
3. Employment Assignments: add assignment (org unit → position → cost center)
4. Org Structure: create org unit
5. Organisation Overview: checklist links, permission gating

### Phase 3 — Broader Coverage (Week 4+)

1. Company Groups, Cost Centers, Legal Entities CRUD
2. Employee detail, add employment
3. Payroll: calendars, checklist
4. Recruitment: requisitions, candidates
5. RBAC: nav visibility, Forbidden states

---

## 9. CI Integration

```yaml
# Example GitHub Actions
- name: Start services
  run: |
    docker compose up -d
    npm run start:dev &
    cd admin-portal && npm run dev &
    # Wait for health
- name: Run Playwright
  run: npx playwright test --project=chromium
  env:
    BASE_URL: http://localhost:3001
- name: Upload report
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: playwright-report
    path: playwright-report/
```

---

## 10. Success Criteria

- [ ] Smoke suite passes in &lt; 10 min
- [ ] No flaky tests (retries &lt; 2)
- [ ] Demo flow (Organisation → Positions → Employees → Assignments) automated
- [ ] RBAC: Forbidden/disabled states verified
- [ ] Screenshots and traces on failure for debugging
