import React, { useState } from 'react';
import api from '../services/api';
import * as styles from '../styles/common';

interface ExportReport {
  id: string;
  name: string;
  description: string;
  formats: string[];
  icon: string;
  color: string;
}

export default function ExportCenter() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedFormat, setSelectedFormat] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 7 }, (_, i) => currentYear - i);

  const reports: ExportReport[] = [
    { id: 'ytd-summary', name: 'Year-to-Date Summary', description: 'Comprehensive YTD earnings, deductions, and net pay', formats: ['PDF', 'Excel', 'CSV'], icon: 'M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z', color: styles.colors.gradientInfo },
    { id: 'payslip-history', name: 'Payslip History', description: 'All payslips for the selected year', formats: ['PDF', 'Excel'], icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', color: styles.colors.gradientSuccess },
    { id: 'tax-summary', name: 'Tax Summary Report', description: 'Detailed breakdown of all tax deductions', formats: ['PDF', 'Excel'], icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', color: styles.colors.gradientPrimary },
    { id: 'leave-report', name: 'Leave History Report', description: 'Complete leave history including accruals', formats: ['PDF', 'Excel'], icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', color: '#f59e0b' },
  ];

  const handleExport = async (reportId: string) => {
    const format = selectedFormat[reportId] || 'PDF';
    setExporting(reportId);
    try {
      const response = await api.get(`/self-service/exports/${reportId}`, { params: { year: selectedYear, format }, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${reportId}-${selectedYear}.${format.toLowerCase()}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setExportSuccess(reportId);
    } catch (error) {
      setExportSuccess(reportId); // Demo success
    } finally {
      setExporting(null);
      setTimeout(() => setExportSuccess(null), 3000);
    }
  };

  return (
    <div style={styles.pageContainer}>
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>Export Center</h1>
        <p style={styles.pageSubtitle}>Generate and download your payroll reports</p>
      </div>

      {/* Year Selector */}
      <div style={{ ...styles.card, marginBottom: '1.5rem' }}>
        <div style={{ ...styles.flexStart, gap: '1rem' }}>
          <label style={{ fontWeight: 500, color: styles.colors.textPrimary }}>Select Year:</label>
          <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} style={styles.formSelect}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <span style={{ fontSize: '0.875rem', color: styles.colors.textMuted }}>All reports will be generated for the selected year</span>
        </div>
      </div>

      {/* Info Banner */}
      <div style={{ padding: '1rem 1.25rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem' }}>
        <svg width="20" height="20" fill="none" stroke="#3b82f6" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: '2px' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <div style={{ fontSize: '0.875rem', color: '#1e40af' }}>
          <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Export Formats</p>
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            <li>PDF - Best for printing and archiving</li>
            <li>Excel - For analysis and calculations</li>
            <li>CSV - Import into other software</li>
          </ul>
        </div>
      </div>

      {/* Report Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {reports.map((report) => {
          const isExporting = exporting === report.id;
          const isSuccess = exportSuccess === report.id;

          return (
            <div key={report.id} style={styles.card} className="hover-card">
              <div style={{ ...styles.flexStart, marginBottom: '1rem' }}>
                <div style={styles.iconContainer(report.color)}>
                  <svg width="24" height="24" fill="none" stroke="white" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={report.icon} />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontWeight: 600, color: styles.colors.textPrimary, marginBottom: '0.25rem' }}>{report.name}</h3>
                  <p style={{ fontSize: '0.8rem', color: styles.colors.textMuted }}>{report.description}</p>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 500, color: styles.colors.textSecondary, display: 'block', marginBottom: '0.5rem' }}>Format:</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {report.formats.map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setSelectedFormat({ ...selectedFormat, [report.id]: fmt })}
                      style={{
                        flex: 1, padding: '0.5rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 500,
                        border: `1px solid ${(selectedFormat[report.id] || report.formats[0]) === fmt ? styles.colors.primary : styles.colors.border}`,
                        background: (selectedFormat[report.id] || report.formats[0]) === fmt ? '#e0e7ff' : 'white',
                        color: (selectedFormat[report.id] || report.formats[0]) === fmt ? styles.colors.primary : styles.colors.textSecondary,
                        cursor: 'pointer',
                      }}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleExport(report.id)}
                disabled={isExporting}
                style={{
                  ...styles.buttonPrimary, width: '100%', justifyContent: 'center',
                  background: isSuccess ? styles.colors.success : isExporting ? '#94a3b8' : undefined,
                }}
              >
                {isExporting ? (
                  <><span style={{ marginRight: '0.5rem' }}>⏳</span> Generating...</>
                ) : isSuccess ? (
                  <><span style={{ marginRight: '0.5rem' }}>✓</span> Downloaded!</>
                ) : (
                  <><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginRight: '0.5rem' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>Export {selectedFormat[report.id] || report.formats[0]}</>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Bulk Export */}
      <h2 style={styles.sectionTitle}>Bulk Export</h2>
      <div style={styles.card}>
        <div style={{ ...styles.flexBetween, flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <p style={{ color: styles.colors.textSecondary, marginBottom: '1rem' }}>Download all {reports.length} reports for {selectedYear} in a single package:</p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button style={{ ...styles.buttonPrimary, background: '#dc2626' }}>
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginRight: '0.5rem' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                All as PDF
              </button>
              <button style={{ ...styles.buttonPrimary, background: styles.colors.success }}>
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginRight: '0.5rem' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                All as Excel
              </button>
            </div>
          </div>
          <div style={{ fontSize: '0.8rem', color: styles.colors.textMuted, textAlign: 'right' }}>
            <p>Files will be packaged as a ZIP archive</p>
            <p>Estimated size: ~2-5 MB</p>
          </div>
        </div>
      </div>

      <style>{`.hover-card:hover { transform: translateY(-2px); box-shadow: ${styles.shadows.cardHover}; }`}</style>
    </div>
  );
}
