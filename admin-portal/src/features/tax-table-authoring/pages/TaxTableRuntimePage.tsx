import React, { useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, ExternalLink, Shield, Database } from 'lucide-react';
import * as styles from '../../../styles/common';
import { Page, Card } from '../../../ui/layout';
import { fetchActiveRuntime, fetchRuntimeById } from '../api';
import { ErrorBanner } from '../components/ErrorBanner';
import { CardSkeleton } from '../components/LoadingSkeleton';

export default function TaxTableRuntimePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedId = searchParams.get('id') ?? '';

  const [country, setCountry] = useState('ZA');
  const [tableType, setTableType] = useState('PAYE');
  const [computeDate, setComputeDate] = useState(new Date().toISOString().slice(0, 10));
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandBrackets, setExpandBrackets] = useState(false);

  const search = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      let data;
      if (preselectedId) {
        data = await fetchRuntimeById(preselectedId);
      } else {
        data = await fetchActiveRuntime({ country, tableType, date: computeDate });
      }
      setResult(data);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'No active runtime row found for this scope');
    }
    setLoading(false);
  }, [country, tableType, computeDate, preselectedId]);

  React.useEffect(() => {
    if (preselectedId) void search();
  }, [preselectedId]);

  return (
    <Page
      title="Runtime Tax Table Inspector"
      subtitle="Read-only operational view of active runtime TaxTableSet rows"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          marginBottom: 20,
          padding: '8px 12px',
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 8,
          fontSize: 13,
          color: '#1e40af',
        }}
      >
        <Shield size={14} />
        This page is read-only. Changes must go through the authoring workflow.
      </div>

      {/* Filter bar */}
      {!preselectedId && (
        <Card>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={styles.formLabel}>Country</label>
              <select style={{ ...styles.formSelect, width: 140 }} value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="ZA">South Africa</option>
                <option value="LS">Lesotho</option>
              </select>
            </div>
            <div>
              <label style={styles.formLabel}>Table Type</label>
              <select style={{ ...styles.formSelect, width: 140 }} value={tableType} onChange={(e) => setTableType(e.target.value)}>
                <option value="PAYE">PAYE</option>
              </select>
            </div>
            <div>
              <label style={styles.formLabel}>Compute Date</label>
              <input type="date" style={{ ...styles.formInput, width: 160 }} value={computeDate} onChange={(e) => setComputeDate(e.target.value)} />
            </div>
            <button
              style={{ ...styles.buttonPrimary, padding: '8px 20px', opacity: loading ? 0.5 : 1 }}
              onClick={search}
              disabled={loading}
            >
              <Search size={14} /> {loading ? 'Searching…' : 'Inspect'}
            </button>
          </div>
        </Card>
      )}

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {loading && <div style={{ marginTop: 24 }}><CardSkeleton /></div>}

      {result && (
        <div style={{ marginTop: 24 }}>
          {/* Runtime metadata */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Database size={16} style={{ color: '#4f46e5' }} />
                  <span style={{ fontSize: 16, fontWeight: 700 }}>Active Runtime TaxTableSet</span>
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>ID: {result.id}</div>
              </div>
              <span style={{ background: '#d1fae5', color: '#065f46', padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
                ACTIVE
              </span>
            </div>

            <div style={styles.grid2}>
              <div>
                <RtRow label="Country" value={result.countryCode ?? country} />
                <RtRow label="Table Type" value={result.tableType ?? tableType} />
                <RtRow label="Tax Year" value={result.taxYear} />
                <RtRow label="Effective From" value={result.effectiveFrom?.slice(0, 10)} />
                <RtRow label="Effective To" value={result.effectiveTo?.slice(0, 10) ?? '—'} />
              </div>
              <div>
                <RtRow label="Status" value={result.status} />
                <RtRow label="Source Type" value={result.sourceType ?? '—'} />
                <RtRow label="Source Reference" value={result.sourceReference ?? '—'} />
                <RtRow label="Checksum" value={result.checksum ?? result.sourceChecksum ?? '—'} />
                <RtRow label="Created" value={result.createdAt ? new Date(result.createdAt).toLocaleString() : '—'} />
              </div>
            </div>

            {/* Authoring backlink */}
            {result.authoringVersionId && (
              <div
                style={{
                  marginTop: 16,
                  padding: '10px 12px',
                  background: '#faf5ff',
                  border: '1px solid #e9d5ff',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                }}
              >
                <span style={{ color: '#7c3aed' }}>Authored via version</span>
                <button
                  style={{ background: 'none', border: 'none', color: '#4f46e5', cursor: 'pointer', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13 }}
                  onClick={() => navigate(`/admin/payroll/tax-tables/authoring/${result.authoringVersionId}`)}
                >
                  {result.authoringVersionId.slice(0, 12)}… <ExternalLink size={12} />
                </button>
              </div>
            )}
          </Card>

          {/* Brackets detail */}
          {result.brackets && result.brackets.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <button
                style={{ ...styles.buttonSecondary, padding: '6px 12px', fontSize: 13, marginBottom: 12 }}
                onClick={() => setExpandBrackets(!expandBrackets)}
              >
                {expandBrackets ? 'Hide' : 'Show'} Brackets ({result.brackets.length})
              </button>
              {expandBrackets && (
                <Card>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ ...styles.table, fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Seq</th>
                          <th style={styles.th}>From</th>
                          <th style={styles.th}>To</th>
                          <th style={styles.th}>Rate</th>
                          <th style={styles.th}>Base Tax</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.brackets.map((b: any, i: number) => (
                          <tr key={i} style={styles.tr}>
                            <td style={styles.td}>{b.seqNo ?? i + 1}</td>
                            <td style={styles.td}>{Number(b.bracketFrom ?? b.lower ?? 0).toLocaleString()}</td>
                            <td style={styles.td}>{b.bracketTo ?? b.upper ? Number(b.bracketTo ?? b.upper).toLocaleString() : '∞'}</td>
                            <td style={styles.td}>{b.marginalRate ?? b.rate}</td>
                            <td style={styles.td}>{Number(b.baseTax ?? 0).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* Supplemental fields */}
          {result.fields && result.fields.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <h3 style={{ ...styles.sectionTitle, marginTop: 0 }}>Supplemental Fields</h3>
              <Card>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {result.fields.map((f: any, i: number) => (
                    <RtRow key={i} label={f.fieldCode} value={typeof f.fieldValue === 'object' ? JSON.stringify(f.fieldValue) : String(f.fieldValue)} />
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}
    </Page>
  );
}

function RtRow({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
      <span style={{ color: '#94a3b8' }}>{label}</span>
      <span style={{ fontWeight: 500, color: '#1e293b', maxWidth: 240, wordBreak: 'break-all', textAlign: 'right' }}>
        {value ?? '—'}
      </span>
    </div>
  );
}
