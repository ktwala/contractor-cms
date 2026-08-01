import { AcquisitionModel } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import {
  resolveAcquisitionModelFromSupplierId,
  SUPPLIER_CHANNEL_ACQUISITION_MODEL,
  assertIndependentChannelNotSupplierScoped,
} from './acquisition-model.constants';

describe('ADR-013 acquisition model', () => {
  it('maps resolved supplier link to SUPPLIER authority', () => {
    expect(resolveAcquisitionModelFromSupplierId('sup-1')).toBe(
      AcquisitionModel.SUPPLIER,
    );
  });

  it('maps absent supplier link to INDEPENDENT authority', () => {
    expect(resolveAcquisitionModelFromSupplierId(null)).toBe(
      AcquisitionModel.INDEPENDENT,
    );
    expect(resolveAcquisitionModelFromSupplierId(undefined)).toBe(
      AcquisitionModel.INDEPENDENT,
    );
  });

  it('declares supplier channel constant for nominate and portal intake', () => {
    expect(SUPPLIER_CHANNEL_ACQUISITION_MODEL).toBe(AcquisitionModel.SUPPLIER);
  });

  it('rejects independent acquire from supplier portal scope', () => {
    expect(() => assertIndependentChannelNotSupplierScoped('sup-1')).toThrow(
      BadRequestException,
    );
  });
});
