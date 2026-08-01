/**
 * Role policy map: defines allowed scopes and country restrictions per role.
 * Shared validation for frontend (UX) and backend (enforcement).
 *
 * PR-RBAC-GOV-1 — **must stay in parity** with `prisma/seed.ts` `ROLE_PERM_MAP`:
 * every seeded role with a permission bundle must appear here so IAM assign UI
 * and `assertRoleAssignmentAllowed` accept the same roles.
 *
 * Drift: `npm run check:rbac-role-policy-drift`
 *
 * - Role name = what you can do (permissions bundle in DB)
 * - Scope = where you can do it (GLOBAL = tenant-wide, LEGAL_ENTITY = per company)
 * - SARS roles: LEGAL_ENTITY + ZA-only (statutory domain)
 */

export type RoleScopeType = 'GLOBAL' | 'LEGAL_ENTITY';
export type PolicyCountry = 'ZA' | 'LS';

export type RoleName =
  | 'TENANT_ADMIN'
  | 'PAYROLL_CLERK'
  | 'PAYROLL_APPROVER'
  | 'FINANCE_APPROVER'
  | 'SARS_OFFICER'
  | 'SARS_APPROVER'
  | 'AUDITOR_READONLY'
  | 'EMPLOYEE_SELF_SERVICE'
  | 'INTEGRATION_IGA'
  | 'HR_ADMIN'
  | 'PAYROLL_PROCESSOR'
  | 'PAYROLL_MANAGER'
  | 'PAYMENT_OPERATOR'
  | 'RECONCILIATION_ANALYST'
  | 'FINANCE_REVIEWER'
  | 'COMPLIANCE_OFFICER'
  | 'TAX_TABLE_ADMINISTRATOR'
  | 'EXECUTIVE_READONLY'
  | 'GLOBAL_PAYROLL_ADMIN'
  | 'GLOBAL_COMPLIANCE_ADMIN'
  | 'TALENT_ADMIN'
  | 'RECRUITER'
  | 'HIRING_MANAGER'
  | 'INTERVIEWER'
  | 'HR_OPERATIONS'
  | 'PLATFORM_SUPERADMIN';

export type RolePolicy = {
  allowedScopes: RoleScopeType[];
  allowedCountries?: PolicyCountry[];
  category:
    | 'Governance'
    | 'HCM'
    | 'Payroll'
    | 'SARS'
    | 'Audit'
    | 'Integrations'
    | 'Break-glass'
    | 'Compliance'
    | 'Talent';
  sensitive?: boolean;
};

export const ROLE_POLICY: Record<RoleName, RolePolicy> = {
  AUDITOR_READONLY: {
    allowedScopes: ['LEGAL_ENTITY'],
    category: 'Audit',
  },
  COMPLIANCE_OFFICER: {
    allowedScopes: ['LEGAL_ENTITY'],
    category: 'Compliance',
    sensitive: true,
  },
  EMPLOYEE_SELF_SERVICE: {
    allowedScopes: ['LEGAL_ENTITY'],
    category: 'HCM',
  },
  EXECUTIVE_READONLY: {
    allowedScopes: ['LEGAL_ENTITY'],
    category: 'Audit',
  },
  FINANCE_APPROVER: {
    allowedScopes: ['LEGAL_ENTITY'],
    category: 'Payroll',
    sensitive: true,
  },
  FINANCE_REVIEWER: {
    allowedScopes: ['LEGAL_ENTITY'],
    category: 'Payroll',
    sensitive: true,
  },
  GLOBAL_COMPLIANCE_ADMIN: {
    allowedScopes: ['GLOBAL'],
    category: 'Compliance',
    sensitive: true,
  },
  GLOBAL_PAYROLL_ADMIN: {
    allowedScopes: ['GLOBAL'],
    category: 'Payroll',
    sensitive: true,
  },
  HIRING_MANAGER: {
    allowedScopes: ['LEGAL_ENTITY'],
    category: 'Talent',
    sensitive: true,
  },
  HR_ADMIN: {
    allowedScopes: ['LEGAL_ENTITY'],
    category: 'HCM',
  },
  HR_OPERATIONS: {
    allowedScopes: ['LEGAL_ENTITY'],
    category: 'Talent',
  },
  INTEGRATION_IGA: {
    allowedScopes: ['GLOBAL'],
    category: 'Integrations',
    sensitive: true,
  },
  INTERVIEWER: {
    allowedScopes: ['LEGAL_ENTITY'],
    category: 'Talent',
  },
  PAYMENT_OPERATOR: {
    allowedScopes: ['LEGAL_ENTITY'],
    category: 'Payroll',
    sensitive: true,
  },
  PAYROLL_APPROVER: {
    allowedScopes: ['LEGAL_ENTITY'],
    category: 'Payroll',
    sensitive: true,
  },
  PAYROLL_CLERK: {
    allowedScopes: ['LEGAL_ENTITY'],
    category: 'Payroll',
  },
  PAYROLL_MANAGER: {
    allowedScopes: ['LEGAL_ENTITY'],
    category: 'Payroll',
    sensitive: true,
  },
  PAYROLL_PROCESSOR: {
    allowedScopes: ['LEGAL_ENTITY'],
    category: 'Payroll',
  },
  PLATFORM_SUPERADMIN: {
    allowedScopes: ['GLOBAL'],
    category: 'Break-glass',
    sensitive: true,
  },
  RECONCILIATION_ANALYST: {
    allowedScopes: ['LEGAL_ENTITY'],
    category: 'Payroll',
  },
  RECRUITER: {
    allowedScopes: ['LEGAL_ENTITY'],
    category: 'Talent',
  },
  SARS_APPROVER: {
    allowedScopes: ['LEGAL_ENTITY'],
    allowedCountries: ['ZA'],
    category: 'SARS',
    sensitive: true,
  },
  SARS_OFFICER: {
    allowedScopes: ['LEGAL_ENTITY'],
    allowedCountries: ['ZA'],
    category: 'SARS',
  },
  TALENT_ADMIN: {
    allowedScopes: ['GLOBAL'],
    category: 'Talent',
    sensitive: true,
  },
  TAX_TABLE_ADMINISTRATOR: {
    allowedScopes: ['LEGAL_ENTITY'],
    category: 'Payroll',
    sensitive: true,
  },
  TENANT_ADMIN: {
    allowedScopes: ['GLOBAL'],
    category: 'Governance',
    sensitive: true,
  },
};

export function getAssignableRoles(params: {
  scope: RoleScopeType;
  legalEntityCountry?: PolicyCountry;
}): RoleName[] {
  const { scope, legalEntityCountry } = params;
  return (Object.entries(ROLE_POLICY) as [RoleName, RolePolicy][])
    .filter(([, policy]) => policy.allowedScopes.includes(scope))
    .filter(([, policy]) => {
      if (scope !== 'LEGAL_ENTITY') return true;
      if (!policy.allowedCountries) return true;
      return legalEntityCountry ? policy.allowedCountries.includes(legalEntityCountry) : false;
    })
    .map(([roleName]) => roleName);
}

export function assertRoleAssignmentAllowed(input: {
  role: string;
  scope: RoleScopeType;
  legalEntity?: { id: string; country: string } | null;
}): void {
  const policy = ROLE_POLICY[input.role as RoleName];
  if (!policy) {
    throw new Error(`Unknown role: ${input.role}`);
  }

  if (!policy.allowedScopes.includes(input.scope)) {
    throw new Error(`Role ${input.role} cannot be assigned as ${input.scope}.`);
  }

  if (input.scope === 'LEGAL_ENTITY') {
    if (!input.legalEntity) {
      throw new Error('legal_entity_id is required for LEGAL_ENTITY assignments.');
    }
    const country = input.legalEntity.country as PolicyCountry;
    if (policy.allowedCountries && !policy.allowedCountries.includes(country)) {
      throw new Error(
        `Role ${input.role} can only be assigned to legal entities in: ${policy.allowedCountries.join(', ')}.`,
      );
    }
  }
}
