# Operating Model — Market benchmark (Appendix B pattern)

**Status:** `DRAFT` — **workshop alignment**, not a competitive audit or platform-specific certification.

**Companion:** [`CONTRACTOR_OPERATING_MODEL_V1.md`](./CONTRACTOR_OPERATING_MODEL_V1.md).

**Disclaimer:** Patterns below summarize **common** behaviors in enterprise **VMS / MSP / extended workforce** and **IGA** contexts (e.g. SAP Fieldglass–class, Workday extended worker, Beeline-class, supplier-neutral IGA). Names are **illustrative**; capabilities vary by tenant configuration. **Do not** cite this table as legal advice or supplier product documentation.

---

## Capability matrix

| Capability | Market common pattern (illustrative) | Our default (v0.5 doctrine) |
|------------|----------------------------------------|-----------------------------|
| **Supplier of record** | Supplier firm registers workers, submits time, invoices client | **Supplier bills client**; supplier-managed resource default |
| **Worker self-service** | Often limited: time entry or read-only status; rarely full AP invoice | **Invoice visibility OFF**; optional **payment status**; timesheet self-entry **configurable**, default **supplier-led** |
| **Sponsor / cost manager** | Named accountable party on work order / SOW | **One primary sponsor (HCM)** + optional delegate; **LOCKED** doctrine **§25** (v0.5) |
| **IGA for contingent** | Logical access gated on provisioning / certification | **Two planes** + **§25 sponsor** for justification; **§24** IGA execution; **ACCESS_ENABLED** = sponsor + IGA when access required |
| **Supplier portal** | Separate login for supplier ops | **Target ON**, **ship OFF** until MVP (OD-04) |
| **Independent vs agency** | Distinct work order types and billing rules | **Independent supported, not default** (OD-05) |
| **Lifecycle** | Draft → submitted → approved → active → end | Mapped toward **§7 workforce plane** in constitution (phased implementation) |
| **VMS vs IGA** | VMS / extended workforce tools own **work order & supplier context**; enterprise IGA owns **account and badge provisioning** | **CMS aligns with VMS-style workforce truth**; **does not replace IGA** — see constitution **§24** (v0.4) |

---

## Maintenance

When **CONTRACTOR_OPERATING_MODEL_V1** is ratified to **v1.0**, revisit this file: tighten wording with any **customer-specific** benchmark pack stored outside the public repo if needed.
