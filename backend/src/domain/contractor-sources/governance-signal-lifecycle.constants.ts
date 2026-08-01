import {
  ContractorSourceDriftType,
  GovernanceOperationalImpact,
  GovernanceSignalCategory,
  GovernanceSignalOwner,
} from '@prisma/client';

/** Default bootstrap signal TTL from detection (days). */
export const DEFAULT_BOOTSTRAP_SIGNAL_TTL_DAYS = 30;

export type GovernanceSignalClassification = {
  signalCategory: GovernanceSignalCategory;
  detectedPhase: GovernanceSignalCategory;
  suppressAfterCutover: boolean;
  lineageOnly: boolean;
  operationalImpact: GovernanceOperationalImpact;
  governanceOwner: GovernanceSignalOwner;
};

const OPERATIONAL_UNSponsored: GovernanceSignalClassification = {
  signalCategory: GovernanceSignalCategory.OPERATIONAL,
  detectedPhase: GovernanceSignalCategory.OPERATIONAL,
  suppressAfterCutover: false,
  lineageOnly: false,
  operationalImpact: GovernanceOperationalImpact.ACTIVE,
  governanceOwner: GovernanceSignalOwner.OPERATIONS,
};

const BOOTSTRAP_MIGRATION: GovernanceSignalClassification = {
  signalCategory: GovernanceSignalCategory.BOOTSTRAP,
  detectedPhase: GovernanceSignalCategory.BOOTSTRAP,
  suppressAfterCutover: true,
  lineageOnly: false,
  operationalImpact: GovernanceOperationalImpact.LIMITED,
  governanceOwner: GovernanceSignalOwner.MIGRATION,
};

const BOOTSTRAP_LINEAGE: GovernanceSignalClassification = {
  ...BOOTSTRAP_MIGRATION,
  lineageOnly: true,
  operationalImpact: GovernanceOperationalImpact.NONE,
};

export const CONTRACTOR_DRIFT_SIGNAL_CLASSIFICATION: Record<
  ContractorSourceDriftType,
  GovernanceSignalClassification
> = {
  [ContractorSourceDriftType.MISSING_RESPONSIBLE_MANAGER]: OPERATIONAL_UNSponsored,
  [ContractorSourceDriftType.GOVERNANCE_LIFECYCLE_CONFLICT]: {
    ...BOOTSTRAP_MIGRATION,
    operationalImpact: GovernanceOperationalImpact.LIMITED,
  },
  [ContractorSourceDriftType.PERSON_CORRELATION_CONFLICT]: BOOTSTRAP_MIGRATION,
  [ContractorSourceDriftType.DUPLICATE_PERSON_ANCHOR]: BOOTSTRAP_MIGRATION,
  [ContractorSourceDriftType.SUPPLIER_LINK_MISSING]: BOOTSTRAP_MIGRATION,
  [ContractorSourceDriftType.CHECKPOINT_GAP]: BOOTSTRAP_MIGRATION,
  [ContractorSourceDriftType.WORKER_SOURCE_DRIFT]: BOOTSTRAP_LINEAGE,
};
