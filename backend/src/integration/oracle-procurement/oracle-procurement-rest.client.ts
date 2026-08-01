import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OracleProcurementFetchInput,
  OracleProcurementFetchResult,
  OracleProcurementTestConnectionInput,
  OracleProcurementTestConnectionResult,
} from './oracle-procurement.types';
import { mapOracleProcurementItems } from './oracle-procurement.mapper';
import { OracleProcurementUpstreamException } from './oracle-procurement-upstream.errors';

/**
 * PR-CMS-CONNECTOR-1A — Oracle Procurement REST client (normalized output only).
 */
export interface OracleProcurementRestClient {
  fetchSuppliers(
    input: OracleProcurementFetchInput,
  ): Promise<OracleProcurementFetchResult>;

  testConnection(
    input: OracleProcurementTestConnectionInput,
  ): Promise<OracleProcurementTestConnectionResult>;

  isEnabled(): boolean;
}

@Injectable()
export class HttpOracleProcurementRestClient implements OracleProcurementRestClient {
  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return this.config.get<string>('ORACLE_PROCUREMENT_REST_ENABLED') === 'true';
  }

  async testConnection(
    _input: OracleProcurementTestConnectionInput,
  ): Promise<OracleProcurementTestConnectionResult> {
    if (!this.isEnabled()) {
      return {
        ok: false,
        errorCode: 'DISABLED',
        message:
          'Oracle Procurement REST is disabled. Set ORACLE_PROCUREMENT_REST_ENABLED=true.',
      };
    }

    const baseUrl = this.baseUrl();
    if (!baseUrl) {
      return {
        ok: false,
        errorCode: 'MISCONFIGURED',
        message: 'ORACLE_PROCUREMENT_REST_BASE_URL is required',
      };
    }

    try {
      const url = this.buildSuppliersUrl(baseUrl, { limit: 1 });
      const { status } = await this.fetchPage(url);
      if (status === 401 || status === 403) {
        return {
          ok: false,
          statusCode: status,
          errorCode: 'AUTH_FAILED',
          message: `Oracle Procurement REST returned ${status}`,
        };
      }
      if (status === 429) {
        return {
          ok: false,
          statusCode: status,
          errorCode: 'RATE_LIMITED',
          message: 'Oracle Procurement REST rate limited',
        };
      }
      if (!status || status >= 500) {
        return {
          ok: false,
          statusCode: status,
          errorCode: 'UPSTREAM_ERROR',
          message: `Oracle Procurement REST returned ${status}`,
        };
      }
      return { ok: status >= 200 && status < 300, statusCode: status };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      return {
        ok: false,
        errorCode: 'UPSTREAM_UNAVAILABLE',
        message,
      };
    }
  }

  async fetchSuppliers(
    input: OracleProcurementFetchInput,
  ): Promise<OracleProcurementFetchResult> {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException(
        'Oracle Procurement REST is disabled. Set ORACLE_PROCUREMENT_REST_ENABLED=true.',
      );
    }

    const baseUrl = this.baseUrl();
    if (!baseUrl) {
      throw new BadRequestException('ORACLE_PROCUREMENT_REST_BASE_URL is required');
    }

    const url = this.buildSuppliersUrl(baseUrl, {
      limit: input.pageSize ?? this.pageLimit(),
      since: input.since,
      cursor: input.cursor ?? undefined,
    });

    const page = await this.fetchPage(url);
    const records = mapOracleProcurementItems(page.body);
    const checkpointTo = new Date();
    const nextCursor = this.resolveNextCursor(page.body);
    const hasMore = nextCursor != null;

    return {
      records,
      nextCursor,
      hasMore,
      checkpointTo,
    };
  }

  private baseUrl(): string | undefined {
    return this.config.get<string>('ORACLE_PROCUREMENT_REST_BASE_URL')?.replace(/\/$/, '');
  }

  private suppliersPath(): string {
    return (
      this.config.get<string>('ORACLE_PROCUREMENT_REST_SUPPLIERS_PATH') ??
      '/fscmRestApi/resources/11.13.18.05/suppliers'
    );
  }

  private pageLimit(): number {
    const raw = this.config.get<string>('ORACLE_PROCUREMENT_REST_PAGE_LIMIT');
    const parsed = raw ? Number.parseInt(raw, 10) : 200;
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 500) : 200;
  }

  private buildSuppliersUrl(
    baseUrl: string,
    opts: { limit: number; since?: Date; cursor?: string },
  ): string {
    if (opts.cursor?.startsWith('http')) {
      return opts.cursor;
    }

    const path = this.suppliersPath();
    const url = new URL(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`);
    url.searchParams.set('onlyData', 'true');
    url.searchParams.set('limit', String(opts.limit));
    if (opts.since) {
      url.searchParams.set('lastUpdateDate', opts.since.toISOString());
    }
    if (opts.cursor && !opts.cursor.startsWith('http')) {
      url.searchParams.set('offset', opts.cursor);
    }
    return url.toString();
  }

  private async fetchPage(url: string): Promise<{ body: unknown; status: number }> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const username = this.config.get<string>('ORACLE_PROCUREMENT_REST_USERNAME');
    const password = this.config.get<string>('ORACLE_PROCUREMENT_REST_PASSWORD');
    if (username && password) {
      headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    }
    const bearer = this.config.get<string>('ORACLE_PROCUREMENT_REST_BEARER_TOKEN');
    if (bearer) {
      headers.Authorization = `Bearer ${bearer}`;
    }

    let response: Response;
    try {
      response = await fetch(url, { method: 'GET', headers });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      throw new OracleProcurementUpstreamException(
        'UPSTREAM_UNAVAILABLE',
        `Oracle Procurement REST request failed: ${message}`,
      );
    }

    const text = await response.text();
    let body: unknown = {};
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        throw new OracleProcurementUpstreamException(
          'UPSTREAM_ERROR',
          'Oracle Procurement REST returned non-JSON response',
          response.status,
        );
      }
    }

    if (response.status === 401 || response.status === 403) {
      throw new OracleProcurementUpstreamException(
        'AUTH_FAILED',
        `Oracle Procurement REST auth failed: ${response.status}`,
        response.status,
      );
    }
    if (response.status === 429) {
      throw new OracleProcurementUpstreamException(
        'RATE_LIMITED',
        'Oracle Procurement REST rate limited',
        response.status,
      );
    }
    if (!response.ok) {
      throw new OracleProcurementUpstreamException(
        response.status >= 500 ? 'UPSTREAM_ERROR' : 'UPSTREAM_ERROR',
        `Oracle Procurement REST ${response.status}: ${text.slice(0, 500)}`,
        response.status,
      );
    }

    return { body, status: response.status };
  }

  private resolveNextCursor(body: unknown): string | null {
    if (!body || typeof body !== 'object') {
      return null;
    }
    const obj = body as Record<string, unknown>;
    if (obj.hasMore !== true) {
      return null;
    }
    const link =
      (obj.next as { href?: string } | undefined)?.href ??
      (obj.links as Array<{ rel?: string; href?: string }> | undefined)?.find(
        (l) => l.rel === 'next',
      )?.href;
    return link ?? null;
  }
}
