import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

/**
 * SARS eFiling Integration Service
 * Direct submission to SARS eFiling system
 */
@Injectable()
export class SarsEfilingService {
  private readonly logger = new Logger(SarsEfilingService.name);

  constructor(private readonly prisma: PrismaService) { }

  async submitEMP201(connectionId: string, emp201Id: string): Promise<string> {
    const emp201 = await (this.prisma as any).emp201Return.findUnique({
      where: { id: emp201Id },
    });

    if (!emp201) throw new Error('EMP201 not found');

    const submission = await (this.prisma as any).sarsEfilingSubmission.create({
      data: {
        connectionId,
        legalEntityId: emp201.legalEntityId,
        submissionType: 'EMP201',
        taxPeriod: emp201.taxPeriod,
        referenceId: emp201Id,
        status: 'draft',
      },
    });

    this.logger.log(`SARS eFiling submission created: ${submission.id}`);
    return submission.id;
  }

  async getSubmissionStatus(submissionId: string): Promise<any> {
    return (this.prisma as any).sarsEfilingSubmission.findUnique({
      where: { id: submissionId },
    });
  }
}
