# ADR-010: Governance Analytics & Risk Intelligence

## Status
Proposed

## Context
The Policy Decision Platform (PDP) is now operationally complete through its full control cycle:

**Evaluate → Explain → Activate → Enforce → Exception → Audit**

Every governance decision — shadow evaluations, enforcement blocks, activation rule changes, and exception approvals — is persisted in the `AuditLog` with structured `metadata`, `tags`, and `severity` fields. The `PdpActivationRule` and `PdpExceptionRequest` models provide additional operational state.

However, raw audit data is not intelligence. Without analytics, governance degrades into bureaucracy:

* Operators cannot tell which policies cause the most friction.
* Leadership has no visibility into whether governance is helping or hurting throughput.
* Approvers who rubber-stamp exceptions are invisible.
* Suppliers with chronic compliance failures are not systematically flagged.
* Shadow-to-enforcement conversion success is unmeasured.
* There is no early warning for governance fatigue or policy suppression.

We need a **Governance Intelligence Layer** that transforms operational audit streams into executive risk intelligence, operational optimization signals, and abuse detection alerts.

## Decision
We will build a Governance Analytics & Risk Intelligence service that queries existing `AuditLog`, `PdpActivationRule`, and `PdpExceptionRequest` data to produce scored, aggregated, and trend-aware governance insights.

---

## 1. Core Metrics

All metrics are derived from existing audit data. No new write-path instrumentation is required.

### 1.1 Policy Friction Metrics
| Metric | Source | Query Pattern |
|--------|--------|---------------|
| Top reason codes by frequency | `AuditLog` where `action = 'PDP_SHADOW_EVALUATION'` | Group by `metadata.reason_code`, count, sort desc |
| Block rate | `AuditLog` PDP events | `evaluatedDecision = 'BLOCK'` / total evaluations |
| Hold rate | `AuditLog` PDP events | `evaluatedDecision = 'HOLD'` / total evaluations |
| Approval-required rate | `AuditLog` PDP events | `evaluatedDecision = 'APPROVAL_REQUIRED'` / total evaluations |
| Pass-through rate | `AuditLog` PDP events | `evaluatedDecision = 'ALLOW'` / total evaluations |
| Top reason codes by action | `AuditLog` PDP events | Group by `metadata.reason_code, metadata.action` |

### 1.2 Exception Metrics
| Metric | Source | Query Pattern |
|--------|--------|---------------|
| Exception request rate | `PdpExceptionRequest` | Count per time window |
| Exception approval rate | `PdpExceptionRequest` | `status = 'APPROVED'` / total |
| Exception rejection rate | `PdpExceptionRequest` | `status = 'REJECTED'` / total |
| Average time-to-approval | `PdpExceptionRequest` | `updatedAt - createdAt` where `status = 'APPROVED'` |
| Top exception requestors | `PdpExceptionRequest` | Group by `requestedBy`, count |
| Top exception approvers | `PdpExceptionRequest` | Group by `approverId`, count |
| Exception expiry utilization | `PdpExceptionRequest` | How often approved exceptions are actually consumed by PDP engine |

### 1.3 Entity Compliance Metrics
| Metric | Source | Query Pattern |
|--------|--------|---------------|
| Top violating suppliers | `AuditLog` PDP events | Group by `metadata.supplierId`, filter non-ALLOW |
| Top violating contractors | `AuditLog` PDP events | Group by `metadata.contractorId`, filter non-ALLOW |
| Top violating organizations | `AuditLog` PDP events | Group by `organizationId`, filter non-ALLOW |
| Self-service compliance rate | `AuditLog` PDP events | Entities that resolved their own compliance issues vs. forced via exception |

---

## 2. Risk Scoring

Risk scores are computed values, stored ephemerally and recalculated on query or on a scheduled cadence. They are **not** persisted as authoritative state.

### 2.1 Supplier Governance Risk Score
Inputs:
* Count of non-ALLOW PDP evaluations in last 90 days
* Count of exception requests associated with this supplier
* Whether supplier master agreement is expired or expiring within 30 days
* Count of distinct reason codes triggered (breadth of non-compliance)
* Trend direction (worsening = higher score)

Formula: Weighted composite, normalized to 0–100.

| Weight | Factor |
|--------|--------|
| 30% | Block/Hold frequency |
| 25% | Exception dependency (how often exceptions are needed to operate) |
| 20% | Reason code breadth |
| 15% | Agreement health (expired/expiring) |
| 10% | Trend acceleration |

### 2.2 Contractor Governance Risk Score
Same structure as supplier score, but scoped to individual contractors:
* Late timesheet submissions
* Post-expiry labor attempts
* Frozen/inactive status triggers

### 2.3 Organization Governance Maturity Score
Measures how well an org is self-governing:
* Low exception request rate = mature
* High self-cure rate (resolved compliance before PDP blocked) = mature
* Low override rate = mature
* High shadow-to-enforcement adoption = mature

Scale: 1 (Reactive) → 5 (Self-Governing)

### 2.4 Approver Override Risk Score
Detects potential rubber-stamping or concentration of override authority:
* Approval rate > 90% = elevated risk
* Average review time < 60 seconds = elevated risk
* Single approver handling > 50% of all exceptions = concentration risk
* Approver overriding for a single supplier repeatedly = relationship risk

---

## 3. Abuse Detection

Abuse detection produces **alerts**, not blocks. These are surfaced to governance administrators and security teams.

### 3.1 Exception Abuse Patterns
| Pattern | Detection Logic | Alert Severity |
|---------|----------------|----------------|
| Repeated exception requests | Same `requestedBy + reasonCode + action` > 3 times in 30 days | WARNING |
| Chronic same-approver override | Same `approverId` approves > 80% of a specific requestor's exceptions | WARNING |
| Exception-as-policy | Same `reasonCode` has >10 approved exceptions active simultaneously | CRITICAL |
| Expired-and-renewed cycle | Exception approved, expires, immediately re-requested | WARNING |

### 3.2 Operational Abuse Patterns
| Pattern | Detection Logic | Alert Severity |
|---------|----------------|----------------|
| Chronic PO missing | Same supplier triggers `MISSING_PO` > 5 times in 30 days | WARNING |
| Chronic late timesheets | Same contractor triggers `LATE_TIMESHEET_SUBMISSION` > 3 times in 30 days | INFO |
| Policy suppression hotspot | Activation rule disabled/re-enabled > 3 times in 30 days | CRITICAL |
| Shadow mode stagnation | Reason code in SHADOW mode for > 90 days without enforcement progression | WARNING |

### 3.3 Alert Delivery
Alerts are written to `AuditLog` with:
* `action = 'GOVERNANCE_RISK_ALERT'`
* `severity = WARNING | CRITICAL`
* `tags = ['GOVERNANCE', 'RISK_INTELLIGENCE', '<pattern_name>']`
* `metadata = { alertType, entityId, entityType, score, evidence }`

Future: NATS publish to `governance.alerts.*` for real-time consumption.

---

## 4. Governance Health Indicators

### 4.1 Shadow → Enforcement Conversion
Tracks the governance program's progression maturity:
* Count of reason codes currently in SHADOW
* Count of reason codes that have progressed to WARN or higher
* Average time-in-shadow before enforcement (days)
* Reason codes that regressed from enforcement back to SHADOW (rollback events)

### 4.2 False Positive Trends
Identifies over-blocking:
* Reason codes where >70% of evaluations result in exception approval → the policy may be too aggressive
* Reason codes where enforcement was activated then rolled back within 7 days → premature enforcement

### 4.3 Governance Fatigue Indicators
Detects when governance is causing operational harm:
* Exception queue depth trending upward over 4 weeks
* Average exception approval time increasing (approvers ignoring queue)
* Operational teams disabling activation rules more frequently
* Block rate increasing while exception approval rate also increases (rubber-stamping under pressure)

---

## 5. Dashboards

### 5.1 Executive Governance Scorecard
**Audience**: CTO, CFO, Head of Compliance
**Cadence**: Weekly/Monthly

| Widget | Content |
|--------|---------|
| Governance Coverage | % of reason codes under active enforcement vs. shadow |
| Compliance Health | Aggregate block rate, hold rate, pass-through rate |
| Top Risk Entities | Top 5 suppliers/contractors by governance risk score |
| Exception Velocity | Exception requests per week, approval rate trend |
| Governance Maturity | Organization maturity scores by tenant |
| Program Progression | Shadow → Enforcement conversion timeline |

### 5.2 Operational Friction Dashboard
**Audience**: Operations Managers, Contractor Managers
**Cadence**: Daily

| Widget | Content |
|--------|---------|
| Top Friction Points | Reason codes causing the most blocks/holds today |
| Exception Queue Health | Pending count, average wait time, oldest pending |
| Supplier Compliance Status | Red/amber/green status per supplier |
| Action Breakdown | Block rates by action (`SUBMIT_TIMESHEET` vs. `SUBMIT_INVOICE`) |
| Self-Cure Rate | % of compliance issues resolved without exception |

### 5.3 Compliance Hotspots
**Audience**: Internal Audit, Security
**Cadence**: On-demand

| Widget | Content |
|--------|---------|
| Abuse Alerts | Active governance risk alerts |
| Approver Concentration | Heatmap of approver-to-requestor relationships |
| Policy Suppression Log | Activation rules disabled/modified recently |
| Override Audit Trail | Full exception lifecycle with evidence |
| Trend Anomalies | Reason codes with unusual volume changes |

---

## 6. Technical Architecture

### 6.1 Service Layer
```
GovernanceAnalyticsService
├── getCoreFrictionMetrics(timeWindow)
├── getExceptionMetrics(timeWindow)
├── getEntityComplianceMetrics(entityType, entityId?)
├── getSupplierRiskScore(supplierId)
├── getContractorRiskScore(contractorId)
├── getOrgMaturityScore(organizationId)
├── getApproverRiskScore(approverId)
├── getGovernanceHealthIndicators()
├── getAbuseAlerts(timeWindow)
└── getExecutiveScorecard(timeWindow)
```

### 6.2 Data Flow
```
AuditLog (existing)
PdpActivationRule (existing)           GovernanceAnalyticsService
PdpExceptionRequest (existing)    ──►   (read-only aggregation)
                                            │
                                            ▼
                                    GovernanceAnalyticsController
                                            │
                                    ┌───────┼───────┐
                                    ▼       ▼       ▼
                              Executive  Ops     Compliance
                              Scorecard  Dash    Hotspots
```

### 6.3 Query Strategy
* **No new tables required.** All analytics are derived from existing `AuditLog`, `PdpActivationRule`, and `PdpExceptionRequest`.
* **Read-only queries.** The analytics service never writes governance state.
* **Time-windowed aggregation.** All queries accept `fromDate` / `toDate` parameters to prevent unbounded scans.
* **Indexed paths.** Queries leverage existing indexes on `AuditLog.action`, `AuditLog.createdAt`, `AuditLog.organizationId`, and `AuditLog.severity`.
* **Future optimization.** If query volume becomes a concern, introduce materialized aggregation tables refreshed on a cron schedule (e.g., daily rollups). This is explicitly deferred until proven necessary.

### 6.4 Permissions
| Permission | Scope |
|------------|-------|
| `governance.analytics.read` | View dashboards and metrics |
| `governance.analytics.export` | Export data to CSV/PDF |
| `governance.risk.read` | View risk scores and abuse alerts |
| `governance.risk.manage` | Acknowledge/dismiss alerts |

---

## 7. Implementation Phases

### Phase 1: Core Analytics API (This PR)
* `GovernanceAnalyticsService` with friction metrics, exception metrics, entity metrics
* `GovernanceAnalyticsController` with read-only endpoints
* Basic risk scoring (supplier, contractor)
* Tests for aggregation correctness

### Phase 2: Dashboards
* Executive Governance Scorecard UI
* Operational Friction Dashboard UI
* Integration with existing Security Insights page

### Phase 3: Abuse Detection
* Pattern-matching engine for exception abuse
* Governance risk alert generation
* Compliance Hotspots UI

### Phase 4: Advanced Intelligence (Future)
* Predictive governance (ML-based anomaly detection on evaluation trends)
* NATS event streaming for real-time governance alerts
* Automated policy tuning recommendations
* Cross-tenant governance benchmarking

---

## 8. Consequences

### Positive
* **Measurable governance.** Leadership can answer "is governance helping or hurting?" with data.
* **Optimizable policies.** Over-blocking and under-blocking become visible and correctable.
* **Abuse visibility.** Rubber-stamping, exception-as-policy, and approver concentration are detectable.
* **Program maturity tracking.** Shadow-to-enforcement progression is measured, not assumed.
* **No new write-path complexity.** Everything is read-only aggregation over existing data.

### Negative
* **Query cost.** Large audit log tables may cause slow aggregation queries without materialized views.
* **Interpretation risk.** Risk scores are heuristics, not ground truth. Governance teams must be trained to use them as signals, not verdicts.
* **Dashboard maintenance.** More UI surface area to maintain.

### Mitigations
* Time-windowed queries with sensible defaults (30/90 days).
* Materialized aggregation deferred until proven necessary.
* Risk scores are explicitly labeled as advisory, never enforcement inputs.

---

## References
* [ADR-008: PDP Runtime Execution Contract](./ADR-008-PDP-Runtime-Execution-Contract.md)
* [ADR-009: PDP Activation Control Plane](./ADR-009-PDP-Activation-Control-Plane.md)
* [PDP Reason Code Catalog](./PDP_REASON_CODE_CATALOG.md)
* [PDP Enforcement Readiness Matrix](./PDP_ENFORCEMENT_READINESS_MATRIX.md)
* [Audit Event Catalog](./AUDIT_EVENT_CATALOG.md)
