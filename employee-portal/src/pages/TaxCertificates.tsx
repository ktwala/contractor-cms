import React, { useEffect, useState } from 'react';
import api from '../services/api';
import * as styles from '../styles/common';

interface TaxCertificate {
  id: string;
  tax_year: string;
  certificate_type: string;
  issue_date: string;
  status: string;
}

export default function TaxCertificates() {
  const [certificates, setCertificates] = useState<TaxCertificate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCertificates();
  }, []);

  const loadCertificates = async () => {
    try {
      const response = await api.get('/self-service/tax-certificates');
      setCertificates(response.data.certificates || []);
    } catch (error) {
      console.error('Failed to load certificates:', error);
      // Demo data
      setCertificates([
        { id: '1', tax_year: '2025/2026', certificate_type: 'IRP5', issue_date: '2026-03-01', status: 'Available' },
        { id: '2', tax_year: '2024/2025', certificate_type: 'IRP5', issue_date: '2025-03-01', status: 'Available' },
        { id: '3', tax_year: '2023/2024', certificate_type: 'IRP5', issue_date: '2024-03-01', status: 'Available' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (id: string) => {
    try {
      const response = await api.get(`/self-service/tax-certificates/${id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `irp5-${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to download certificate:', error);
      alert('Failed to download certificate');
    }
  };

  if (loading) {
    return (
      <div style={styles.pageContainer}>
        <div style={styles.loadingContainer}>
          <div style={styles.loadingSpinner}></div>
          <p style={{ color: styles.colors.textSecondary }}>Loading certificates...</p>
        </div>
        <style>{styles.spinKeyframes}</style>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer}>
      {/* Header */}
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>Tax Certificates</h1>
        <p style={styles.pageSubtitle}>Download your IRP5 and other tax documents</p>
      </div>

      {/* Content */}
      {certificates.length === 0 ? (
        <div style={{ ...styles.card, ...styles.emptyState }}>
          <svg style={styles.emptyStateIcon} width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
          </svg>
          <h3 style={styles.emptyStateTitle}>No certificates available</h3>
          <p style={styles.emptyStateText}>Tax certificates will appear here when available</p>
        </div>
      ) : (
        <div style={styles.grid3}>
          {certificates.map((cert) => (
            <div key={cert.id} style={styles.card}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={styles.iconContainer(styles.colors.gradientSuccess)}>
                  <svg width="24" height="24" fill="none" stroke="white" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontWeight: 600, color: styles.colors.textPrimary, fontSize: '1.1rem', marginBottom: '0.25rem' }}>
                    {cert.certificate_type}
                  </h3>
                  <p style={{ color: styles.colors.textSecondary, fontSize: '0.875rem' }}>
                    Tax Year: {cert.tax_year}
                  </p>
                </div>
              </div>

              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: `1px solid ${styles.colors.borderLight}` }}>
                <div style={{ ...styles.flexBetween, marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.8rem', color: styles.colors.textMuted }}>Issue Date</span>
                  <span style={{ fontSize: '0.875rem', color: styles.colors.textSecondary }}>
                    {new Date(cert.issue_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div style={{ ...styles.flexBetween, marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.8rem', color: styles.colors.textMuted }}>Status</span>
                  <span style={styles.badge('success')}>{cert.status}</span>
                </div>
                <button
                  onClick={() => handleDownload(cert.id)}
                  style={{ ...styles.buttonPrimary, width: '100%', justifyContent: 'center' }}
                >
                  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{styles.spinKeyframes}</style>
    </div>
  );
}
