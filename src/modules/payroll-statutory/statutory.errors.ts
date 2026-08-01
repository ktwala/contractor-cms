export class StatutoryProfileNotFoundError extends Error {
  constructor(countryCode: string) {
    super(`No statutory profile found for country: ${countryCode}`);
    this.name = 'StatutoryProfileNotFoundError';
  }
}

export class StatutoryReturnGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StatutoryReturnGenerationError';
  }
}

export class StatutoryWorkflowTransitionError extends Error {
  public readonly fromStatus: string;
  public readonly toStatus: string;

  constructor(fromStatus: string, toStatus: string) {
    super(`Invalid workflow transition: ${fromStatus} -> ${toStatus}`);
    this.name = 'StatutoryWorkflowTransitionError';
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
  }
}

export class StatutoryEvidenceGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StatutoryEvidenceGenerationError';
  }
}

export class UnmappedStatutoryLineError extends Error {
  public readonly unmappedCodes: string[];

  constructor(unmappedCodes: string[]) {
    super(`Unmapped statutory line codes found: ${unmappedCodes.join(', ')}`);
    this.name = 'UnmappedStatutoryLineError';
    this.unmappedCodes = unmappedCodes;
  }
}

export class InvalidPayrunStateError extends Error {
  public readonly payrunStatus: string;

  constructor(payrunId: string, payrunStatus: string) {
    super(`PayRun ${payrunId} is in status '${payrunStatus}' which is not eligible for statutory return generation`);
    this.name = 'InvalidPayrunStateError';
    this.payrunStatus = payrunStatus;
  }
}
