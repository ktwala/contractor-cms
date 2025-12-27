import { PartialType } from '@nestjs/swagger';
import { CreateProjectDto } from './create-project.dto';
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  @ApiPropertyOptional({ description: 'Project status (ACTIVE, COMPLETED, ON_HOLD, CANCELLED)' })
  @IsOptional()
  @IsString()
  status?: string;
}
