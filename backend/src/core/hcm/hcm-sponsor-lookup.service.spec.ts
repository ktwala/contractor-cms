import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HcmSponsorLookupService } from './hcm-sponsor-lookup.service';

function makeConfig(env: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => env[key],
  } as ConfigService;
}

describe('HcmSponsorLookupService', () => {
  it('is disabled by default — assert is a no-op for any string ids', async () => {
    const svc = new HcmSponsorLookupService(makeConfig({}));
    await expect(
      svc.assertSponsorReferencesAllowed('org-1', {
        sponsorEmployeeId: '!!!',
        sponsorDelegateEmployeeId: 'also-bad',
      }),
    ).resolves.toBeUndefined();
  });

  it('when enabled with pattern, rejects non-matching ids', async () => {
    const svc = new HcmSponsorLookupService(
      makeConfig({
        HCM_SPONSOR_VALIDATION_ENABLED: 'true',
        HCM_SPONSOR_REFERENCE_PATTERN: '^cms:',
      }),
    );
    await expect(
      svc.assertSponsorReferencesAllowed('org-1', {
        sponsorEmployeeId: 'bad',
        sponsorDelegateEmployeeId: null,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('when enabled with pattern, accepts matching ids', async () => {
    const svc = new HcmSponsorLookupService(
      makeConfig({
        HCM_SPONSOR_VALIDATION_ENABLED: 'true',
        HCM_SPONSOR_REFERENCE_PATTERN: '^cms:',
      }),
    );
    await expect(
      svc.assertSponsorReferencesAllowed('org-1', {
        sponsorEmployeeId: 'cms:emp:1',
        sponsorDelegateEmployeeId: 'cms:emp:2',
      }),
    ).resolves.toBeUndefined();
  });

  it('invalid regex pattern causes format check to fail', async () => {
    const svc = new HcmSponsorLookupService(
      makeConfig({
        HCM_SPONSOR_VALIDATION_ENABLED: 'true',
        HCM_SPONSOR_REFERENCE_PATTERN: '[',
      }),
    );
    expect(svc.validateReferenceFormat('any')).toBe(false);
  });
});
