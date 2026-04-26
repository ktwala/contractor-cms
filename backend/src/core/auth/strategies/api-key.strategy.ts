import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import { ApiKeyService } from '../services/api-key.service';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  constructor(private apiKeyService: ApiKeyService) {
    super();
  }

  async validate(req: Request): Promise<any> {
    const apiKey = this.extractApiKey(req);

    if (!apiKey) {
      throw new UnauthorizedException('API key is missing');
    }

    const apiKeyRecord = await this.apiKeyService.validateApiKey(apiKey);

    return {
      apiKeyId: apiKeyRecord.id,
      scopes: apiKeyRecord.scopes,
      organizationId: apiKeyRecord.organizationId,
    };
  }

  private extractApiKey(req: Request): string | null {
    // Check X-API-Key header
    const headerKey = req.headers['x-api-key'];
    if (headerKey) {
      return Array.isArray(headerKey) ? headerKey[0] : headerKey;
    }

    // Check query parameter (less secure, use sparingly)
    const queryKey = req.query.api_key;
    if (queryKey) {
      return Array.isArray(queryKey) ? queryKey[0] : (queryKey as string);
    }

    return null;
  }
}
