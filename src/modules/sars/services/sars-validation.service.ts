import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { RequestUser, assertHasLegalEntities, assertLegalEntityAllowed } from './sars-scope';

interface ValidationRule {
  id: string;
  ruleCode: string;
  ruleName: string;
  ruleDescription: string | null;
  appliesTo: string;
  severity: string;
  validationLogic: any;
  errorMessage: string;
  isActive: boolean;
}

interface ValidationResult {
  rule_id: string;
  rule_code: string;
  rule_name: string;
  passed: boolean;
  severity: string;
  error_message?: string;
  field_name?: string;
  expected_value?: string;
  actual_value?: string;
}

export interface ValidationReport {
  validation_run_id: string;
  document_type: string;
  document_id: string;
  total_rules: number;
  passed_count: number;
  failed_count: number;
  error_count: number;
  warning_count: number;
  results: ValidationResult[];
  is_valid: boolean;
}

@Injectable()
export class SarsValidationService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Validate IRP5 certificate (scoped via IRP5Certificate.legalEntityId)
   */
  async validateIRP5(irp5Id: string, user: RequestUser): Promise<ValidationReport> {
    const irp5 = await this.prisma.iRP5Certificate.findUnique({
      where: { id: irp5Id },
    });

    if (!irp5) {
      throw new Error('IRP5 certificate not found');
    }

    assertLegalEntityAllowed(user, irp5.legalEntityId);

    // Get employee data for additional validation
    const employee = await this.prisma.employee.findUnique({
      where: { id: irp5.employeeId },
      select: { nationalId: true, idNumber: true },
    });

    const irp5Data = {
      ...irp5,
      id_number: employee?.idNumber || employee?.nationalId,
    };

    // Get applicable rules
    const rules = await this.getRules('irp5');

    // Run validations
    const validationRunId = crypto.randomUUID();
    const results: ValidationResult[] = [];

    for (const rule of rules) {
      const result = this.executeRule(rule, irp5Data);
      results.push(result);

      // Save result to database
      await this.saveValidationResult(validationRunId, 'irp5', irp5Id, rule, result);
    }

    return this.buildValidationReport(validationRunId, 'irp5', irp5Id, results);
  }

  /**
   * Validate EMP201 return (scoped to user's legal entities)
   */
  async validateEMP201(emp201Id: string, user: RequestUser): Promise<ValidationReport> {
    // Get EMP201 data
    const emp201 = await this.prisma.eMP201Return.findUnique({
      where: { id: emp201Id },
    });

    if (!emp201) {
      throw new Error('EMP201 return not found');
    }

    assertLegalEntityAllowed(user, emp201.legalEntityId);

    // Get applicable rules
    const rules = await this.getRules('emp201');

    // Run validations
    const validationRunId = crypto.randomUUID();
    const results: ValidationResult[] = [];

    for (const rule of rules) {
      const result = this.executeRule(rule, emp201);
      results.push(result);

      // Save result to database
      await this.saveValidationResult(validationRunId, 'emp201', emp201Id, rule, result);
    }

    return this.buildValidationReport(validationRunId, 'emp201', emp201Id, results);
  }

  /**
   * Validate EMP501 reconciliation (scoped to user's legal entities)
   */
  async validateEMP501(emp501Id: string, user: RequestUser): Promise<ValidationReport> {
    // Get EMP501 data
    const emp501 = await this.prisma.eMP501Reconciliation.findUnique({
      where: { id: emp501Id },
    });

    if (!emp501) {
      throw new Error('EMP501 reconciliation not found');
    }

    assertLegalEntityAllowed(user, emp501.legalEntityId);

    // Get applicable rules
    const rules = await this.getRules('emp501');

    // Run validations
    const validationRunId = crypto.randomUUID();
    const results: ValidationResult[] = [];

    for (const rule of rules) {
      const result = this.executeRule(rule, emp501);
      results.push(result);

      // Save result to database
      await this.saveValidationResult(validationRunId, 'emp501', emp501Id, rule, result);
    }

    return this.buildValidationReport(validationRunId, 'emp501', emp501Id, results);
  }

  /**
   * Bulk validate all IRP5 certificates for a tax period (scoped via IRP5Certificate.legalEntityId)
   */
  async validateAllIRP5(
    taxPeriodId: string,
    user: RequestUser,
  ): Promise<{ total: number; passed: number; failed: number; reports: ValidationReport[] }> {
    const allowed = assertHasLegalEntities(user);
    const certificates = await this.prisma.iRP5Certificate.findMany({
      where: {
        taxPeriodId,
        legalEntityId: { in: allowed },
      },
      select: { id: true },
    });

    const reports: ValidationReport[] = [];
    let passed = 0;
    let failed = 0;

    for (const cert of certificates) {
      const report = await this.validateIRP5(cert.id, user);
      reports.push(report);

      if (report.is_valid) {
        passed++;
      } else {
        failed++;
      }
    }

    return {
      total: certificates.length,
      passed,
      failed,
      reports,
    };
  }

  /**
   * Get validation rules
   */
  private async getRules(appliesTo: string): Promise<ValidationRule[]> {
    const rules = await this.prisma.sarsValidationRule.findMany({
      where: {
        isActive: true,
        OR: [
          { appliesTo },
          { appliesTo: 'all' },
        ],
      },
      orderBy: { severity: 'desc' },
    });

    return rules.map(rule => ({
      id: rule.id,
      ruleCode: rule.ruleCode,
      ruleName: rule.ruleName,
      ruleDescription: rule.ruleDescription,
      appliesTo: rule.appliesTo,
      severity: rule.severity,
      validationLogic: rule.validationLogic || {},
      errorMessage: rule.errorMessage,
      isActive: rule.isActive,
    }));
  }

  /**
   * Execute a validation rule
   */
  private executeRule(rule: ValidationRule, data: any): ValidationResult {
    const logic = rule.validationLogic;
    let passed = true;
    let actualValue: any;
    let expectedValue: any;
    let fieldName: string | undefined;

    try {
      // Required field validation
      if (logic.required && logic.field) {
        fieldName = logic.field;
        actualValue = data[logic.field];
        passed = actualValue !== null && actualValue !== undefined && actualValue !== '';
        expectedValue = 'Not empty';
      }

      // Min length validation
      if (passed && logic.min_length && logic.field) {
        fieldName = logic.field;
        actualValue = data[logic.field]?.toString() || '';
        expectedValue = `Length >= ${logic.min_length}`;
        passed = actualValue.length >= logic.min_length;
      }

      // Exact length validation
      if (passed && logic.length && logic.field) {
        fieldName = logic.field;
        actualValue = data[logic.field]?.toString() || '';
        expectedValue = `Length = ${logic.length}`;
        passed = actualValue.length === logic.length;
      }

      // Min value validation
      if (passed && logic.min_value !== undefined && logic.field) {
        fieldName = logic.field;
        actualValue = parseFloat(data[logic.field] || 0);
        expectedValue = `>= ${logic.min_value}`;
        passed = actualValue >= logic.min_value;
      }

      // Max value validation
      if (passed && logic.max_value !== undefined && logic.field) {
        fieldName = logic.field;
        actualValue = parseFloat(data[logic.field] || 0);
        expectedValue = `<= ${logic.max_value}`;
        passed = actualValue <= logic.max_value;
      }

      // Equals validation
      if (passed && logic.equals !== undefined && logic.field) {
        fieldName = logic.field;
        actualValue = data[logic.field];
        expectedValue = logic.equals;
        passed = actualValue === logic.equals;
      }

      // Comparison validation
      if (passed && logic.compare) {
        const field1Value = parseFloat(data[logic.compare.field1] || 0);
        const field2Value = parseFloat(data[logic.compare.field2] || 0);
        fieldName = `${logic.compare.field1} vs ${logic.compare.field2}`;
        actualValue = `${field1Value} vs ${field2Value}`;

        switch (logic.compare.operator) {
          case '>=':
            passed = field1Value >= field2Value;
            expectedValue = `${logic.compare.field1} >= ${logic.compare.field2}`;
            break;
          case '<=':
            passed = field1Value <= field2Value;
            expectedValue = `${logic.compare.field1} <= ${logic.compare.field2}`;
            break;
          case '==':
            passed = field1Value === field2Value;
            expectedValue = `${logic.compare.field1} == ${logic.compare.field2}`;
            break;
        }
      }

      // Sum equals validation
      if (passed && logic.sum_equals) {
        const sum = logic.sum_equals.fields.reduce((acc: number, field: string) => {
          return acc + parseFloat(data[field] || 0);
        }, 0);
        const target = parseFloat(data[logic.sum_equals.equals] || 0);
        const tolerance = logic.sum_equals.tolerance || 0.01;

        fieldName = logic.sum_equals.fields.join(' + ');
        actualValue = sum.toFixed(2);
        expectedValue = target.toFixed(2);
        passed = Math.abs(sum - target) <= tolerance;
      }

    } catch (error) {
      passed = false;
      expectedValue = 'Valid data';
      actualValue = 'Error executing validation';
    }

    return {
      rule_id: rule.id,
      rule_code: rule.ruleCode,
      rule_name: rule.ruleName,
      passed,
      severity: rule.severity,
      error_message: passed ? undefined : rule.errorMessage,
      field_name: fieldName,
      expected_value: expectedValue?.toString(),
      actual_value: actualValue?.toString(),
    };
  }

  /**
   * Save validation result to database
   */
  private async saveValidationResult(
    validationRunId: string,
    documentType: string,
    documentId: string,
    rule: ValidationRule,
    result: ValidationResult
  ) {
    await this.prisma.sarsValidationResult.create({
      data: {
        validationRunId,
        ruleId: rule.id,
        documentType,
        documentId,
        passed: result.passed,
        severity: result.severity,
        errorMessage: result.error_message,
        fieldName: result.field_name,
        expectedValue: result.expected_value,
        actualValue: result.actual_value,
      },
    });
  }

  /**
   * Build validation report
   */
  private buildValidationReport(
    validationRunId: string,
    documentType: string,
    documentId: string,
    results: ValidationResult[]
  ): ValidationReport {
    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.filter(r => !r.passed).length;
    const errorCount = results.filter(r => !r.passed && r.severity === 'error').length;
    const warningCount = results.filter(r => !r.passed && r.severity === 'warning').length;

    return {
      validation_run_id: validationRunId,
      document_type: documentType,
      document_id: documentId,
      total_rules: results.length,
      passed_count: passedCount,
      failed_count: failedCount,
      error_count: errorCount,
      warning_count: warningCount,
      results,
      is_valid: errorCount === 0, // Valid if no errors (warnings are ok)
    };
  }

  /**
   * Get validation history for a document
   */
  async getValidationHistory(documentType: string, documentId: string) {
    return this.prisma.sarsValidationResult.findMany({
      where: { documentType, documentId },
      include: { rule: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
