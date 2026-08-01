import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { formatContractorBusinessId } from '../constants/ctr-format';

/**
 * PR-CTR-5 — issues immutable CTR-* under row lock (never derived from HCM).
 */
@Injectable()
export class CtrSequenceService {
  /**
   * Must run inside an open transaction. Locks `ctr_sequence_registry` for org.
   */
  async issueNext(
    tx: Prisma.TransactionClient,
    organizationId: string,
    issuedTo: string,
  ): Promise<string> {
    const org = await tx.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { code: true },
    });
    const orgCode = org.code;

    const locked = await tx.$queryRaw<
      Array<{ nextValue: number; orgCode: string }>
    >`
      SELECT "nextValue", "orgCode"
      FROM ctr_sequence_registry
      WHERE "organizationId" = ${organizationId}
      FOR UPDATE
    `;

    if (locked.length === 0) {
      const first = 1;
      await tx.ctrSequenceRegistry.create({
        data: {
          organizationId,
          orgCode,
          nextValue: first + 1,
          lastIssuedAt: new Date(),
          lastIssuedTo: issuedTo,
        },
      });
      return formatContractorBusinessId(orgCode, first);
    }

    const row = locked[0];
    const issued = row.nextValue;
    await tx.ctrSequenceRegistry.update({
      where: { organizationId },
      data: {
        nextValue: issued + 1,
        lastIssuedAt: new Date(),
        lastIssuedTo: issuedTo,
      },
    });

    return formatContractorBusinessId(row.orgCode, issued);
  }
}
