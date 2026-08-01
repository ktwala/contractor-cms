import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../../core/database/prisma.service';

@Injectable()
export class OfferService {
  constructor(private readonly prisma: PrismaService) {}

  async createOffer(
    applicationId: string,
    offerData: Record<string, unknown>,
    userId: string,
  ): Promise<string> {
    const application = await this.prisma.jobApplication.findUnique({
      where: { id: applicationId },
      include: { requisition: true },
    });
    if (!application) throw new NotFoundException('Application not found');

    const salary = offerData.salary ?? offerData.base_salary;
    if (salary === undefined || salary === null) {
      throw new BadRequestException('salary (or base_salary) is required');
    }
    const expiry = offerData.offer_expiry_date ?? offerData.expiry_date;
    if (!expiry) {
      throw new BadRequestException('offer_expiry_date is required');
    }

    const offerNumber = `OFF-${randomBytes(4).toString('hex').toUpperCase()}`;

    const offer = await this.prisma.jobOffer.create({
      data: {
        offerNumber,
        candidateId: application.candidateId,
        requisitionId: application.requisitionId,
        position:
          (offerData.job_title as string) ||
          (offerData.position as string) ||
          application.requisition.title,
        department:
          (offerData.department as string) ?? application.requisition.department,
        baseSalary: new Prisma.Decimal(String(salary)),
        currency: (offerData.salary_currency as string) || (offerData.currency as string) || 'ZAR',
        bonus:
          offerData.signing_bonus != null && offerData.signing_bonus !== ''
            ? new Prisma.Decimal(String(offerData.signing_bonus))
            : null,
        startDate: offerData.start_date
          ? new Date(String(offerData.start_date))
          : null,
        expiryDate: new Date(String(expiry)),
        status: 'draft',
        createdBy: userId,
        notes: (offerData.benefits_summary as string) ?? (offerData.notes as string) ?? null,
        offerLetterUrl:
          (offerData.offer_letter_url as string) ?? (offerData.offer_letter_path as string) ?? null,
      },
    });

    await this.prisma.jobApplication.update({
      where: { id: applicationId },
      data: { stage: 'offer' },
    });

    return offer.id;
  }

  async approveOffer(offerId: string, userId: string): Promise<void> {
    const o = await this.prisma.jobOffer.findUnique({ where: { id: offerId } });
    if (!o) throw new NotFoundException('Offer not found');
    if (o.status !== 'draft') {
      throw new BadRequestException('Only draft offers can be approved');
    }
    await this.prisma.jobOffer.update({
      where: { id: offerId },
      data: { status: 'pending_approval', approvedBy: userId },
    });
  }

  async sendOffer(offerId: string, offerLetterPath: string): Promise<void> {
    const existing = await this.prisma.jobOffer.findUnique({ where: { id: offerId } });
    if (!existing) throw new NotFoundException('Offer not found');
    if (existing.status !== 'pending_approval') {
      throw new BadRequestException('Only pending_approval offers can be sent');
    }

    const pathOrUrl = offerLetterPath?.trim() || existing.offerLetterUrl?.trim() || '';
    const noteSuffix = pathOrUrl ? `Offer letter: ${pathOrUrl}` : '';
    const notes = [existing.notes, noteSuffix].filter(Boolean).join('\n');

    await this.prisma.jobOffer.update({
      where: { id: offerId },
      data: {
        status: 'sent',
        sentAt: new Date(),
        ...(notes ? { notes } : {}),
      },
    });
  }

  async acceptOffer(offerId: string): Promise<void> {
    const offer = await this.prisma.jobOffer.update({
      where: { id: offerId },
      data: {
        status: 'accepted',
        respondedAt: new Date(),
        acceptedAt: new Date(),
      },
    });

    const application = await this.prisma.jobApplication.findFirst({
      where: {
        candidateId: offer.candidateId,
        requisitionId: offer.requisitionId,
      },
    });

    if (application) {
      await this.prisma.jobApplication.update({
        where: { id: application.id },
        data: { status: 'hired', stage: 'offer' },
      });
    }

    await this.prisma.candidate.update({
      where: { id: offer.candidateId },
      data: { status: 'hired' },
    });
  }

  async declineOffer(offerId: string, declineReason: string): Promise<void> {
    await this.prisma.jobOffer.update({
      where: { id: offerId },
      data: {
        status: 'rejected',
        respondedAt: new Date(),
        rejectionReason: declineReason || 'Declined',
      },
    });
  }

  async getOfferDetails(offerId: string): Promise<unknown> {
    const offer = await this.prisma.jobOffer.findUnique({
      where: { id: offerId },
      include: {
        candidate: { select: { firstName: true, lastName: true, email: true } },
        requisition: { select: { id: true, title: true } },
      },
    });

    if (!offer) throw new NotFoundException('Offer not found');

    return {
      ...offer,
      candidate_name: `${offer.candidate.firstName} ${offer.candidate.lastName}`.trim(),
      requisition_title: offer.requisition.title,
      base_salary: offer.baseSalary.toString(),
    };
  }

  async getOffersForApplication(applicationId: string): Promise<unknown[]> {
    const application = await this.prisma.jobApplication.findUnique({
      where: { id: applicationId },
    });
    if (!application) return [];

    return this.prisma.jobOffer.findMany({
      where: {
        candidateId: application.candidateId,
        requisitionId: application.requisitionId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPendingOffers(legalEntityId?: string): Promise<unknown[]> {
    const offers = await this.prisma.jobOffer.findMany({
      where: {
        status: { in: ['draft', 'pending_approval', 'sent'] },
        ...(legalEntityId?.trim()
          ? { requisition: { legalEntityId: legalEntityId.trim() } }
          : {}),
      },
      include: {
        candidate: { select: { firstName: true, lastName: true, email: true } },
        requisition: { select: { id: true, title: true, legalEntityId: true } },
      },
      orderBy: { expiryDate: 'asc' },
    });

    return offers.map((o) => ({
      id: o.id,
      offer_number: o.offerNumber,
      candidate_id: o.candidateId,
      requisition_id: o.requisitionId,
      candidate_name: `${o.candidate.firstName} ${o.candidate.lastName}`.trim(),
      requisition_title: o.requisition.title,
      position: o.position,
      base_salary: o.baseSalary.toString(),
      currency: o.currency,
      status: o.status,
      expiry_date: o.expiryDate,
      sent_at: o.sentAt,
      offer_letter_url: o.offerLetterUrl,
      created_at: o.createdAt,
      updated_at: o.updatedAt,
    }));
  }
}
