-- PR-PAYROLL-CONTAINER-2 — one Payroll shell per pay group + statutory tax-year window.
CREATE UNIQUE INDEX "payrolls_pay_group_tax_year_window_key" ON "payrolls"("pay_group_id", "tax_year_start", "tax_year_end");
