import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ApproveTimesheetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectTimesheetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
