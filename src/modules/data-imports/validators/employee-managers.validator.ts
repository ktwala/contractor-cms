import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { BaseImportValidator, ImportRowIssue } from './base-import.validator';

type GraphNode = { managerId: string | null; reports: string[] };

/**
 * Employee Managers (MANAGER_RELATIONSHIPS) validator.
 * Validation rules: MGR-001 to MGR-005 (errors), MGR-W01 to MGR-W04 (warnings).
 */
@Injectable()
export class EmployeeManagersValidator extends BaseImportValidator {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async validate(job: {
    id: string;
    rows: Array<{ id: string; rowNumber: number; payloadJson: unknown }>;
  }) {
    let valid = 0;
    let invalid = 0;
    let warnings = 0;
    let errors = 0;

    const seenEmployeeNos = new Set<string>();
    const existingEmployees = await this.prisma.employee.findMany({
      select: { id: true, employeeNo: true, managerId: true },
    });
    const employeeByNo = new Map(existingEmployees.map((e) => [e.employeeNo, e]));
    const employeeById = new Map(existingEmployees.map((e) => [e.id, e]));

    // Build current graph from DB (employeeId -> managerId)
    const currentGraph = new Map<string, string | null>();
    for (const e of existingEmployees) {
      currentGraph.set(e.id, e.managerId);
    }

    // Collect staged assignments: employee_no -> manager_employee_no (from file)
    const stagedAssignments = new Map<string, string | null>();

    for (const row of job.rows) {
      const payload = row.payloadJson as Record<string, unknown>;
      const issues: ImportRowIssue[] = [];

      const employee_no = this.trim(
        payload.employee_no ?? payload.employeeNo,
      );
      const manager_employee_no = this.trim(
        payload.manager_employee_no ?? payload.managerEmployeeNo,
      );

      const mapped = {
        employee_no,
        manager_employee_no: manager_employee_no || null,
      };

      // MGR-001: Employee not found
      if (!employee_no) {
        issues.push({
          fieldName: 'employee_no',
          errorCode: 'MGR-001',
          message: 'employee_no is required',
          severity: 'ERROR',
        });
      } else {
        if (!employeeByNo.has(employee_no)) {
          issues.push({
            fieldName: 'employee_no',
            errorCode: 'MGR-001',
            message: `employee_no '${employee_no}' not found`,
            severity: 'ERROR',
          });
        }

        // MGR-004: Duplicate rows
        if (seenEmployeeNos.has(employee_no)) {
          issues.push({
            fieldName: 'employee_no',
            errorCode: 'MGR-004',
            message: `'${employee_no}' appears multiple times in manager assignment file`,
            severity: 'ERROR',
          });
        } else {
          seenEmployeeNos.add(employee_no);
        }

        // MGR-002: Manager not found (when provided)
        if (manager_employee_no && !employeeByNo.has(manager_employee_no)) {
          issues.push({
            fieldName: 'manager_employee_no',
            errorCode: 'MGR-002',
            message: `manager_employee_no '${manager_employee_no}' not found`,
            severity: 'ERROR',
          });
        }

        // MGR-003: Self-manager
        if (manager_employee_no && employee_no === manager_employee_no) {
          issues.push({
            fieldName: 'manager_employee_no',
            errorCode: 'MGR-003',
            message: `'${employee_no}' cannot be their own manager`,
            severity: 'ERROR',
          });
        }

        // MGR-W01: Missing manager (warning)
        if (!manager_employee_no && employee_no) {
          issues.push({
            fieldName: 'manager_employee_no',
            errorCode: 'MGR-W01',
            message: 'manager_employee_no is empty (valid for top-level roles)',
            severity: 'WARNING',
          });
        }

        if (employeeByNo.has(employee_no) && manager_employee_no && employeeByNo.has(manager_employee_no)) {
          stagedAssignments.set(employee_no, manager_employee_no);
        } else if (employeeByNo.has(employee_no)) {
          stagedAssignments.set(employee_no, null);
        }
      }

      const errCount = issues.filter((i) => i.severity === 'ERROR').length;
      const warnCount = issues.filter((i) => i.severity === 'WARNING').length;
      if (errCount > 0) {
        invalid += 1;
        errors += errCount;
      } else {
        valid += 1;
        warnings += warnCount;
      }

      await this.saveRowResult(job.id, row, mapped, issues);
    }

    // MGR-005: Circular hierarchy - validate combined graph
    const cycleResult = this.detectCycle(
      employeeByNo,
      currentGraph,
      stagedAssignments,
    );
    if (cycleResult.hasCycle) {
      for (const row of job.rows) {
        const payload = row.payloadJson as Record<string, unknown>;
        const employee_no = this.trim(
          payload.employee_no ?? payload.employeeNo,
        );
        if (cycleResult.involved.has(employee_no)) {
          const rowData = await this.prisma.dataImportRow.findUnique({
            where: { id: row.id },
            select: { status: true, errorsCount: true },
          });
          if (rowData?.status === 'VALID') {
            await this.prisma.dataImportError.create({
              data: {
                jobId: job.id,
                rowId: row.id,
                rowNumber: row.rowNumber,
                errorCode: 'MGR-005',
                message: `Circular hierarchy: ${cycleResult.cyclePath}`,
                severity: 'ERROR',
              },
            });
            await this.prisma.dataImportRow.update({
              where: { id: row.id },
              data: {
                status: 'INVALID',
                errorsCount: { increment: 1 },
              },
            });
            valid -= 1;
            invalid += 1;
            errors += 1;
          }
        }
      }
    }

    await this.finalizeJob(job, {
      valid,
      invalid,
      warnings,
      errors,
    });

    return {
      valid_rows: valid,
      invalid_rows: invalid,
      errors,
      warnings,
      total_rows: job.rows.length,
    };
  }

  private trim(v: unknown): string {
    if (v == null) return '';
    const s = String(v).trim();
    return s;
  }

  private detectCycle(
    employeeByNo: Map<string, { id: string; employeeNo: string; managerId: string | null }>,
    currentGraph: Map<string, string | null>,
    stagedAssignments: Map<string, string | null>,
  ): { hasCycle: boolean; cyclePath: string; involved: Set<string> } {
    const idToNo = new Map<string, string>();
    for (const [no, emp] of employeeByNo) {
      idToNo.set(emp.id, no);
    }

    // Build combined graph: employeeNo -> managerEmployeeNo
    const graphByNo = new Map<string, string | null>();

    for (const [empNo, emp] of employeeByNo) {
      if (stagedAssignments.has(empNo)) {
        graphByNo.set(empNo, stagedAssignments.get(empNo)!);
      } else {
        const managerId = currentGraph.get(emp.id);
        graphByNo.set(empNo, managerId ? idToNo.get(managerId) ?? null : null);
      }
    }

    // DFS cycle detection
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const path: string[] = [];
    let cyclePath = '';

    const dfs = (nodeNo: string): boolean => {
      visited.add(nodeNo);
      inStack.add(nodeNo);
      path.push(nodeNo);

      const managerNo = graphByNo.get(nodeNo);
      if (managerNo && graphByNo.has(managerNo)) {
        if (!visited.has(managerNo)) {
          if (dfs(managerNo)) return true;
        } else if (inStack.has(managerNo)) {
          const idx = path.indexOf(managerNo);
          cyclePath = [...path.slice(idx), managerNo].join(' → ');
          return true;
        }
      }

      path.pop();
      inStack.delete(nodeNo);
      return false;
    };

    for (const nodeNo of graphByNo.keys()) {
      if (!visited.has(nodeNo) && dfs(nodeNo)) {
        return {
          hasCycle: true,
          cyclePath: cyclePath || 'cycle detected',
          involved: new Set(path),
        };
      }
    }

    return { hasCycle: false, cyclePath: '', involved: new Set() };
  }
}
