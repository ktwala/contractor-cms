import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import * as Papa from 'papaparse';

export interface BatchJobResult {
  job_id: string;
  total_records: number;
  successful: number;
  failed: number;
  status: string;
}

@Injectable()
export class BulkOperationsService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Create a batch job
   */
  async createBatchJob(
    jobName: string,
    jobType: string,
    operationType: 'create' | 'update' | 'delete' | 'import' | 'export',
    legalEntityId: string | null,
    userId: string,
    metadata?: any,
  ): Promise<string> {
    const job = await (this.prisma as any).batchJob.create({
      data: {
        jobName,
        jobType,
        operationType,
        legalEntityId,
        status: 'pending',
        createdBy: userId,
        metadata: metadata || null,
      },
    });

    return job.id;
  }

  /**
   * Bulk import employees from CSV
   */
  async bulkImportEmployees(
    csvData: string,
    legalEntityId: string,
    userId: string,
  ): Promise<BatchJobResult> {
    // Create batch job
    const jobId = await this.createBatchJob(
      `Employee Import - ${new Date().toISOString()}`,
      'employee',
      'import',
      legalEntityId,
      userId
    );

    // Parse CSV
    const parsed = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
    });

    const records = parsed.data as any[];
    let successful = 0;
    let failed = 0;

    // Update job status
    await (this.prisma as any).batchJob.update({
      where: { id: jobId },
      data: {
        status: 'processing',
        totalRecords: records.length,
        startedAt: new Date(),
      },
    });

    // Process each record
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNumber = i + 1;

      try {
        // Validate record
        const validation = this.validateEmployeeRecord(record);

        if (!validation.valid) {
          await this.addBatchJobItem(jobId, rowNumber, 'employee', null, record, null, 'failed', validation.errors.join('; '));
          failed++;
          continue;
        }

        // Create employee
        const employeeId = await this.createEmployeeFromRecord(record, legalEntityId, userId);

        await this.addBatchJobItem(jobId, rowNumber, 'employee', employeeId, record, { id: employeeId }, 'success', null);
        successful++;
      } catch (error: any) {
        await this.addBatchJobItem(jobId, rowNumber, 'employee', null, record, null, 'failed', error.message);
        failed++;
      }
    }

    // Update job status
    await (this.prisma as any).batchJob.update({
      where: { id: jobId },
      data: {
        status: failed === records.length ? 'failed' : failed > 0 ? 'completed_with_errors' : 'completed',
        successfulRecords: successful,
        failedRecords: failed,
        completedAt: new Date(),
      },
    });

    return {
      job_id: jobId,
      total_records: records.length,
      successful,
      failed,
      status: failed === records.length ? 'failed' : failed > 0 ? 'completed_with_errors' : 'completed',
    };
  }

  /**
   * Bulk update employee salaries
   */
  async bulkUpdateSalaries(
    updates: Array<{ employee_id: string; new_salary: number; effective_date: string }>,
    legalEntityId: string,
    userId: string,
  ): Promise<BatchJobResult> {
    const jobId = await this.createBatchJob(
      `Salary Update - ${new Date().toISOString()}`,
      'salary',
      'update',
      legalEntityId,
      userId
    );

    let successful = 0;
    let failed = 0;

    // Update job status
    await (this.prisma as any).batchJob.update({
      where: { id: jobId },
      data: {
        status: 'processing',
        totalRecords: updates.length,
        startedAt: new Date(),
      },
    });

    for (let i = 0; i < updates.length; i++) {
      const update = updates[i];
      const rowNumber = i + 1;

      try {
        // Verify employee exists and belongs to legal entity
        const employee = await (this.prisma as any).employee.findFirst({
          where: { id: update.employee_id },
        });

        if (!employee) {
          await this.addBatchJobItem(jobId, rowNumber, 'employee', update.employee_id, update, null, 'failed', 'Employee not found');
          failed++;
          continue;
        }

        // Update salary
        await (this.prisma as any).employee.update({
          where: { id: update.employee_id },
          data: { salary: update.new_salary },
        });

        await this.addBatchJobItem(jobId, rowNumber, 'employee', update.employee_id, update, { new_salary: update.new_salary }, 'success', null);
        successful++;
      } catch (error: any) {
        await this.addBatchJobItem(jobId, rowNumber, 'employee', update.employee_id, update, null, 'failed', error.message);
        failed++;
      }
    }

    // Update job status
    await (this.prisma as any).batchJob.update({
      where: { id: jobId },
      data: {
        status: failed === updates.length ? 'failed' : failed > 0 ? 'completed_with_errors' : 'completed',
        successfulRecords: successful,
        failedRecords: failed,
        completedAt: new Date(),
      },
    });

    return {
      job_id: jobId,
      total_records: updates.length,
      successful,
      failed,
      status: failed === updates.length ? 'failed' : failed > 0 ? 'completed_with_errors' : 'completed',
    };
  }

  /**
   * Bulk employee termination
   */
  async bulkTerminateEmployees(
    terminations: Array<{
      employee_id: string;
      termination_date: string;
      termination_reason: string;
    }>,
    legalEntityId: string,
    userId: string,
  ): Promise<BatchJobResult> {
    const jobId = await this.createBatchJob(
      `Termination - ${new Date().toISOString()}`,
      'termination',
      'update',
      legalEntityId,
      userId
    );

    let successful = 0;
    let failed = 0;

    await (this.prisma as any).batchJob.update({
      where: { id: jobId },
      data: {
        status: 'processing',
        totalRecords: terminations.length,
        startedAt: new Date(),
      },
    });

    for (let i = 0; i < terminations.length; i++) {
      const term = terminations[i];
      const rowNumber = i + 1;

      try {
        const employee = await (this.prisma as any).employee.findFirst({
          where: { id: term.employee_id },
        });

        if (!employee) {
          await this.addBatchJobItem(jobId, rowNumber, 'employee', term.employee_id, term, null, 'failed', 'Employee not found');
          failed++;
          continue;
        }

        await (this.prisma as any).employee.update({
          where: { id: term.employee_id },
          data: {
            status: 'TERMINATED',
            endDate: new Date(term.termination_date),
          },
        });

        await this.addBatchJobItem(jobId, rowNumber, 'employee', term.employee_id, term, { status: 'terminated' }, 'success', null);
        successful++;
      } catch (error: any) {
        await this.addBatchJobItem(jobId, rowNumber, 'employee', term.employee_id, term, null, 'failed', error.message);
        failed++;
      }
    }

    await (this.prisma as any).batchJob.update({
      where: { id: jobId },
      data: {
        status: failed === terminations.length ? 'failed' : failed > 0 ? 'completed_with_errors' : 'completed',
        successfulRecords: successful,
        failedRecords: failed,
        completedAt: new Date(),
      },
    });

    return {
      job_id: jobId,
      total_records: terminations.length,
      successful,
      failed,
      status: failed === terminations.length ? 'failed' : failed > 0 ? 'completed_with_errors' : 'completed',
    };
  }

  /**
   * Get batch job status
   */
  async getBatchJobStatus(jobId: string): Promise<any> {
    const job = await (this.prisma as any).batchJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new Error('Batch job not found');
    }

    return {
      ...job,
      progress: job.totalRecords > 0
        ? ((job.successfulRecords + job.failedRecords) / job.totalRecords) * 100
        : 0,
    };
  }

  /**
   * Get batch job items (with pagination)
   */
  async getBatchJobItems(jobId: string, limit: number = 100, offset: number = 0): Promise<any[]> {
    return (this.prisma as any).batchJobItem.findMany({
      where: { jobId },
      orderBy: { rowNumber: 'asc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Validate employee record
   */
  private validateEmployeeRecord(record: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!record.first_name) errors.push('First name is required');
    if (!record.last_name) errors.push('Last name is required');
    if (!record.id_number && !record.passport_number) {
      errors.push('Either ID number or passport number is required');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Create employee from CSV record
   */
  private async createEmployeeFromRecord(
    record: any,
    legalEntityId: string,
    userId: string,
  ): Promise<string> {
    const employee = await (this.prisma as any).employee.create({
      data: {
        firstName: record.first_name,
        lastName: record.last_name,
        nationalId: record.id_number || null,
        email: record.email || null,
        phone: record.phone || null,
        employeeNo: record.employee_number || `EMP-${Date.now()}`,
        status: 'ACTIVE',
        hireDate: record.start_date ? new Date(record.start_date) : new Date(),
        salary: record.basic_salary ? parseFloat(record.basic_salary) : 0,
      },
    });

    return employee.id;
  }

  /**
   * Add batch job item
   */
  private async addBatchJobItem(
    jobId: string,
    rowNumber: number,
    entityType: string,
    entityId: string | null,
    inputData: any,
    outputData: any,
    status: 'pending' | 'processing' | 'success' | 'failed' | 'skipped',
    errorMessage: string | null,
  ): Promise<void> {
    await (this.prisma as any).batchJobItem.create({
      data: {
        jobId,
        rowNumber,
        entityType,
        entityId,
        inputData,
        outputData,
        status,
        errorMessage,
      },
    });
  }
}
