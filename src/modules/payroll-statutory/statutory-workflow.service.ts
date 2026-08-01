import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { StatutoryRepository } from './repository/statutory.repository';
import { ALLOWED_TRANSITIONS, STATUS_EVENT_MAP } from './statutory.constants';
import { StatutoryReturnStatus } from './statutory.types';
import { StatutoryWorkflowTransitionError } from './statutory.errors';

@Injectable()
export class StatutoryWorkflowService {
  private readonly logger = new Logger(StatutoryWorkflowService.name);

  constructor(private readonly repository: StatutoryRepository) {}

  async submitForReview(returnId: string, userId?: string, comment?: string) {
    return this.transition(returnId, 'under_review', 'reviewedAt', userId, comment);
  }

  async approve(returnId: string, userId?: string, comment?: string) {
    return this.transition(returnId, 'approved', 'approvedAt', userId, comment);
  }

  async markSubmitted(
    returnId: string,
    userId?: string,
    submissionReference?: string,
    comment?: string,
  ) {
    return this.transition(returnId, 'submitted', 'submittedAt', userId, comment, {
      submissionReference,
    });
  }

  async acknowledge(returnId: string, userId?: string, comment?: string) {
    return this.transition(returnId, 'acknowledged', 'acknowledgedAt', userId, comment);
  }

  async cancel(returnId: string, userId?: string, comment?: string) {
    const ret = await this.repository.getReturnById(returnId);
    if (!ret) throw new NotFoundException(`Statutory return ${returnId} not found`);

    const currentStatus = ret.status as StatutoryReturnStatus;
    this.assertTransition(currentStatus, 'cancelled');

    await this.repository.createWorkflowEvent({
      statutoryReturnId: returnId,
      eventType: STATUS_EVENT_MAP['cancelled'],
      fromStatus: currentStatus,
      toStatus: 'cancelled',
      performedByUserId: userId,
      comment,
    });

    return this.repository.updateReturnStatus(returnId, 'cancelled', 'updatedAt', userId);
  }

  private async transition(
    returnId: string,
    toStatus: StatutoryReturnStatus,
    timestampField: string,
    userId?: string,
    comment?: string,
    extra?: Record<string, unknown>,
  ) {
    const ret = await this.repository.getReturnById(returnId);
    if (!ret) throw new NotFoundException(`Statutory return ${returnId} not found`);

    const currentStatus = ret.status as StatutoryReturnStatus;
    this.assertTransition(currentStatus, toStatus);

    await this.repository.createWorkflowEvent({
      statutoryReturnId: returnId,
      eventType: STATUS_EVENT_MAP[toStatus],
      fromStatus: currentStatus,
      toStatus,
      performedByUserId: userId,
      comment,
    });

    const updated = await this.repository.updateReturnStatus(
      returnId,
      toStatus,
      timestampField,
      userId,
      extra,
    );

    this.logger.log(`Return ${returnId}: ${currentStatus} -> ${toStatus}`);
    return updated;
  }

  private assertTransition(from: StatutoryReturnStatus, to: StatutoryReturnStatus): void {
    const allowed = ALLOWED_TRANSITIONS[from];
    if (!allowed || !allowed.includes(to)) {
      throw new StatutoryWorkflowTransitionError(from, to);
    }
  }
}
