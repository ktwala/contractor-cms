import { AcquisitionModel } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

/**
 * ADR-013 — acquisition authority is derived from supplier linkage at canonical creation,
 * not from WorkerClassification.
 */
export function resolveAcquisitionModelFromSupplierId(
  supplierId: string | null | undefined,
): AcquisitionModel {
  return supplierId ? AcquisitionModel.SUPPLIER : AcquisitionModel.INDEPENDENT;
}

/** Supplier-backed intake channels (nominate, portal, admin create with supplier). */
export const SUPPLIER_CHANNEL_ACQUISITION_MODEL = AcquisitionModel.SUPPLIER;

/** Enterprise direct intake — no supplying organisation on the worker record. */
export const INDEPENDENT_CHANNEL_ACQUISITION_MODEL = AcquisitionModel.INDEPENDENT;

export function assertIndependentChannelNotSupplierScoped(
  supplierScopeId: string | null | undefined,
): void {
  if (supplierScopeId) {
    throw new BadRequestException(
      'Independent worker acquisition is not available in supplier portal scope',
    );
  }
}

export function assertAcquisitionModelSupplierConsistency(
  acquisitionModel: AcquisitionModel,
  supplierId: string | null | undefined,
): void {
  const expected = resolveAcquisitionModelFromSupplierId(supplierId);
  if (acquisitionModel !== expected) {
    throw new BadRequestException(
      `acquisitionModel ${acquisitionModel} is inconsistent with supplier linkage`,
    );
  }
}
