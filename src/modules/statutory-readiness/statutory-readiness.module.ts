import { Module } from '@nestjs/common';
import { StatutoryBootstrapReadinessService } from './statutory-bootstrap-readiness.service';

@Module({
  providers: [StatutoryBootstrapReadinessService],
  exports: [StatutoryBootstrapReadinessService],
})
export class StatutoryReadinessModule {}
