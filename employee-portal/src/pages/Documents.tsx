import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { format } from 'date-fns';
import * as styles from '../styles/common';

interface Document {
  id: string;
  name: string;
  type: string;
  category: string;
  size: number;
  uploaded_at: string;
  uploaded_by: string;
}

export default function Documents() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { value: 'all', label: 'All Documents' },
    { value: 'identification', label: 'Identification' },
    { value: 'certificates', label: 'Certificates' },
    { value: 'contracts', label: 'Contracts' },
    { value: 'tax', label: 'Tax Documents' },
    { value: 'other', label: 'Other' },
  ];

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const response = await api.get('/self-service/documents');
      setDocuments(response.data.documents || []);
    } catch (error) {
      console.error('Failed to load documents:', error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', selectedCategory === 'all' ? 'other' : selectedCategory);
    setUploading(true);
    try {
      await api.post('/self-service/documents/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      await loadDocuments();
      alert('Document uploaded successfully!');
    } catch (error) {
      alert('Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: Document) => {
    try {
      const response = await api.get(`/self-service/documents/${doc.id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert('Failed to download document');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await api.delete(`/self-service/documents/${id}`);
      setDocuments(documents.filter(d => d.id !== id));
    } catch (error) {
      alert('Failed to delete document');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const filteredDocuments = selectedCategory === 'all' ? documents : documents.filter(d => d.category === selectedCategory);

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      identification: 'M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0',
      certificates: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
      contracts: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      tax: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z',
    };
    return icons[category] || 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';
  };

  if (loading) {
    return (
      <div style={styles.pageContainer}>
        <div style={styles.loadingContainer}>
          <div style={styles.loadingSpinner}></div>
          <p style={{ color: styles.colors.textSecondary }}>Loading documents...</p>
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
          <h1 style={styles.pageTitle}>My Documents</h1>
          <p style={styles.pageSubtitle}>Upload and manage your personal documents</p>
        </div>
        <label style={{ ...styles.buttonPrimary, cursor: 'pointer' }}>
          <input type="file" style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploading} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          {uploading ? 'Uploading...' : 'Upload Document'}
        </label>
      </div>

      {/* Category Filter */}
      <div style={{ ...styles.card, padding: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto' }}>
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: selectedCategory === cat.value ? '#e0e7ff' : 'transparent',
                color: selectedCategory === cat.value ? styles.colors.primary : styles.colors.textSecondary,
                transition: 'all 0.2s',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Documents Grid */}
      {filteredDocuments.length === 0 ? (
        <div style={{ ...styles.card, ...styles.emptyState }}>
          <svg style={styles.emptyStateIcon} width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 style={styles.emptyStateTitle}>No documents found</h3>
          <p style={styles.emptyStateText}>Upload your first document to get started</p>
        </div>
      ) : (
        <div style={styles.grid3}>
          {filteredDocuments.map((doc) => (
            <div key={doc.id} style={styles.card} className="hover-card">
              <div style={{ ...styles.flexBetween, marginBottom: '1rem' }}>
                <div style={styles.iconContainer(styles.colors.gradientPrimary)}>
                  <svg width="24" height="24" fill="none" stroke="white" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getCategoryIcon(doc.category)} />
                  </svg>
                </div>
                <span style={styles.badge('default')}>
                  {categories.find(c => c.value === doc.category)?.label}
                </span>
              </div>

              <h3 style={{ fontWeight: 600, color: styles.colors.textPrimary, marginBottom: '0.75rem', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={doc.name}>
                {doc.name}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem', color: styles.colors.textMuted, marginBottom: '1rem' }}>
                <span>Size: {formatFileSize(doc.size)}</span>
                <span>Uploaded: {format(new Date(doc.uploaded_at), 'MMM dd, yyyy')}</span>
                <span>By: {doc.uploaded_by}</span>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => handleDownload(doc)} style={{ ...styles.buttonSecondary, flex: 1, justifyContent: 'center' }}>
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </button>
                {doc.uploaded_by !== 'HR Department' && (
                  <button onClick={() => handleDelete(doc.id)} style={{ ...styles.buttonDanger, padding: '0.5rem' }}>
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Banner */}
      <div style={{ marginTop: '1.5rem', padding: '1rem 1.25rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', display: 'flex', gap: '0.75rem' }}>
        <svg width="20" height="20" fill="none" stroke="#3b82f6" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: '2px' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <h4 style={{ fontWeight: 600, color: '#1e40af', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Accepted File Types</h4>
          <p style={{ fontSize: '0.8rem', color: '#1e40af' }}>PDF, Word (.doc, .docx), and images (.jpg, .jpeg, .png). Maximum: 10MB</p>
        </div>
      </div>

      <style>{`${styles.spinKeyframes} .hover-card:hover { transform: translateY(-2px); box-shadow: ${styles.shadows.cardHover}; }`}</style>
    </div>
  );
}
