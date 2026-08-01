-- Tax Tables Seed SQL
-- Run with: docker compose exec postgres psql -U payroll -d payroll_platform -f /seed.sql

-- Insert Lesotho PAYE 2025/2026
INSERT INTO tax_table_sets (
    id, country, table_type, tax_year, display_name, 
    effective_from, effective_to, status, source_ref, checksum, data,
    created_at, updated_at
) VALUES (
    gen_random_uuid(), 'LS', 'PAYE', '2025/2026', 'Lesotho PAYE 2025/2026',
    '2025-04-01', '2026-03-31', 'ACTIVE', 'Revenue Services Lesotho (rsl.org.ls)',
    'ls_paye_2025_seed',
    '{"brackets": [{"min": 0, "max": 74040, "rate": 0.20, "base_amount": 0}, {"min": 74040, "max": null, "rate": 0.30, "base_amount": 14808}], "credits": {"tax_credit": 11640}, "periods_per_year": {"WEEKLY": 52, "BI_WEEKLY": 26, "SEMI_MONTHLY": 24, "MONTHLY": 12}}'::jsonb,
    NOW(), NOW()
) ON CONFLICT (country, table_type, tax_year) DO UPDATE SET
    data = EXCLUDED.data,
    status = 'ACTIVE',
    updated_at = NOW();

-- Insert South Africa PAYE 2025/2026
INSERT INTO tax_table_sets (
    id, country, table_type, tax_year, display_name,
    effective_from, effective_to, status, source_ref, checksum, data,
    created_at, updated_at
) VALUES (
    gen_random_uuid(), 'ZA', 'PAYE', '2025/2026', 'South Africa PAYE 2025/2026',
    '2025-03-01', '2026-02-28', 'ACTIVE', 'SARS Budget 2025',
    'za_paye_2025_seed',
    '{"brackets": [{"min": 0, "max": 237100, "rate": 0.18, "base_amount": 0}, {"min": 237100, "max": 370500, "rate": 0.26, "base_amount": 42678}, {"min": 370500, "max": 512800, "rate": 0.31, "base_amount": 77362}, {"min": 512800, "max": 673000, "rate": 0.36, "base_amount": 121475}, {"min": 673000, "max": 857900, "rate": 0.39, "base_amount": 179147}, {"min": 857900, "max": 1817000, "rate": 0.41, "base_amount": 251258}, {"min": 1817000, "max": null, "rate": 0.45, "base_amount": 644489}], "rebates": {"primary": 17235, "secondary": 9444, "tertiary": 3145}, "thresholds": {"under65": 95750, "age65to74": 148217, "age75plus": 165689}, "periods_per_year": {"WEEKLY": 52, "BI_WEEKLY": 26, "SEMI_MONTHLY": 24, "MONTHLY": 12}}'::jsonb,
    NOW(), NOW()
) ON CONFLICT (country, table_type, tax_year) DO UPDATE SET
    data = EXCLUDED.data,
    status = 'ACTIVE',
    updated_at = NOW();

-- Insert Lesotho Pack Registry
INSERT INTO pack_registry (
    id, country, pack_version, display_name, description,
    effective_from, status, artifact_checksum, release_notes,
    created_at, updated_at
) VALUES (
    gen_random_uuid(), 'LS', 'ls-pack@2025.1', 'Lesotho Compute Pack 2025',
    'Lesotho payroll computation pack for tax year 2025/2026',
    '2025-04-01', 'ACTIVE', 'ls_2025_v1', 
    'Updated with 2025/2026 tax brackets from RSL',
    NOW(), NOW()
) ON CONFLICT (country, pack_version) DO UPDATE SET
    status = 'ACTIVE',
    updated_at = NOW();

-- Insert South Africa Pack Registry
INSERT INTO pack_registry (
    id, country, pack_version, display_name, description,
    effective_from, status, artifact_checksum, release_notes,
    created_at, updated_at
) VALUES (
    gen_random_uuid(), 'ZA', 'za-pack@2025.1', 'South Africa Compute Pack 2025',
    'South Africa payroll computation pack for tax year 2025/2026',
    '2025-03-01', 'ACTIVE', 'za_2025_v1',
    'Updated with 2025/2026 tax brackets from SARS Budget',
    NOW(), NOW()
) ON CONFLICT (country, pack_version) DO UPDATE SET
    status = 'ACTIVE',
    updated_at = NOW();

-- Insert UIF Config
INSERT INTO statutory_configs (
    id, country, config_type, effective_from, status, checksum, data, source_ref,
    created_at, updated_at
) VALUES (
    gen_random_uuid(), 'ZA', 'UIF', '2025-03-01', 'ACTIVE', 'uif_2025_seed',
    '{"employee_rate": 0.01, "employer_rate": 0.01, "monthly_ceiling": 17712, "annual_ceiling": 212544}'::jsonb,
    'SARS 2025', NOW(), NOW()
) ON CONFLICT (country, config_type, effective_from) DO UPDATE SET
    data = EXCLUDED.data,
    updated_at = NOW();

-- Insert SDL Config
INSERT INTO statutory_configs (
    id, country, config_type, effective_from, status, checksum, data, source_ref,
    created_at, updated_at
) VALUES (
    gen_random_uuid(), 'ZA', 'SDL', '2025-03-01', 'ACTIVE', 'sdl_2025_seed',
    '{"rate": 0.01, "threshold_annual": 500000}'::jsonb,
    'SARS 2025', NOW(), NOW()
) ON CONFLICT (country, config_type, effective_from) DO UPDATE SET
    data = EXCLUDED.data,
    updated_at = NOW();

-- Insert MTC Config
INSERT INTO statutory_configs (
    id, country, config_type, effective_from, status, checksum, data, source_ref,
    created_at, updated_at
) VALUES (
    gen_random_uuid(), 'ZA', 'MTC', '2025-03-01', 'ACTIVE', 'mtc_2025_seed',
    '{"main_member": 364, "first_dependant": 364, "additional_dependants": 246}'::jsonb,
    'SARS 2025', NOW(), NOW()
) ON CONFLICT (country, config_type, effective_from) DO UPDATE SET
    data = EXCLUDED.data,
    updated_at = NOW();

SELECT 'Seeded tax tables successfully!' as result;
