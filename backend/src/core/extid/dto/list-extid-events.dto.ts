import { IgaOutboxDeliveryStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class ListExtidEventsDto {
  @IsOptional()
  @IsEnum(IgaOutboxDeliveryStatus)
  status?: IgaOutboxDeliveryStatus = IgaOutboxDeliveryStatus.PENDING;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 50;

  /** Opaque cursor — outbox row id of the last item from the previous page. */
  @IsOptional()
  @IsUUID()
  cursor?: string;
}
