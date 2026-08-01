import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

export type ImportRowIssue = {
  fieldName?: string;
  errorCode: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
};

@Injectable()
export abstract class BaseImportValidator {
  constructor(protected readonly prisma: PrismaService) {}

  protected async saveRowResult(
    jobId: string,
    row: { id: string; rowNumber: number },
    mappedJson: Record<string, unknown>,
    issues: ImportRowIssue[],
  ) {
    const errorsCount = issues.filter((i) => i.severity === 'ERROR').length;
    const warningsCount = issues.filter((i) => i.severity === 'WARNING').length;
    const status = errorsCount > 0 ? 'INVALID' : 'VALID';

    await this.prisma.dataImportRow.update({
      where: { id: row.id },
      data: {
        status,
        errorsCount,
        warningsCount,
        mappedJson: mappedJson as object,
      },
    });

    if (issues.length > 0) {
      await this.prisma.dataImportError.createMany({
        data: issues.map((i) => ({
          jobId,
          rowId: row.id,
          rowNumber: row.rowNumber,
          fieldName: i.fieldName,
          errorCode: i.errorCode,
          message: i.message,
          severity: i.severity,
        })),
      });
    }

    return {
      isValid: errorsCount === 0,
      errorsCount,
      warningsCount,
    };
  }

  protected async finalizeJob(
    job: { id: string; rows: unknown[] },
    counters: { valid: number; invalid: number; warnings: number; errors: number },
  ) {
    const summary = {
      total_rows: job.rows.length,
      valid_rows: counters.valid,
      invalid_rows: counters.invalid,
      warnings: counters.warnings,
      errors: counters.errors,
    };

    await this.prisma.dataImportJob.update({
      where: { id: job.id },
      data: {
        status: counters.errors > 0 ? 'HAS_ERRORS' : 'VALIDATED',
        validatedAt: new Date(),
        summaryJson: summary as object,
      },
    });

    return summary;
  }
}
