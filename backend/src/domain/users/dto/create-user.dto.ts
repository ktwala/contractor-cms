import { IsString, IsEmail, IsEnum, IsOptional } from 'class-validator';
import { UserType } from '@prisma/client';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEnum(UserType)
  @IsOptional()
  userType?: UserType;
}
