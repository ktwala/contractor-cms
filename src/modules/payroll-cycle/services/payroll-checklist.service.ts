import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

@Injectable()
export class PayrollChecklistService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Create checklist from template for a period
   */
  async createChecklistFromTemplate(
    periodId: string,
    templateId: string,
    userId: string,
  ): Promise<string> {
    // Get template with items
    const template = await this.prisma.payrollChecklistTemplate.findUnique({
      where: { id: templateId, isActive: true },
      include: {
        items: {
          orderBy: { taskOrder: 'asc' },
        },
      },
    });

    if (!template) {
      throw new Error('Template not found');
    }

    // Get period for calculating due dates
    const period = await this.prisma.payPeriod.findUnique({
      where: { id: periodId },
    });

    if (!period) {
      throw new Error('Period not found');
    }

    // Create checklist with tasks
    const checklist = await this.prisma.payrollChecklist.create({
      data: {
        periodId,
        templateId,
        checklistName: template.templateName,
        createdBy: userId,
        totalTasks: template.items.length,
        tasks: {
          create: template.items.map(item => {
            const dueDate = new Date(period.endDate);
            dueDate.setDate(dueDate.getDate() + item.dueOffsetDays);

            return {
              taskName: item.taskName,
              taskDescription: item.taskDescription,
              taskCategory: item.taskCategory,
              taskOrder: item.taskOrder,
              dueDate,
              isRequired: item.isRequired,
            };
          }),
        },
      },
    });

    return checklist.id;
  }

  /**
   * Complete a checklist task
   */
  async completeTask(taskId: string, userId: string, notes: string | null = null): Promise<void> {
    const task = await this.prisma.payrollChecklistTask.update({
      where: { id: taskId },
      data: {
        status: 'completed',
        completedBy: userId,
        completedAt: new Date(),
        notes,
      },
    });

    // Update checklist progress
    await this.updateChecklistProgress(task.checklistId);
  }

  /**
   * Update checklist progress
   */
  private async updateChecklistProgress(checklistId: string): Promise<void> {
    const tasks = await this.prisma.payrollChecklistTask.findMany({
      where: { checklistId },
    });

    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const percentage = total > 0 ? (completed / total) * 100 : 0;
    const status = percentage === 100 ? 'completed' : percentage > 0 ? 'in_progress' : 'pending';

    await this.prisma.payrollChecklist.update({
      where: { id: checklistId },
      data: {
        totalTasks: total,
        completedTasks: completed,
        completionPercentage: percentage,
        status,
      },
    });
  }

  /**
   * Get checklist for a period
   */
  async getChecklistForPeriod(periodId: string): Promise<any> {
    const checklist = await this.prisma.payrollChecklist.findFirst({
      where: { periodId },
      orderBy: { createdAt: 'desc' },
      include: {
        tasks: {
          orderBy: { taskOrder: 'asc' },
          include: {
            assignedUser: {
              select: { firstName: true, lastName: true },
            },
            completedByUser: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
    });

    if (!checklist) {
      return null;
    }

    return {
      ...checklist,
      tasks: checklist.tasks.map(task => ({
        ...task,
        assigned_to_name: task.assignedUser
          ? `${task.assignedUser.firstName} ${task.assignedUser.lastName}`
          : null,
        completed_by_name: task.completedByUser
          ? `${task.completedByUser.firstName} ${task.completedByUser.lastName}`
          : null,
      })),
    };
  }

  /**
   * Assign task to user
   */
  async assignTask(taskId: string, userId: string): Promise<void> {
    await this.prisma.payrollChecklistTask.update({
      where: { id: taskId },
      data: {
        assignedTo: userId,
        status: 'in_progress',
      },
    });
  }

  /**
   * Get my assigned tasks
   */
  async getMyTasks(userId: string): Promise<any[]> {
    const tasks = await this.prisma.payrollChecklistTask.findMany({
      where: {
        assignedTo: userId,
        status: { in: ['pending', 'in_progress'] },
      },
      include: {
        checklist: {
          include: {
            period: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    return tasks.map(task => ({
      ...task,
      period_name: `${task.checklist.period.year}-${task.checklist.period.periodNum}`,
      period_end_date: task.checklist.period.endDate,
    }));
  }

  /**
   * Create a checklist template
   */
  async createTemplate(
    templateName: string,
    description: string | null,
    frequency: string,
    items: { taskName: string; taskDescription?: string; taskCategory: string; taskOrder: number; dueOffsetDays: number; isRequired: boolean }[],
    userId: string,
  ): Promise<string> {
    const template = await this.prisma.payrollChecklistTemplate.create({
      data: {
        templateName,
        description,
        frequency,
        createdBy: userId,
        items: {
          create: items,
        },
      },
    });

    return template.id;
  }

  /**
   * Get all templates
   */
  async getTemplates(): Promise<any[]> {
    return this.prisma.payrollChecklistTemplate.findMany({
      where: { isActive: true },
      include: {
        items: {
          orderBy: { taskOrder: 'asc' },
        },
      },
    });
  }
}
