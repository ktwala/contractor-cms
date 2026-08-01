import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { HcmResponsibleManagerLookupProvider } from './hcm-responsible-manager-lookup.interface';

/**
 * Default / stub HCM sponsor bridge — configurable, **disabled** unless
 * `HCM_SPONSOR_VALIDATION_ENABLED=true`. No IGA, no certification, no UI.
 */
@Injectable()
export class HcmResponsibleManagerLookupService implements HcmResponsibleManagerLookupProvider {
  constructor(private readonly config: ConfigService) {}

  isValidationEnabled(): boolean {
    return this.config.get<string>('HCM_SPONSOR_VALIDATION_ENABLED') === 'true';
  }

  validateReferenceFormat(employeeId: string): boolean {
    const id = String(employeeId ?? '').trim();
    if (!id || id.length > 2048) return false;
    const pattern = this.config.get<string>('HCM_SPONSOR_REFERENCE_PATTERN');
    if (!pattern?.trim()) return true;
    try {
      return new RegExp(pattern).test(id);
    } catch {
      return false;
    }
  }

  async responsibleManagerExists(_organizationId: string, _employeeId: string): Promise<boolean> {
    // Stub: no outbound HCM call; real providers replace this when wired.
    return true;
  }

  /**
   * When validation is enabled, enforce format (and stub existence) for non-null sponsor ids.
   * When disabled, no-op — sponsor remains opaque to HCM.
   */
  async assertResponsibleManagerReferencesAllowed(
    organizationId: string,
    sponsor: {
      responsibleManagerEmployeeId: string | null;
      responsibleManagerDelegateEmployeeId: string | null;
    },
  ): Promise<void> {
    if (!this.isValidationEnabled()) return;

    const check = async (label: 'responsibleManagerEmployeeId' | 'responsibleManagerDelegateEmployeeId', value: string | null) => {
      if (value == null || value === '') return;
      if (!this.validateReferenceFormat(value)) {
        throw new BadRequestException(
          `${label} rejected by HCM sponsor reference validation (format / pattern)`,
        );
      }
      if (!(await this.responsibleManagerExists(organizationId, value))) {
        throw new BadRequestException(
          `${label} not found for organization in HCM sponsor provider (stub always accepts)`,
        );
      }
    };

    await check('responsibleManagerEmployeeId', sponsor.responsibleManagerEmployeeId);
    await check('responsibleManagerDelegateEmployeeId', sponsor.responsibleManagerDelegateEmployeeId);
  }
}
