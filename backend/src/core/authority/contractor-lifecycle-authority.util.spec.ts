import { ContractorAuthorityMode } from '@prisma/client';
import {
  isUpstreamHcmLifecycleDriftEnabled,
  isUpstreamHcmWorkerSourceDriftEnabled,
} from './contractor-lifecycle-authority.util';

describe('contractor-lifecycle-authority.util', () => {
  it('enables upstream lifecycle drift only for HCM_ONLY tenants', () => {
    expect(isUpstreamHcmLifecycleDriftEnabled(ContractorAuthorityMode.HCM_ONLY)).toBe(true);
    expect(isUpstreamHcmLifecycleDriftEnabled(ContractorAuthorityMode.CMS_ONLY)).toBe(false);
    expect(isUpstreamHcmLifecycleDriftEnabled(ContractorAuthorityMode.HYBRID)).toBe(false);
  });

  it('enables upstream worker source drift only for HCM_ONLY tenants', () => {
    expect(isUpstreamHcmWorkerSourceDriftEnabled(ContractorAuthorityMode.HCM_ONLY)).toBe(true);
    expect(isUpstreamHcmWorkerSourceDriftEnabled(ContractorAuthorityMode.CMS_ONLY)).toBe(false);
    expect(isUpstreamHcmWorkerSourceDriftEnabled(ContractorAuthorityMode.HYBRID)).toBe(false);
  });
});
