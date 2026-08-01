# ML QA Feature — Implementation Plan

> **Status:** Parked for future implementation
> **Last Updated:** 2025-12-15

## Overview

Automated quality assurance for payroll calculations using rule-based anomaly detection. Scores each employee's payrun results and flags outliers for reviewer attention.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ NestJS          │     │ NATS JetStream  │     │ Python Worker   │
│ PayrunService   │────▶│ PAYROLL_EVENTS  │────▶│ ml-qa-worker    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                               │
        │                                               │
        ▼                                               ▼
┌───────────────────────────────────────────────────────────────┐
│                        PostgreSQL                             │
│  payruns, employee_results, pay_lines                        │
│  ml_runs, ml_employee_insights, ml_feedback, ml_qa_configs   │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────┐
│ NestJS          │
│ MlInsightsAPI   │◀── Frontend reads insights
└─────────────────┘
```

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Message bus | NATS JetStream | At-least-once delivery, durable, replay capability |
| Scoring trigger | `CALCULATED` status | Score before approval decision |
| Scoring approach | Rules-based v0 | Explainable, no ML training needed |
| Payrun-level score | % employees flagged HIGH+ | Actionable, not skewed by outliers |
| Thresholds | Database per pay group | Tunable without deploys |
| Consumer model | Single instance, pull-based | Low volume, easy to scale later |

---

## Database Schema

### New Enums

```prisma
enum MlRunStatus {
  RUNNING
  SUCCEEDED
  FAILED
}

enum MlSeverity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum MlFeedbackLabel {
  TP
  FP
  UNCERTAIN
}
```

### New Models

```prisma
model MlQaConfig {
  id          String   @id @default(uuid())
  payGroupId  String?  @unique @map("pay_group_id")
  country     Country?
  thresholds  Json
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("ml_qa_configs")
}

model MlRun {
  id             String      @id @default(uuid())
  payrunId       String      @unique @map("payrun_id")
  modelFamily    String      @map("model_family")
  modelVersion   String      @map("model_version")
  featureVersion String      @map("feature_version")
  status         MlRunStatus @default(RUNNING)
  overallScore   Int?        @map("overall_score")
  summary        Json?
  configSnapshot Json?       @map("config_snapshot")
  error          Json?
  startedAt      DateTime?   @map("started_at")
  completedAt    DateTime?   @map("completed_at")
  createdAt      DateTime    @default(now()) @map("created_at")
  updatedAt      DateTime    @updatedAt @map("updated_at")

  employeeInsights MlEmployeeInsight[]

  @@index([payrunId])
  @@map("ml_runs")
}

model MlEmployeeInsight {
  id          String     @id @default(uuid())
  mlRunId     String     @map("ml_run_id")
  payrunId    String     @map("payrun_id")
  employeeId  String     @map("employee_id")
  severity    MlSeverity
  score       Int
  flagTypes   String[]   @map("flag_types")
  explanation Json
  features    Json?
  createdAt   DateTime   @default(now()) @map("created_at")

  mlRun    MlRun        @relation(fields: [mlRunId], references: [id], onDelete: Cascade)
  feedback MlFeedback[]

  @@index([payrunId, severity])
  @@index([payrunId, employeeId])
  @@map("ml_employee_insights")
}

model MlFeedback {
  id             String          @id @default(uuid())
  insightId      String          @map("insight_id")
  payrunId       String          @map("payrun_id")
  employeeId     String          @map("employee_id")
  reviewerUserId String          @map("reviewer_user_id")
  label          MlFeedbackLabel
  comment        String?
  createdAt      DateTime        @default(now()) @map("created_at")

  insight MlEmployeeInsight @relation(fields: [insightId], references: [id], onDelete: Cascade)

  @@index([payrunId])
  @@index([insightId])
  @@map("ml_feedback")
}

model MlDeadLetter {
  id         String    @id @default(uuid())
  subject    String
  payload    Json
  error      String
  attempts   Int
  createdAt  DateTime  @default(now()) @map("created_at")
  resolvedAt DateTime? @map("resolved_at")
  resolvedBy String?   @map("resolved_by")

  @@map("ml_dead_letters")
}
```

---

## Feature Set `fs_v1`

### Variance Features (vs. previous period)
- `net_delta_abs`, `net_delta_pct`
- `gross_delta_abs`, `gross_delta_pct`
- `paye_delta_abs`, `paye_delta_pct`
- `uif_delta_abs`, `uif_delta_pct`

### Composition Features
- `overtime_pct_of_gross`
- `allowances_pct_of_gross`
- `deductions_pct_of_gross`

### Sanity Features
- `paye_is_zero_but_gross_gt_0`
- `uif_is_zero_but_gross_gt_0`
- `net_negative`

### Peer Comparison (robust z-scores using MAD)
- `peer_net_z`
- `peer_overtime_z`
- `peer_allowances_z`
- `peer_paye_z`

---

## Scoring Rules `v0`

### Default Thresholds

```json
{
  "NET_DELTA_PCT_HIGH": 0.30,
  "NET_DELTA_PCT_CRIT": 0.50,
  "GROSS_DELTA_PCT_HIGH": 0.30,
  "PAYE_DELTA_PCT_HIGH": 0.40,
  "UIF_ZERO_GROSS_GT_0": true,
  "OVERTIME_PCT_HIGH": 0.20,
  "ALLOWANCES_PCT_HIGH": 0.25,
  "PEER_Z_HIGH": 3.0,
  "PEER_Z_CRIT": 4.0,
  "NET_NEGATIVE": true
}
```

### Rules → Points

| Flag | Condition | Points |
|------|-----------|--------|
| NET_SPIKE | `abs(net_delta_pct) >= 0.50` | 35 |
| NET_SPIKE | `abs(net_delta_pct) >= 0.30` | 20 |
| GROSS_SPIKE | `abs(gross_delta_pct) >= 0.30` | 15 |
| PAYE_SPIKE | `abs(paye_delta_pct) >= 0.40` | 12 |
| UIF_MISSING | `gross > 0 and uif == 0` | 20 |
| PAYE_MISSING | `gross > 0 and paye == 0` | 20 |
| OVERTIME_OUTLIER | `overtime_pct >= 0.20` | 12 |
| ALLOWANCE_OUTLIER | `allowances_pct >= 0.25` | 10 |
| PEER_OUTLIER_NET | `abs(peer_net_z) >= 4` | 25 |
| PEER_OUTLIER_NET | `abs(peer_net_z) >= 3` | 15 |
| NET_NEGATIVE | `net < 0` | 40 |

### Score → Severity

- `>= 80` → CRITICAL
- `>= 55` → HIGH
- `>= 30` → MEDIUM
- `< 30` → LOW

### Payrun-Level Score

```
pct_high_plus = count(severity in [HIGH, CRITICAL]) / total_employees * 100
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/payruns/:id/ml-insights` | GET | Run summary + top flags |
| `/v1/payruns/:id/ml-insights/employees` | GET | List insights (filter by severity) |
| `/v1/payruns/:id/ml-insights/employees/:empId` | GET | Single employee detail |
| `/v1/payruns/:id/ml-insights/feedback` | POST | Submit TP/FP feedback |
| `/v1/ml-qa-config` | GET | List threshold configs |
| `/v1/ml-qa-config/:payGroupId` | PUT | Update thresholds (admin) |

### RBAC

| Role | Permissions |
|------|-------------|
| PAYROLL_CLERK | View insights |
| PAYROLL_MANAGER | View + feedback |
| APPROVER | View + feedback |
| ADMIN | All + manage thresholds |
| AUDITOR | Read-only all |

---

## NATS JetStream Configuration

### Stream

```javascript
{
  name: 'PAYROLL_EVENTS',
  subjects: ['payroll.>'],
  retention: 'limits',
  max_age: 604800000000000,  // 7 days in nanoseconds
  storage: 'file',
  replicas: 1  // 3 in production
}
```

### Consumer

```javascript
{
  durable_name: 'ml-qa-worker',
  filter_subject: 'payroll.payrun.calculated',
  ack_policy: 'explicit',
  ack_wait: 120000000000,  // 2 minutes
  max_deliver: 3
}
```

### Event Payload

```json
{
  "event_id": "evt_01H...",
  "occurred_at": "2026-01-25T18:01:00Z",
  "payrun_id": "pr_456",
  "country": "ZA",
  "legal_entity_id": "le_za_001",
  "pay_group_id": "pg_za_123",
  "period": {
    "start": "2026-01-01",
    "end": "2026-01-31",
    "pay_date": "2026-01-25"
  },
  "snapshot_id": "snap_99",
  "pack": {
    "id": "ZA",
    "version": "za-pack@1.1.0"
  }
}
```

---

## Implementation Phases

### Phase A: Foundation (Day 1)

**NestJS:**
1. Add ML enums and models to `schema.prisma`
2. Run migration
3. Add NATS module (JetStream publisher)
4. Publish event after `CALCULATED` status in PayrunService

**Deliverable:** Events flowing to NATS, ML tables ready

### Phase B: Python Worker (Days 2-3)

1. Create `ml-insights-worker/` project structure
2. Implement JetStream consumer (pull-based, durable)
3. Implement feature extractor (`fs_v1`)
4. Implement scorer (`rules_v0`)
5. Implement DB writers
6. Add to Docker Compose
7. Test with real payrun

**Deliverable:** Payruns auto-scored, insights in database

### Phase C: API Endpoints (Day 4)

1. Add `MlInsightsModule` to NestJS
2. Implement read endpoints (summary, employee list)
3. Implement feedback endpoint
4. Add RBAC guards

**Deliverable:** Frontend can display insights

### Phase D: Config & Polish (Day 5)

1. Add threshold config API
2. Add dead-letter inspection (admin)
3. Add monitoring (consumer lag, errors)
4. Integration tests

**Deliverable:** Production-ready

---

## Files to Create

### NestJS

```
src/
├── core/
│   └── nats/
│       ├── nats.module.ts
│       ├── nats-jetstream.service.ts
│       └── nats.config.ts
└── modules/
    └── ml-insights/
        ├── ml-insights.module.ts
        ├── ml-insights.controller.ts
        ├── ml-insights.service.ts
        ├── ml-qa-config.service.ts
        └── dto/
            ├── ml-run.dto.ts
            ├── ml-insight.dto.ts
            └── ml-feedback.dto.ts
```

### Python Worker

```
ml-insights-worker/
├── pyproject.toml
├── Dockerfile
├── src/
│   ├── main.py
│   ├── config.py
│   ├── db.py
│   ├── consumer.py
│   ├── processor.py
│   ├── features/
│   │   ├── extractor.py
│   │   └── cohort.py
│   ├── scoring/
│   │   ├── rules_v0.py
│   │   └── thresholds.py
│   ├── models/
│   │   └── schemas.py
│   └── writers/
│       ├── ml_run.py
│       └── ml_insight.py
└── tests/
    ├── test_extractor.py
    └── test_scorer.py
```

---

## Docker Compose Addition

```yaml
services:
  nats:
    image: nats:2.10-alpine
    command: ["-js", "-sd", "/data"]
    ports:
      - "4222:4222"
      - "8222:8222"
    volumes:
      - nats_data:/data

  ml-insights-worker:
    build: ./ml-insights-worker
    environment:
      - NATS_URL=nats://nats:4222
      - DATABASE_URL=${DATABASE_URL}
      - ML_MODEL_VERSION=0.1.0
      - ML_FEATURE_VERSION=fs_v1
    depends_on:
      - nats
      - postgres

volumes:
  nats_data:
```

---

## Environment Variables

### NestJS
```
NATS_URL=nats://nats:4222
```

### Python Worker
```
NATS_URL=nats://nats:4222
DATABASE_URL=postgres://user:pass@postgres:5432/payroll
ML_MODEL_VERSION=0.1.0
ML_FEATURE_VERSION=fs_v1
```

---

## Monitoring

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| Messages pending | NATS | > 100 for 5 min |
| Consumer lag | NATS | > 50 messages |
| Worker errors | Logs | > 3/hour |
| Dead letters | Postgres | Any new row |
| Scoring duration | Worker | p95 > 30s |

---

## When to Implement

Pick this up when:
- Core payroll is stable and in production use
- Users ask "how do I know if this payrun looks right?"
- You have real historical data to validate thresholds
- You need audit trail for why payruns were approved

---

## Future Enhancements (v1+)

- ML model training using feedback labels
- Isolation Forest for unsupervised anomaly detection
- Pay group-specific model tuning
- Trend analysis across multiple periods
- Integration with approval workflow (auto-hold if score > threshold)
