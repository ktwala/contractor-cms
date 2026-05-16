import { IsString, MaxLength, MinLength } from 'class-validator';

export class FailExtidEventDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  reason!: string;
}
