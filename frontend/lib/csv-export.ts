/**
 * Utility functions for exporting data to CSV
 */

/**
 * Convert an array of objects to CSV string
 */
export function convertToCSV(data: any[], headers: string[]): string {
  if (data.length === 0) return '';

  const headerRow = headers.join(',');
  const rows = data.map((row) => {
    return headers
      .map((header) => {
        const value = row[header];
        // Handle null/undefined
        if (value == null) return '';
        // Handle strings with commas or quotes
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      })
      .join(',');
  });

  return [headerRow, ...rows].join('\n');
}

/**
 * Download CSV file
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Format date for CSV export
 */
export function formatDateForCSV(date: string | Date | undefined | null): string {
  if (!date) return '';
  try {
    return new Date(date).toISOString().split('T')[0];
  } catch {
    return '';
  }
}

/**
 * Format currency for CSV export (without currency symbol)
 */
export function formatCurrencyForCSV(amount: number | undefined | null): string {
  if (amount == null) return '0';
  return amount.toFixed(2);
}

/**
 * Export timesheets to CSV
 */
export function exportTimesheetsToCSV(timesheets: any[]): void {
  const exportData = timesheets.map((ts) => ({
    id: ts.id,
    periodStart: formatDateForCSV(ts.periodStart),
    periodEnd: formatDateForCSV(ts.periodEnd),
    contractor: ts.engagement?.contract?.contractor
      ? `${ts.engagement.contract.contractor.firstName} ${ts.engagement.contract.contractor.lastName}`
      : '',
    engagement: ts.engagement?.title || '',
    project: ts.project?.name || '',
    totalHours: ts.totalHours,
    status: ts.status,
    submittedAt: formatDateForCSV(ts.submittedAt),
    approvedAt: formatDateForCSV(ts.approvedAt),
    rejectionReason: ts.rejectionReason || '',
  }));

  const headers = [
    'id',
    'periodStart',
    'periodEnd',
    'contractor',
    'engagement',
    'project',
    'totalHours',
    'status',
    'submittedAt',
    'approvedAt',
    'rejectionReason',
  ];

  const csv = convertToCSV(exportData, headers);
  const filename = `timesheets_${new Date().toISOString().split('T')[0]}.csv`;
  downloadCSV(csv, filename);
}

/**
 * Export invoices to CSV
 */
export function exportInvoicesToCSV(invoices: any[]): void {
  const exportData = invoices.map((inv) => ({
    invoiceNumber: inv.invoiceNumber,
    contractor: inv.engagement?.contract?.contractor
      ? `${inv.engagement.contract.contractor.firstName} ${inv.engagement.contract.contractor.lastName}`
      : '',
    engagement: inv.engagement?.title || '',
    issueDate: formatDateForCSV(inv.issueDate),
    dueDate: formatDateForCSV(inv.dueDate),
    amount: formatCurrencyForCSV(inv.amount),
    taxAmount: formatCurrencyForCSV(inv.taxAmount),
    totalAmount: formatCurrencyForCSV(inv.totalAmount),
    currency: inv.currency,
    status: inv.status,
    paidAt: formatDateForCSV(inv.paidAt),
    paidAmount: formatCurrencyForCSV(inv.paidAmount),
    paymentReference: inv.paymentReference || '',
  }));

  const headers = [
    'invoiceNumber',
    'contractor',
    'engagement',
    'issueDate',
    'dueDate',
    'amount',
    'taxAmount',
    'totalAmount',
    'currency',
    'status',
    'paidAt',
    'paidAmount',
    'paymentReference',
  ];

  const csv = convertToCSV(exportData, headers);
  const filename = `invoices_${new Date().toISOString().split('T')[0]}.csv`;
  downloadCSV(csv, filename);
}

/**
 * Export contractors to CSV
 */
export function exportContractorsToCSV(contractors: any[]): void {
  const exportData = contractors.map((c) => ({
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone || '',
    taxNumber: c.taxNumber || '',
    idNumber: c.idNumber || '',
    dateOfBirth: formatDateForCSV(c.dateOfBirth),
    nationality: c.nationality || '',
    status: c.status,
    supplier: c.supplier?.companyName || `${c.supplier?.firstName} ${c.supplier?.lastName}`,
  }));

  const headers = [
    'firstName',
    'lastName',
    'email',
    'phone',
    'taxNumber',
    'idNumber',
    'dateOfBirth',
    'nationality',
    'status',
    'supplier',
  ];

  const csv = convertToCSV(exportData, headers);
  const filename = `contractors_${new Date().toISOString().split('T')[0]}.csv`;
  downloadCSV(csv, filename);
}

/**
 * Export contracts to CSV
 */
export function exportContractsToCSV(contracts: any[]): void {
  const exportData = contracts.map((c) => ({
    contractNumber: c.contractNumber,
    title: c.title,
    contractor: c.contractor ? `${c.contractor.firstName} ${c.contractor.lastName}` : '',
    type: c.type,
    startDate: formatDateForCSV(c.startDate),
    endDate: formatDateForCSV(c.endDate),
    rate: formatCurrencyForCSV(c.rate),
    rateType: c.rateType,
    currency: c.currency,
    status: c.status,
  }));

  const headers = [
    'contractNumber',
    'title',
    'contractor',
    'type',
    'startDate',
    'endDate',
    'rate',
    'rateType',
    'currency',
    'status',
  ];

  const csv = convertToCSV(exportData, headers);
  const filename = `contracts_${new Date().toISOString().split('T')[0]}.csv`;
  downloadCSV(csv, filename);
}

/**
 * Export projects to CSV
 */
export function exportProjectsToCSV(projects: any[]): void {
  const exportData = projects.map((p) => ({
    name: p.name,
    code: p.code,
    startDate: formatDateForCSV(p.startDate),
    endDate: formatDateForCSV(p.endDate),
    budget: formatCurrencyForCSV(p.budget),
    totalSpent: formatCurrencyForCSV(p.totalSpent),
    remaining: formatCurrencyForCSV(p.budget - (p.totalSpent || 0)),
    utilization: p.budget > 0 ? ((p.totalSpent || 0) / p.budget * 100).toFixed(2) : '0',
    currency: p.currency,
    status: p.status,
    totalHours: p.totalHours || '0',
    timesheetCount: p.timesheetCount || '0',
    invoiceCount: p.invoiceCount || '0',
  }));

  const headers = [
    'name',
    'code',
    'startDate',
    'endDate',
    'budget',
    'totalSpent',
    'remaining',
    'utilization',
    'currency',
    'status',
    'totalHours',
    'timesheetCount',
    'invoiceCount',
  ];

  const csv = convertToCSV(exportData, headers);
  const filename = `projects_${new Date().toISOString().split('T')[0]}.csv`;
  downloadCSV(csv, filename);
}
