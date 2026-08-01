import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

@Injectable()
export class PerformanceService {
  constructor(private readonly prisma: PrismaService) { }

  async findAllCycles(filters?: { status?: string; country?: string }) {
    return (this.prisma as any).performanceCycle.findMany({
      where: {
        ...(filters?.status && { status: filters.status }),
        ...(filters?.country && { country: filters.country }),
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async createCycle(data: any) {
    return (this.prisma as any).performanceCycle.create({
      data: {
        name: data.name,
        description: data.description,
        cycleType: data.cycle_type,
        startDate: new Date(data.start_date),
        endDate: new Date(data.end_date),
        reviewStartDate: data.review_start_date ? new Date(data.review_start_date) : null,
        reviewEndDate: data.review_end_date ? new Date(data.review_end_date) : null,
        selfAssessmentEnabled: data.self_assessment_enabled ?? true,
        peerFeedbackEnabled: data.peer_feedback_enabled ?? false,
        managerReviewEnabled: data.manager_review_enabled ?? true,
        goalsRequired: data.goals_required ?? true,
        country: data.country,
        status: 'draft',
        createdBy: data.created_by,
      },
    });
  }

  async activateCycle(id: string) {
    await (this.prisma as any).performanceCycle.update({
      where: { id },
      data: { status: 'active' },
    });
  }

  async findGoals(filters?: { employee_id?: string; cycle_id?: string; status?: string }) {
    return (this.prisma as any).performanceGoal.findMany({
      where: {
        ...(filters?.employee_id && { employeeId: filters.employee_id }),
        ...(filters?.cycle_id && { cycleId: filters.cycle_id }),
        ...(filters?.status && { status: filters.status }),
      },
      include: {
        employee: { select: { firstName: true, lastName: true } },
        manager: { select: { firstName: true, lastName: true } },
        cycle: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createGoal(data: any) {
    return (this.prisma as any).performanceGoal.create({
      data: {
        employeeId: data.employee_id,
        cycleId: data.cycle_id,
        title: data.title,
        description: data.description,
        goalType: data.goal_type || 'individual',
        category: data.category || 'performance',
        metric: data.metric,
        targetValue: data.target_value,
        startDate: data.start_date ? new Date(data.start_date) : null,
        dueDate: data.due_date ? new Date(data.due_date) : null,
        weight: data.weight || 0,
        managerId: data.manager_id,
        status: 'active',
      },
    });
  }

  async updateGoalProgress(id: string, data: { current_value?: string; completion_percentage?: number; employee_comments?: string }) {
    await (this.prisma as any).performanceGoal.update({
      where: { id },
      data: {
        ...(data.current_value !== undefined && { currentValue: data.current_value }),
        ...(data.completion_percentage !== undefined && { completionPercentage: data.completion_percentage }),
        ...(data.employee_comments !== undefined && { employeeComments: data.employee_comments }),
      },
    });
  }

  private async generateReviewNumber(): Promise<string> {
    const lastReview = await (this.prisma as any).performanceReview.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { reviewNumber: true },
    });

    if (!lastReview) return 'REV-2024-0001';

    const match = lastReview.reviewNumber?.match(/REV-(\d{4})-(\d{4})/);
    if (match) {
      const year = parseInt(match[1]);
      const seq = parseInt(match[2]);
      const currentYear = new Date().getFullYear();
      if (year === currentYear) return `REV-${currentYear}-${String(seq + 1).padStart(4, '0')}`;
    }

    return `REV-${new Date().getFullYear()}-0001`;
  }

  async findReviews(filters?: { employee_id?: string; manager_id?: string; cycle_id?: string; status?: string }) {
    return (this.prisma as any).performanceReview.findMany({
      where: {
        ...(filters?.employee_id && { employeeId: filters.employee_id }),
        ...(filters?.manager_id && { managerId: filters.manager_id }),
        ...(filters?.cycle_id && { cycleId: filters.cycle_id }),
        ...(filters?.status && { status: filters.status }),
      },
      include: {
        employee: { select: { firstName: true, lastName: true, employeeNo: true } },
        manager: { select: { firstName: true, lastName: true } },
        cycle: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createReview(data: any) {
    const reviewNumber = await this.generateReviewNumber();

    return (this.prisma as any).performanceReview.create({
      data: {
        reviewNumber,
        employeeId: data.employee_id,
        cycleId: data.cycle_id,
        managerId: data.manager_id,
        reviewType: data.review_type || 'manager_review',
        reviewPeriodStart: data.review_period_start ? new Date(data.review_period_start) : null,
        reviewPeriodEnd: data.review_period_end ? new Date(data.review_period_end) : null,
        status: 'not_started',
      },
    });
  }

  async submitSelfAssessment(reviewId: string, data: any) {
    await (this.prisma as any).performanceReview.update({
      where: { id: reviewId },
      data: {
        status: 'submitted',
        selfAssessmentDate: new Date(),
        overallRating: data.overall_rating,
        employeeComments: data.employee_comments,
      },
    });
  }

  async submitManagerReview(reviewId: string, data: any) {
    await (this.prisma as any).performanceReview.update({
      where: { id: reviewId },
      data: {
        status: 'completed',
        managerReviewDate: new Date(),
        overallRating: data.overall_rating,
        goalsRating: data.goals_rating,
        competenciesRating: data.competencies_rating,
        managerComments: data.manager_comments,
        performanceCategory: data.performance_category,
        recommendedForPromotion: data.recommended_for_promotion || false,
        recommendedSalaryIncrease: data.recommended_salary_increase || null,
      },
    });
  }

  async requestPeerFeedback(data: any) {
    const feedback = await (this.prisma as any).performanceFeedback.create({
      data: {
        reviewId: data.review_id,
        employeeId: data.employee_id,
        feedbackProviderId: data.feedback_provider_id,
        feedbackType: 'peer',
        relationship: data.relationship || 'Peer',
        status: 'requested',
        requestedDate: new Date(),
      },
    });
    return feedback.id;
  }

  async submitPeerFeedback(feedbackId: string, data: any) {
    await (this.prisma as any).performanceFeedback.update({
      where: { id: feedbackId },
      data: {
        status: 'submitted',
        submittedDate: new Date(),
        overallRating: data.overall_rating,
        strengths: data.strengths,
        areasForImprovement: data.areas_for_improvement,
        collaborationFeedback: data.collaboration_feedback,
        communicationFeedback: data.communication_feedback,
      },
    });
  }

  async findPendingFeedback(providerId: string) {
    return (this.prisma as any).performanceFeedback.findMany({
      where: { feedbackProviderId: providerId, status: 'requested' },
      include: {
        employee: { select: { firstName: true, lastName: true } },
        review: { include: { cycle: { select: { name: true } } } },
      },
      orderBy: { requestedDate: 'desc' },
    });
  }

  async getCycleStatistics(cycleId: string) {
    const [totalReviews, completedReviews, notStarted, totalGoals, completedGoals] = await Promise.all([
      (this.prisma as any).performanceReview.count({ where: { cycleId } }),
      (this.prisma as any).performanceReview.count({ where: { cycleId, status: 'completed' } }),
      (this.prisma as any).performanceReview.count({ where: { cycleId, status: 'not_started' } }),
      (this.prisma as any).performanceGoal.count({ where: { cycleId } }),
      (this.prisma as any).performanceGoal.count({ where: { cycleId, status: 'completed' } }),
    ]);

    const avgRating = await (this.prisma as any).performanceReview.aggregate({
      where: { cycleId, overallRating: { not: null } },
      _avg: { overallRating: true },
    });

    return { total_reviews: totalReviews, completed_reviews: completedReviews, not_started: notStarted, avg_rating: avgRating._avg?.overallRating, total_goals: totalGoals, completed_goals: completedGoals };
  }

  async getEmployeeStatistics(employeeId: string) {
    const [totalReviews, totalGoals, completedGoals] = await Promise.all([
      (this.prisma as any).performanceReview.count({ where: { employeeId } }),
      (this.prisma as any).performanceGoal.count({ where: { employeeId } }),
      (this.prisma as any).performanceGoal.count({ where: { employeeId, status: 'completed' } }),
    ]);

    const avgRating = await (this.prisma as any).performanceReview.aggregate({
      where: { employeeId, overallRating: { not: null } },
      _avg: { overallRating: true },
    });

    const avgGoalProgress = await (this.prisma as any).performanceGoal.aggregate({
      where: { employeeId, status: 'active' },
      _avg: { completionPercentage: true },
    });

    return { total_reviews: totalReviews, avg_rating: avgRating._avg?.overallRating, total_goals: totalGoals, completed_goals: completedGoals, avg_goal_progress: avgGoalProgress._avg?.completionPercentage };
  }
}
