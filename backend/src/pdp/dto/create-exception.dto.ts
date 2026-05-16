import { IsOptional, IsString } from 'class-validator';

export class CreateExceptionDto {
  @IsString()
  evaluationId: string;

  @IsString()
  reasonCode: string;

  @IsString()
  action: string;

  @IsOptional()
  @IsString()
  contextTargetId?: string;

  @IsString()
  justification: string;
}
