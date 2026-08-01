import { ConfigService } from '@nestjs/config';
import {
  isResponsibleManagerAccountabilityInboxEnabled,
  SPONSOR_ACCOUNTABILITY_INBOX_ENV,
} from './responsible-manager-accountability.config';

describe('responsible-manager-accountability.config', () => {
  const config = (value: string | undefined) =>
    ({
      get: (key: string) =>
        key === SPONSOR_ACCOUNTABILITY_INBOX_ENV ? value : undefined,
    }) as ConfigService;

  it('is false when env unset', () => {
    expect(isResponsibleManagerAccountabilityInboxEnabled(config(undefined))).toBe(false);
  });

  it('is false when env is not true', () => {
    expect(isResponsibleManagerAccountabilityInboxEnabled(config('false'))).toBe(false);
  });

  it('is true only when env is true', () => {
    expect(isResponsibleManagerAccountabilityInboxEnabled(config('true'))).toBe(true);
  });
});
