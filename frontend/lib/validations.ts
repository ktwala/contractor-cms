/**
 * Validation schemas using Zod for form validation
 */

import { z } from 'zod';

// Common validation rules
export const emailSchema = z.string().email('Invalid email address');
export const phoneSchema = z.string().regex(/^\+?[0-9\s\-()]+$/, 'Invalid phone number').optional().or(z.literal(''));
export const requiredString = z.string().min(1, 'This field is required');
export const optionalString = z.string().optional();
export const dateSchema = z.string().min(1, 'Date is required');
export const optionalDateSchema = z.string().optional().or(z.literal(''));

// Contractor validation schema
export const contractorSchema = z.object({
  supplierId: requiredString,
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: emailSchema,
  phone: phoneSchema,
  taxNumber: z.string().optional().or(z.literal('')),
  idNumber: z.string().optional().or(z.literal('')),
  dateOfBirth: optionalDateSchema,
  nationality: z.string().optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'INACTIVE']),
});

export type ContractorFormData = z.infer<typeof contractorSchema>;

// Contract validation schema
export const contractSchema = z.object({
  contractorId: requiredString,
  supplierId: requiredString,
  contractNumber: z.string().min(3, 'Contract number must be at least 3 characters'),
  title: z.string().min(3, 'Title must be at least 3 characters'),
  type: z.enum(['FIXED_TERM', 'INDEFINITE', 'PROJECT_BASED']),
  startDate: dateSchema,
  endDate: optionalDateSchema,
  rate: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: 'Rate must be a positive number',
  }),
  rateType: z.enum(['HOURLY', 'DAILY', 'MONTHLY', 'FIXED']),
  currency: z.string().min(3, 'Currency code is required'),
  status: z.enum(['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED']),
}).refine(
  (data) => {
    if (data.endDate && data.startDate) {
      return new Date(data.endDate) > new Date(data.startDate);
    }
    return true;
  },
  {
    message: 'End date must be after start date',
    path: ['endDate'],
  }
);

export type ContractFormData = z.infer<typeof contractSchema>;

// Engagement validation schema
export const engagementSchema = z.object({
  contractId: requiredString,
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: optionalString,
  startDate: dateSchema,
  endDate: optionalDateSchema,
  rate: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: 'Rate must be a positive number',
  }),
  rateType: z.enum(['HOURLY', 'DAILY', 'MONTHLY', 'FIXED']),
  currency: z.string().min(3, 'Currency code is required'),
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']),
}).refine(
  (data) => {
    if (data.endDate && data.startDate) {
      return new Date(data.endDate) > new Date(data.startDate);
    }
    return true;
  },
  {
    message: 'End date must be after start date',
    path: ['endDate'],
  }
);

export type EngagementFormData = z.infer<typeof engagementSchema>;

// Project validation schema
export const projectSchema = z.object({
  name: z.string().min(3, 'Project name must be at least 3 characters'),
  code: z.string().min(3, 'Project code must be at least 3 characters'),
  description: optionalString,
  startDate: dateSchema,
  endDate: optionalDateSchema,
  budget: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: 'Budget must be a positive number',
  }),
  currency: z.string().min(3, 'Currency code is required'),
  status: z.enum(['ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED']),
}).refine(
  (data) => {
    if (data.endDate && data.startDate) {
      return new Date(data.endDate) > new Date(data.startDate);
    }
    return true;
  },
  {
    message: 'End date must be after start date',
    path: ['endDate'],
  }
);

export type ProjectFormData = z.infer<typeof projectSchema>;

// Timesheet entry validation
export const timesheetEntrySchema = z.object({
  date: dateSchema,
  hours: z.number().min(0.1, 'Hours must be at least 0.1').max(24, 'Hours cannot exceed 24'),
  description: z.string().min(1, 'Description is required'),
});

// Timesheet validation schema
export const timesheetSchema = z.object({
  engagementId: requiredString,
  projectId: optionalString,
  periodStart: dateSchema,
  periodEnd: dateSchema,
  entries: z.array(timesheetEntrySchema).min(1, 'At least one entry is required'),
}).refine(
  (data) => {
    return new Date(data.periodEnd) >= new Date(data.periodStart);
  },
  {
    message: 'Period end must be on or after period start',
    path: ['periodEnd'],
  }
);

export type TimesheetFormData = z.infer<typeof timesheetSchema>;

// Invoice validation schema
export const invoiceSchema = z.object({
  engagementId: requiredString,
  invoiceNumber: z.string().min(3, 'Invoice number must be at least 3 characters'),
  issueDate: dateSchema,
  dueDate: dateSchema,
  notes: optionalString,
  taxRate: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
    message: 'Tax rate must be a positive number or zero',
  }),
  timesheetIds: z.array(z.string()).min(1, 'Select at least one timesheet'),
}).refine(
  (data) => {
    return new Date(data.dueDate) > new Date(data.issueDate);
  },
  {
    message: 'Due date must be after issue date',
    path: ['dueDate'],
  }
);

export type InvoiceFormData = z.infer<typeof invoiceSchema>;

// Login validation schema
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// Register validation schema
export const registerSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
  organizationName: z.string().min(2, 'Organization name must be at least 2 characters'),
  organizationCode: z.string().min(2, 'Organization code must be at least 2 characters'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export type RegisterFormData = z.infer<typeof registerSchema>;

// Supplier validation schema
export const supplierSchema = z.object({
  type: z.enum(['INDIVIDUAL', 'COMPANY']),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  companyName: z.string().optional(),
  email: emailSchema,
  phone: phoneSchema,
  taxNumber: z.string().optional().or(z.literal('')),
  registrationNumber: z.string().optional().or(z.literal('')),
  bankName: z.string().optional().or(z.literal('')),
  accountNumber: z.string().optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'INACTIVE']),
}).refine(
  (data) => {
    if (data.type === 'INDIVIDUAL') {
      return !!data.firstName && !!data.lastName;
    }
    return !!data.companyName;
  },
  {
    message: 'Individual suppliers require first and last name, company suppliers require company name',
    path: ['type'],
  }
);

export type SupplierFormData = z.infer<typeof supplierSchema>;
