# Working as a Supplier

**Experience:** Supplier Portal  
**Audience:** Supplier companies (your customer's supplier users).  
**Login:** `supplier.admin@ewp.demo` / `SupplierAdmin123!`  
**Live aid:** [`DEMO-CHEATSHEET.md`](./DEMO-CHEATSHEET.md) · **MTN operations:** [`DEMO-OPERATIONS.md`](./DEMO-OPERATIONS.md)

**Question this demo answers:** *How do I work with my customer?*

```text
Maintain my organisation → Introduce workers → Track nominations → Submit timesheets → Track invoices
```

Suppliers do **not** establish trust — they operate **inside** the trust boundary MTN already granted. They never think about workforce administration. They think: *Did my worker get approved?*

---

## Overview you should see

Not a dashboard menu — an **inbox**:

```text
Welcome, [Your company].

Today's attention
• Workers awaiting review
• Rejected nominations
• Timesheets awaiting submission
• Invoices awaiting submission

Quick actions
Nominate worker · Submit timesheet · View invoices · Update company details
```

Sidebar still has profile, workers, timesheets, invoices — but **Overview** is where daily work starts.

There is **no** Suppliers page, **no** Supplier Approvals, **no** Workforce Review. That is correct — those are operations console screens.

---

## How to open

Skip the full MTN four-stakeholder opener unless MTN staff are in the room. For a supplier-only session:

> **You've been approved to supply workers to MTN.**
>
> This is your workspace — what needs your attention today, and the actions you can take.
>
> You can see workforce progress on each worker — but you cannot activate workers or change MTN's workforce decisions.

---

## Presenting discipline

- **Supplier language** — *my workers, my timesheets, my invoices, my company*
- **Never say** capability names, Supplier Administration, Workforce Administration
- **End each act in practical outcomes** — not architecture. Save truth cascade for mixed MTN rooms only.

---

## Before you start

| Item | Value |
|------|--------|
| Frontend | `http://localhost:3001` |
| Credentials | [`DEMO_LOGIN_CREDENTIALS.md`](./DEMO_LOGIN_CREDENTIALS.md) |

**Duration:** ~10–15 min · **With ops counterpart:** nominate here while ops runs Act 3 in [`DEMO-OPERATIONS.md`](./DEMO-OPERATIONS.md)

---

# Five acts

---

## Act 1 — Inside the trust boundary

**Question:** What does our company need to maintain?

**Say:** *We're already an approved supplier. First we keep our profile accurate.*

| Screen | Route |
|--------|--------|
| Overview | `/dashboard` |
| Company profile | `/supplier-portal/profile` |

Show profile status, evidence/onboarding if present.

**Close the act:** *Our company profile is up to date — MTN can rely on it.*

---

## Act 2 — Introduce a worker

**Question:** How do we bring someone to MTN's attention?

**Say:** *We introduce a worker. This does not give them access and does not activate them.*

| Screen | Route |
|--------|--------|
| External workers | `/supplier-portal/contractors` |
| Nominate | **Nominate external worker** |

Contract `DEMO-SEED-001`, role, start date, rate, sponsor if needed.

**Close the act:** *We've introduced them — now we wait for MTN to decide.*

---

## Act 3 — Track review (read-only)

**Question:** What happened after we nominated them?

**Say:** *We can see the story — but we cannot advance it.*

| Screen | Route |
|--------|--------|
| Worker detail | `/supplier-portal/contractors/{id}` |
| Workforce timeline | On detail page |

Show `null → Nominated` and later ops steps when MTN acts (second browser or pre-seeded worker).

**Close the act:** *We can see exactly where our worker is in MTN's process.*

---

## Act 4 — Timesheets *(if data exists)*

**Question:** How do we manage ongoing work?

| Screen | Route |
|--------|--------|
| Supplier timesheets | `/supplier-portal/timesheets` |

**Close the act:** *Timesheets are our job — separate from whether MTN has activated a worker.*

---

## Act 5 — Invoice status *(if data exists)*

**Question:** How do we see billing?

| Screen | Route |
|--------|--------|
| Supplier invoices | `/supplier-portal/invoices` |

Amounts may show **Restricted** — finance visibility is MTN-controlled.

**Close the act:** *We can see status and periods; payment decisions sit with MTN.*

---

# Close

**Supplier-only room** — keep it practical:

> **You nominate and maintain your workers. MTN operations decides workforce status. Everyone sees the same timeline on each worker.**

**Mixed room (MTN present)** — add the architecture close from [`DEMO-PLATFORM-ARCHITECTURE.md`](./DEMO-PLATFORM-ARCHITECTURE.md) Phase 3 only if the audience wants the full picture.

---

## What suppliers never see (by design)

| Operations screen | Why absent |
|-------------------|------------|
| `/suppliers` | Supplier trust is MTN's decision |
| `/suppliers/approvals` | MTN approves suppliers, not suppliers |
| `/contractors/workforce-review` | Workforce decisions are MTN-owned |
| `/settings/audit-logs` | Governance is internal |

That separation is intentional — not a missing feature.
