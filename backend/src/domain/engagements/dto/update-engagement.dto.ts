import { PartialType } from '@nestjs/swagger';
import { CreateEngagementDto } from './create-engagement.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateEngagementDto extends PartialType(CreateEngagementDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
