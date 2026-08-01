# Managing an External Workforce

**Experience:** Operations Console  
**Audience:** MTN — procurement, operations, HR operations, security, governance.  
**Login:** `ops.admin@ewp.demo` / `Admin123!` (or `workforce.import@ewp.demo` for connector-heavy demos)  
**Live aid:** [`DEMO-CHEATSHEET.md`](./DEMO-CHEATSHEET.md) · **Supplier experience:** [`DEMO-SUPPLIER-PORTAL.md`](./DEMO-SUPPLIER-PORTAL.md) · **Executive opener:** [`DEMO-PLATFORM-ARCHITECTURE.md`](./DEMO-PLATFORM-ARCHITECTURE.md)

**Question this demo answers:** *How do we govern an external workforce?*

```text
Trust supplier → Accept worker → Manage workforce → Manage engagement → React
```

For a first meeting with MTN executives, use [`DEMO-PLATFORM-ARCHITECTURE.md`](./DEMO-PLATFORM-ARCHITECTURE.md) — problem first, login after five minutes — then return here for Acts 1–6.

---

## Presenting discipline

- **Story first, screens as evidence** — say the business moment, then click.
- **Never narrate route names** — *"Operations now has to make a decision"* not *"Opening Workforce Review."*
- **End each act in audience language** — responsibility and outcomes, not architecture labels.
- **Say:** supplier management · workforce decisions · worker assignment · access notification · **operational visibility**
- **Never say live:** Identity Acquisition · CAP · gateway · authoritative · capability names · **say "Workforce Import"** for the HCM connector page

**Oracle connectors (when asked):** EWP operationalizes authoritative business data without becoming its master — same governance pattern across HCM and Procurement (evidence → snapshot → assess → govern), not a universal mandate. See [`EXTERNAL_SOURCE_GOVERNANCE_PATTERN.md`](./EXTERNAL_SOURCE_GOVERNANCE_PATTERN.md). Externally: *governance pattern*, not *platform capability*.

| Transition | Say |
|------------|-----|
| Submit for review | *Moved from introduction into organisational review* |
| Activate | *Operations has accepted responsibility for this worker* |
| Suspend / end | *The workforce relationship has changed* |

---

## Before you start

| Item | Value |
|------|--------|
| Frontend | `http://localhost:3001` |
| Stack | `docker compose up -d` |
| Credentials | [`DEMO_LOGIN_CREDENTIALS.md`](./DEMO_LOGIN_CREDENTIALS.md) |

**Prep:** Second browser on `supplier.admin@atlas.demo` when Acts need supplier-visible timeline (nominate in supplier window, review in ops window). Full MTN ecosystem: [`DEMO-MTN-STORY.md`](./DEMO-MTN-STORY.md).

**Duration:** ~15–20 min · **With technical depth:** [`DEMO-TECHNICAL.md`](./DEMO-TECHNICAL.md)

**Overview:** `/dashboard` shows **today's attention** — supplier approvals, workers awaiting review, expiring contracts, governance exceptions. Each item opens the work; it is not a capability menu.

---

# Six acts

---

## Act 1 — Establish trust

**Question:** Who is allowed to supply workers to us?

**Say:** *Before anyone can introduce a worker, we need to know who we trust to supply them.*

| Screen | Route |
|--------|--------|
| Overview | `/dashboard` |
| Supplier registry | `/suppliers` |
| Supplier approvals | `/suppliers/approvals` |
| Supplier sync *(optional)* | `/supplier-sources/oracle/operations` |

**Close the act:** *We've decided who we trust to supply workers.*

---

## Act 2 — Worker introduced (supplier action, ops observes)

**Question:** How does someone become known to the organisation?

**Say:** *The approved supplier introduces someone — worker intake. Not access. Not activation.*

Switch to **supplier browser** (or pre-nominated worker):

| Screen | Route |
|--------|--------|
| Nominate | `/supplier-portal/contractors` → **Nominate external worker** |

Contract `DEMO-SEED-001`, role, dates. *"The worker has been introduced."*

**Close the act:** *The supplier has introduced someone — they are known, not yet active.*

---

## Act 3 — Workforce decision

**Question:** Do we accept this worker into our workforce?

**Say:** *Operations now has to make a decision.*

| Screen | Route |
|--------|--------|
| Workforce review | `/contractors/workforce-review` |

Submit for review → Activate. Refresh supplier detail timeline.

**Close the act:** *Operations has now accepted responsibility for this worker.*

---

## Act 4 — Commercial context

**Question:** What work will this person actually perform?

**Say:** *The worker has been accepted. Where will they actually work?*

| Screen | Route |
|--------|--------|
| Contracts | `/contracts` |
| Engagements | `/engagements` |
| Sponsor accountability *(if enabled)* | `/sponsor-tasks` |

**Close the act:** *We know where they will work — that's separate from whether they can work.*

---

## Act 5 — Relationship change

**Question:** What happens when the business changes the workforce relationship?

**Say:** *The workforce relationship has changed* — not *suspend the worker*.

Post-activation pause/end: API pre-run or [`DEMO-TECHNICAL.md`](./DEMO-TECHNICAL.md). Reject/blacklist on spare workers for technical track.

**Close the act:** *The workforce relationship has changed — everyone else will need to react.*

---

## Act 6 — Platform reaction

**Question:** What should happen because workforce changed?

1. Timeline (supplier portal worker detail)
2. Audit `/settings/audit-logs`
3. Access notification evidence (technical)

**Close the act:** *The platform recorded what happened and notified downstream systems.*

---

# Close (architecture — MTN stakeholders only)

Reserve this for the end. Do not sprinkle it between acts.

1. *If we changed the workforce decision tomorrow, where would we make that change?* → wait → **Exactly one place.**
2. Truth cascade: Supplier Truth → Worker Truth → Assignment Truth → Access Reaction → Operational Visibility
3. *Every piece of business truth has one owner. Everything else introduces, transfers, or consumes.*

Full executive arc with pre-login problem statement: [`DEMO-PLATFORM-ARCHITECTURE.md`](./DEMO-PLATFORM-ARCHITECTURE.md).

---

## What not to demo (unless asked)

MTN approval chains · ServiceNow/Aveksa execution · Full HCM push · Un-blacklist · Connector operational risk tiles · Cutover tab

**Workforce Discovery (optional ~7 min):** when MTN asks how HCM workforce enters EWP — login `workforce.import@ewp.demo`, route `/contractor-sources/oracle-hcm/operations`.

| Step | Tab | Say |
|------|-----|-----|
| 0 | *(prep)* | `docker compose restart mock-oracle` then `npm run docker:reset:connector-demo` — see [`DEMO-MTN-STORY.md`](./DEMO-MTN-STORY.md) |
| 1 | Overview → **Discover workforce** | *Oracle told us these workers exist — we preserved that as snapshot DISC-00001.* |
| 2 | Snapshot History | *This is our evidence archive — not connector milliseconds.* |
| 3 | Governance (before assess) | *Nothing is trusted yet — only how many await assessment.* |
| 4 | **Assess workforce** | *Assessment produces findings from that snapshot.* |
| 5 | Assessment findings | *These are what assessment discovered.* |
| 6 | Workforce readiness | *These explain why workers are not trusted yet.* |
| 7 | Resolution | *These are the tasks that close the gaps.* |
| 8 | Operational workforce | *These show governed lifecycle state after decisions.* |

**First discovery (greenfield):** Records discovered **40**, assessment pending. Supplier sync: **5** suppliers (**SYNC-00001**). Full run order: [`DEMO-MTN-STORY.md`](./DEMO-MTN-STORY.md).

**Migration/conflict demo only:** `npm run docker:reset:connector-demo:migration` — Matched to hidden comparison worker **6**, No worker match **3**, Conflict **1**. Do not use for the default MTN sales flow.

Full script: [`WORKFORCE_GOVERNANCE_LANGUAGE_GUIDE.md`](./WORKFORCE_GOVERNANCE_LANGUAGE_GUIDE.md) §2b.

---

## Combined demo (two windows)

| Step | Ops (`ops.admin@ewp.demo`) | Supplier (`supplier.admin@ewp.demo`) |
|------|----------------|------------------------------|
| 1 | Trust — suppliers / approvals | — (supplier already inside trust boundary) |
| 2 | — | Nominate worker |
| 3 | Review → activate | Show read-only timeline |
| 4 | Engagements | — |
| 5–6 | Change + reaction | Timeline updates |

Do not ask a supplier user to open `/suppliers` — that screen does not exist in their portal.
