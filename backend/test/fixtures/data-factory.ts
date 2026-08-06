import { PrismaClient, SupplierType, WorkerClassification, EngagementModel, SupplierStatus } from '@prisma/client';

export class DataFactory {
  // ---------------------------------------------------------------------------
  // Raw data shapes — used by callers that compose their own prisma.create()
  // ---------------------------------------------------------------------------

  static supplier(override?: Partial<any>) {
    return {
      type: SupplierType.INDIVIDUAL,
      firstName: 'John',
      lastName: 'Supplier',
      email: `supplier-${Date.now()}@example.com`,
      phone: '+27821234567',
      taxNumber: `TAX${Date.now()}`,
      bankName: 'Standard Bank',
      bankAccountNumber: '1234567890',
      bankBranchCode: '051001',
      country: 'ZA',
      countryCode: 'ZA',
      ...override,
    };
  }

  static contractor(supplierId: string, override?: Partial<any>) {
    return {
      supplierId,
      firstName: 'Jane',
      lastName: 'Contractor',
      email: `contractor-${Date.now()}@example.com`,
      phone: '+27827654321',
      taxNumber: `CTX${Date.now()}`,
      idNumber: `${Date.now()}`.substring(0, 13),
      dateOfBirth: new Date('1990-01-15T00:00:00.000Z'),
      taxResidency: 'ZA',
      workerClassification: WorkerClassification.INDEPENDENT_CONTRACTOR,
      engagementModel: EngagementModel.DIRECT,
      ...override,
    };
  }

  // ---------------------------------------------------------------------------
  // Prisma-aware create helpers — use checked relation syntax
  // ---------------------------------------------------------------------------

  /**
   * Create a supplier with proper checked Prisma relations.
   * Callers pass scalar IDs; the factory translates to `connect` syntax.
   */
  static async createSupplier(
    prisma: PrismaClient | any,
    opts: { organizationId: string } & Partial<any>,
  ) {
    const { organizationId, ...overrides } = opts;
    return prisma.supplier.create({
      data: {
        organization: { connect: { id: organizationId } },
        status: overrides.status ?? SupplierStatus.ACTIVE,
        ...DataFactory.supplier(overrides),
      },
    });
  }

  /**
   * Create a contractor with proper checked Prisma relations.
   * Accepts scalar IDs for organization and optional supplier.
   */
  static async createContractor(
    prisma: PrismaClient | any,
    opts: {
      organizationId: string;
      supplierId?: string;
      workerClassification?: WorkerClassification;
    } & Partial<any>,
  ) {
    const { organizationId, supplierId, workerClassification, ...overrides } = opts;
    const supplierConnect = supplierId
      ? { supplier: { connect: { id: supplierId } } }
      : {};
    return prisma.contractor.create({
      data: {
        organization: { connect: { id: organizationId } },
        ...supplierConnect,
        firstName: overrides.firstName ?? 'Jane',
        lastName: overrides.lastName ?? 'Contractor',
        email: overrides.email ?? `contractor-${Date.now()}@example.com`,
        workerClassification: workerClassification ?? WorkerClassification.INDEPENDENT_CONTRACTOR,
        engagementModel: overrides.engagementModel ?? EngagementModel.DIRECT,
        taxResidency: overrides.taxResidency ?? 'ZA',
        dateOfBirth: overrides.dateOfBirth ?? new Date('1990-01-15T00:00:00.000Z'),
        skills: overrides.skills ?? [],
        ...overrides,
      },
    });
  }

  static contract(
    contractorId: string,
    supplierId: string,
    override?: Partial<any>,
  ) {
    return {
      contractorId,
      supplierId,
      contractNumber: `CT-${Date.now()}`,
      title: 'Software Development Contract',
      type: 'FIXED_TERM',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      rate: 1000,
      rateType: 'HOURLY',
      currency: 'ZAR',
      status: 'ACTIVE',
      ...override,
    };
  }

  static engagement(contractId: string, contractorId: string, override?: Partial<any>) {
    return {
      contractId,
      contractorId,
      role: 'Developer',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      rateAmount: 1000,
      rateType: 'HOURLY',
      currency: 'ZAR',
      ...override,
    };
  }

  static project(override?: Partial<any>) {
    return {
      code: `PRJ-${Date.now()}`,
      name: 'Test Project',
      description: 'A test project for development',
      clientName: 'Test Client',
      startDate: new Date().toISOString(),
      budget: 100000,
      currency: 'ZAR',
      ...override,
    };
  }

  static timesheet(contractorId: string, projectId: string, override?: Partial<any>) {
    return {
      contractorId,
      projectId,
      periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      periodEnd: new Date().toISOString(),
      entries: [
        {
          date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          hours: 8,
          description: 'Development work',
        },
        {
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          hours: 7.5,
          description: 'Testing',
        },
      ],
      ...override,
    };
  }

  static invoice(timesheetIds: string[], override?: Partial<any>) {
    return {
      timesheetIds,
      invoiceNumber: `INV-${Date.now()}`,
      invoiceDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      currency: 'ZAR',
      ...override,
    };
  }

  static taxClassification(contractorId: string, override?: Partial<any>) {
    return {
      contractorId,
      classification: 'DEEMED_EMPLOYEE',
      basis: 'STATUTORY_TEST',
      assessmentPayload: {
        controlFactor: 'HIGH',
        integrationFactor: 'HIGH',
        economicRealityFactor: 'MEDIUM',
      },
      riskScore: 75,
      dominantImpression: 'Employment relationship exists',
      validFrom: new Date().toISOString(),
      ...override,
    };
  }

  static withholdingInstruction(
    contractorId: string,
    taxClassificationId: string,
    override?: Partial<any>,
  ) {
    return {
      contractorId,
      taxClassificationId,
      effectiveDate: new Date().toISOString(),
      withholdingType: 'PAYE',
      taxYear: new Date().getFullYear(),
      grossAmount: 25000,
      withholdingAmount: 6500,
      currency: 'ZAR',
      classification: 'DEEMED_EMPLOYEE',
      riskScore: 75,
      dominantImpression: 'Employment relationship exists',
      canonicalPayload: {
        workerId: 'W123',
        supplierCode: 'S456',
      },
      adapterType: 'ORACLE_HCM',
      ...override,
    };
  }

  static organization(override?: Partial<any>) {
    return {
      name: 'Test Organization',
      code: `ORG-${Date.now()}`,
      country: 'ZA',
      currency: 'ZAR',
      timezone: 'Africa/Johannesburg',
      hcmType: 'ORACLE_HCM',
      hcmConfig: {
        apiUrl: 'https://api.example.com',
        apiKey: 'test-key',
      },
      ...override,
    };
  }
}
