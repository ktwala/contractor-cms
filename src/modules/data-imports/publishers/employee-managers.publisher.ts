import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { BaseImportPublisher } from './base-import.publisher';

/**
 * Employee Managers (MANAGER_RELATIONSHIPS) publisher.
 * Writes to Employee.managerId. PATCH mode: only employees in file are updated.
 */
@Injectable()
export class EmployeeManagersPublisher extends BaseImportPublisher {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async publish(
    job: {
      id: string;
      rows: Array<{
        id: string;
        rowNumber: number;
        status: string;
        mappedJson: unknown;
      }>;
    },
    user: { id: string },
  ) {
    const validRows = job.rows.filter((r) => r.status === 'VALID');
    const summary: Record<string, number> = {
      created: 0,
      updated: 0,
      cleared: 0,
      skipped: 0,
      failed: 0,
    };

    const employees = await this.prisma.employee.findMany({
      select: { id: true, employeeNo: true },
    });
    const employeeByNo = new Map(employees.map((e) => [e.employeeNo, e]));

    for (const row of validRows) {
      const payload = row.mappedJson as Record<string, unknown>;
      const employee_no = (payload.employee_no as string)?.trim?.();
      const manager_employee_no = (payload.manager_employee_no as string)?.trim?.() || null;

      if (!employee_no) {
        await this.markRowSkipped(row.id);
        summary.skipped += 1;
        continue;
      }

      const employee = employeeByNo.get(employee_no);
      if (!employee) {
        await this.markRowSkipped(row.id);
        summary.skipped += 1;
        continue;
      }

      let managerId: string | null = null;
      if (manager_employee_no) {
        const manager = employeeByNo.get(manager_employee_no);
        if (!manager) {
          await this.markRowSkipped(row.id);
          summary.skipped += 1;
          continue;
        }
        managerId = manager.id;
      }

      const existing = await this.prisma.employee.findUnique({
        where: { id: employee.id },
        select: { managerId: true },
      });

      const hadManager = !!existing?.managerId;
      const nowHasManager = !!managerId;

      await this.prisma.employee.update({
        where: { id: employee.id },
        data: { managerId },
      });

      if (nowHasManager) {
        summary.updated += 1;
      } else if (hadManager) {
        summary.cleared += 1;
      } else {
        summary.cleared += 1; // explicitly set to null
      }

      await this.markRowPublished(row.id, 'Employee', employee.id, 'updated');
    }

    return this.finalizeJobPublished(job.id, user.id, summary as any);
  }
}
