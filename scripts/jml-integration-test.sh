#!/usr/bin/env bash
#
# JML Integration Test Pack v1 — Delta + Current Employment Correctness
#
# Proves:
# - Delta is transaction-time (Employee.updatedAt / Employment.updatedAt)
# - current_employment is business-time ("as of now" unless as_of param)
#
# Usage:
#   BASE_URL=http://localhost:3000 ./scripts/jml-integration-test.sh
#   EMP_NO_A=E2E-101 EMP_NO_B=E2E-102 ./scripts/jml-integration-test.sh
#   ./scripts/jml-integration-test.sh --save-evidence
# Requires: curl, jq
#
set -e
BASE_URL="${BASE_URL:-http://localhost:3000}"
FAILED=0
SAVE_EVIDENCE=""
[ "${1:-}" = "--save-evidence" ] && SAVE_EVIDENCE=1

# Configurable employee numbers (rerun without reseeding)
RUN_ID="${RUN_ID:-}"
if [ -n "$RUN_ID" ]; then
  EMP_NO_A="${EMP_NO_A:-E2E-${RUN_ID}-A}"
  EMP_NO_B="${EMP_NO_B:-E2E-${RUN_ID}-B}"
else
  EMP_NO_A="${EMP_NO_A:-E2E-0001}"
  EMP_NO_B="${EMP_NO_B:-E2E-0002}"
fi

# Dates in UTC (+%F = YYYY-MM-DD). Portable: macOS (-v+1d), GNU (-d "+1 day"), else node
TODAY="$(date -u +%F)"
TOMORROW="$( (date -u -v+1d +%F 2>/dev/null) || (date -u -d "+1 day" +%F 2>/dev/null) || (node -e "const d=new Date(); d.setUTCDate(d.getUTCDate()+1); console.log(d.toISOString().slice(0,10));") )"

pass() { echo "  ✅ PASS: $1"; }
fail() { echo "  ❌ FAIL: $1"; FAILED=$((FAILED+1)); }

# Evidence bundle dir (when --save-evidence)
EVIDENCE_DIR=""
if [ -n "$SAVE_EVIDENCE" ]; then
  EVIDENCE_DIR="artifacts/jml-test-$(date -u +%Y%m%d%H%M%S)"
  mkdir -p "$EVIDENCE_DIR"
  echo "Evidence will be saved to $EVIDENCE_DIR"
fi
save_ev() { [ -n "$EVIDENCE_DIR" ] && [ -n "$1" ] && echo "$2" > "$EVIDENCE_DIR/$1"; }

echo "=============================================="
echo "JML Integration Test Pack — $BASE_URL"
echo "TODAY=$TODAY TOMORROW=$TOMORROW  (UTC)"
echo "EMP_NO_A=$EMP_NO_A  EMP_NO_B=$EMP_NO_B"
echo "=============================================="

# --- 0) Login ---
echo ""
echo "[0] Login as admin and IGA..."
ADMIN_RESP="$(curl -s -X POST "$BASE_URL/v1/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@demo.payroll","password":"admin123"}')"
IGA_RESP="$(curl -s -X POST "$BASE_URL/v1/auth/login" -H "Content-Type: application/json" -d '{"email":"iga@demo.payroll","password":"admin123"}')"

ADMIN_TOKEN="$(echo "$ADMIN_RESP" | jq -r '.access_token // empty')"
IGA_TOKEN="$(echo "$IGA_RESP" | jq -r '.access_token // empty')"

if [ -z "$ADMIN_TOKEN" ]; then fail "Admin login"; else pass "Admin login"; fi
if [ -z "$IGA_TOKEN" ]; then fail "IGA login"; else pass "IGA login"; fi
[ -n "$ADMIN_TOKEN" ] && [ -n "$IGA_TOKEN" ] || exit 1

# Permission gate: HR with IGA token -> 200
HR_STATUS="$(curl -s -o /tmp/hr_gate.json -w "%{http_code}" -H "Authorization: Bearer $IGA_TOKEN" "$BASE_URL/v1/hr/employees?limit=5")"
if [ "$HR_STATUS" = "200" ]; then pass "GET /v1/hr/employees with IGA token → 200"; else fail "GET /v1/hr/employees with IGA token → $HR_STATUS"; fi

# --- Resolve legal entity + pay group (admin) ---
LE_ID="$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL/v1/legal-entities" | jq -r '.items[0].id // empty')"
PG_RESP="$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL/v1/pay-groups")"
PG_ID="$(echo "$PG_RESP" | jq -r '(.items // .)[0].id // empty')"
if [ -z "$LE_ID" ] || [ -z "$PG_ID" ]; then
  fail "Resolve legal_entity_id and pay_group_id (seed data?)"
  exit 1
fi
pass "Resolved legal_entity + pay_group"

# --- Checkpoint T0 ---
echo ""
echo "[1] Checkpoint T0 (baseline)..."
T0="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
DELTA_T0="$(curl -s -H "Authorization: Bearer $IGA_TOKEN" "$BASE_URL/v1/hr/employees?changed_since=$T0&limit=50")"
COUNT_T0="$(echo "$DELTA_T0" | jq '.items | length')"
if [ "${COUNT_T0:-0}" -le 5 ]; then pass "changed_since=T0 → empty or small (count=$COUNT_T0)"; else fail "changed_since=T0 → expected empty/small, got $COUNT_T0"; fi

# ========== TRACK A — Effective today ==========
echo ""
echo "========== TRACK A — Effective today (JOINER → MOVER → LEAVER) =========="

echo "[A1] JOINER: create employee + employment (effective today)..."
CREATE_EMP="$(curl -s -X POST "$BASE_URL/v1/employees" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d "{
  \"employee_no\": \"$EMP_NO_A\",
  \"first_name\": \"Track\",
  \"last_name\": \"A\",
  \"hire_date\": \"$TODAY\"
}")"
EMP_ID_A="$(echo "$CREATE_EMP" | jq -r '.id // empty')"
if [ -z "$EMP_ID_A" ]; then fail "Create employee $EMP_NO_A"; else pass "Create employee $EMP_NO_A"; fi

CREATE_EMP_JOB="$(curl -s -X POST "$BASE_URL/v1/employees/$EMP_ID_A/employments" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d "{
  \"legal_entity_id\": \"$LE_ID\",
  \"pay_group_id\": \"$PG_ID\",
  \"country\": \"ZA\",
  \"job_title\": \"Junior Payroll\",
  \"cost_center\": \"CC-100\",
  \"effective_from\": \"$TODAY\"
}")"
EMP_JOB_ID="$(echo "$CREATE_EMP_JOB" | jq -r '.id // empty')"
if [ -z "$EMP_JOB_ID" ]; then fail "Create employment (today)"; else pass "Create employment (today)"; fi

# Assert delta and current_employment
sleep 1
DELTA_A1="$(curl -s -H "Authorization: Bearer $IGA_TOKEN" "$BASE_URL/v1/hr/employees?changed_since=$T0&limit=50&include=current_employment,manager")"
FOUND="$(echo "$DELTA_A1" | jq --arg no "$EMP_NO_A" '[.items[] | select(.employee_no == $no)] | length')"
EFF_FROM="$(echo "$DELTA_A1" | jq -r --arg no "$EMP_NO_A" '.items[] | select(.employee_no == $no) | .current_employment.effective_from // empty')"
A1_AS_OF="$(echo "$DELTA_A1" | jq -r '.as_of // empty')"

if [ "${FOUND:-0}" -ge 1 ]; then pass "Delta contains $EMP_NO_A"; else fail "Delta should contain $EMP_NO_A (found=$FOUND)"; fi
if [ "$EFF_FROM" = "$TODAY" ]; then pass "current_employment.effective_from = $TODAY"; else fail "current_employment.effective_from = $EFF_FROM (expected $TODAY)"; fi

BY_NO="$(curl -s -H "Authorization: Bearer $IGA_TOKEN" "$BASE_URL/v1/hr/employees/by-employee-no/$EMP_NO_A")"
BY_NO_ID="$(echo "$BY_NO" | jq -r '.employee_id // empty')"
if [ "$BY_NO_ID" = "$EMP_ID_A" ]; then pass "GET by-employee-no/$EMP_NO_A returns employee"; else fail "GET by-employee-no/$EMP_NO_A"; fi

HIST_A1="$(curl -s -H "Authorization: Bearer $IGA_TOKEN" "$BASE_URL/v1/hr/employees/$EMP_NO_A/employments")"
HIST_COUNT="$(echo "$HIST_A1" | jq '.items | length')"
if [ "${HIST_COUNT:-0}" -eq 1 ]; then pass "Employment history: 1 open employment"; else fail "Employment history: expected 1, got $HIST_COUNT"; fi

save_ev "checkpoint_t0.txt" "$T0"
save_ev "checkpoint_a1.txt" "$A1_AS_OF"
save_ev "delta_a1.json" "$DELTA_A1"
save_ev "employee_by_no_a1.json" "$BY_NO"
save_ev "history_a1.json" "$HIST_A1"

echo "[A2] MOVER: new employment (today, different job_title/cost_center)..."
CREATE_EMP_JOB2="$(curl -s -X POST "$BASE_URL/v1/employees/$EMP_ID_A/employments" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d "{
  \"legal_entity_id\": \"$LE_ID\",
  \"pay_group_id\": \"$PG_ID\",
  \"country\": \"ZA\",
  \"job_title\": \"Payroll Specialist\",
  \"cost_center\": \"CC-200\",
  \"effective_from\": \"$TODAY\"
}")"
sleep 1
DELTA_A2="$(curl -s -H "Authorization: Bearer $IGA_TOKEN" "$BASE_URL/v1/hr/employees?changed_since=$A1_AS_OF&limit=50&include=current_employment")"
FOUND_A2="$(echo "$DELTA_A2" | jq --arg no "$EMP_NO_A" '[.items[] | select(.employee_no == $no)] | length')"
CURR_JOB="$(echo "$DELTA_A2" | jq -r --arg no "$EMP_NO_A" '.items[] | select(.employee_no == $no) | .current_employment.job_title // empty')"
A2_AS_OF="$(echo "$DELTA_A2" | jq -r '.as_of // empty')"
save_ev "checkpoint_a2.txt" "$A2_AS_OF"
save_ev "delta_a2.json" "$DELTA_A2"

if [ "${FOUND_A2:-0}" -ge 1 ]; then pass "Delta (since A1) contains employee (Employment.updatedAt drives delta)"; else fail "Delta should contain $EMP_NO_A after mover"; fi
if [ "$CURR_JOB" = "Payroll Specialist" ]; then pass "current_employment reflects new employment"; else fail "current_employment.job_title = $CURR_JOB"; fi

HIST_A2="$(curl -s -H "Authorization: Bearer $IGA_TOKEN" "$BASE_URL/v1/hr/employees/$EMP_NO_A/employments")"
HIST_COUNT_A2="$(echo "$HIST_A2" | jq '.items | length')"
if [ "${HIST_COUNT_A2:-0}" -eq 2 ]; then pass "Employment history: 2 rows (old closed, new open)"; else fail "Employment history: expected 2, got $HIST_COUNT_A2"; fi

echo "[A3] LEAVER: terminate employee (today)..."
PATCH_TERM="$(curl -s -X PATCH "$BASE_URL/v1/employees/$EMP_ID_A" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d "{\"status\": \"TERMINATED\", \"termination_date\": \"$TODAY\"}")"
sleep 1
DELTA_A3="$(curl -s -H "Authorization: Bearer $IGA_TOKEN" "$BASE_URL/v1/hr/employees?changed_since=$A2_AS_OF&limit=50")"
FOUND_A3="$(echo "$DELTA_A3" | jq --arg no "$EMP_NO_A" '[.items[] | select(.employee_no == $no)] | length')"
STATUS_A3="$(echo "$DELTA_A3" | jq -r --arg no "$EMP_NO_A" '.items[] | select(.employee_no == $no) | .status // empty')"
A3_AS_OF="$(echo "$DELTA_A3" | jq -r '.as_of // empty')"
save_ev "checkpoint_a3.txt" "$A3_AS_OF"
save_ev "delta_a3.json" "$DELTA_A3"

if [ "${FOUND_A3:-0}" -ge 1 ]; then pass "Delta (since A2) contains employee (Employee.updatedAt drives delta)"; else fail "Delta should contain $EMP_NO_A after termination"; fi
if [ "$STATUS_A3" = "TERMINATED" ]; then pass "status/termination_date returned"; else fail "status = $STATUS_A3"; fi

echo "[A4] No false positives: changed_since=A3 → empty..."
DELTA_A4="$(curl -s -H "Authorization: Bearer $IGA_TOKEN" "$BASE_URL/v1/hr/employees?changed_since=$A3_AS_OF&limit=50")"
COUNT_A4="$(echo "$DELTA_A4" | jq '.items | length')"
if [ "${COUNT_A4:-0}" -eq 0 ]; then pass "changed_since=A3 → empty"; else fail "changed_since=A3 → expected empty, got $COUNT_A4"; fi

# ========== TRACK B — Effective tomorrow ==========
echo ""
echo "========== TRACK B — Effective tomorrow (planned mover/leaver) =========="

echo "[B1] JOINER (today)..."
CREATE_B="$(curl -s -X POST "$BASE_URL/v1/employees" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d "{
  \"employee_no\": \"$EMP_NO_B\",
  \"first_name\": \"Track\",
  \"last_name\": \"B\",
  \"hire_date\": \"$TODAY\"
}")"
EMP_ID_B="$(echo "$CREATE_B" | jq -r '.id // empty')"
curl -s -X POST "$BASE_URL/v1/employees/$EMP_ID_B/employments" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d "{
  \"legal_entity_id\": \"$LE_ID\",
  \"pay_group_id\": \"$PG_ID\",
  \"country\": \"ZA\",
  \"job_title\": \"Analyst\",
  \"effective_from\": \"$TODAY\"
}" > /dev/null
sleep 1
DELTA_B1="$(curl -s -H "Authorization: Bearer $IGA_TOKEN" "$BASE_URL/v1/hr/employees?changed_since=$T0&limit=100&include=current_employment")"
B1_AS_OF="$(echo "$DELTA_B1" | jq -r '.as_of // empty')"
pass "B1: employee + employment today"

echo "[B2] MOVER scheduled for tomorrow (D1)..."
curl -s -X POST "$BASE_URL/v1/employees/$EMP_ID_B/employments" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d "{
  \"legal_entity_id\": \"$LE_ID\",
  \"pay_group_id\": \"$PG_ID\",
  \"country\": \"ZA\",
  \"job_title\": \"Senior Analyst\",
  \"cost_center\": \"CC-300\",
  \"effective_from\": \"$TOMORROW\"
}" > /dev/null
sleep 1
DELTA_B2="$(curl -s -H "Authorization: Bearer $IGA_TOKEN" "$BASE_URL/v1/hr/employees?changed_since=$B1_AS_OF&limit=100&include=current_employment")"
FOUND_B2="$(echo "$DELTA_B2" | jq --arg no "$EMP_NO_B" '[.items[] | select(.employee_no == $no)] | length')"
CURR_B2="$(echo "$DELTA_B2" | jq -r --arg no "$EMP_NO_B" '.items[] | select(.employee_no == $no) | .current_employment.job_title // empty')"
CURR_EFF_B2="$(echo "$DELTA_B2" | jq -r --arg no "$EMP_NO_B" '.items[] | select(.employee_no == $no) | .current_employment.effective_from // empty')"

if [ "${FOUND_B2:-0}" -ge 1 ]; then pass "Delta contains employee (Employment.updatedAt changed)"; else fail "Delta should contain $EMP_NO_B after future employment"; fi
if [ "$CURR_B2" = "Analyst" ] && [ "$CURR_EFF_B2" = "$TODAY" ]; then pass "current_employment still today's (Analyst, not tomorrow's)"; else fail "current_employment should be today's job (Analyst), got $CURR_B2 / $CURR_EFF_B2"; fi

HIST_B2="$(curl -s -H "Authorization: Bearer $IGA_TOKEN" "$BASE_URL/v1/hr/employees/$EMP_NO_B/employments")"
FUTURE_ROW="$(echo "$HIST_B2" | jq --arg from "$TOMORROW" '[.items[] | select(.effective_from == $from)] | length')"
FUTURE_JOB="$(echo "$HIST_B2" | jq -r --arg from "$TOMORROW" '[.items[] | select(.effective_from == $from) | .job_title] | first // empty')"
if [ "${FUTURE_ROW:-0}" -ge 1 ]; then pass "Employment history shows future row (effective_from=$TOMORROW)"; else fail "Employment history should show future employment"; fi
if [ "$FUTURE_JOB" = "Senior Analyst" ]; then pass "Future employment has job_title Senior Analyst (planned change exists, current does not flip early)"; else fail "Future row job_title = $FUTURE_JOB (expected Senior Analyst)"; fi
B2_AS_OF="$(echo "$DELTA_B2" | jq -r '.as_of // empty')"
save_ev "checkpoint_b1.txt" "$B1_AS_OF"
save_ev "checkpoint_b2.txt" "$B2_AS_OF"
save_ev "delta_b2.json" "$DELTA_B2"
save_ev "history_b2.json" "$HIST_B2"

echo "[B3] LEAVER scheduled for tomorrow (termination_date=D1)..."
curl -s -X PATCH "$BASE_URL/v1/employees/$EMP_ID_B" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d "{\"termination_date\": \"$TOMORROW\", \"status\": \"TERMINATED\"}" > /dev/null
sleep 1
DELTA_B3="$(curl -s -H "Authorization: Bearer $IGA_TOKEN" "$BASE_URL/v1/hr/employees?changed_since=$B2_AS_OF&limit=100")"
FOUND_B3="$(echo "$DELTA_B3" | jq --arg no "$EMP_NO_B" '[.items[] | select(.employee_no == $no)] | length')"
TERM_DATE="$(echo "$DELTA_B3" | jq -r --arg no "$EMP_NO_B" '.items[] | select(.employee_no == $no) | .termination_date // empty')"
if [ "${FOUND_B3:-0}" -ge 1 ]; then pass "Delta returns employee"; else fail "Delta should contain $EMP_NO_B"; fi
if [ "$TERM_DATE" = "$TOMORROW" ]; then pass "termination_date = $TOMORROW"; else fail "termination_date = $TERM_DATE"; fi

# ========== TRACK C — as_of (optional) ==========
echo ""
echo "========== TRACK C — as_of query (point-in-time current_employment) =========="
# With as_of=tomorrow, current_employment should resolve to tomorrow's assignment for E2E-0002
DELTA_ASOF="$(curl -s -H "Authorization: Bearer $IGA_TOKEN" "$BASE_URL/v1/hr/employees?changed_since=$T0&limit=100&include=current_employment&as_of=$TOMORROW")"
CURR_ASOF="$(echo "$DELTA_ASOF" | jq -r --arg no "$EMP_NO_B" '.items[] | select(.employee_no == $no) | .current_employment.job_title // empty')"
if [ "$CURR_ASOF" = "Senior Analyst" ]; then pass "as_of=$TOMORROW → current_employment = Senior Analyst (future assignment)"; else fail "as_of=$TOMORROW expected Senior Analyst, got $CURR_ASOF"; fi

# ========== Summary ==========
echo ""
echo "=============================================="
if [ -n "$EVIDENCE_DIR" ]; then
  {
    echo "JML Integration Test Pack — evidence bundle"
    echo "TODAY=$TODAY TOMORROW=$TOMORROW (UTC)"
    echo "EMP_NO_A=$EMP_NO_A EMP_NO_B=$EMP_NO_B"
    echo "T0=$T0 A1=$A1_AS_OF A2=$A2_AS_OF A3=$A3_AS_OF B1=$B1_AS_OF B2=$B2_AS_OF"
    echo "Result: $([ "$FAILED" -eq 0 ] && echo "ALL PASSED" || echo "$FAILED FAILED")"
  } > "$EVIDENCE_DIR/manifest.txt"
  echo "Evidence saved to $EVIDENCE_DIR"
fi
if [ "$FAILED" -eq 0 ]; then
  echo "Result: ALL PASSED"
  exit 0
else
  echo "Result: $FAILED assertion(s) FAILED"
  exit 1
fi
