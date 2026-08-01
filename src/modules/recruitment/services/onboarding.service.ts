import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { EmploymentType, type Country, type Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';

export type CreateOnboardingWorkflowResult = {
  workflow_id: string;
  employee_id?: string;
  employee_name?: string;
  candidate_id?: string;
  offer_id?: string;
  offer_status?: string;
  requisition_title?: string;
  department?: string | null;
  hiring_manager_name?: string | null;
  /** Payroll `Employment` row created when pay-group + country defaults resolved */
  employment_record_created?: boolean;
  /** When true, onboarding still started but HR must complete payroll employment (see onboarding task) */
  employment_setup_required?: boolean;
  employment_setup_reason?: string | null;
};

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Store `@db.Date` fields without local timezone drift. */
  private toUtcDateOnly(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  private mapRequisitionToEmploymentType(raw: string | null | undefined): EmploymentType {
    const s = (raw ?? '').toLowerCase();
    if (s.includes('casual')) return EmploymentType.CASUAL;
    if (s.includes('contract')) return EmploymentType.CONTRACT;
    return EmploymentType.PERMANENT;
  }

  /**
   * Prefer a pay group whose country matches the legal entity; otherwise any pay group for the LE.
   * Employment.country is set to the pay group's country so payroll configuration stays consistent.
   */
  private async resolvePayrollShellForLegalEntity(
    tx: Prisma.TransactionClient,
    legalEntityId: string,
  ): Promise<{ payGroupId: string; country: Country } | null> {
    const le = await tx.legalEntity.findUnique({
      where: { id: legalEntityId },
      select: { country: true },
    });
    if (!le) return null;

    let pg = await tx.payGroup.findFirst({
      where: { legalEntityId, country: le.country },
      orderBy: { createdAt: 'asc' },
    });
    if (!pg) {
      pg = await tx.payGroup.findFirst({
        where: { legalEntityId },
        orderBy: { createdAt: 'asc' },
      });
    }
    if (!pg) return null;
    return { payGroupId: pg.id, country: pg.country };
  }

  async createOnboardingWorkflow(
    body: Record<string, unknown>,
    _userId: string,
  ): Promise<CreateOnboardingWorkflowResult> {
    const offerId = String(body.offer_id ?? '').trim();
    if (offerId) {
      return this.createFromAcceptedOffer(body, offerId);
    }

    const applicationId = String(body.application_id ?? '').trim();
    if (applicationId) {
      const resolvedOfferId = await this.resolveAcceptedOfferIdFromApplication(
        applicationId,
        String(body.legal_entity_id ?? '').trim(),
      );
      return this.createFromAcceptedOffer(body, resolvedOfferId);
    }

    const employeeId = String(body.employee_id ?? body.new_employee_id ?? '').trim();
    if (!employeeId) {
      throw new BadRequestException(
        'offer_id or application_id is required for new-hire onboarding, or provide employee_id for an existing employee',
      );
    }

    const startDate = body.start_date
      ? new Date(String(body.start_date))
      : new Date();

    const workflow = await this.prisma.onboardingWorkflow.create({
      data: {
        employeeId,
        workflowName: String(body.workflow_name ?? 'Employee onboarding'),
        startDate,
        targetEndDate: body.target_end_date
          ? new Date(String(body.target_end_date))
          : null,
        status: 'in_progress',
        legalEntityId: (body.legal_entity_id as string) ?? null,
        assignedTo:
          (body.assigned_buddy_id as string) ??
          (body.assigned_to as string) ??
          null,
        notes: body.notes ? String(body.notes) : null,
      },
    });

    await this.createWelcomeTask(workflow.id, startDate);
    await this.recalcProgress(workflow.id);
    return { workflow_id: workflow.id };
  }

  /**
   * When the client has an application id but not the offer id, resolve the accepted
   * {@link JobOffer} for the same candidate + requisition pair (latest by update).
   */
  private async resolveAcceptedOfferIdFromApplication(
    applicationId: string,
    legalEntityFromBody: string,
  ): Promise<string> {
    const app = await this.prisma.jobApplication.findUnique({
      where: { id: applicationId },
      include: { requisition: true },
    });
    if (!app) {
      throw new NotFoundException('Application not found');
    }
    if (legalEntityFromBody && app.requisition.legalEntityId) {
      if (app.requisition.legalEntityId !== legalEntityFromBody) {
        throw new BadRequestException('Application does not belong to the selected legal entity');
      }
    }

    const offer = await this.prisma.jobOffer.findFirst({
      where: {
        candidateId: app.candidateId,
        requisitionId: app.requisitionId,
        status: 'accepted',
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (!offer) {
      throw new BadRequestException('No accepted offer found for this application');
    }
    return offer.id;
  }

  private async hiringManagerDisplayName(userId: string | null | undefined): Promise<string | null> {
    const id = userId?.trim();
    if (!id) return null;
    const u = await this.prisma.user.findUnique({
      where: { id },
      select: { firstName: true, lastName: true, email: true },
    });
    if (!u) return null;
    const name = `${u.firstName} ${u.lastName}`.trim();
    return name || u.email;
  }

  private async createFromAcceptedOffer(
    body: Record<string, unknown>,
    offerId: string,
  ): Promise<CreateOnboardingWorkflowResult> {
    const startDate = body.start_date
      ? new Date(String(body.start_date))
      : null;
    if (!startDate || Number.isNaN(startDate.getTime())) {
      throw new BadRequestException('start_date is required and must be a valid date');
    }

    const legalEntityFromBody = String(body.legal_entity_id ?? '').trim();

    const offer = await this.prisma.jobOffer.findUnique({
      where: { id: offerId },
      include: {
        candidate: true,
        requisition: {
          select: {
            id: true,
            title: true,
            department: true,
            legalEntityId: true,
            hiringManagerId: true,
            employmentType: true,
          },
        },
      },
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    if (offer.status !== 'accepted') {
      throw new BadRequestException('Only accepted offers can start onboarding');
    }

    if (legalEntityFromBody && offer.requisition.legalEntityId) {
      if (offer.requisition.legalEntityId !== legalEntityFromBody) {
        throw new BadRequestException('Offer does not belong to the selected legal entity');
      }
    }

    const existing = await this.prisma.onboardingWorkflow.findFirst({
      where: { sourceOfferId: offer.id },
    });
    if (existing) {
      throw new ConflictException('Onboarding already exists for this offer');
    }

    const legalEntityId =
      offer.requisition.legalEntityId ?? (legalEntityFromBody || null);
    if (!legalEntityId) {
      throw new BadRequestException(
        'Requisition has no legal entity; select a legal entity filter or fix the requisition',
      );
    }

    const department = offer.department ?? offer.requisition.department ?? null;
    const workflowName = String(body.workflow_name ?? 'New hire onboarding');
    const notes = body.notes ? String(body.notes) : null;

    const hiringManagerName = await this.hiringManagerDisplayName(
      offer.requisition.hiringManagerId,
    );

    const employeeNo = `NH-${randomBytes(8).toString('hex').toUpperCase()}`;

    const {
      workflow,
      employeeName,
      employmentRecordCreated,
      employmentSetupRequired,
      employmentSetupReason,
    } = await this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          employeeNo,
          firstName: offer.candidate.firstName,
          lastName: offer.candidate.lastName,
          email: offer.candidate.email,
          phone: offer.candidate.phone,
          hireDate: startDate,
          legalEntityId,
          department,
          jobTitle: offer.position,
          status: 'ACTIVE',
        },
      });

      const workflow = await tx.onboardingWorkflow.create({
        data: {
          employeeId: employee.id,
          workflowName,
          startDate,
          status: 'in_progress',
          legalEntityId,
          notes,
          assignedTo:
            (body.assigned_buddy_id as string) ??
            (body.assigned_to as string) ??
            null,
          sourceOfferId: offer.id,
          sourceCandidateId: offer.candidateId,
          sourceRequisitionId: offer.requisitionId,
        },
      });

      await tx.onboardingTask.create({
        data: {
          workflowId: workflow.id,
          taskName: 'Welcome & orientation',
          description: 'Complete HR orientation and policy acknowledgements',
          category: 'documentation',
          status: 'pending',
          dueDate: new Date(startDate.getTime() + 7 * 86_400_000),
        },
      });

      let employmentRecordCreated = false;
      let employmentSetupRequired = false;
      let employmentSetupReason: string | null = null;

      const shell = await this.resolvePayrollShellForLegalEntity(tx, legalEntityId);
      if (shell) {
        await tx.employment.create({
          data: {
            employeeId: employee.id,
            legalEntityId,
            payGroupId: shell.payGroupId,
            country: shell.country,
            employmentType: this.mapRequisitionToEmploymentType(offer.requisition.employmentType),
            effectiveFrom: this.toUtcDateOnly(startDate),
            jobTitle: offer.position,
          },
        });
        employmentRecordCreated = true;
      } else {
        employmentSetupRequired = true;
        employmentSetupReason =
          'No pay group found for this legal entity (add a pay group, or align its country with the legal entity).';
        await tx.onboardingTask.create({
          data: {
            workflowId: workflow.id,
            taskName: 'Complete employment & payroll setup',
            description:
              'No payroll Employment could be created automatically. In Workforce, create an Employment for this employee with pay group, country, employment type, and effective start date — or add a default pay group for this legal entity and use HR tools to link employment. Mark this task done when payroll employment exists.',
            category: 'payroll',
            status: 'pending',
            priority: 2,
            dueDate: new Date(startDate.getTime() + 3 * 86_400_000),
          },
        });
      }

      const employeeName =
        `${employee.firstName} ${employee.lastName}`.trim() || offer.candidate.email || '';

      return {
        workflow,
        employeeName,
        employmentRecordCreated,
        employmentSetupRequired,
        employmentSetupReason,
      };
    });

    await this.recalcProgress(workflow.id);

    return {
      workflow_id: workflow.id,
      employee_id: workflow.employeeId,
      employee_name: employeeName,
      candidate_id: offer.candidateId,
      offer_id: offer.id,
      offer_status: offer.status,
      requisition_title: offer.requisition.title,
      department,
      hiring_manager_name: hiringManagerName,
      employment_record_created: employmentRecordCreated,
      employment_setup_required: employmentSetupRequired,
      employment_setup_reason: employmentSetupReason,
    };
  }

  private async createWelcomeTask(workflowId: string, startDate: Date): Promise<void> {
    await this.prisma.onboardingTask.create({
      data: {
        workflowId,
        taskName: 'Welcome & orientation',
        description: 'Complete HR orientation and policy acknowledgements',
        category: 'documentation',
        status: 'pending',
        dueDate: new Date(startDate.getTime() + 7 * 86_400_000),
      },
    });
  }

  async completeTask(taskId: string, userId: string, notes: string | null): Promise<void> {
    const task = await this.prisma.onboardingTask.update({
      where: { id: taskId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        completedBy: userId,
        notes: notes ?? undefined,
      },
    });
    await this.recalcProgress(task.workflowId);
  }

  async addRequiredDocument(
    workflowId: string,
    documentType: string,
    documentName: string,
    isRequired: boolean,
  ): Promise<string> {
    const doc = await this.prisma.onboardingDocument.create({
      data: {
        workflowId,
        documentType,
        documentName: documentName || documentType,
        required: isRequired,
      },
    });
    return doc.id;
  }

  async uploadDocument(documentId: string, filePath: string, userId: string): Promise<void> {
    await this.prisma.onboardingDocument.update({
      where: { id: documentId },
      data: {
        fileUrl: filePath,
        uploadedBy: userId,
        uploadedAt: new Date(),
        status: 'uploaded',
      },
    });
  }

  async verifyDocument(documentId: string, userId: string): Promise<void> {
    await this.prisma.onboardingDocument.update({
      where: { id: documentId },
      data: {
        verifiedBy: userId,
        verifiedAt: new Date(),
        status: 'verified',
      },
    });
  }

  async getOnboardingWorkflow(workflowId: string): Promise<unknown> {
    const workflow = await this.prisma.onboardingWorkflow.findUnique({
      where: { id: workflowId },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            employeeNo: true,
            _count: { select: { employments: true } },
          },
        },
        sourceOffer: {
          include: {
            candidate: { select: { id: true, firstName: true, lastName: true, email: true } },
            requisition: {
              select: { id: true, title: true, department: true, hiringManagerId: true },
            },
          },
        },
        tasks: { orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }] },
        documents: { orderBy: { documentType: 'asc' } },
      },
    });

    if (!workflow) throw new NotFoundException('Onboarding workflow not found');

    const employeeName = workflow.employee
      ? `${workflow.employee.firstName} ${workflow.employee.lastName}`.trim()
      : null;

    const cand = workflow.sourceOffer?.candidate;
    const candidateName = cand
      ? `${cand.firstName} ${cand.lastName}`.trim() || cand.email
      : null;

    const hiringManagerName = await this.hiringManagerDisplayName(
      workflow.sourceOffer?.requisition?.hiringManagerId,
    );

    const payrollEmploymentCount = workflow.employee?._count?.employments ?? 0;

    return {
      ...workflow,
      employee_name: employeeName,
      employee_number: workflow.employee?.employeeNo ?? null,
      payroll_employment_count: payrollEmploymentCount,
      candidate_id: workflow.sourceCandidateId ?? workflow.sourceOffer?.candidateId ?? null,
      candidate_name: candidateName,
      offer_id: workflow.sourceOfferId,
      offer_status: workflow.sourceOffer?.status ?? null,
      requisition_title: workflow.sourceOffer?.requisition?.title ?? null,
      requisition_department: workflow.sourceOffer?.requisition?.department ?? null,
      offer_position: workflow.sourceOffer?.position ?? null,
      hiring_manager_name: hiringManagerName,
    };
  }

  async listOnboardingWorkflows(legalEntityId?: string): Promise<unknown[]> {
    const rows = await this.prisma.onboardingWorkflow.findMany({
      where: legalEntityId?.trim()
        ? { legalEntityId: legalEntityId.trim() }
        : {},
      include: {
        employee: { select: { firstName: true, lastName: true } },
        sourceOffer: {
          include: {
            candidate: { select: { firstName: true, lastName: true, email: true } },
            requisition: { select: { title: true, department: true, hiringManagerId: true } },
          },
        },
        tasks: true,
        documents: true,
      },
      orderBy: { startDate: 'desc' },
    });

    const managerIds = [
      ...new Set(
        rows
          .map((w) => w.sourceOffer?.requisition?.hiringManagerId)
          .filter((id): id is string => Boolean(id?.trim())),
      ),
    ];
    const managers =
      managerIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: managerIds } },
            select: { id: true, firstName: true, lastName: true, email: true },
          })
        : [];
    const managerNameById = new Map(
      managers.map((u) => {
        const n = `${u.firstName} ${u.lastName}`.trim();
        return [u.id, n || u.email] as const;
      }),
    );

    return rows.map((w) => {
      const cand = w.sourceOffer?.candidate;
      const candidateName = cand
        ? `${cand.firstName} ${cand.lastName}`.trim() || cand.email
        : null;
      const hmId = w.sourceOffer?.requisition?.hiringManagerId;
      return {
        id: w.id,
        employee_id: w.employeeId,
        employee_name: w.employee
          ? `${w.employee.firstName} ${w.employee.lastName}`.trim()
          : null,
        workflow_name: w.workflowName,
        start_date: w.startDate,
        status: w.status,
        progress: w.progress,
        legal_entity_id: w.legalEntityId,
        tasks_count: w.tasks.length,
        documents_count: w.documents.length,
        created_at: w.createdAt,
        updated_at: w.updatedAt,
        candidate_name: candidateName,
        offer_id: w.sourceOfferId,
        offer_status: w.sourceOffer?.status ?? null,
        requisition_title: w.sourceOffer?.requisition?.title ?? null,
        requisition_department: w.sourceOffer?.requisition?.department ?? null,
        offer_position: w.sourceOffer?.position ?? null,
        hiring_manager_name: hmId ? managerNameById.get(hmId) ?? null : null,
      };
    });
  }

  async getMyOnboardingTasks(userId: string): Promise<unknown[]> {
    const tasks = await this.prisma.onboardingTask.findMany({
      where: {
        assignedTo: userId,
        status: { in: ['pending', 'in_progress'] },
      },
      include: {
        workflow: {
          include: {
            employee: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    return tasks.map((t) => ({
      id: t.id,
      task_name: t.taskName,
      status: t.status,
      due_date: t.dueDate,
      workflow_id: t.workflowId,
      employee_name: t.workflow.employee
        ? `${t.workflow.employee.firstName} ${t.workflow.employee.lastName}`.trim()
        : null,
    }));
  }

  async addEquipment(
    _workflowId: string,
    _equipmentType: string,
    _equipmentDescription: string,
    _isRequired: boolean,
  ): Promise<string> {
    throw new BadRequestException(
      'Equipment tracking is not enabled for onboarding in this schema version.',
    );
  }

  async assignEquipment(
    _equipmentId: string,
    _serialNumber: string | null,
    _userId: string,
  ): Promise<void> {
    throw new BadRequestException(
      'Equipment tracking is not enabled for onboarding in this schema version.',
    );
  }

  async addSystemAccess(
    _workflowId: string,
    _systemName: string,
    _accessLevel: string,
    _isRequired: boolean,
  ): Promise<string> {
    throw new BadRequestException(
      'Access provisioning is not enabled for onboarding in this schema version.',
    );
  }

  async provisionAccess(
    _accessId: string,
    _username: string,
    _userId: string,
  ): Promise<void> {
    throw new BadRequestException(
      'Access provisioning is not enabled for onboarding in this schema version.',
    );
  }

  private async recalcProgress(workflowId: string): Promise<void> {
    const tasks = await this.prisma.onboardingTask.findMany({
      where: { workflowId },
    });
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const pct = total ? Math.round((completed / total) * 100) : 0;

    await this.prisma.onboardingWorkflow.update({
      where: { id: workflowId },
      data: {
        progress: pct,
        status: pct === 100 ? 'completed' : 'in_progress',
        ...(pct === 100 ? { actualEndDate: new Date() } : {}),
      },
    });
  }
}
