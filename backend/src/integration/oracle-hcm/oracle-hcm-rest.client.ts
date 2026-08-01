import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { HcmExtractRecord } from '../../domain/contractor-migration/types/hcm-extract.types';
import {
  extractOracleRestItems,
  mapOracleWorkerToExtractRecord,
} from '../../domain/contractor-migration/providers/oracle-rest-worker.mapper';
import { HcmOracleUpstreamException } from './oracle-hcm-upstream.errors';

export type HcmOracleFetchInput = {
  organizationId: string;
  since?: string | Date;
  cursor?: string;
};

export type HcmOracleFetchResult = {
  records: HcmExtractRecord[];
  nextCursor: string | null;
  checkpointTo: Date;
};

/**
 * PR-CTR-CONNECTOR-1A — Oracle HCM REST client abstraction.
 */
@Injectable()
export class HttpOracleHcmRestClient {
  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return this.config.get<string>('HCM_ORACLE_REST_ENABLED') === 'true';
  }

  async fetchWorkers(input: HcmOracleFetchInput): Promise<HcmOracleFetchResult> {
    if (!this.isEnabled()) {
      throw new HcmOracleUpstreamException(
        'UPSTREAM_UNAVAILABLE',
        'Oracle HCM REST is disabled',
      );
    }

    const baseUrl = this.config
      .get<string>('HCM_ORACLE_REST_BASE_URL')
      ?.replace(/\/$/, '');
    if (!baseUrl) {
      throw new BadRequestException('HCM_ORACLE_REST_BASE_URL is required');
    }

    const path =
      this.config.get<string>('HCM_ORACLE_REST_WORKERS_PATH') ??
      '/hcmRestApi/resources/11.13.18.05/workers';
    const url = input.cursor
      ? input.cursor
      : this.buildInitialUrl(baseUrl, path, input.since);

    const records: HcmExtractRecord[] = [];
    let nextUrl: string | null = url;

    while (nextUrl) {
      const page = await this.fetchPage(nextUrl);
      const items = extractOracleRestItems(page.body);
      items.forEach((item, index) => {
        records.push(
          mapOracleWorkerToExtractRecord(item, records.length + index + 1),
        );
      });
      nextUrl = this.resolveNextLink(page.body, baseUrl);
    }

    return {
      records,
      nextCursor: nextUrl,
      checkpointTo: new Date(),
    };
  }

  private buildInitialUrl(
    baseUrl: string,
    path: string,
    since?: string | Date,
  ): string {
    const url = new URL(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`);
    url.searchParams.set('onlyData', 'true');
    url.searchParams.set('limit', String(this.pageLimit()));
    if (since) {
      const value = since instanceof Date ? since.toISOString().slice(0, 10) : since;
      url.searchParams.set('effectiveDate', value);
    }
    return url.toString();
  }

  private pageLimit(): number {
    const raw = this.config.get<string>('HCM_ORACLE_REST_PAGE_LIMIT');
    const parsed = raw ? Number.parseInt(raw, 10) : 200;
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 500) : 200;
  }

  private async fetchPage(url: string): Promise<{ body: unknown; status: number }> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const username = this.config.get<string>('HCM_ORACLE_REST_USERNAME');
    const password = this.config.get<string>('HCM_ORACLE_REST_PASSWORD');
    if (username && password) {
      headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    }
    const bearer = this.config.get<string>('HCM_ORACLE_REST_BEARER_TOKEN');
    if (bearer) {
      headers.Authorization = `Bearer ${bearer}`;
    }

    let response: Response;
    try {
      response = await fetch(url, { method: 'GET', headers });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      throw new HcmOracleUpstreamException('UPSTREAM_UNAVAILABLE', message);
    }

    const text = await response.text();
    let body: unknown = {};
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        throw new HcmOracleUpstreamException(
          'UPSTREAM_ERROR',
          'Oracle HCM REST returned non-JSON response',
          response.status,
        );
      }
    }

    if (response.status === 401 || response.status === 403) {
      throw new HcmOracleUpstreamException(
        'AUTH_FAILED',
        `Oracle HCM auth failed (${response.status})`,
        response.status,
      );
    }
    if (response.status === 429) {
      throw new HcmOracleUpstreamException(
        'RATE_LIMITED',
        'Oracle HCM rate limited (429)',
        response.status,
      );
    }
    if (response.status >= 500) {
      throw new HcmOracleUpstreamException(
        'UPSTREAM_ERROR',
        `Oracle HCM upstream error (${response.status})`,
        response.status,
      );
    }
    if (!response.ok) {
      throw new HcmOracleUpstreamException(
        'UPSTREAM_ERROR',
        `Oracle HCM REST ${response.status}: ${text.slice(0, 500)}`,
        response.status,
      );
    }

    return { body, status: response.status };
  }

  private resolveNextLink(body: unknown, baseUrl: string): string | null {
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
    if (!link) {
      return null;
    }
    return link.startsWith('http') ? link : `${baseUrl}${link}`;
  }
}
