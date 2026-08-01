# JML Integration Test Pack v1 — Delta + Current Employment Correctness

Executable proof that:

1. **Delta is transaction-time:** Employee appears if `Employee.updatedAt > changed_since` OR any `Employment.updatedAt > changed_since`.
2. **current_employment is business-time:** Resolves “as of now” (or `as_of` query param); future-dated employments do not appear until that date.

## What the script does

- **Common setup:** Login as admin + IGA; permission gate (GET /v1/hr/employees with IGA → 200); checkpoint T0.
- **Track A (effective today):** JOINER → MOVER → LEAVER → no false positives. Proves delta mechanics and that closing/opening employment and termination are detectable.
- **Track B (effective tomorrow):** JOINER today; MOVER and LEAVER scheduled for tomorrow. Proves that `current_employment` stays “today’s” until the effective date and that the HR surface can represent planned changes.
- **Track C:** `as_of=<tomorrow>` → `current_employment` resolves to the future assignment (point-in-time).

## Run

```bash
# Default: http://localhost:3000, employee numbers E2E-0001 / E2E-0002
./scripts/jml-integration-test.sh

# Custom base URL
BASE_URL=http://localhost:4000 ./scripts/jml-integration-test.sh

# Rerun without reseeding: use different employee numbers
EMP_NO_A=E2E-101 EMP_NO_B=E2E-102 ./scripts/jml-integration-test.sh

# Or use a run ID (generates E2E-<RUN_ID>-A and E2E-<RUN_ID>-B)
RUN_ID=$(date +%Y%m%d%H%M%S) ./scripts/jml-integration-test.sh

# Save evidence bundle for auditors/vendors (checkpoints + key JSON payloads)
./scripts/jml-integration-test.sh --save-evidence
```

Evidence is written to **artifacts/jml-test-YYYYMMDDHHMMSS/** (UTC timestamp): `manifest.txt`, checkpoints (T0, A1–A3, B1–B2), `delta_*.json`, `history_*.json`, `employee_by_no_a1.json`. Add `artifacts/` to `.gitignore` if you don’t want to commit evidence.

**Requires:** `curl`, `jq`. Server must be up; DB seeded (admin + iga users, legal entity, pay group).

**Alternative:** For a Postman/Newman-based run with the same flow (Bootstrap, T0, Track A/B/C), see [POSTMAN_JML_TEST_PLAN.md](./POSTMAN_JML_TEST_PLAN.md).

## Artifacts (for vendor evidence)

- **Automatic:** Run with `--save-evidence` to write checkpoints and key payloads to `artifacts/jml-test-<timestamp>/`.
- **Manual:** T0, A1/A2/A3, B1/B2 checkpoints and JSON responses can also be captured from script output or by saving `response.as_of` and response bodies after each step.

Employee numbers default to **E2E-0001** (Track A) and **E2E-0002** (Track B). Override **EMP_NO_A** / **EMP_NO_B** or **RUN_ID** to rerun without reseeding (avoids duplicate `employee_no`).

## B4 — “Time passes” (manual / next day)

On D1 (tomorrow), without new writes:

- `current_employment` (as-of-now) will resolve to the new employment.
- The delta feed may not re-emit the employee, because nothing `updatedAt` changed. That’s expected for effective-dated systems; IGA typically uses `effective_from` / `termination_date` or a daily “effective transitions” job, or a future `/v1/hr/events` feed.
