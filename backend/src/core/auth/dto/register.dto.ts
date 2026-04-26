import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { UserType } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'User email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'SecurePassword123!',
    description: 'User password (min 8 characters)',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({
    example: 'John',
    description: 'First name',
  })
  @IsString()
  firstName: string;

  @ApiProperty({
    example: 'Doe',
    description: 'Last name',
  })
  @IsString()
  lastName: string;

  @ApiProperty({
    example: 'INTERNAL',
    description: 'User type',
    enum: UserType,
    required: false,
  })
  @IsEnum(UserType)
  @IsOptional()
  userType?: UserType;

  @ApiProperty({
    example: 'org-123',
    description: 'Organization ID (for non-admin users)',
    required: false,
  })
  @IsString()
  @IsOptional()
  organizationId?: string;
}
