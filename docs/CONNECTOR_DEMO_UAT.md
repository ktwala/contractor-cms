# Connector demo / UAT playbook

> **Platform reference:** [`CONNECTOR_GOVERNANCE_PLATFORM.md`](CONNECTOR_GOVERNANCE_PLATFORM.md)
> **Supplier governance (tiles, evidence, approvals):** [`SUPPLIER_GOVERNANCE_OPERATIONS.md`](SUPPLIER_GOVERNANCE_OPERATIONS.md)
> **Contractor bootstrap authority:** [`CONTRACTOR_BOOTSTRAP_AUTHORITY.md`](CONTRACTOR_BOOTSTRAP_AUTHORITY.md)
> **PR:** [`business/PR-DEMO-CONNECTOR-1_MOCK_ORACLE_DEMO_CONTROLS.md`](business/PR-DEMO-CONNECTOR-1_MOCK_ORACLE_DEMO_CONTROLS.md)
> **Personas:** [`GOVERNANCE_TEST_PERSONAS.md`](GOVERNANCE_TEST_PERSONAS.md) · [`DEMO_LOGIN_CREDENTIALS.md`](DEMO_LOGIN_CREDENTIALS.md)

## UAT question (correct framing)

You are **not** testing whether HCM remains authoritative.

You are testing:

```text
Can CMS assume operational contractor authority after bootstrap
and govern operational trust correctly?
```

---

## Authority model under test

| Domain | Authority |
|--------|-----------|
| Supplier master | Oracle Procurement |
| Supplier operational trust | CMS |
| Contractor bootstrap/import | Oracle HCM |
| Contractor operational lifecycle | CMS |
| Operational restrictions | CMS |
| Governance remediation | CMS |

### Source truth vs operational trust

| Domain | Source truth | Operational trust |
|--------|--------------|-------------------|
| Suppliers | Oracle Procurement | CMS |
| Contractors | CMS after HCM bootstrap | CMS |

UAT validates operational trust — *“Can we use this entity safely?”* — not upstream master ownership alone.

## Clean doctrine

```text
HCM is bootstrap authority.
CMS is operational contractor authority.

Oracle Procurement remains supplier master.
CMS governs supplier operational trust.

Oracle HCM bootstraps contractors.
CMS becomes contractor authority after import.
CMS governs contractor operational trust.
```

**Key line:** Oracle provides source truth; CMS governs operational trust.

**Product story:** We **operationalize trust** after enterprise ingestion — not “we synchronized Oracle.” Bootstrap lineage and operational authority stay separate ([`CONTRACTOR_BOOTSTRAP_AUTHORITY.md`](CONTRACTOR_BOOTSTRAP_AUTHORITY.md)).

| Say in UAT | Treat as failure in main demo |
|------------|-------------------------------|
| HCM workforce **bootstrap** (not continuous sync) | HCM terminated → CMS auto-disabled |
| CMS governance scan | Upstream assignment controls CMS lifecycle |
| Unsponsored contractor | Access review / IGA certification as flagship |
| Operational governance remediation | `GOVERNANCE_LIFECYCLE_CONFLICT` as primary outcome (`CMS_ONLY` skips this) |
| Worker attribute drift as ops priority | Implies HCM remains canonical after materialize |
| PDP restriction | Pre-loaded drift/remediation before scan |

---

## Four governance phases

| Phase | What is validated |
|-------|-------------------|
| **1. Bootstrap** | HCM import + correlation (bootstrap ≠ governance failure) |
| **2. Materialization** | CMS contractor creation; CMS becomes authority |
| **3. Governance** | CMS-native operational governance (`UNSPONSORED_CONTRACTOR`) |
| **4. Enforcement** | PDP restriction + remediation lifecycle |

---

## Setup (Docker — primary)

```bash
docker compose up -d
```

Starts **postgres**, **mock-oracle** (`:8080`), **backend** (`:3000`), **frontend** (`:3001`). Backend entrypoint: migrate → seed → `reset:connector-demo` when `DEMO_MODE=true`.

**Re-run reset:**

```bash
npm run docker:reset:connector-demo
```

After reset, **visible** operational counts should all be **zero** (suppliers, contractors, dashboard KPIs, HCM “Active (imported)”). The default reset is **greenfield** — no pre-seeded workers.

**Mode 1 — Greenfield MTN demo (default)**

```bash
npm run docker:reset:connector-demo
```

First HCM discovery should show: **Records discovered 10 · Matched to existing worker 0 · New / unmatched 10**.

**Mode 2 — Migration / conflict UAT (opt-in)**

Hidden comparison anchors (`anchor.*` emails) simulate re-discovery against legacy CMS rows. Excluded from registry UIs but included in correlation.

```bash
npm run docker:reset:connector-demo:migration
# or: SEED_HCM_COMPARISON_ANCHORS=true npm run docker:reset:connector-demo
```

First discovery should show: **Matched to hidden comparison worker 6 · No worker match 3 · Conflict / possible match 1**.

Login: `workforce.import@ewp.demo` / `GovOps123!`
Remediation close: `governance.reviewer@ewp.demo` / `GovReview123!`

Do **not** set `SEED_GOVERNANCE_FIXTURES=true` or `SEED_DEMO_OPERATIONAL_DATA=true` for this UAT.

Demo buttons: `NEXT_PUBLIC_DEMO_MODE=true` or `NODE_ENV !== production`.

---

## Navigation (Operations)

Sidebar and dashboard tiles use **business surfaces**, not “connector ops”:

```text
OPERATIONS
- Dashboard
- Suppliers              ← governed registry
- Supplier sync          ← Oracle Procurement ingestion
- Contractors            ← governed registry
- Contractor bootstrap   ← HCM import + materialization
```

Dashboard tiles mirror the same story (Supplier sync / Contractor bootstrap appear when tenant authority allows).

**Governance overview tiles** on `/suppliers` are operational navigation (not static KPIs):

| Tile | Opens |
|------|--------|
| Synced | `/suppliers?governanceBucket=synced` |
| Pending governance / evidence | `/suppliers/approvals` (ORACLE_ONLY inherits procurement evidence) |
| Active | `/suppliers?governanceBucket=active` |
| Suspended | `/suppliers?governanceBucket=suspended` |

**Evidence authority (ORACLE_ONLY demo):** Oracle Procurement onboarding is trusted for synced suppliers; CMS gates **operational trust** (approve to `ACTIVE`, suspend, PDP) — not re-upload of procurement documents.

## UI surfaces

| Route | Purpose |
|-------|---------|
| `/supplier-sources/oracle/operations` | **Supplier sync** (nav) — Oracle import + create governance record |
| `/contractor-sources/oracle-hcm/operations` | **Contractor bootstrap** (nav) — HCM import + CMS governance scan |
| `/suppliers` | CMS supplier governance records; **overview tiles** filter registry |
| `/suppliers/approvals` | Operational trust queue (approve → `ACTIVE`) |
| `/contractors` | CMS contractor registry (post-materialization) |
| Contractor bootstrap → remediation queue | Operational governance |

---

## Supplier governance language (demos)

**Process-first vocabulary:** [`SUPPLIER_GOVERNANCE_LANGUAGE_GUIDE.md`](SUPPLIER_GOVERNANCE_LANGUAGE_GUIDE.md) — lifecycle, forbidden MTN terms (CMS, staging, ledger), Snapshot History layout.

**Do not say** “promote governance twin” to stakeholders — that is engineering shorthand.

| Engineering term | Business / UI term |
|------------------|-------------------|
| Governance twin | CMS governance record (linked to Oracle supplier) |
| Promote twin | Create governance record |
| Promote supplier | Start supplier governance |

```text
Oracle Procurement creates supplier (master)
→ CMS syncs supplier metadata (staging)
→ CMS creates governance record (PENDING_APPROVAL — not ACTIVE)
→ CMS governs operational trust (approvals, restrictions — not re-running procurement onboarding on ORACLE_ONLY)
```

Sync alone must **not** make a supplier operationally trusted.

---

## Supplier path (prerequisite for HCM materialization)

Route: `/supplier-sources/oracle/operations`

1. **Sync demo Oracle suppliers**
2. **Create governance record** for clean supplier (`ORCL-SUP-DEMO-001` → `PENDING_APPROVAL`, not `ACTIVE`)
3. Open **`/suppliers`** → click **Pending governance** (or **Open supplier approvals queue** on sync page)
4. **Approve** supplier → `ACTIVE` (on `ORACLE_ONLY`, no CMS evidence upload required when Oracle-linked + synced)
5. Optional: click **Active** tile → `/suppliers?governanceBucket=active`

Validate on `/suppliers`:

- CMS governance record visible and linked to Oracle ID
- Status is **not** connector-driven `ACTIVE` until approval
- After approve, supplier appears under **Active** bucket / filter

---

# Phase 1 — Bootstrap testing

**Question:** Can CMS correctly ingest and correlate HCM workforce data?

**Route:** `/contractor-sources/oracle-hcm/operations`

### Reset baseline

```bash
npm run docker:reset:connector-demo
```

| Check | Expected |
|-------|----------|
| `/contractors` | 0 visible contractors |
| HCM ops — sync runs | 0 |
| HCM ops — drift / remediation | 0 |
| HCM ops — PDP restrictions | 0 |

### Action

Click **Import demo HCM workers** (staging import + correlation; materialization runs in same demo action).

### Validate — connector telemetry (greenfield default)

| Metric | Expected |
|--------|----------|
| Total runs | 1 |
| Records discovered | 10 |
| Matched to existing worker | **0** |
| New / unmatched | **10** |
| Failed | 0 |

### Validate — connector telemetry (migration mode only)

Enable with `npm run docker:reset:connector-demo:migration` before discovery:

| Metric | Expected |
|--------|----------|
| Records discovered | 10 |
| Matched to hidden comparison worker | 6 |
| No worker match | 3 |
| Conflict / possible match | 1 |
| Failed | 0 |

### Validate — correlation (bootstrap only)

Correlation telemetry shows a mix of:

```text
HIGH
LOW
MANUAL_REVIEW
(conflicts as applicable)
```

### Critical — no governance drift yet

**Before** clicking **Run CMS governance scan**:

| Check | Expected |
|-------|----------|
| Open drift registry | Empty (or no `UNSPONSORED_CONTRACTOR`) |
| Remediation queue | Empty |
| PDP restrictions active | 0 |

```text
bootstrap ≠ governance failure
```

Import and correlation are healthy bootstrap signals. Operational governance drifts appear only after the CMS governance scan.

---

# Phase 2 — Materialization testing

**Question:** Does CMS become contractor authority (not an HCM row mirror)?

### Validate — registry

Route: `/contractors`

| Check | Expected |
|-------|----------|
| Visible contractors | ~10 (after import/materialize) |
| Source | Imported from HCM bootstrap, **governed in CMS** |

Contractors should be:

- Visible and operable in the CMS registry
- Editable/governed in CMS workflows
- **Active in CMS** by default after materialize

They should **not** behave as live mirrors where HCM assignment status automatically drives CMS `isActive` or termination.

### Critical doctrine test (manual / follow-up)

Re-import or change upstream fixture assignment status for a materialized contractor. **CMS lifecycle must not auto-mutate** from HCM alone when `contractorAuthorityMode = CMS_ONLY`.

| Outcome | Pass/Fail |
|---------|-----------|
| CMS `isActive` unchanged without CMS action | Pass |
| CMS auto-deactivates because HCM says terminated | **Fail** |

---

# Phase 3 — Governance testing

**Question:** Can CMS detect operational governance problems natively?

### Action

On `/contractor-sources/oracle-hcm/operations`, click **Run CMS governance scan**.

### Validate — governance emerges

| Check | Expected |
|-------|----------|
| Drift detected | ≥ 1 (includes flagship) |
| Flagship person | `HCM-WORKER-DEMO-008` |
| Governance signal (UI) | **Unsponsored contractor** (not “access review”) |
| Severity | `CRITICAL` |
| Remediation (UI) | **Operational restriction (PDP)** — not IGA/access-review wording |
| Remediation status | `OPEN` |

### Validate — contractor stays ACTIVE

| Check | Expected |
|-------|----------|
| `demo.worker.unsponsored08@demo.local` (worker 008) | `isActive = true` |
| Auto-disable from drift detect | **Must not happen** |

```text
The platform must NOT disable the contractor automatically.
Governance restricts operations; humans resolve sponsorship in CMS.
```

### Validate — CMS governance telemetry

| Metric | Expected |
|--------|----------|
| Unsponsored (no sponsor) | ≥ 1 |
| Terminated upstream · active CMS | 0 (CMS_ONLY tenant) |

---

# Phase 4 — Enforcement testing

**Question:** Does CMS enforce operational trust restrictions for failed governance state?

### Validate — PDP blocks operational actions

With active remediation + `pdpRestrictionsApplied` on worker 008, attempt (as an entitled user):

- Submit timesheet (for that contractor context)
- Submit invoice (if applicable)
- Other PDP-gated contractor operational actions

| Check | Expected |
|-------|----------|
| PDP decision | `BLOCK` |
| Reason code | `WORKFORCE_GOVERNANCE_RESTRICTED` |

Restriction applies because **CMS governance state failed** (unsponsored), **not** because HCM terminated the contractor.

### Validate — no silent identity mutation

| Check | Expected |
|-------|----------|
| Contractor record | Still present, still ACTIVE |
| Restriction | Runtime PDP only until remediation closed |

---

# Phase 5 — Remediation lifecycle testing

**Question:** Can humans govern resolution without auto-mutation?

Login: `governance.reviewer@ewp.demo` / `GovReview123!`

### Validate workflow

```text
OPEN
→ ACKNOWLEDGED
→ REMEDIATION_IN_PROGRESS
→ VERIFIED
→ CLOSED
```

### Validate final state

| Check | Expected |
|-------|----------|
| PDP restriction | Removed after `CLOSED` |
| Contractor | Still **ACTIVE** (until CMS assigns sponsor / offboards in CMS) |
| Audit trail | Remediation + governance events preserved |

Optional CMS resolution: assign sponsor / create sponsored engagement for worker 008, then re-scan — `UNSPONSORED_CONTRACTOR` should resolve when sponsor exists.

---

## Flagship acceptance scenario (single end-to-end)

This scenario validates bootstrap, CMS authority, governance, remediation, and PDP doctrine in one path:

```text
1. HCM imports contractor (bootstrap)
2. CMS materializes contractor
3. Contractor operationally exists in CMS registry
4. CMS governance scan runs
5. Unsponsored contractor detected (HCM-WORKER-DEMO-008)
6. UNSPONSORED_CONTRACTOR drift + OPEN remediation
7. PDP restriction applied
8. Contractor remains ACTIVE
9. Humans resolve governance (remediation lifecycle)
10. PDP restriction lifted
```

---

## Explicit failures (regression guard)

| Bad outcome | Why it fails doctrine |
|-------------|------------------------|
| HCM terminated → CMS auto-disabled contractor | HCM must not be lifecycle authority |
| Upstream assignment controls operational lifecycle | CMS_ONLY contractor authority |
| Access review campaign as workforce flagship | Wrong governance metaphor |
| IGA-style certification semantics in connector demo | CMS operational governance, not sync certification |
| Drift/remediation visible before governance scan | Governance must emerge from scan, not seed |
| `GOVERNANCE_LIFECYCLE_CONFLICT` as demo flagship | Legacy HCM_ONLY mode only |

---

## Quick demo sequence (presenter)

1. Login `governance.ops@`
2. `/supplier-sources/oracle/operations` → sync + create governance record
3. `/contractor-sources/oracle-hcm/operations` → **Import demo HCM workers**
4. `/contractors` → confirm ~10 materialized
5. HCM ops → **Run CMS governance scan**
6. Show `UNSPONSORED_CONTRACTOR` + remediation + PDP; contractor still ACTIVE
7. `governance.reviewer@` → close remediation → PDP lifted

---

## Seed layers (do not collapse)

| Layer | Creates | When |
|-------|---------|------|
| Platform seed | Users, roles, DEMO org | Startup |
| Greenfield reset | Empty registry + connector baseline | `reset:connector-demo` (default) |
| Comparison seed | Hidden correlation anchors only | `reset:connector-demo:migration` or `SEED_HCM_COMPARISON_ANCHORS=true` |
| Connector ingestion | Staging + Oracle supplier metadata | UI sync |
| Governance record | CMS supplier linked to Oracle (`PENDING_APPROVAL`) | Create governance record |
| Operational trust | Supplier `ACTIVE` in CMS | Approve on `/suppliers/approvals` |
| Materialization | Visible `/contractors` | Import demo HCM workers |
| Governance scan | Drift, remediation, PDP | Run CMS governance scan |

---

## Fixture IDs

| Domain | IDs |
|--------|-----|
| Supplier | `ORCL-SUP-DEMO-001`, `ORCL-SUP-DEMO-002` |
| Workforce | `HCM-WORKER-DEMO-001` … `010` |
| Flagship | `HCM-WORKER-DEMO-008` → `demo.worker.unsponsored08@demo.local` |

Files: `backend/test/fixtures/oracle-procurement/demo-two-suppliers.json`, `oracle-hcm/demo-ten-contractors.json`

---

## Manual API (optional)

```bash
curl -s http://localhost:8080/health

# After login TOKEN=...
curl -s -X POST http://localhost:3000/api/v1/supplier-sources/oracle/sync \
  -H "Authorization: Bearer $TOKEN"

curl -s -X POST http://localhost:3000/api/v1/contractor-sources/oracle-hcm/sync \
  -H "Authorization: Bearer $TOKEN"

curl -s -X POST http://localhost:3000/api/v1/contractor-sources/oracle-hcm/demo/materialize-contractors \
  -H "Authorization: Bearer $TOKEN"

curl -s -X POST http://localhost:3000/api/v1/contractor-sources/oracle-hcm/drift/detect \
  -H "Authorization: Bearer $TOKEN"
```

---

## Deprecated

`npm run reset:connector-demo -- --import` — does not ingest. Use mock REST + UI demo buttons.
