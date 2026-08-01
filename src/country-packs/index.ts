// Interfaces
export * from './interfaces/country-pack.interface';
export * from './interfaces/compute-contract.interface';

// Registry
export * from './country-pack.registry';
export * from './country-packs.module';

// Services - explicitly export to avoid duplicate interface conflicts
export { TaxTableValidatorService } from './services/tax-table-validator.service';
export type { TaxTableData } from './services/tax-table-validator.service';
// Re-export validator-specific interfaces with different names to avoid conflicts
export type {
  TaxBracket as ValidatorTaxBracket,
  ValidationResult as ValidatorValidationResult,
  ValidationError as ValidatorValidationError,
  ValidationWarning as ValidatorValidationWarning,
} from './services/tax-table-validator.service';
export * from './services/pack-router.service';

// Utility packs (tax validation, exports, etc.)
export * from './lesotho/lesotho.pack';
export * from './south-africa/south-africa.pack';

// Compute packs (payroll calculation)
export * from './lesotho/lesotho-compute.pack';
export * from './south-africa/south-africa-compute.pack';
