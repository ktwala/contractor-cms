import { Module, Global } from '@nestjs/common';
import { PayslipTemplateService } from './payslip-template.service';
import { PayslipPdfService } from './pdf.service';

@Global()
@Module({
  providers: [PayslipTemplateService, PayslipPdfService],
  exports: [PayslipTemplateService, PayslipPdfService],
})
export class PayslipTemplateModule { }
