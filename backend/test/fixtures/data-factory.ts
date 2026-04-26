export class DataFactory {
  static supplier(override?: Partial<any>) {
    return {
      type: 'INDIVIDUAL',
      firstName: 'John',
      lastName: 'Supplier',
      email: `supplier-${Date.now()}@example.com`,
      phone: '+27821234567',
      taxNumber: `TAX${Date.now()}`,
      bankName: 'Standard Bank',
      accountNumber: '1234567890',
      branchCode: '051001',
      country: 'ZA',
      status: 'ACTIVE',
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
      dateOfBirth: '1990-01-15',
      nationality: 'ZA',
      status: 'ACTIVE',
      ...override,
    };
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

  static engagement(contractId: string, override?: Partial<any>) {
    return {
      contractId,
      title: 'Development Engagement',
      description: 'Software development services',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      rate: 1000,
      rateType: 'HOURLY',
      currency: 'ZAR',
      status: 'ACTIVE',
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
      status: 'ACTIVE',
      ...override,
    };
  }

  static timesheet(engagementId: string, projectId: string, override?: Partial<any>) {
    return {
      engagementId,
      projectId,
      periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      periodEnd: new Date().toISOString(),
      entries: [
        {
          date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          hours: 8,
          description: 'Development work',
        },
        {
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          hours: 7.5,
          description: 'Testing',
        },
      ],
      status: 'DRAFT',
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
      status: 'PENDING',
      notes: 'Test invoice',
      ...override,
    };
  }

  static taxClassification(contractorId: string, override?: Partial<any>) {
    return {
      contractorId,
      taxYear: new Date().getFullYear(),
      classification: 'DEEMED_EMPLOYEE',
      determinationDate: new Date().toISOString(),
      factors: {
        controlFactor: 'HIGH',
        integrationFactor: 'HIGH',
        economicRealityFactor: 'MEDIUM',
      },
      riskScore: 75,
      dominantImpression: 'Employment relationship exists',
      status: 'ACTIVE',
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
