import { Module } from '@nestjs/common';
import { RecruitmentController } from './recruitment.controller';
import { JobRequisitionService } from './services/job-requisition.service';
import { CandidateService } from './services/candidate.service';
import { InterviewService } from './services/interview.service';
import { OfferService } from './services/offer.service';
import { OnboardingService } from './services/onboarding.service';
import { RecruitmentLookupService } from './services/recruitment-lookup.service';
import { RecruitmentFilesService } from './services/recruitment-files.service';

@Module({
  controllers: [RecruitmentController],
  providers: [
    JobRequisitionService,
    CandidateService,
    InterviewService,
    OfferService,
    OnboardingService,
    RecruitmentLookupService,
    RecruitmentFilesService,
  ],
  exports: [
    JobRequisitionService,
    CandidateService,
    InterviewService,
    OfferService,
    OnboardingService,
  ],
})
export class RecruitmentModule {}
