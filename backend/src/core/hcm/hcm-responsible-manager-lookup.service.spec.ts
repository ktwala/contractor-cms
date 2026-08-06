import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HcmResponsibleManagerLookupService } from './hcm-responsible-manager-lookup.service';

function makeConfig(env: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => env[key],
  } as ConfigService;
}

describe('HcmResponsibleManagerLookupService', () => {
  it('is disabled by default — assert is a no-op for any string ids', async () => {
    const svc = new HcmResponsibleManagerLookupService(makeConfig({}));
    await expect(
      svc.assertResponsibleManagerReferencesAllowed('org-1', {
        responsibleManagerEmployeeId: '!!!',
        responsibleManagerDelegateEmployeeId: 'also-bad',
      }),
    ).resolves.toBeUndefined();
  });

  it('when enabled with pattern, rejects non-matching ids', async () => {
    const svc = new HcmResponsibleManagerLookupService(
      makeConfig({
        HCM_SPONSOR_VALIDATION_ENABLED: 'true',
        HCM_SPONSOR_REFERENCE_PATTERN: '^ewp:',
      }),
    );
    await expect(
      svc.assertResponsibleManagerReferencesAllowed('org-1', {
        responsibleManagerEmployeeId: 'bad',
        responsibleManagerDelegateEmployeeId: null,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('when enabled with pattern, accepts matching ids', async () => {
    const svc = new HcmResponsibleManagerLookupService(
      makeConfig({
        HCM_SPONSOR_VALIDATION_ENABLED: 'true',
        HCM_SPONSOR_REFERENCE_PATTERN: '^ewp:',
      }),
    );
    await expect(
      svc.assertResponsibleManagerReferencesAllowed('org-1', {
        responsibleManagerEmployeeId: 'ewp:emp:1',
        responsibleManagerDelegateEmployeeId: 'ewp:emp:2',
      }),
    ).resolves.toBeUndefined();
  });

  it('invalid regex pattern causes format check to fail', async () => {
    const svc = new HcmResponsibleManagerLookupService(
      makeConfig({
        HCM_SPONSOR_VALIDATION_ENABLED: 'true',
        HCM_SPONSOR_REFERENCE_PATTERN: '[',
      }),
    );
    expect(svc.validateReferenceFormat('any')).toBe(false);
  });
});
