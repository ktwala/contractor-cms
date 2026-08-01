-- PR-TAX-GOV-2A — Optional SQL checklist (run against the app database).
-- Complement to: npm run verify:tta-rbac

-- 1) All TTA permission rows
SELECT code, description
FROM permissions
WHERE code LIKE 'tax_table_authoring%'
ORDER BY code;

-- 2) Role → TTA mapping (repeat for TAX_TABLE_ADMINISTRATOR, GLOBAL_COMPLIANCE_ADMIN)
SELECT r.name AS role_name, p.code
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE r.name = 'TENANT_ADMIN'
  AND p.code LIKE 'tax_table_authoring%'
ORDER BY p.code;
