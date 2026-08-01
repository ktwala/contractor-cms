import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { CreateContractorDto } from './create-contractor.dto';
import { NominateContractorEngagementDto } from './nominate-contractor-engagement.dto';

/** Supplier-backed workforce intake — enters at NOMINATED (PR-WORKFORCE-NOMINATE-1). */
export class NominateContractorDto extends CreateContractorDto {
  @ApiProperty({ type: NominateContractorEngagementDto })
  @ValidateNested()
  @Type(() => NominateContractorEngagementDto)
  engagement: NominateContractorEngagementDto;

  @ApiPropertyOptional({ description: 'Optional note for nomination intake audit trail' })
  @IsOptional()
  @IsString()
  nominationReason?: string;
}
