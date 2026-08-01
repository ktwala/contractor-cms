# EWP demo — presenter cheat sheet

**Base URL:** `http://localhost:3001` · **Credentials:** [`DEMO_LOGIN_CREDENTIALS.md`](./DEMO_LOGIN_CREDENTIALS.md)

Three experiences — pick **one** column. Do not mix personas in one narrative.

**During demo:** audience language · **Close only:** truth cascade ([`DEMO-PLATFORM-ARCHITECTURE.md`](./DEMO-PLATFORM-ARCHITECTURE.md))

---

## Platform Architecture *(primary MTN pitch — no login first)*

**Open:** Five dept questions → *Should everyone decide independently?* → **No** → *Where should truth live?* → *Let me show you.* → login `ops.admin@ewp.demo`

| Phase | Do |
|-------|-----|
| **1 Problem** | Table: Procurement / Ops / Project / Security / Finance — ~5 min, no UI |
| **2 Behaviour** | [`DEMO-OPERATIONS.md`](./DEMO-OPERATIONS.md) Acts 1–6 — audience closers only |
| **3 Reveal** | *Where change workforce tomorrow?* → one place → truth cascade |

**Full script:** [`DEMO-PLATFORM-ARCHITECTURE.md`](./DEMO-PLATFORM-ARCHITECTURE.md)

---

## Managing an External Workforce (`ops.admin@ewp.demo` / `Admin123!`)

**Question:** *How do we govern an external workforce?*

| Act | Say → click | Close the act |
|-----|-------------|---------------|
| **1 Trust** | *Who do we trust?* → `/dashboard` `/suppliers` `/approvals` | *We've decided who we trust.* |
| **2 Introduce** | *(supplier window)* Nominate | *Known, not yet active.* |
| **3 Decide** | *Ops must decide* → `/contractors/workforce-review` | *Ops accepted responsibility.* |
| **4 Assign** | *Where will they work?* → `/contracts` `/engagements` | *Assignment ≠ whether they can work.* |
| **5 Change** | *Relationship changed* · API suspend if needed | *Everyone else will react.* |
| **6 React** | Timeline → `/settings/audit-logs` | *Platform recorded and notified.* |

**Overview:** today's attention — not a menu.

**Architecture close:** end only — see Platform Architecture column.

**Full script:** [`DEMO-OPERATIONS.md`](./DEMO-OPERATIONS.md)

---

## Working as a Supplier (`supplier.admin@ewp.demo` / `SupplierAdmin123!`)

**Question:** *How do I work with my customer?*

| Act | Say → click | Close the act |
|-----|-------------|---------------|
| **1 Profile** | *Keep our side accurate* → `/dashboard` `/supplier-portal/profile` | *Profile is up to date.* |
| **2 Introduce** | *Introduce, not activate* → Nominate | *Waiting for MTN to decide.* |
| **3 Track** | *Read-only timeline* → worker detail | *We see where they are in the process.* |
| **4 Timesheets** | `/supplier-portal/timesheets` | *Our commercial work.* |
| **5 Invoices** | `/supplier-portal/invoices` | *Status visible; MTN decides payment.* |

**Overview:** inbox + quick actions · **Never show:** `/suppliers`, `/approvals`, workforce review.

**Full script:** [`DEMO-SUPPLIER-PORTAL.md`](./DEMO-SUPPLIER-PORTAL.md)

---

## Technical add-ons

[`DEMO-TECHNICAL.md`](./DEMO-TECHNICAL.md) · `workforce.import@ewp.demo` for Workforce Import · `./scripts/validate-workforce-uat.sh`
