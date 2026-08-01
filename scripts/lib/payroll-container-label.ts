import type { Country, PayFrequency } from '@prisma/client';

export function payrollContainerLabel(args: {
  country: Country;
  frequency: PayFrequency;
  payGroupCode: string;
  windowLabel: string;
}): string {
  return `${args.country} FY${args.windowLabel} · ${args.frequency} · ${args.payGroupCode}`;
}
