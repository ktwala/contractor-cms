import React, { useCallback, useEffect, useState } from 'react';
import {
  Shield,
  Send,
  Check,
  Upload,
  Archive,
  AlertCircle,
  ExternalLink,
  Clock,
} from 'lucide-react';
import * as styles from '../../../../styles/common';
import { Card } from '../../../../ui/layout';
import {
  fetchVersion,
  fetchAuditTrail,
  submitForApproval,
  approveVersion,
  publishVersion,
  archiveVersion,
  fetchPublishedRuntime,
} from '../../api';
import { StatusBadge } from '../StatusBadge';
import { useTtaPermissions } from '../../hooks/useTtaPermissions';
import { trackTtaFunnel } from '../../utils/ttaFunnelTelemetry';
import type { AuthoringVersion, AuditEvent } from '../../types';

interface Props {
  draftId: string;
  setError: (e: string | null) => void;
  onPublished: () => void;
}

export function PublishStep({ draftId, setError, onPublished }: Props) {
  const [version, setVersion] = useState<AuthoringVersion | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [runtimeLink, setRuntimeLink] = useState<any>(null);
  const [acting, setActing] = useState(false);
  const [publishReason, setPublishReason] = useState('');
  const [confirmPublish, setConfirmPublish] = useState(false);
  const perms = useTtaPermissions();

  const load = useCallback(async () => {
    try {
      const [v, trail] = await Promise.all([
        fetchVersion(draftId),
        fetchAuditTrail(draftId),
      ]);
      setVersion(v);
      setAudit(trail);
      if (v.status === 'PUBLISHED' && v.publishedTaxTableSetId) {
        try {
          const rt = await fetchPublishedRuntime(draftId);
          setRuntimeLink(rt);
        } catch { /* may not exist yet */ }
      }
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Failed to load');
    }
  }, [draftId]);

  useEffect(() => { void load(); }, [load]);

  async function handleAction(action: string) {
    setActing(true);
    setError(null);
    try {
      switch (action) {
        case 'submit':
          await submitForApproval(draftId);
          break;
        case 'approve':
          await approveVersion(draftId);
          break;
        case 'publish':
          await publishVersion(draftId, publishReason || undefined);
          setConfirmPublish(false);
          break;
        case 'archive':
          await archiveVersion(draftId);
          break;
      }
      await load();
      if (action === 'publish') {
        trackTtaFunnel({ stage: 'published', draftId });
        onPublished();
      }
    } catch (e: any) {
      const errData = e?.response?.data?.error;
      setError(errData?.message ?? e.message ?? `${action} failed`);
    }
    setActing(false);
  }

  if (!version) return null;

  const submitCheck = perms.canPerformAction('submit_approval', version);
  const approveCheck = perms.canPerformAction('approve', version);
  const publishCheck = perms.canPerformAction('publish', version);
  const archiveCheck = perms.canPerformAction('archive', version);

  return (
    <div style={{ maxWidth: 800 }}>
      {/* Status header */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Lifecycle Status</div>
            <StatusBadge status={version.status as any} />
          </div>
          <div style={{ textAlign: 'right', fontSize: 13, color: '#64748b' }}>
            <div>{version.countryCode} • {version.tableType} • {version.taxYear}</div>
            <div>Effective from {version.effectiveFrom?.slice(0, 10)}</div>
          </div>
        </div>

        {version.status === 'PUBLISHED' && version.publishedTaxTableSetId && (
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 8,
              padding: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              color: '#065f46',
            }}
          >
            <Check size={16} />
            Published to runtime row {version.publishedTaxTableSetId.slice(0, 8)}…
            {runtimeLink && (
              <a
                href={`/admin/payroll/tax-tables/runtime?id=${version.publishedTaxTableSetId}`}
                style={{ color: '#4f46e5', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                View Runtime <ExternalLink size={12} />
              </a>
            )}
          </div>
        )}
      </Card>

      {/* Actions */}
      <div style={{ marginTop: 24 }}>
        <h3 style={{ ...styles.sectionTitle, marginTop: 0 }}>Available Actions</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <ActionCard
            icon={<Send size={18} />}
            label="Submit for Approval"
            desc="Send to a reviewer for sign-off"
            check={submitCheck}
            loading={acting}
            onClick={() => handleAction('submit')}
          />
          <ActionCard
            icon={<Shield size={18} />}
            label="Approve"
            desc="Sign off on this version"
            check={approveCheck}
            loading={acting}
            onClick={() => handleAction('approve')}
          />
          <ActionCard
            icon={<Upload size={18} />}
            label="Publish to Runtime"
            desc="Will create a runtime row. This action is final."
            check={publishCheck}
            loading={acting}
            onClick={() => setConfirmPublish(true)}
            accent
          />
          <ActionCard
            icon={<Archive size={18} />}
            label="Archive"
            desc="Remove from active workflow"
            check={archiveCheck}
            loading={acting}
            onClick={() => handleAction('archive')}
            danger
          />
        </div>
      </div>

      {/* Publish confirmation */}
      {confirmPublish && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 480, width: '100%' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Confirm Publish</h3>
            <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>
              This will create a new runtime <strong>TaxTableSet</strong> row and supersede any existing
              active row for this scope. This action cannot be undone.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={styles.formLabel}>Publish reason (optional)</label>
              <input
                type="text"
                style={styles.formInput}
                placeholder="e.g. 2026 budget update"
                value={publishReason}
                onChange={(e) => setPublishReason(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button style={styles.buttonSecondary} onClick={() => setConfirmPublish(false)}>
                Cancel
              </button>
              <button
                style={{ ...styles.buttonPrimary, opacity: acting ? 0.5 : 1 }}
                onClick={() => handleAction('publish')}
                disabled={acting}
              >
                {acting ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit trail */}
      {audit.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h3 style={{ ...styles.sectionTitle, marginTop: 0 }}>Audit Trail</h3>
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {audit.map((ev, i) => (
                <div
                  key={ev.id}
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: '10px 0',
                    borderBottom: i < audit.length - 1 ? '1px solid #f1f5f9' : 'none',
                    fontSize: 13,
                  }}
                >
                  <div style={{ position: 'relative' }}>
                    <Clock size={14} style={{ color: '#94a3b8', marginTop: 2 }} />
                    {i < audit.length - 1 && (
                      <div style={{ position: 'absolute', left: 6.5, top: 18, width: 1, height: 'calc(100% + 2px)', background: '#e2e8f0' }} />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, color: '#1e293b' }}>{formatEvent(ev.eventType)}</div>
                    <div style={{ color: '#94a3b8', fontSize: 12 }}>
                      {new Date(ev.createdAt).toLocaleString()} — {ev.actorUserId.slice(0, 8)}…
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function ActionCard({
  icon,
  label,
  desc,
  check,
  loading,
  onClick,
  accent,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  check: { allowed: boolean; reason?: string };
  loading: boolean;
  onClick: () => void;
  accent?: boolean;
  danger?: boolean;
}) {
  const disabled = !check.allowed || loading;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 6,
        padding: 16,
        background: disabled ? '#f8fafc' : accent ? '#eef2ff' : danger ? '#fef2f2' : '#fff',
        border: `1px solid ${disabled ? '#e2e8f0' : accent ? '#c7d2fe' : danger ? '#fecaca' : '#e2e8f0'}`,
        borderRadius: 10,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        textAlign: 'left',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ color: accent ? '#4f46e5' : danger ? '#dc2626' : '#64748b' }}>{icon}</div>
      <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{label}</div>
      <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.4 }}>{desc}</div>
      {!check.allowed && check.reason && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#f59e0b', marginTop: 2 }}>
          <AlertCircle size={12} /> {check.reason}
        </div>
      )}
    </button>
  );
}

function formatEvent(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
