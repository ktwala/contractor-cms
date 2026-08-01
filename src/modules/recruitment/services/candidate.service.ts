import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

@Injectable()
export class CandidateService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrGetCandidate(candidateData: Record<string, unknown>): Promise<string> {
    const email = String(candidateData.email ?? '')
      .trim()
      .toLowerCase();
    if (!email) {
      throw new BadRequestException('candidate email is required');
    }

    const existing = await this.prisma.candidate.findUnique({ where: { email } });
    if (existing) {
      await this.updateCandidate(existing.id, candidateData);
      return existing.id;
    }

    const candidate = await this.prisma.candidate.create({
      data: {
        firstName: String(candidateData.first_name ?? '').trim() || 'Unknown',
        lastName: String(candidateData.last_name ?? '').trim() || 'Unknown',
        email,
        phone: (candidateData.phone as string) ?? null,
        resumeUrl: (candidateData.resume_url as string) ?? null,
        linkedinUrl: (candidateData.linkedin_url as string) ?? null,
        source: (candidateData.source as string) ?? 'company_website',
        skills: candidateData.skills as object | undefined,
      },
    });

    return candidate.id;
  }

  async candidateExists(candidateId: string): Promise<boolean> {
    const c = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { id: true },
    });
    return Boolean(c);
  }

  async submitApplication(requisitionId: string, candidateId: string): Promise<string> {
    const req = await this.prisma.jobRequisition.findUnique({ where: { id: requisitionId } });
    if (!req) throw new NotFoundException('Requisition not found');

    const existing = await this.prisma.jobApplication.findUnique({
      where: {
        candidateId_requisitionId: { candidateId, requisitionId },
      },
    });
    if (existing) return existing.id;

    const application = await this.prisma.jobApplication.create({
      data: {
        requisitionId,
        candidateId,
        status: 'new',
        stage: 'applied',
      },
    });

    return application.id;
  }

  async moveApplicationStage(applicationId: string, newStage: string): Promise<void> {
    await this.prisma.jobApplication.update({
      where: { id: applicationId },
      data: { stage: newStage },
    });
  }

  async rejectApplication(
    applicationId: string,
    rejectionReason: string,
    userId: string,
  ): Promise<void> {
    const app = await this.prisma.jobApplication.update({
      where: { id: applicationId },
      data: {
        status: 'rejected',
        rejectionReason: rejectionReason || 'Rejected',
        notes: rejectionReason || undefined,
      },
    });

    await this.prisma.candidate.update({
      where: { id: app.candidateId },
      data: { status: 'rejected' },
    });
  }

  async getApplicationsForRequisition(
    requisitionId: string,
    stage?: string,
    status?: string,
  ): Promise<unknown[]> {
    const applications = await this.prisma.jobApplication.findMany({
      where: {
        requisitionId,
        ...(stage && { stage }),
        ...(status && { status }),
      },
      include: {
        candidate: true,
      },
      orderBy: { applicationDate: 'desc' },
    });

    return applications.map((app) => ({
      id: app.id,
      candidate_id: app.candidateId,
      requisition_id: app.requisitionId,
      application_date: app.applicationDate,
      status: app.status,
      stage: app.stage,
      rating: app.rating,
      first_name: app.candidate.firstName,
      last_name: app.candidate.lastName,
      email: app.candidate.email,
      phone: app.candidate.phone,
    }));
  }

  async getCandidateProfile(candidateId: string): Promise<unknown> {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      include: {
        applications: {
          include: { requisition: { select: { id: true, title: true, status: true } } },
          orderBy: { applicationDate: 'desc' },
        },
      },
    });

    if (!candidate) throw new NotFoundException('Candidate not found');

    return candidate;
  }

  async listCandidates(legalEntityId?: string): Promise<unknown[]> {
    const where =
      legalEntityId?.trim()
        ? {
            applications: {
              some: { requisition: { legalEntityId: legalEntityId.trim() } },
            },
          }
        : {};

    const candidates = await this.prisma.candidate.findMany({
      where,
      include: {
        applications: {
          include: {
            requisition: { select: { id: true, title: true, status: true, legalEntityId: true } },
          },
          orderBy: { applicationDate: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return candidates;
  }

  async rateApplication(
    applicationId: string,
    screeningScore: number | null,
    overallRating: number | null,
  ): Promise<void> {
    const rating = overallRating ?? screeningScore;
    await this.prisma.jobApplication.update({
      where: { id: applicationId },
      data: { rating: rating ?? undefined },
    });
  }

  private async updateCandidate(candidateId: string, updates: Record<string, unknown>): Promise<void> {
    const data: Record<string, unknown> = {};
    if (updates.first_name) data.firstName = updates.first_name;
    if (updates.last_name) data.lastName = updates.last_name;
    if (updates.phone) data.phone = updates.phone;
    if (updates.linkedin_url) data.linkedinUrl = updates.linkedin_url;
    if (updates.resume_url) data.resumeUrl = updates.resume_url;
    if (updates.skills) data.skills = updates.skills;

    if (Object.keys(data).length === 0) return;

    await this.prisma.candidate.update({
      where: { id: candidateId },
      data: data as { firstName?: string; lastName?: string; phone?: string; linkedinUrl?: string; skills?: object },
    });
  }
}
