import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';

@Injectable()
export class InterviewService {
  constructor(private readonly prisma: PrismaService) {}

  async scheduleInterview(
    applicationId: string,
    interviewType: string,
    scheduledDate: string,
    durationMinutes: number,
    interviewerId: string,
    location: string | null,
    videoMeetingLink: string | null,
    additionalInterviewers: string[] | null,
    userId: string,
  ): Promise<string> {
    const application = await this.prisma.jobApplication.findUnique({
      where: { id: applicationId },
      include: { requisition: true },
    });
    if (!application) throw new NotFoundException('Application not found');

    const ids = [interviewerId, ...(additionalInterviewers ?? [])].filter(Boolean);
    const interviewerIds = ids as Prisma.InputJsonValue;

    const interview = await this.prisma.interview.create({
      data: {
        candidateId: application.candidateId,
        applicationId,
        interviewType,
        scheduledDate: new Date(scheduledDate),
        duration: durationMinutes,
        location: location ?? undefined,
        meetingLink: videoMeetingLink ?? undefined,
        interviewerIds,
        status: 'scheduled',
        createdBy: userId,
      },
    });

    await this.prisma.jobApplication.update({
      where: { id: applicationId },
      data: { stage: 'interview' },
    });

    return interview.id;
  }

  async submitFeedback(
    interviewId: string,
    interviewerId: string,
    overallRating: number,
    recommendation: string,
    feedbackData: Record<string, unknown>,
  ): Promise<string> {
    const feedback = await this.prisma.interviewFeedback.create({
      data: {
        interviewId,
        interviewerId,
        overallRating,
        technicalRating: (feedbackData.technical_skills_rating as number) ?? null,
        cultureFitRating: (feedbackData.cultural_fit_rating as number) ?? null,
        communicationRating: (feedbackData.communication_rating as number) ?? null,
        strengths: (feedbackData.strengths as string) ?? null,
        weaknesses: (feedbackData.weaknesses as string) ?? null,
        recommendation,
        notes: (feedbackData.detailed_feedback as string) ?? null,
      },
    });

    await this.prisma.interview.update({
      where: { id: interviewId },
      data: {
        overallRating,
        recommendation,
        notes: (feedbackData.detailed_feedback as string) ?? undefined,
      },
    });

    return feedback.id;
  }

  async completeInterview(interviewId: string): Promise<void> {
    await this.prisma.interview.update({
      where: { id: interviewId },
      data: { status: 'completed', completedAt: new Date() },
    });
  }

  async cancelInterview(interviewId: string, cancelledReason: string): Promise<void> {
    await this.prisma.interview.update({
      where: { id: interviewId },
      data: {
        status: 'cancelled',
        notes: cancelledReason || undefined,
      },
    });
  }

  async getInterviewsForApplication(applicationId: string): Promise<unknown[]> {
    const interviews = await this.prisma.interview.findMany({
      where: { applicationId },
      include: {
        candidate: { select: { firstName: true, lastName: true } },
        application: {
          include: { requisition: { select: { id: true, title: true } } },
        },
        feedback: true,
      },
      orderBy: { scheduledDate: 'asc' },
    });

    return interviews.map((i) => ({
      id: i.id,
      application_id: i.applicationId,
      candidate_id: i.candidateId,
      interview_type: i.interviewType,
      scheduled_date: i.scheduledDate,
      scheduled_time: i.scheduledTime,
      duration: i.duration,
      location: i.location,
      meeting_link: i.meetingLink,
      interviewer_ids: i.interviewerIds,
      status: i.status,
      candidate_name: `${i.candidate.firstName} ${i.candidate.lastName}`.trim(),
      requisition_title: i.application?.requisition?.title ?? '',
      feedback: i.feedback,
    }));
  }

  async listInterviews(legalEntityId: string): Promise<unknown[]> {
    const interviews = await this.prisma.interview.findMany({
      where: {
        application: {
          requisition: { legalEntityId },
        },
      },
      include: {
        candidate: { select: { firstName: true, lastName: true } },
        application: {
          include: { requisition: { select: { id: true, title: true, legalEntityId: true } } },
        },
        feedback: true,
      },
      orderBy: { scheduledDate: 'asc' },
    });

    return interviews.map((i) => this.serializeInterview(i));
  }

  async getMyInterviews(userId: string, status?: string): Promise<unknown[]> {
    const interviews = await this.prisma.interview.findMany({
      where: status ? { status } : {},
      include: {
        candidate: { select: { firstName: true, lastName: true } },
        application: {
          include: { requisition: { select: { id: true, title: true } } },
        },
        feedback: { where: { interviewerId: userId } },
      },
      orderBy: { scheduledDate: 'asc' },
    });

    const mine = interviews.filter((i) => {
      const raw = i.interviewerIds;
      if (!Array.isArray(raw)) return false;
      return raw.some((id) => String(id) === String(userId));
    });

    return mine.map((i) => this.serializeInterview(i, userId));
  }

  private serializeInterview(
    i: {
      id: string;
      applicationId: string | null;
      candidateId: string;
      interviewType: string;
      scheduledDate: Date;
      scheduledTime: string | null;
      duration: number;
      location: string | null;
      meetingLink: string | null;
      interviewerIds: Prisma.JsonValue;
      status: string;
      candidate: { firstName: string; lastName: string };
      application: {
        requisition: { id: string; title: string } | null;
      } | null;
      feedback?: unknown[];
    },
    currentUserId?: string,
  ): Record<string, unknown> {
    const ids = Array.isArray(i.interviewerIds) ? i.interviewerIds.map(String) : [];
    const hasMyFeedback =
      currentUserId &&
      Array.isArray(i.feedback) &&
      (i.feedback as { interviewerId: string }[]).some((f) => f.interviewerId === currentUserId);

    return {
      id: i.id,
      application_id: i.applicationId,
      candidate_id: i.candidateId,
      candidate_name: `${i.candidate.firstName} ${i.candidate.lastName}`.trim(),
      requisition_title: i.application?.requisition?.title ?? '',
      interview_type: i.interviewType,
      scheduled_date: i.scheduledDate,
      scheduled_time: i.scheduledTime,
      duration: i.duration,
      location: i.location,
      meeting_link: i.meetingLink,
      interviewer_ids: ids,
      status: i.status,
      feedback: i.feedback,
      current_user_has_feedback: Boolean(hasMyFeedback),
    };
  }
}
