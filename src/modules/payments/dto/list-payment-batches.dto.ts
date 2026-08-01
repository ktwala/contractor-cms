import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class ListPaymentBatchesDto {
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() legalEntityId?: string;
  @IsOptional() @IsString() payGroupId?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() exportStatus?: string;
  @IsOptional() @IsString() payrunId?: string;

  @IsOptional() @Type(() => Number) @IsInt() page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() pageSize?: number = 25;
}
