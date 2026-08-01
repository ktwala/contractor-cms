/**
 * Hubsec Workforce Platform - Demo Data Seed
 *
 * Creates demo/sandbox data for development and testing:
 * - Demo users (admin@demo.workforce, hr@demo.workforce, etc.)
 * - Legal entity, pay group, pay periods
 * - Pay items, tax tables, statutory configs
 * - Sample employees
 *
 * Requires: npm run db:seed (roles & permissions) first.
 * Skips if demo legal entity (DEMO-ZA-001) already exists.
 *
 * Run: npm run demo:seed
 */

import {
  PrismaClient,
  Country,
  Currency,
  PayFrequency,
  EmployeeStatus,
  EmploymentType,
  PayItemType,
  ResidencyStatus,
  AccountType,
  PackStatus,
  TaxTableType,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { addDays, endOfMonth, startOfMonth } from 'date-fns';
import { ensureRecruitmentTalentDemoUsers } from './ensure-recruitment-talent-users';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DEMO_PASSWORD_HASH = '$2b$10$I8FQ5uXGDSVQ9QnLF1rYkewFIRNYCh0knNblp6i1caqEMg4uaJnWa'; // admin123

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  // Never run demo seed in customer mode (env var)
  if (process.env.DEPLOYMENT_MODE === 'customer') {
    console.log('DEPLOYMENT_MODE=customer — skipping demo seed.');
    return;
  }

  // Never run demo seed if the database was reset for a real customer.
  // The reset-for-customer script writes a flag row to prevent this.
  // The platform_settings table is defined in the Prisma schema so db push won't drop it.
  try {
    const flag = await prisma.$queryRaw<{ value: string }[]>`
      SELECT value FROM platform_settings WHERE key = 'deployment_mode' LIMIT 1
    `;
    if (flag.length > 0 && flag[0].value === 'customer') {
      console.log('Database is flagged as customer environment — skipping demo seed.');
      return;
    }
  } catch {
    // Table may not exist yet on first run; proceed with demo seed
  }

  const existing = await prisma.legalEntity.findUnique({
    where: { code: 'DEMO-ZA-001' },
  });
  if (existing) {
    console.log('Demo data already exists (DEMO-ZA-001). Ensuring recruitment talent demo users…');
    await ensureRecruitmentTalentDemoUsers(prisma, existing.id);
    return;
  }

  const tenantAdminRole = await prisma.role.findUnique({ where: { name: 'TENANT_ADMIN' } });
  const payrollClerkRole = await prisma.role.findUnique({ where: { name: 'PAYROLL_CLERK' } });
  const payrollApproverRole = await prisma.role.findUnique({ where: { name: 'PAYROLL_APPROVER' } });
  const financeApproverRole = await prisma.role.findUnique({ where: { name: 'FINANCE_APPROVER' } });
  const sarsOfficerRole = await prisma.role.findUnique({ where: { name: 'SARS_OFFICER' } });
  const sarsApproverRole = await prisma.role.findUnique({ where: { name: 'SARS_APPROVER' } });
  const hrAdminRole = await prisma.role.findUnique({ where: { name: 'HR_ADMIN' } });
  const integrationIgaRole = await prisma.role.findUnique({ where: { name: 'INTEGRATION_IGA' } });

  if (!tenantAdminRole || !payrollClerkRole) {
    throw new Error('Roles not found. Run npm run db:seed first.');
  }

  console.log('🌱 Seeding demo data...\n');

  // Demo users
  const demoUser = await prisma.user.create({
    data: {
      email: 'admin@demo.workforce',
      passwordHash: DEMO_PASSWORD_HASH,
      firstName: 'Demo',
      lastName: 'Admin',
      isActive: true,
    },
  });

  const integrationUser = await prisma.user.create({
    data: {
      email: 'iga@demo.workforce',
      passwordHash: DEMO_PASSWORD_HASH,
      firstName: 'IGA',
      lastName: 'Connector',
      isActive: true,
    },
  });
  if (integrationIgaRole) {
    await prisma.roleAssignment.create({
      data: {
        userId: integrationUser.id,
        roleId: integrationIgaRole.id,
        scopeType: 'GLOBAL',
        legalEntityId: null,
      },
    });
  }

  const legalEntity = await prisma.legalEntity.create({
    data: {
      code: 'DEMO-ZA-001',
      name: 'Demo Company (Pty) Ltd',
      country: Country.ZA,
      registrationNo: '2020/123456/07',
      taxReference: '9012345678',
      address: {
        street: '123 Main Street',
        city: 'Johannesburg',
        province: 'Gauteng',
        postalCode: '2000',
        country: 'South Africa',
      },
    },
  });

  await prisma.roleAssignment.create({
    data: {
      userId: demoUser.id,
      roleId: tenantAdminRole.id,
      scopeType: 'GLOBAL',
      legalEntityId: null,
    },
  });

  if (payrollClerkRole && payrollApproverRole && financeApproverRole && sarsOfficerRole && sarsApproverRole && hrAdminRole) {
    await prisma.roleAssignment.createMany({
      data: [
        { userId: demoUser.id, roleId: payrollClerkRole.id, scopeType: 'LEGAL_ENTITY', legalEntityId: legalEntity.id },
        { userId: demoUser.id, roleId: payrollApproverRole.id, scopeType: 'LEGAL_ENTITY', legalEntityId: legalEntity.id },
        { userId: demoUser.id, roleId: financeApproverRole.id, scopeType: 'LEGAL_ENTITY', legalEntityId: legalEntity.id },
        { userId: demoUser.id, roleId: sarsOfficerRole.id, scopeType: 'LEGAL_ENTITY', legalEntityId: legalEntity.id },
        { userId: demoUser.id, roleId: sarsApproverRole.id, scopeType: 'LEGAL_ENTITY', legalEntityId: legalEntity.id },
        { userId: demoUser.id, roleId: hrAdminRole.id, scopeType: 'LEGAL_ENTITY', legalEntityId: legalEntity.id },
      ],
      skipDuplicates: true,
    });
  }

  const tenantAdminUser = await prisma.user.create({
    data: {
      email: 'tenantadmin@demo.workforce',
      passwordHash: DEMO_PASSWORD_HASH,
      firstName: 'Tenant',
      lastName: 'Admin',
      isActive: true,
    },
  });
  const hrAdminUser = await prisma.user.create({
    data: {
      email: 'hr@demo.workforce',
      passwordHash: DEMO_PASSWORD_HASH,
      firstName: 'HR',
      lastName: 'Officer',
      isActive: true,
    },
  });
  const payrollClerkUser = await prisma.user.create({
    data: {
      email: 'payrollclerk@demo.workforce',
      passwordHash: DEMO_PASSWORD_HASH,
      firstName: 'Payroll',
      lastName: 'Clerk',
      isActive: true,
    },
  });
  if (tenantAdminRole && hrAdminRole && payrollClerkRole) {
    await prisma.roleAssignment.createMany({
      data: [
        { userId: tenantAdminUser.id, roleId: tenantAdminRole.id, scopeType: 'LEGAL_ENTITY', legalEntityId: legalEntity.id },
        { userId: hrAdminUser.id, roleId: hrAdminRole.id, scopeType: 'LEGAL_ENTITY', legalEntityId: legalEntity.id },
        { userId: payrollClerkUser.id, roleId: payrollClerkRole.id, scopeType: 'LEGAL_ENTITY', legalEntityId: legalEntity.id },
      ],
      skipDuplicates: true,
    });
  }

  const companyGroups = await Promise.all([
    prisma.companyGroup.create({
      data: {
        groupName: 'South Africa Operations',
        groupCode: 'ZA-OPS',
        consolidationCurrency: Currency.ZAR,
        createdBy: demoUser.id,
      },
    }),
    prisma.companyGroup.create({
      data: {
        groupName: 'East Africa Division',
        groupCode: 'EA-DIV',
        consolidationCurrency: Currency.ZAR,
        createdBy: demoUser.id,
      },
    }),
    prisma.companyGroup.create({
      data: {
        groupName: 'West Africa Holdings',
        groupCode: 'WA-HOLD',
        consolidationCurrency: Currency.ZAR,
        createdBy: demoUser.id,
      },
    }),
  ]);

  await prisma.companyGroupMember.create({
    data: {
      groupId: companyGroups[0].id,
      legalEntityId: legalEntity.id,
      effectiveFrom: new Date('2020-01-01'),
      consolidationPercentage: 100,
    },
  });

  await Promise.all([
    prisma.costCenter.create({
      data: {
        costCenterCode: 'CC-001',
        costCenterName: 'IT Operations',
        legalEntityId: legalEntity.id,
        costType: 'department',
        glAccount: '5100',
        description: 'Information Technology Department',
        createdBy: demoUser.id,
      },
    }),
    prisma.costCenter.create({
      data: {
        costCenterCode: 'CC-002',
        costCenterName: 'Human Resources',
        legalEntityId: legalEntity.id,
        costType: 'department',
        glAccount: '5200',
        description: 'Human Resources Department',
        createdBy: demoUser.id,
      },
    }),
    prisma.costCenter.create({
      data: {
        costCenterCode: 'CC-003',
        costCenterName: 'Finance',
        legalEntityId: legalEntity.id,
        costType: 'department',
        glAccount: '5300',
        description: 'Finance and Accounting Department',
        createdBy: demoUser.id,
      },
    }),
    prisma.costCenter.create({
      data: {
        costCenterCode: 'CC-004',
        costCenterName: 'Marketing',
        legalEntityId: legalEntity.id,
        costType: 'department',
        glAccount: '5400',
        description: 'Marketing and Sales Department',
        createdBy: demoUser.id,
      },
    }),
  ]);

  const payGroup = await prisma.payGroup.create({
    data: {
      code: 'ZA-MONTHLY-001',
      name: 'South Africa Monthly Payroll',
      country: Country.ZA,
      currency: Currency.ZAR,
      frequency: PayFrequency.MONTHLY,
      legalEntityId: legalEntity.id,
      glDefaults: {
        salaries_expense: '5100',
        paye_liability: '2100',
        uif_liability: '2110',
        sdl_liability: '2120',
        net_pay_liability: '2200',
      },
    },
  });

  const periods = [];
  for (let month = 0; month < 12; month++) {
    const periodStart = startOfMonth(new Date(2025, month, 1));
    const periodEnd = endOfMonth(periodStart);
    const payDate = addDays(periodEnd, 1);
    const period = await prisma.payPeriod.create({
      data: {
        payGroupId: payGroup.id,
        startDate: periodStart,
        endDate: periodEnd,
        payDate,
        cutoffDate: addDays(periodEnd, -2),
        year: 2025,
        periodNum: month + 1,
      },
    });
    periods.push(period);
  }

  const payItemData = [
    { code: 'BASIC', name: 'Basic Salary', type: PayItemType.EARNING, taxable: true, glAccount: '5100', sortOrder: 10, countryAttributes: { za: { source_code: '3601' } } },
    { code: 'OVERTIME', name: 'Overtime', type: PayItemType.EARNING, taxable: true, glAccount: '5110', sortOrder: 20, countryAttributes: { za: { source_code: '3601' } } },
    { code: 'COMMISSION', name: 'Commission', type: PayItemType.EARNING, taxable: true, glAccount: '5120', sortOrder: 30, countryAttributes: { za: { source_code: '3616' } } },
    { code: 'BONUS', name: 'Bonus', type: PayItemType.EARNING, taxable: true, glAccount: '5130', sortOrder: 40, countryAttributes: { za: { source_code: '3605' } } },
    { code: 'ALLOWANCE_TRAVEL', name: 'Travel Allowance', type: PayItemType.EARNING, taxable: true, glAccount: '5140', sortOrder: 50, countryAttributes: { za: { source_code: '3701' } } },
    { code: 'ALLOWANCE_CELL', name: 'Cell Phone Allowance', type: PayItemType.EARNING, taxable: true, glAccount: '5141', sortOrder: 51 },
    { code: 'PENSION_EE', name: 'Pension Fund (Employee)', type: PayItemType.DEDUCTION, taxable: false, glAccount: '2130', sortOrder: 100, countryAttributes: { za: { source_code: '4001', pre_tax: true } } },
    { code: 'MEDICAL_AID_EE', name: 'Medical Aid (Employee)', type: PayItemType.DEDUCTION, taxable: false, glAccount: '2140', sortOrder: 110, countryAttributes: { za: { source_code: '4005' } } },
    { code: 'LOAN_REPAYMENT', name: 'Loan Repayment', type: PayItemType.DEDUCTION, taxable: false, glAccount: '2150', sortOrder: 120 },
    { code: 'PAYE', name: 'Pay As You Earn', type: PayItemType.TAX, taxable: false, glAccount: '2100', sortOrder: 200, countryAttributes: { za: { source_code: '4101' } } },
    { code: 'UIF_EE', name: 'UIF (Employee)', type: PayItemType.TAX, taxable: false, glAccount: '2110', sortOrder: 210, countryAttributes: { za: { source_code: '4141' } } },
    { code: 'UIF_ER', name: 'UIF (Employer)', type: PayItemType.EMPLOYER_CONTRIB, taxable: false, glAccount: '5200', sortOrder: 300, countryAttributes: { za: { source_code: '4142' } } },
    { code: 'SDL', name: 'Skills Development Levy', type: PayItemType.EMPLOYER_CONTRIB, taxable: false, glAccount: '5210', sortOrder: 310, countryAttributes: { za: { source_code: '4150' } } },
    { code: 'PENSION_ER', name: 'Pension Fund (Employer)', type: PayItemType.EMPLOYER_CONTRIB, taxable: false, glAccount: '5220', sortOrder: 320, countryAttributes: { za: { source_code: '4002' } } },
  ];

  for (const p of payItemData) {
    await prisma.payItem.upsert({
      where: { code: p.code },
      create: p as any,
      update: {},
    });
  }

  const brackets = [
    { from: 0, to: 237100, rate: 0.18, baseTax: 0 },
    { from: 237101, to: 370500, rate: 0.26, baseTax: 42678 },
    { from: 370501, to: 512800, rate: 0.31, baseTax: 77362 },
    { from: 512801, to: 673000, rate: 0.36, baseTax: 121475 },
    { from: 673001, to: 857900, rate: 0.39, baseTax: 179147 },
    { from: 857901, to: 1817000, rate: 0.41, baseTax: 251258 },
    { from: 1817001, to: null, rate: 0.45, baseTax: 644489 },
  ];

  const taxTable = await prisma.taxTable.create({
    data: {
      country: Country.ZA,
      effectiveFrom: new Date('2025-03-01'),
      effectiveTo: new Date('2026-02-28'),
      meta: {
        tax_year: '2025/2026',
        primary_rebate: 17235,
        secondary_rebate: 9444,
        tertiary_rebate: 3145,
        threshold_under65: 95750,
        threshold_65to74: 148217,
        threshold_75plus: 165689,
        uif_rate_employee: 0.01,
        uif_rate_employer: 0.01,
        uif_ceiling_monthly: 17712,
        sdl_rate: 0.01,
        sdl_threshold_annual: 500000,
      },
    },
  });

  for (let i = 0; i < brackets.length; i++) {
    await prisma.taxBracket.create({
      data: {
        taxTableId: taxTable.id,
        fromAmount: brackets[i].from,
        toAmount: brackets[i].to,
        rate: brackets[i].rate,
        baseTax: brackets[i].baseTax,
        sortOrder: i,
      },
    });
  }

  await prisma.taxTableSet.create({
    data: {
      country: Country.ZA,
      tableType: TaxTableType.PAYE,
      taxYear: '2025/2026',
      displayName: 'ZA PAYE 2025/2026',
      effectiveFrom: new Date('2025-03-01'),
      effectiveTo: new Date('2026-02-28'),
      status: PackStatus.ACTIVE,
      sourceRef: 'SARS Budget 2025',
      checksum: 'sha256_za_paye_2025',
      data: {
        brackets: brackets.map((b) => ({ lower: b.from, upper: b.to, rate: b.rate, base_tax: b.baseTax, marginal_from: b.from })),
        rebates: { primary: 17235, secondary: 9444, tertiary: 3145 },
        thresholds: { under65: 95750, age65to74: 148217, age75plus: 165689 },
      },
    },
  });

  await prisma.packRegistry.upsert({
    where: { country_packVersion: { country: Country.ZA, packVersion: 'za-pack@1.1.0' } },
    create: {
      country: Country.ZA,
      packVersion: 'za-pack@1.1.0',
      displayName: 'South Africa Pack v1.1',
      description: 'PAYE, UIF, SDL with retirement fund and fringe benefit support',
      effectiveFrom: new Date('2025-03-01'),
      status: PackStatus.ACTIVE,
      artifactChecksum: 'sha256_za_pack_1.1.0',
      releaseNotes: 'Added retirement fund contribution limits, fringe benefits',
    },
    update: {},
  });

  for (const config of [
    { configType: 'UIF', sourceRef: 'DoL 2025', checksum: 'sha256_uif_2025', data: { employee_rate: 0.01, employer_rate: 0.01, monthly_ceiling: 17712, annual_ceiling: 212544 } },
    { configType: 'SDL', sourceRef: 'SARS 2025', checksum: 'sha256_sdl_2025', data: { rate: 0.01, threshold_annual: 500000 } },
    { configType: 'RETIREMENT_LIMITS', sourceRef: 'SARS 2025', checksum: undefined, data: { deduction_percentage: 0.275, annual_cap: 350000, monthly_cap: 29166.67 } },
    { configType: 'MEDICAL_TAX_CREDIT', sourceRef: 'SARS 2025', checksum: undefined, data: { main_member: 364, first_dependant: 364, additional_dependants: 246 } },
  ]) {
    await prisma.statutoryConfig.create({
      data: {
        country: Country.ZA,
        configType: config.configType,
        effectiveFrom: new Date('2025-03-01'),
        status: PackStatus.ACTIVE,
        ...(config.checksum && { checksum: config.checksum }),
        sourceRef: config.sourceRef,
        data: config.data as any,
      },
    });
  }

  const employeeData = [
    { employeeNo: 'EMP001', firstName: 'John', lastName: 'Smith', nationalId: '8501015800086', email: 'john.smith@demo.co.za', hireDate: new Date('2020-01-15'), jobTitle: 'Software Developer', baseSalary: 45000, scenario: 'Standard salaried employee' },
    { employeeNo: 'EMP002', firstName: 'Sarah', lastName: 'Johnson', nationalId: '9002025800087', email: 'sarah.johnson@demo.co.za', hireDate: new Date('2019-06-01'), jobTitle: 'Senior Manager', baseSalary: 95000, scenario: 'High earner (top tax bracket)' },
    { employeeNo: 'EMP003', firstName: 'Michael', lastName: 'Williams', nationalId: '8803035800088', email: 'michael.williams@demo.co.za', hireDate: new Date('2021-03-01'), jobTitle: 'Technician', baseSalary: 25000, scenario: 'With regular overtime' },
    { employeeNo: 'EMP004', firstName: 'Emily', lastName: 'Brown', nationalId: '9204045800089', email: 'emily.brown@demo.co.za', hireDate: new Date('2022-09-15'), jobTitle: 'Sales Representative', baseSalary: 20000, scenario: 'Commission-based (variable pay)' },
    { employeeNo: 'EMP005', firstName: 'David', lastName: 'Davis', nationalId: '7506055800090', email: 'david.davis@demo.co.za', hireDate: new Date('2015-02-01'), jobTitle: 'Financial Controller', baseSalary: 75000, scenario: 'With pension contributions' },
    { employeeNo: 'EMP006', firstName: 'Lisa', lastName: 'Miller', nationalId: '9508065800091', email: 'lisa.miller@demo.co.za', hireDate: new Date('2024-11-01'), jobTitle: 'Graduate Trainee', baseSalary: 15000, scenario: 'New starter (below tax threshold)' },
    { employeeNo: 'EMP007', firstName: 'James', lastName: 'Wilson', nationalId: '6010075800092', email: 'james.wilson@demo.co.za', hireDate: new Date('2010-05-01'), jobTitle: 'Executive Director', baseSalary: 180000, scenario: 'Executive (highest bracket)' },
    { employeeNo: 'EMP008', firstName: 'Amanda', lastName: 'Taylor', nationalId: '8712085800093', email: 'amanda.taylor@demo.co.za', hireDate: new Date('2018-08-15'), jobTitle: 'HR Manager', baseSalary: 55000, scenario: 'With travel allowance' },
    { employeeNo: 'EMP009', firstName: 'Robert', lastName: 'Anderson', nationalId: '8201095800094', email: 'robert.anderson@demo.co.za', hireDate: new Date('2023-01-10'), jobTitle: 'Operations Manager', baseSalary: 65000, scenario: 'With medical aid' },
    { employeeNo: 'EMP010', firstName: 'Jennifer', lastName: 'Thomas', nationalId: '9105105800095', email: 'jennifer.thomas@demo.co.za', hireDate: new Date('2020-07-01'), jobTitle: 'Marketing Specialist', baseSalary: 38000, scenario: 'Standard with loan deduction' },
  ];

  for (const emp of employeeData) {
    const employee = await prisma.employee.create({
      data: {
        employeeNo: emp.employeeNo,
        firstName: emp.firstName,
        lastName: emp.lastName,
        nationalId: emp.nationalId,
        email: emp.email,
        status: EmployeeStatus.ACTIVE,
        hireDate: emp.hireDate,
      },
    });
    await prisma.employment.create({
      data: {
        employeeId: employee.id,
        legalEntityId: legalEntity.id,
        payGroupId: payGroup.id,
        country: Country.ZA,
        jobTitle: emp.jobTitle,
        costCenter: 'CC100',
        employmentType: EmploymentType.PERMANENT,
        effectiveFrom: emp.hireDate,
        notes: emp.scenario,
      },
    });
    await prisma.compensation.create({
      data: {
        employeeId: employee.id,
        baseSalary: emp.baseSalary,
        currency: Currency.ZAR,
        effectiveFrom: emp.hireDate,
        notes: `Monthly salary: R${emp.baseSalary.toLocaleString()}`,
      },
    });
    await prisma.taxProfile.create({
      data: {
        employeeId: employee.id,
        country: Country.ZA,
        residencyStatus: ResidencyStatus.RESIDENT,
        tin: `TIN${emp.nationalId.substring(0, 10)}`,
        effectiveFrom: emp.hireDate,
      },
    });
    await prisma.bankAccount.create({
      data: {
        employeeId: employee.id,
        bankName: 'First National Bank',
        accountNumberEnc: 'encrypted_' + Math.random().toString(36).substring(7),
        maskedAccountNumber: '****' + Math.floor(1000 + Math.random() * 9000),
        branchCode: '250655',
        accountType: AccountType.CHEQUE,
        effectiveFrom: emp.hireDate,
      },
    });
  }

  console.log('\n✅ Demo seed completed!\n');
  console.log('📊 Summary:');
  console.log(`   • Legal Entity: ${legalEntity.name}`);
  console.log(`   • Pay Group: ${payGroup.name}`);
  console.log(`   • ${periods.length} Pay Periods (2025)`);
  console.log(`   • ${employeeData.length} Employees`);
  console.log('   • Demo users: admin@demo.workforce, tenantadmin@demo.workforce, hr@demo.workforce, payrollclerk@demo.workforce (password: admin123)');
  await ensureRecruitmentTalentDemoUsers(prisma, legalEntity.id);
  console.log('\n🚀 Ready for payroll processing!\n');
}

main()
  .catch((e) => {
    console.error('❌ Demo seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
