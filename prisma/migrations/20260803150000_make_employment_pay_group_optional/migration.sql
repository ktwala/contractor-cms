-- HCM employments may exist before payroll enrollment.
-- Payroll eligibility remains defined by a non-null pay_group_id.
ALTER TABLE "employments" ALTER COLUMN "pay_group_id" DROP NOT NULL;
