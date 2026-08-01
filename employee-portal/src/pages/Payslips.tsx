import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { format } from 'date-fns';
import type { PayslipSummary } from '../types';
import * as styles from '../styles/common';

export default function Payslips() {
  const [payslips, setPayslips] = useState<PayslipSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadPayslips();
  }, [selectedYear]);

  const loadPayslips = async () => {
    try {
      setLoading(true);
      const response = await api.get('/self-service/payslips', {
        params: { year: selectedYear, limit: 50 },
      });
      setPayslips(response.data.payslips || []);
    } catch (error) {
      console.error('Failed to load payslips:', error);
      // Demo data
      setPayslips([
        { id: '1', period_start: '2026-01-01', period_end: '2026-01-31', pay_date: '2026-01-25', gross: 45000, net: 32850, currency: 'ZAR' },
        { id: '2', period_start: '2025-12-01', period_end: '2025-12-31', pay_date: '2025-12-25', gross: 45000, net: 32850, currency: 'ZAR' },
        { id: '3', period_start: '2025-11-01', period_end: '2025-11-30', pay_date: '2025-11-25', gross: 45000, net: 32850, currency: 'ZAR' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
  };

  const handleDownload = async (payslipId: string) => {
    try {
      const response = await api.get(`/self-service/payslips/${payslipId}/download`, {
        params: { format: 'PDF' },
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `payslip-${payslipId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download payslip:', error);
      alert('Failed to download payslip');
    }
  };

  const handleView = async (payslipId: string) => {
    try {
      const response = await api.get(`/self-service/payslips/${payslipId}/download`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'text/html' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      // Revoke after a delay so the new tab can load it
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error('Failed to view payslip:', error);
      alert('Failed to view payslip');
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  if (loading) {
    return (
      <div style={styles.pageContainer}>
        <div style={styles.loadingContainer}>
          <div style={styles.loadingSpinner}></div>
          <p style={{ color: styles.colors.textSecondary }}>Loading payslips...</p>
        </div>
        <style>{styles.spinKeyframes}</style>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer}>
      {/* Header */}
      <div style={{ ...styles.flexBetween, ...styles.pageHeader }}>
        <div>
          <h1 style={styles.pageTitle}>Payslips</h1>
          <p style={styles.pageSubtitle}>View and download your payment history</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <a
            href="/payslip-sample.html"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...styles.buttonSecondary,
              padding: '0.5rem 1rem',
              fontSize: '0.8rem',
              textDecoration: 'none',
            }}
          >
            Preview sample
          </a>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            style={{
              ...styles.formSelect,
              width: 'auto',
              padding: '0.625rem 2.5rem 0.625rem 1rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {years.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      {payslips.length === 0 ? (
        <div style={{ ...styles.card, ...styles.emptyState }}>
          <svg style={styles.emptyStateIcon} width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 style={styles.emptyStateTitle}>No payslips found</h3>
          <p style={styles.emptyStateText}>No payslips available for {selectedYear}</p>
        </div>
      ) : (
        <div style={{ ...styles.card, padding: 0, overflow: 'hidden' }}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeader}>
                <th style={styles.tableHeaderCell}>Period</th>
                <th style={styles.tableHeaderCell}>Pay Date</th>
                <th style={{ ...styles.tableHeaderCell, textAlign: 'right' }}>Gross</th>
                <th style={{ ...styles.tableHeaderCell, textAlign: 'right' }}>Net</th>
                <th style={{ ...styles.tableHeaderCell, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payslips.map((payslip, index) => (
                <tr
                  key={payslip.id}
                  style={{
                    ...styles.tableRow,
                    borderBottom: index === payslips.length - 1 ? 'none' : `1px solid ${styles.colors.borderLight}`,
                  }}
                  className="hover-row"
                >
                  <td style={styles.tableCell}>
                    <div style={{ fontWeight: 500, color: styles.colors.textPrimary }}>
                      {format(new Date(payslip.period_end), 'MMMM yyyy')}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: styles.colors.textMuted, marginTop: '0.25rem' }}>
                      {format(new Date(payslip.period_start), 'dd MMM')} - {format(new Date(payslip.period_end), 'dd MMM')}
                    </div>
                  </td>
                  <td style={styles.tableCell}>
                    <span style={{ color: styles.colors.textSecondary }}>
                      {format(new Date(payslip.pay_date), 'dd MMM yyyy')}
                    </span>
                  </td>
                  <td style={{ ...styles.tableCell, textAlign: 'right' }}>
                    <span style={{ color: styles.colors.textSecondary }}>
                      {formatCurrency(payslip.gross)}
                    </span>
                  </td>
                  <td style={{ ...styles.tableCell, textAlign: 'right' }}>
                    <span style={{ fontWeight: 600, color: styles.colors.textPrimary, fontSize: '1rem' }}>
                      {formatCurrency(payslip.net)}
                    </span>
                  </td>
                  <td style={{ ...styles.tableCell, textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => handleView(payslip.id)}
                        style={{
                          ...styles.buttonSecondary,
                          padding: '0.5rem 1rem',
                          fontSize: '0.8rem',
                        }}
                      >
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View
                      </button>
                      <button
                        onClick={() => handleDownload(payslip.id)}
                        style={{
                          ...styles.buttonPrimary,
                          padding: '0.5rem 1rem',
                          fontSize: '0.8rem',
                        }}
                      >
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        ${styles.spinKeyframes}
        .hover-row:hover {
          background: ${styles.colors.background};
        }
      `}</style>
    </div>
  );
}
