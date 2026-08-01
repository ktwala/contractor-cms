import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SupplierMembershipRole } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional } from 'class-validator';

export class AssignSupplierPortalMembershipDto {
  @ApiProperty({ example: 'supplier.admin@ewp.demo' })
  @IsEmail()
  userEmail: string;

  @ApiPropertyOptional({ enum: SupplierMembershipRole, default: SupplierMembershipRole.ADMIN })
  @IsOptional()
  @IsEnum(SupplierMembershipRole)
  role?: SupplierMembershipRole;
}

export class SupplierPortalMembershipResponseDto {
  @ApiProperty()
  supplierId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  userEmail: string;

  @ApiProperty({ enum: SupplierMembershipRole })
  role: SupplierMembershipRole;
}
