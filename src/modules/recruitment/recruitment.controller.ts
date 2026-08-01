import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JobRequisitionService } from './services/job-requisition.service';
import { CandidateService } from './services/candidate.service';
import { InterviewService } from './services/interview.service';
import { OfferService } from './services/offer.service';
import { OnboardingService } from './services/onboarding.service';
import { RecruitmentLookupService } from './services/recruitment-lookup.service';
import { RecruitmentFilesService } from './services/recruitment-files.service';
import { AuthGuard } from '@nestjs/passport';
import { AnyPermissions, Permissions } from '../../common/decorators/permissions.decorator';
import { P } from '../../common/constants/permissions';

@Controller('api/recruitment')
@UseGuards(AuthGuard('jwt'))
export class RecruitmentController {
  constructor(
    private readonly requisitionService: JobRequisitionService,
    private readonly candidateService: CandidateService,
    private readonly interviewService: InterviewService,
    private readonly offerService: OfferService,
    private readonly onboardingService: OnboardingService,
    private readonly recruitmentLookupService: RecruitmentLookupService,
    private readonly recruitmentFilesService: RecruitmentFilesService,
  ) {}

  @Post('files/upload')
  @AnyPermissions(
    P.RECRUITMENT_OFFERS_CREATE,
    P.RECRUITMENT_CANDIDATES_CREATE,
    P.RECRUITMENT_OFFERS_SEND,
  )
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }))
  async uploadRecruitmentFile(@UploadedFile() file: Express.Multer.File) {
    return this.recruitmentFilesService.saveUploadedFile(file);
  }

  // ==========================================
  // JOB REQUISITIONS
  // ==========================================

  @Post('requisitions')
  @Permissions(P.RECRUITMENT_REQUISITIONS_CREATE)
  async createRequisition(@Body() body: Record<string, unknown>, @Request() req: any) {
    const requisitionId = await this.requisitionService.createRequisition(body, req.user.userId);
    return { requisition_id: requisitionId };
  }

  @Get('requisitions')
  @Permissions(P.RECRUITMENT_REQUISITIONS_VIEW)
  async listRequisitions(@Query('legal_entity_id') legalEntityId: string) {
    if (!legalEntityId?.trim()) {
      throw new BadRequestException('legal_entity_id query parameter is required');
    }
    return this.requisitionService.listRequisitions(legalEntityId.trim());
  }

  @Post('requisitions/:requisitionId/approve')
  @Permissions(P.RECRUITMENT_REQUISITIONS_APPROVE)
  async approveRequisition(@Param('requisitionId') requisitionId: string, @Request() req: any) {
    await this.requisitionService.approveRequisition(requisitionId, req.user.userId);
    return { status: 'approved' };
  }

  @Post('requisitions/:requisitionId/post')
  @Permissions(P.RECRUITMENT_REQUISITIONS_POST)
  async postRequisition(@Param('requisitionId') requisitionId: string) {
    await this.requisitionService.postRequisition(requisitionId);
    return { status: 'posted' };
  }

  @Post('requisitions/:requisitionId/close')
  @Permissions(P.RECRUITMENT_REQUISITIONS_MANAGE)
  async closeRequisition(@Param('requisitionId') requisitionId: string, @Body() body: { status?: string }) {
    const raw = body?.status;
    if (raw !== 'filled' && raw !== 'cancelled' && raw !== 'closed') {
      throw new BadRequestException('status must be filled, cancelled, or closed');
    }
    const legacy = raw === 'cancelled' ? 'cancelled' : raw === 'closed' ? 'closed' : 'filled';
    await this.requisitionService.closeRequisition(requisitionId, legacy);
    return { status: legacy === 'cancelled' ? 'cancelled' : 'closed' };
  }

  /** Must be registered before :requisitionId so "open" is not captured as an id. */
  @Get('requisitions/open')
  @Permissions(P.RECRUITMENT_REQUISITIONS_VIEW)
  async getOpenRequisitions(@Query('legal_entity_id') legalEntityId: string) {
    return this.requisitionService.getOpenRequisitions(legalEntityId);
  }

  @Get('requisitions/options')
  @Permissions(P.RECRUITMENT_REQUISITIONS_VIEW)
  async listRequisitionOptions(
    @Query('legal_entity_id') legalEntityId: string,
    @Query('search') search?: string,
    @Query('only_posted') onlyPosted?: string,
  ) {
    if (!legalEntityId?.trim()) {
      throw new BadRequestException('legal_entity_id query parameter is required');
    }
    return this.recruitmentLookupService.listRequisitionOptions({
      legalEntityId: legalEntityId.trim(),
      search,
      onlyOpen: onlyPosted === '1' || onlyPosted === 'true' || onlyPosted === 'POSTED',
    });
  }

  @Get('requisitions/:requisitionId')
  @Permissions(P.RECRUITMENT_REQUISITIONS_VIEW)
  async getRequisitionDetails(@Param('requisitionId') requisitionId: string) {
    return this.requisitionService.getRequisitionDetails(requisitionId);
  }

  @Put('requisitions/:requisitionId')
  @Permissions(P.RECRUITMENT_REQUISITIONS_UPDATE)
  async updateRequisition(@Param('requisitionId') requisitionId: string, @Body() body: any) {
    await this.requisitionService.updateRequisition(requisitionId, body);
    return { status: 'updated' };
  }

  // ==========================================
  // CANDIDATES & APPLICATIONS
  // ==========================================

  @Post('candidates')
  @Permissions(P.RECRUITMENT_CANDIDATES_CREATE)
  async createCandidate(@Body() body: any) {
    const candidateId = await this.candidateService.createOrGetCandidate(body);
    return { candidate_id: candidateId };
  }

  @Get('candidates')
  @Permissions(P.RECRUITMENT_CANDIDATES_VIEW)
  async listCandidates(@Query('legal_entity_id') legalEntityId?: string) {
    return this.candidateService.listCandidates(legalEntityId);
  }

  @Post('applications')
  @Permissions(P.RECRUITMENT_APPLICATIONS_CREATE)
  async submitApplication(@Body() body: any) {
    const requisitionId = String(body.requisition_id ?? '').trim();
    if (!requisitionId) {
      throw new BadRequestException('requisition_id is required');
    }
    let candidateId: string;
    if (body.candidate_id) {
      candidateId = String(body.candidate_id).trim();
      if (!(await this.candidateService.candidateExists(candidateId))) {
        throw new BadRequestException('candidate not found');
      }
    } else {
      if (!body.candidate) {
        throw new BadRequestException('candidate or candidate_id is required');
      }
      candidateId = await this.candidateService.createOrGetCandidate(body.candidate);
    }
    const applicationId = await this.candidateService.submitApplication(requisitionId, candidateId);
    return { application_id: applicationId, candidate_id: candidateId };
  }

  @Get('applications/options')
  @Permissions(P.RECRUITMENT_APPLICATIONS_VIEW)
  async listApplicationOptions(
    @Query('legal_entity_id') legalEntityId: string,
    @Query('search') search?: string,
    @Query('candidate_id') candidateId?: string,
    @Query('stage') stage?: string,
  ) {
    if (!legalEntityId?.trim()) {
      throw new BadRequestException('legal_entity_id query parameter is required');
    }
    const stages = this.recruitmentLookupService.normalizeStages(stage);
    return this.recruitmentLookupService.listApplicationOptions({
      legalEntityId: legalEntityId.trim(),
      search,
      candidateId,
      stages,
    });
  }

  @Get('users/options')
  @AnyPermissions(
    P.RECRUITMENT_INTERVIEWS_SCHEDULE,
    P.RECRUITMENT_REQUISITIONS_CREATE,
    P.RECRUITMENT_REQUISITIONS_UPDATE,
    P.RECRUITMENT_OFFERS_CREATE,
    P.RECRUITMENT_ONBOARDING_CREATE,
  )
  async listUserOptions(
    @Query('search') search?: string,
    @Query('legal_entity_id') legalEntityId?: string,
  ) {
    return this.recruitmentLookupService.searchUsers(search, legalEntityId);
  }

  @Get('org-units/options')
  @Permissions(P.RECRUITMENT_REQUISITIONS_VIEW)
  async listOrgUnitOptions(
    @Query('legal_entity_id') legalEntityId: string,
    @Query('search') search?: string,
  ) {
    if (!legalEntityId?.trim()) {
      throw new BadRequestException('legal_entity_id query parameter is required');
    }
    return this.recruitmentLookupService.listOrgUnitOptions(legalEntityId.trim(), search);
  }

  @Get('work-locations/options')
  @Permissions(P.RECRUITMENT_REQUISITIONS_VIEW)
  async listWorkLocationOptions(
    @Query('legal_entity_id') legalEntityId: string,
    @Query('search') search?: string,
  ) {
    if (!legalEntityId?.trim()) {
      throw new BadRequestException('legal_entity_id query parameter is required');
    }
    return this.recruitmentLookupService.listWorkLocationOptions(legalEntityId.trim(), search);
  }

  @Get('employees/options')
  @Permissions(P.RECRUITMENT_ONBOARDING_CREATE)
  async listEmployeeOptions(
    @Query('legal_entity_id') legalEntityId: string,
    @Query('search') search?: string,
  ) {
    if (!legalEntityId?.trim()) {
      throw new BadRequestException('legal_entity_id query parameter is required');
    }
    return this.recruitmentLookupService.listEmployeeOptions(legalEntityId.trim(), search);
  }

  @Post('applications/:applicationId/stage')
  @Permissions(P.RECRUITMENT_APPLICATIONS_MANAGE)
  async moveApplicationStage(@Param('applicationId') applicationId: string, @Body() body: any) {
    await this.candidateService.moveApplicationStage(applicationId, body.stage);
    return { status: 'moved', stage: body.stage };
  }

  @Post('applications/:applicationId/reject')
  @Permissions(P.RECRUITMENT_APPLICATIONS_MANAGE)
  async rejectApplication(
    @Param('applicationId') applicationId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    await this.candidateService.rejectApplication(
      applicationId,
      body.rejection_reason,
      req.user.userId,
    );
    return { status: 'rejected' };
  }

  @Get('requisitions/:requisitionId/applications')
  @Permissions(P.RECRUITMENT_APPLICATIONS_VIEW)
  async getApplicationsForRequisition(
    @Param('requisitionId') requisitionId: string,
    @Query('stage') stage?: string,
    @Query('status') status?: string,
  ) {
    return this.candidateService.getApplicationsForRequisition(requisitionId, stage, status);
  }

  @Get('candidates/:candidateId')
  @Permissions(P.RECRUITMENT_CANDIDATES_VIEW)
  async getCandidateProfile(@Param('candidateId') candidateId: string) {
    return this.candidateService.getCandidateProfile(candidateId);
  }

  @Post('applications/:applicationId/rate')
  @Permissions(P.RECRUITMENT_APPLICATIONS_RATE)
  async rateApplication(@Param('applicationId') applicationId: string, @Body() body: any) {
    await this.candidateService.rateApplication(
      applicationId,
      body.screening_score || null,
      body.overall_rating || null,
    );
    return { status: 'rated' };
  }

  // ==========================================
  // INTERVIEWS
  // ==========================================

  @Post('interviews')
  @Permissions(P.RECRUITMENT_INTERVIEWS_SCHEDULE)
  async scheduleInterview(@Body() body: any, @Request() req: any) {
    const interviewId = await this.interviewService.scheduleInterview(
      body.application_id,
      body.interview_type,
      body.scheduled_date,
      body.duration_minutes || 60,
      body.interviewer_id,
      body.location || null,
      body.video_meeting_link || null,
      body.additional_interviewers || null,
      req.user.userId,
    );
    return { interview_id: interviewId };
  }

  @Post('interviews/:interviewId/feedback')
  @Permissions(P.RECRUITMENT_INTERVIEWS_FEEDBACK)
  async submitFeedback(
    @Param('interviewId') interviewId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    const feedbackId = await this.interviewService.submitFeedback(
      interviewId,
      req.user.userId,
      body.overall_rating,
      body.recommendation,
      body,
    );
    return { feedback_id: feedbackId };
  }

  @Post('interviews/:interviewId/complete')
  @Permissions(P.RECRUITMENT_INTERVIEWS_MANAGE)
  async completeInterview(@Param('interviewId') interviewId: string) {
    await this.interviewService.completeInterview(interviewId);
    return { status: 'completed' };
  }

  @Post('interviews/:interviewId/cancel')
  @Permissions(P.RECRUITMENT_INTERVIEWS_MANAGE)
  async cancelInterview(@Param('interviewId') interviewId: string, @Body() body: any) {
    await this.interviewService.cancelInterview(interviewId, body.cancelled_reason);
    return { status: 'cancelled' };
  }

  @Get('applications/:applicationId/interviews')
  @Permissions(P.RECRUITMENT_INTERVIEWS_VIEW)
  async getInterviewsForApplication(@Param('applicationId') applicationId: string) {
    return this.interviewService.getInterviewsForApplication(applicationId);
  }

  @Get('interviews/my-interviews')
  @Permissions(P.RECRUITMENT_INTERVIEWS_VIEW)
  async getMyInterviews(@Request() req: any, @Query('status') status?: string) {
    return this.interviewService.getMyInterviews(req.user.userId, status);
  }

  @Get('interviews')
  @Permissions(P.RECRUITMENT_INTERVIEWS_VIEW)
  async listInterviews(@Query('legal_entity_id') legalEntityId: string) {
    if (!legalEntityId?.trim()) {
      throw new BadRequestException('legal_entity_id query parameter is required');
    }
    return this.interviewService.listInterviews(legalEntityId.trim());
  }

  // ==========================================
  // OFFERS
  // ==========================================

  @Get('offers/options')
  @AnyPermissions(
    P.RECRUITMENT_OFFERS_VIEW,
    P.RECRUITMENT_ONBOARDING_CREATE,
    P.RECRUITMENT_ONBOARDING_VIEW,
  )
  async getOfferOptions(
    @Query('legal_entity_id') legalEntityId?: string,
    @Query('search') search?: string,
    @Query('accepted_only') acceptedOnlyRaw?: string,
  ) {
    const acceptedOnly = ['1', 'true', 'yes', 'on'].includes(
      String(acceptedOnlyRaw ?? '').toLowerCase(),
    );
    return this.recruitmentLookupService.listOfferOptions({
      legalEntityId,
      search,
      acceptedOnly,
    });
  }

  @Post('offers')
  @Permissions(P.RECRUITMENT_OFFERS_CREATE)
  async createOffer(@Body() body: any, @Request() req: any) {
    const offerId = await this.offerService.createOffer(
      body.application_id,
      body,
      req.user.userId,
    );
    return { offer_id: offerId };
  }

  @Post('offers/:offerId/approve')
  @Permissions(P.RECRUITMENT_OFFERS_APPROVE)
  async approveOffer(@Param('offerId') offerId: string, @Request() req: any) {
    await this.offerService.approveOffer(offerId, req.user.userId);
    return { status: 'approved' };
  }

  @Post('offers/:offerId/send')
  @Permissions(P.RECRUITMENT_OFFERS_SEND)
  async sendOffer(@Param('offerId') offerId: string, @Body() body: any) {
    await this.offerService.sendOffer(offerId, body.offer_letter_path);
    return { status: 'sent' };
  }

  @Post('offers/:offerId/accept')
  async acceptOffer(@Param('offerId') offerId: string) {
    await this.offerService.acceptOffer(offerId);
    return { status: 'accepted' };
  }

  @Post('offers/:offerId/decline')
  async declineOffer(@Param('offerId') offerId: string, @Body() body: any) {
    await this.offerService.declineOffer(offerId, body.decline_reason);
    return { status: 'declined' };
  }

  @Get('offers/:offerId')
  @Permissions(P.RECRUITMENT_OFFERS_VIEW)
  async getOfferDetails(@Param('offerId') offerId: string) {
    return this.offerService.getOfferDetails(offerId);
  }

  @Get('applications/:applicationId/offers')
  @Permissions(P.RECRUITMENT_OFFERS_VIEW)
  async getOffersForApplication(@Param('applicationId') applicationId: string) {
    return this.offerService.getOffersForApplication(applicationId);
  }

  @Get('offers')
  @Permissions(P.RECRUITMENT_OFFERS_VIEW)
  async getPendingOffers(@Query('legal_entity_id') legalEntityId?: string) {
    return this.offerService.getPendingOffers(legalEntityId);
  }

  // ==========================================
  // ONBOARDING
  // ==========================================

  @Post('onboarding')
  @Permissions(P.RECRUITMENT_ONBOARDING_CREATE)
  async createOnboardingWorkflow(@Body() body: Record<string, unknown>, @Request() req: any) {
    return this.onboardingService.createOnboardingWorkflow(body, req.user.userId);
  }

  @Post('onboarding/tasks/:taskId/complete')
  @Permissions(P.RECRUITMENT_ONBOARDING_COMPLETE_TASKS)
  async completeOnboardingTask(
    @Param('taskId') taskId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    await this.onboardingService.completeTask(taskId, req.user.userId, body.notes || null);
    return { status: 'completed' };
  }

  @Post('onboarding/:workflowId/documents')
  @Permissions(P.RECRUITMENT_ONBOARDING_MANAGE_DOCUMENTS)
  async addRequiredDocument(
    @Param('workflowId') workflowId: string,
    @Body() body: any,
  ) {
    const documentId = await this.onboardingService.addRequiredDocument(
      workflowId,
      body.document_type,
      body.document_name,
      body.is_required || true,
    );
    return { document_id: documentId };
  }

  @Post('onboarding/documents/:documentId/upload')
  @Permissions(P.RECRUITMENT_ONBOARDING_UPLOAD_DOCUMENTS)
  async uploadDocument(
    @Param('documentId') documentId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    await this.onboardingService.uploadDocument(documentId, body.file_path, req.user.userId);
    return { status: 'uploaded' };
  }

  @Post('onboarding/documents/:documentId/verify')
  @Permissions(P.RECRUITMENT_ONBOARDING_VERIFY_DOCUMENTS)
  async verifyDocument(@Param('documentId') documentId: string, @Request() req: any) {
    await this.onboardingService.verifyDocument(documentId, req.user.userId);
    return { status: 'verified' };
  }

  @Post('onboarding/:workflowId/equipment')
  @Permissions(P.RECRUITMENT_ONBOARDING_MANAGE_EQUIPMENT)
  async addEquipment(@Param('workflowId') workflowId: string, @Body() body: any) {
    const equipmentId = await this.onboardingService.addEquipment(
      workflowId,
      body.equipment_type,
      body.equipment_description,
      body.is_required || true,
    );
    return { equipment_id: equipmentId };
  }

  @Post('onboarding/equipment/:equipmentId/assign')
  @Permissions(P.RECRUITMENT_ONBOARDING_ASSIGN_EQUIPMENT)
  async assignEquipment(
    @Param('equipmentId') equipmentId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    await this.onboardingService.assignEquipment(
      equipmentId,
      body.serial_number || null,
      req.user.userId,
    );
    return { status: 'assigned' };
  }

  @Post('onboarding/:workflowId/access')
  @Permissions(P.RECRUITMENT_ONBOARDING_MANAGE_ACCESS)
  async addSystemAccess(@Param('workflowId') workflowId: string, @Body() body: any) {
    const accessId = await this.onboardingService.addSystemAccess(
      workflowId,
      body.system_name,
      body.access_level,
      body.is_required || true,
    );
    return { access_id: accessId };
  }

  @Post('onboarding/access/:accessId/provision')
  @Permissions(P.RECRUITMENT_ONBOARDING_PROVISION_ACCESS)
  async provisionAccess(
    @Param('accessId') accessId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    await this.onboardingService.provisionAccess(accessId, body.username, req.user.userId);
    return { status: 'provisioned' };
  }

  @Get('onboarding')
  @Permissions(P.RECRUITMENT_ONBOARDING_VIEW)
  async listOnboardingWorkflows(@Query('legal_entity_id') legalEntityId?: string) {
    return this.onboardingService.listOnboardingWorkflows(legalEntityId);
  }

  @Get('onboarding/:workflowId')
  @Permissions(P.RECRUITMENT_ONBOARDING_VIEW)
  async getOnboardingWorkflow(@Param('workflowId') workflowId: string) {
    return this.onboardingService.getOnboardingWorkflow(workflowId);
  }

  @Get('onboarding/tasks/my-tasks')
  @Permissions(P.RECRUITMENT_ONBOARDING_VIEW)
  async getMyOnboardingTasks(@Request() req: any) {
    return this.onboardingService.getMyOnboardingTasks(req.user.userId);
  }
}
