# MTN demo — Continuous Workforce Assurance stories

**Status:** RATIFIED — subordinate to frozen lifecycle [`EXTERNAL_WORKFORCE_LIFECYCLE.md`](./EXTERNAL_WORKFORCE_LIFECYCLE.md)  
**Assessment demo (separate):** [`DEMO-MTN-STORY.md`](./DEMO-MTN-STORY.md)

---

## Purpose

The MTN connector demo proves **Assessment** first (40 workers; 32 operationally ready + 8 readiness findings).

These **seven personas** prove **Continuous Workforce Assurance** — operational workers who are **still** compliant, or who have **fallen out** of compliance over time.

Every story answers:

> **Why should an operator care?**

Governance Review *(future workspace)* will be powered by these stories — not the other way around.

**Prerequisite — Supplier Governance frozen:** Do not build Supplier Assurance workflow logic until live Inspections 7–10 pass ([`DEMO-MTN-STORY.md`](./DEMO-MTN-STORY.md)). After freeze, Supplier Assurance **observes and reports only**:

```text
Pending trust · Suspended trust · Workers affected by Operational Trust
Integrity violations · Trust aging · Review due
```

It consumes `Operational Trust`, `Workforce Impact`, and `Integrity` from Supplier Governance — no parallel readiness calculation, no redefining Operational Trust.

---

## The seven personas

| # | Worker | Domain | Finding | Severity |
|---|--------|--------|---------|----------|
| 1 | **John Smith** | — | *(compliant)* | Healthy |
| 2 | **Peter Molefe** | Engagement Assurance | `ENGAGEMENT_CONTRACT_EXPIRED` | Review |
| 3 | **Mary Dube** | Supplier Assurance | `SUPPLIER_SUSPENDED` | Review |
| 4 | **Alex Nkosi** | Accountability Assurance | `ACCOUNTABILITY_INACTIVE` | Review |
| 5 | **Jane Adams** | Workforce Assurance | `WORKFORCE_DUPLICATE` | Review |
| 6 | **Sipho Maseko** | Access Assurance *(Phase 2)* | `ACCESS_AFTER_ENGAGEMENT_END` | Critical |
| 7 | **David Ncube** | Workforce Assurance | `WORKFORCE_ORPHANED` | Review |

**Expected Governance Review counts (demo cohort):**

```text
7 Operational workers

1 Healthy          ← John (with positive evidence)
5 Require review
1 Critical         ← Sipho
```

---

## Story detail

### 1. John Smith — Compliant baseline *(positive evidence)*

John is not merely “no findings.” He proves the platform **verifies compliance**, not only problems.

**Compliance evidence (show on Governance Review):**

```text
John Smith

Supplier ✓              Atlas Consulting — active, synchronized
Contract ✓              MTN-FWA-001 — active through 2027-12-31
Responsible Manager ✓   Sarah Jones — active employee
Engagement ✓            Single active placement
Access ✓                Compliant (no open access observations)
Last assured            14 days ago
```

**Observation → Finding → Decision → Action:**

```text
Observation   All assurance domains evaluated; no policy violations
Finding       (none)
Decision      Compliant
Action        None — show positive evidence
```

**Why an operator cares:** Green must be trustworthy. John shows what “good” looks like with evidence, not an empty row.

**Demo beat:** *“Assurance doesn’t only find problems — it proves compliance.”*

---

### 2. Peter Molefe — Contract expired yesterday

| Field | Value |
|-------|-------|
| Supplier | Nexa Technologies — active |
| Contract | End date = yesterday |
| Responsible Manager | Assigned and active |
| Engagement | Still marked active in EWP |

```text
Observation  →  Finding  →  Decision  →  Action
```

**Example — Peter (contract expired):**

```text
Observation   Contract expired yesterday; engagement still active
Finding       ENGAGEMENT_CONTRACT_EXPIRED
Decision      Review required
Action        Open governance task
```

**Example — contract nearing expiry (monitor):**

```text
Observation   Contract expires in 28 days
Finding       ENGAGEMENT_CONTRACT_EXPIRING
Decision      Monitor
Action        None
```

**Example — Sipho (access after engagement end):**

```text
Observation   Engagement closed; IGA: Oracle account still active
Finding       ACCESS_AFTER_ENGAGEMENT_END
Decision      Critical
Action        Create IGA remediation
```

---

### 3. Mary Dube — Supplier suspended

| Field | Value |
|-------|-------|
| Supplier | Ubuntu Field Services — **SUSPENDED** |
| Engagement | Still active on suspended supplier |

```text
Observation   Supplier lifecycle status changed to Suspended
      ↓
Finding       SUPPLIER_SUSPENDED  (Supplier Assurance)
      ↓
Action        Review operational workers under this supplier
```

**Why an operator cares:** Procurement blocked the vendor; operations must not continue under that supplier.

---

### 4. Alex Nkosi — Responsible Manager resigned

| Field | Value |
|-------|-------|
| Responsible Manager | Points to exited employee (terminated 30 days ago) |
| Engagement | Active |

```text
Observation   Responsible Manager employee record terminated in HCM
      ↓
Finding       ACCOUNTABILITY_INACTIVE  (Accountability Assurance)
      ↓
Action        Assign Responsible Manager
```

**Why an operator cares:** Worker appears governed; accountability pointer is stale.

**Contrast with Assessment:** `ACCOUNTABILITY_MISSING` at import vs `ACCOUNTABILITY_INACTIVE` after operational life.

---

### 5. Jane Adams — Duplicate operational records

```text
Observation   Two operational registry records share same national ID / email
      ↓
Finding       WORKFORCE_DUPLICATE  (Workforce Assurance)
      ↓
Action        Merge or exit duplicate record
```

**Why an operator cares:** Payroll double-pay risk, split audit history.

**Contrast with Assessment:** Duplicate at **discovery** (staging) vs duplicate among **operational** records.

---

### 6. Sipho Maseko — Access after engagement end *(critical, Phase 2)*

| Field | Value |
|-------|-------|
| Engagement | Closed / expired in EWP |
| Access | Oracle / VPN account still active *(IGA observation)* |

```text
Observation   Engagement closed in EWP; IGA signal: Oracle account still active
      ↓
Finding       ACCESS_AFTER_ENGAGEMENT_END  (Access Assurance)
      ↓
Action        Open access remediation
```

**Why an operator cares:** Workforce and access planes diverged — classic governance failure.

**Severity:** Critical.

**Demo beat:** Bridges EWP assurance to IGA — EWP detects; IGA remediates.

**Note:** Peter’s expired contract and Sipho’s stale access are **two findings in two domains**, even if the same worker could theoretically have both.

---

### 7. David Ncube — Portal drift (orphaned worker)

```text
Observation   Supplier portal removed worker from supplier roster
      ↓
Finding       WORKFORCE_ORPHANED  (Workforce Assurance)
      ↓
Action        Re-sync from portal; exit or re-nominate worker
```

**Why an operator cares:** Portal says removed; EWP still operational — drift only EWP detects.

**Drift is the mechanism;** Workforce Assurance is the domain.

---

## Presenter script (after Assessment demo)

| Step | Say |
|------|-----|
| 1 | *Assessment was point-in-time — 40 discovered, 32 operational.* |
| 2 | *Governance Review is powered by Continuous Workforce Assurance — is everyone **still** compliant?* |
| 3 | *John — fully compliant. Supplier, contract, Responsible Manager, access. Last assured 14 days ago.* |
| 4 | *Peter — contract expired yesterday. Engagement Assurance. Review engagement.* |
| 5 | *Mary — supplier suspended. Supplier Assurance.* |
| 6 | *Alex — Responsible Manager left. Accountability Assurance.* |
| 7 | *Jane — duplicate operational records. Workforce Assurance.* |
| 8 | *Sipho — engagement ended, access didn’t. Access Assurance — critical.* |
| 9 | *David — portal removed him; EWP didn’t. Portal drift → Workforce Assurance.* |
| 10 | *Counts only: 1 healthy, 5 review, 1 critical. No health score.* |

---

## Future seed mapping

| Persona | Suggested anchor | Notes |
|---------|------------------|-------|
| John Smith | Dedicated assurance seed | Positive evidence fields required |
| Peter Molefe | Nexa worker | Contract end = yesterday |
| Mary Dube | Ubuntu worker | Supplier SUSPENDED post-setup |
| Alex Nkosi | Post-operational `Kyle Brooks` arc | RM exited after assignment |
| Jane Adams | New — not `Matthew Young` (assessment) | Two **operational** records |
| Sipho Maseko | Atlas worker | IGA observation stub |
| David Ncube | Horizon worker | Portal removal in reconciliation |

Constants: [`backend/src/domain/demo/demo-mtn-assurance.constants.ts`](../backend/src/domain/demo/demo-mtn-assurance.constants.ts)

---

## Non-goals

- Health score / percentage
- Governance Review UI or APIs *(Step 3)*
- Mixing assurance findings into Assessment readiness tiles
- Full pipeline rules (observation → decision → action)
