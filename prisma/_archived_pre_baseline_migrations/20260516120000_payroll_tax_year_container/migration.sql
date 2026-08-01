-- PR-PAYROLL-CONTAINER-1 — Payroll tax-year governance shell + optional PayPeriod.payroll_id

CREATE TYPE "PayrollTaxYearStatus" AS ENUM ('PLANNING', 'ACTIVE', 'CLOSED', 'ARCHIVED');

CREATE TABLE "payrolls" (
    "id" TEXT NOT NULL,
    "pay_group_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "tax_year_start" DATE NOT NULL,
    "tax_year_end" DATE NOT NULL,
    "status" "PayrollTaxYearStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payrolls_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payrolls_pay_group_id_idx" ON "payrolls"("pay_group_id");

ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_pay_group_id_fkey" FOREIGN KEY ("pay_group_id") REFERENCES "pay_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pay_periods" ADD COLUMN "payroll_id" TEXT;

CREATE INDEX "pay_periods_payroll_id_idx" ON "pay_periods"("payroll_id");

ALTER TABLE "pay_periods" ADD CONSTRAINT "pay_periods_payroll_id_fkey" FOREIGN KEY ("payroll_id") REFERENCES "payrolls"("id") ON DELETE SET NULL ON UPDATE CASCADE;
