import { IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApplyCtcScenarioDto {
  @ApiProperty()
  @IsString()
  runId!: string;

  @ApiProperty()
  @IsString()
  scenarioId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
