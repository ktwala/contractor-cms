# Platform Architecture — executive demo

**Audience:** MTN executives, enterprise architects, programme sponsors.
**Login:** none for the first five minutes — then `ops.admin@ewp.demo` / `Admin123!`
**Live aid:** [`DEMO-CHEATSHEET.md`](./DEMO-CHEATSHEET.md) · **Operations walkthrough:** [`DEMO-OPERATIONS.md`](./DEMO-OPERATIONS.md) · **Technical evidence:** [`DEMO-TECHNICAL.md`](./DEMO-TECHNICAL.md)

This is **Demo 3 of 3**. Use it as the **primary MTN pitch** when the room needs to understand *why* EWP exists before they see screens.

---

## Presenting discipline

- **Problem first, product second, architecture last.**
- **During the demo:** speak the language of the audience — responsibility, decisions, approvals, assignments.
- **At the close only:** reveal the truth cascade — behaviour first, design second.
- **Never say live:** Identity Acquisition · CAP · gateway · authoritative · capability names

---

## Phase 1 — The problem (no login, ~5 minutes)

Walk into the room. Do not open the laptop yet.

> Every organisation has external workers.

Five departments ask five different questions about the **same person**:

| Department | Question |
|------------|----------|
| Procurement | Which supplier introduced this worker? |
| Operations | Can this worker work? |
| Project | Where is this worker assigned? |
| Security | Should they still have access? |
| Finance | Can they be paid? |

**Pause.**

> Should every department decide the answer independently?

Wait for **no**.

> So where should the truth live?

**Pause.** Let the room sit with that.

> Let me show you.

**Now** open `http://localhost:3001` and log in as `ops.admin@ewp.demo`.

Everything the audience sees from here should answer a question they have already accepted.

---

## Phase 2 — Behaviour in the product (~15 minutes)

Run the operations story from [`DEMO-OPERATIONS.md`](./DEMO-OPERATIONS.md) — Acts 1–6 — but **without** architecture commentary between acts.

| Act | Audience closer (say this) |
|-----|----------------------------|
| Trust | *We've decided who we trust to supply workers.* |
| Introduce | *The supplier has introduced someone — they are known, not yet active.* |
| Decide | *Operations has now accepted responsibility for this worker.* |
| Assign | *We know where they will work — separate from whether they can work.* |
| Change | *The workforce relationship has changed — everyone else will react.* |
| React | *The platform recorded what happened and notified downstream systems.* |

Use a **second browser** on `supplier.admin@ewp.demo` when you want the room to see the supplier's read-only view of the same story ([`DEMO-SUPPLIER-PORTAL.md`](./DEMO-SUPPLIER-PORTAL.md) Acts 2–3).

**Overview:** point at `/dashboard` — *"This is operational work, not a menu."* Today's attention items are what need a decision today.

---

## Phase 3 — Architecture revealed (~5 minutes)

Only now name the design.

1. **Rhetorical close:** *If we changed the workforce decision tomorrow, where would we make that change?*

   Wait → *Exactly one place.*

2. **Truth cascade** (one slide or whiteboard — not every act):

   ```text
   Supplier truth
        ↓
   Worker truth
        ↓
   Assignment truth
        ↓
   Access reaction
        ↓
   Operational visibility
   ```

3. **Two sentences:**

   > Every piece of business truth has one owner.
   > Everything else introduces, transfers, or consumes.

That is the satisfying arc: they watched behaviour; now they understand the design behind it.

---

## When to use which demo

| Room | Start here |
|------|------------|
| MTN executive / architecture board | **This doc** (Phase 1 → 2 → 3) |
| MTN operations day-to-day | [`DEMO-OPERATIONS.md`](./DEMO-OPERATIONS.md) — *Managing an External Workforce* |
| Supplier company | [`DEMO-SUPPLIER-PORTAL.md`](./DEMO-SUPPLIER-PORTAL.md) — *Working as a Supplier* |
| Engineers / auditors | [`DEMO-TECHNICAL.md`](./DEMO-TECHNICAL.md) after operations Acts 5–6 |

---

## Before you start

| Item | Value |
|------|--------|
| Frontend | `http://localhost:3001` |
| Stack | `docker compose up -d` |
| Credentials | [`DEMO_LOGIN_CREDENTIALS.md`](./DEMO_LOGIN_CREDENTIALS.md) |
| Smoke | `./scripts/validate-workforce-uat.sh` |

**Duration:** ~25 min executive · add [`DEMO-TECHNICAL.md`](./DEMO-TECHNICAL.md) for 45–60 min deep dive.
