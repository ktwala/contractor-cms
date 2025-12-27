import { PartialType } from '@nestjs/swagger';
import { CreateContractorDto } from './create-contractor.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateContractorDto extends PartialType(CreateContractorDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
