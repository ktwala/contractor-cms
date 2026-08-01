-- Optional diagnostics: bank rows for employees with an employment on a pay group.
-- Replace YOUR_PAY_GROUP_UUID below (Hubsec monthly group).
-- Eligibility requires at least one bank_accounts row where
--   effective_from <= period_end AND (effective_to IS NULL OR effective_to >= period_start)
-- (same rule as PayrunSnapshotService.computeEligibilityForPayGroupPeriod).

-- List employees on pay group + their bank account rows
SELECT
  e.id AS employee_id,
  e.employee_no,
  e.first_name,
  e.last_name,
  ba.id AS bank_account_id,
  ba.bank_name,
  ba.branch_code,
  ba.account_type,
  ba.effective_from,
  ba.effective_to,
  ba.masked_account_number
FROM employees e
INNER JOIN employments em
  ON em.employee_id = e.id
  AND em.pay_group_id = 'YOUR_PAY_GROUP_UUID'
LEFT JOIN bank_accounts ba ON ba.employee_id = e.id
WHERE e.status = 'ACTIVE'
ORDER BY e.employee_no, ba.effective_from;
