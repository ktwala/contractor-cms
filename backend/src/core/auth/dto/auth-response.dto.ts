import { ApiProperty } from '@nestjs/swagger';
import type { TenantAuthorityProfile } from '../../authority/authority.constants';

export class AuthResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT access token',
  })
  accessToken: string;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT refresh token',
  })
  refreshToken: string;

  @ApiProperty({
    example: 'Bearer',
    description: 'Token type',
  })
  tokenType: string = 'Bearer';

  @ApiProperty({
    example: 86400,
    description: 'Token expiration in seconds',
  })
  expiresIn: number;

  @ApiProperty({
    description: 'User information',
  })
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    userType: string;
    organizationId: string | null;
    /** Active SupplierMembership supplier id (supplier-portal users). */
    supplierId?: string | null;
    externalId?: string | null;
    roles: string[];
    effectivePermissions: string[];
    tenantAuthority?: TenantAuthorityProfile;
    responsibleManagerAccountabilityInboxEnabled?: boolean;
  };
}
