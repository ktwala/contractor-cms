import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchWorkforceIssues, fetchGroupedIssues, resolveWorkforceIssue, reopenWorkforceIssue,
  triggerIssueDetection, previewBulkRemediation, applyBulkRemediation, triggerStatsRefresh,
  requestRemediationApproval,
} from '../api';
import { getRemediationRoute, ISSUE_TYPE_LABELS } from '../remediation-routes';
import { IssueBadge } from './IssueBadge';
import { BulkRemediationPreviewModal } from './BulkRemediationPreviewModal';
import { BulkRemediationSuccessBanner } from './BulkRemediationSuccessBanner';

const BULK_FIXABLE_TYPES = new Set([
  'MISSING_MANAGER',
  'MISSING_ORG_ASSIGNMENT',
  'MISSING_COST_CENTER',
  'EMPLOYEE_WITHOUT_ASSIGNMENT',
  'EMPLOYEE_WITHOUT_EMPLOYMENT',
]);

interface IssueDrilldownDrawerProps {
  open: boolean;
  onClose: () => void;
  issueType?: string;
  entityType?: string;
  legalEntityId?: string;
  orgUnitId?: string;
  title?: string;
  groupBy?: 'legalEntity' | 'orgUnit' | 'issueType';
  onRefreshNeeded?: () => void;
}

export const IssueDrilldownDrawer: React.FC<IssueDrilldownDrawerProps> = ({
  open, onClose, issueType, entityType, legalEntityId, orgUnitId, title, groupBy, onRefreshNeeded,
}) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'list' | 'grouped'>(groupBy ? 'grouped' : 'list');
  const [issues, setIssues] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [confirmDismiss, setConfirmDismiss] = useState<string | null>(null);
  const [recheckRunning, setRecheckRunning] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'info'; message: string } | null>(null);

  // Bulk remediation state
  const [bulkPreview, setBulkPreview] = useState<any>(null);
  const [bulkPreviewOpen, setBulkPreviewOpen] = useState(false);
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkFixInput, setBulkFixInput] = useState('');
  const [bulkTargetType, setBulkTargetType] = useState<string | null>(null);
  const [bulkFilters, setBulkFilters] = useState<{ legalEntityId?: string; orgUnitId?: string } | null>(null);
  const [bulkResult, setBulkResult] = useState<any>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (mode === 'grouped' && groupBy) {
        const data = await fetchGroupedIssues({
          ...(issueType ? { issueType } : {}),
          groupBy,
          ...(legalEntityId ? { legalEntityId } : {}),
          resolved: 'false',
        });
        setGroups(Array.isArray(data) ? data : []);
        setTotal(Array.isArray(data) ? data.reduce((s: number, g: any) => s + g.count, 0) : 0);
      } else {
        const filters: Record<string, string> = { resolved: 'false', limit: '100' };
        if (issueType) filters.issueType = issueType;
        if (entityType) filters.entityType = entityType;
        if (legalEntityId) filters.legalEntityId = legalEntityId;
        if (orgUnitId) filters.orgUnitId = orgUnitId;
        const data = await fetchWorkforceIssues(filters);
        setIssues(data?.items ?? []);
        setTotal(data?.total ?? 0);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [mode, issueType, entityType, legalEntityId, orgUnitId, groupBy]);

  useEffect(() => {
    if (open) {
      setConfirmDismiss(null);
      setFeedback(null);
      loadData();
    }
  }, [open, loadData]);

  const handleDismiss = async (id: string) => {
    setActionInProgress(id);
    try {
      await resolveWorkforceIssue(id, 'Dismissed by user — will not re-appear until reopened');
      setConfirmDismiss(null);
      setFeedback({ type: 'success', message: 'Issue dismissed. It will not reappear until you reopen it.' });
      await loadData();
      onRefreshNeeded?.();
    } catch { /* ignore */ }
    setActionInProgress(null);
  };

  const handleReopen = async (id: string) => {
    setActionInProgress(id);
    try {
      await reopenWorkforceIssue(id);
      setFeedback({ type: 'info', message: 'Issue reopened. It will appear in active issues again.' });
      await loadData();
      onRefreshNeeded?.();
    } catch { /* ignore */ }
    setActionInProgress(null);
  };

  const handleRecheck = async () => {
    setRecheckRunning(true);
    setFeedback(null);
    try {
      const before = total;
      await triggerIssueDetection();
      await loadData();
      const after = total;
      if (after < before) {
        setFeedback({ type: 'success', message: `Re-check complete. ${before - after} issue(s) resolved.` });
      } else {
        setFeedback({ type: 'info', message: 'Re-check complete. Issues are up to date.' });
      }
      onRefreshNeeded?.();
    } catch { /* ignore */ }
    setRecheckRunning(false);
  };

  const handleNavigate = (issue: any) => {
    const action = issue.recommendedAction;
    if (action) {
      const route = getRemediationRoute(issue.issueType, action.params);
      onClose();
      navigate(route);
    }
  };

  const handleBulkPreview = async (targetIssueType: string, fixValue: string, filters?: { legalEntityId?: string; orgUnitId?: string }) => {
    if (!fixValue.trim()) return;
    const fixFieldMap: Record<string, string> = {
      MISSING_MANAGER: 'managerEmployeeId',
      MISSING_ORG_ASSIGNMENT: 'orgUnitId',
      MISSING_COST_CENTER: 'costCenterId',
      EMPLOYEE_WITHOUT_ASSIGNMENT: 'orgUnitId',
      EMPLOYEE_WITHOUT_EMPLOYMENT: 'legalEntityId',
    };
    const fixField = fixFieldMap[targetIssueType];
    if (!fixField) return;

    try {
      const preview = await previewBulkRemediation({
        issueType: targetIssueType,
        filters,
        proposedFix: { [fixField]: fixValue.trim() },
      });
      setBulkPreview(preview);
      setBulkTargetType(targetIssueType);
      setBulkFilters(filters ?? null);
      setBulkPreviewOpen(true);
    } catch (err: any) {
      setFeedback({ type: 'info', message: err?.response?.data?.message || 'Preview failed' });
    }
  };

  const handleBulkApply = async () => {
    if (!bulkTargetType || !bulkFixInput.trim()) return;
    setBulkApplying(true);
    const fixFieldMap: Record<string, string> = {
      MISSING_MANAGER: 'managerEmployeeId',
      MISSING_ORG_ASSIGNMENT: 'orgUnitId',
      MISSING_COST_CENTER: 'costCenterId',
      EMPLOYEE_WITHOUT_ASSIGNMENT: 'orgUnitId',
      EMPLOYEE_WITHOUT_EMPLOYMENT: 'legalEntityId',
    };
    try {
      const result = await applyBulkRemediation({
        issueType: bulkTargetType,
        filters: bulkFilters ?? undefined,
        fix: { [fixFieldMap[bulkTargetType]]: bulkFixInput.trim() },
      });
      setBulkPreviewOpen(false);
      setBulkPreview(null);
      setBulkResult({
        recordsUpdated: result.recordsUpdated,
        issueTypeLabel: ISSUE_TYPE_LABELS[bulkTargetType] || bulkTargetType,
      });
      await triggerStatsRefresh();
      await loadData();
      onRefreshNeeded?.();
    } catch { /* ignore */ }
    setBulkApplying(false);
  };

  const ISSUE_TO_ACTION: Record<string, string> = {
    MISSING_MANAGER: 'BULK_ASSIGN_MANAGER',
    MISSING_ORG_ASSIGNMENT: 'BULK_ASSIGN_ORG_UNIT',
    MISSING_COST_CENTER: 'BULK_ASSIGN_COST_CENTER',
    EMPLOYEE_WITHOUT_ASSIGNMENT: 'BULK_CREATE_ASSIGNMENTS',
    EMPLOYEE_WITHOUT_EMPLOYMENT: 'BULK_CREATE_EMPLOYMENTS',
  };

  const handleRequestApproval = async () => {
    if (!bulkTargetType || !bulkPreview) return;
    setBulkApplying(true);
    const fixFieldMap: Record<string, string> = {
      MISSING_MANAGER: 'managerEmployeeId',
      MISSING_ORG_ASSIGNMENT: 'orgUnitId',
      MISSING_COST_CENTER: 'costCenterId',
      EMPLOYEE_WITHOUT_ASSIGNMENT: 'orgUnitId',
      EMPLOYEE_WITHOUT_EMPLOYMENT: 'legalEntityId',
    };
    try {
      await requestRemediationApproval({
        actionType: ISSUE_TO_ACTION[bulkTargetType] || bulkTargetType,
        issueType: bulkTargetType,
        recordsAffected: bulkPreview.recordsAffected,
        fixPayload: { [fixFieldMap[bulkTargetType]]: bulkFixInput.trim() },
        previewSummary: bulkPreview as any,
        filters: (bulkFilters ?? undefined) as any,
      });
      setBulkPreviewOpen(false);
      setBulkPreview(null);
      setBulkResult({
        recordsUpdated: 0,
        issueTypeLabel: `Approval requested for ${ISSUE_TYPE_LABELS[bulkTargetType] || bulkTargetType}`,
      });
    } catch { /* ignore */ }
    setBulkApplying(false);
  };

  const handleGroupClick = (group: any) => {
    if (groupBy === 'legalEntity') {
      const filters: Record<string, string> = { resolved: 'false', limit: '100' };
      if (issueType) filters.issueType = issueType;
      filters.legalEntityId = group.key;
      setMode('list');
      fetchWorkforceIssues(filters).then((d: any) => {
        setIssues(d?.items ?? []);
        setTotal(d?.total ?? 0);
      });
    } else if (groupBy === 'orgUnit') {
      const filters: Record<string, string> = { resolved: 'false', limit: '100' };
      if (issueType) filters.issueType = issueType;
      filters.orgUnitId = group.key;
      setMode('list');
      fetchWorkforceIssues(filters).then((d: any) => {
        setIssues(d?.items ?? []);
        setTotal(d?.total ?? 0);
      });
    }
  };

  if (!open) return null;

  const drawerTitle = title || (issueType ? ISSUE_TYPE_LABELS[issueType] || issueType : 'Workforce Issues');

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      display: 'flex', justifyContent: 'flex-end',
    }}>
      <div
        style={{ flex: 1, background: 'rgba(0,0,0,0.3)' }}
        onClick={onClose}
      />
      <div style={{
        width: 640, maxWidth: '100vw', background: '#fff',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column', height: '100vh',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{drawerTitle}</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
              {total} unresolved issue{total !== 1 ? 's' : ''}
              {legalEntityId && ' (filtered)'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={handleRecheck}
              disabled={recheckRunning}
              style={{
                padding: '6px 12px', borderRadius: 6, border: '1px solid #6366f1',
                background: '#eef2ff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                color: '#4338ca', opacity: recheckRunning ? 0.6 : 1,
              }}
            >
              {recheckRunning ? 'Checking...' : 'Re-check'}
            </button>
            {groupBy && (
              <button
                onClick={() => { setMode(mode === 'grouped' ? 'list' : 'grouped'); }}
                style={{
                  padding: '6px 12px', borderRadius: 6, border: '1px solid #e2e8f0',
                  background: '#f8fafc', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  color: '#475569',
                }}
              >
                {mode === 'grouped' ? 'Show all' : 'Group by ' + groupBy}
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0',
                background: '#f8fafc', fontSize: 18, cursor: 'pointer', color: '#64748b',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Feedback banner */}
        {feedback && (
          <div style={{
            padding: '10px 24px',
            background: feedback.type === 'success' ? '#f0fdf4' : '#eff6ff',
            borderBottom: `1px solid ${feedback.type === 'success' ? '#bbf7d0' : '#bfdbfe'}`,
            color: feedback.type === 'success' ? '#166534' : '#1e40af',
            fontSize: 13, fontWeight: 500,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>{feedback.message}</span>
            <button
              onClick={() => setFeedback(null)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: feedback.type === 'success' ? '#166534' : '#1e40af',
                fontSize: 16, padding: '0 4px',
              }}
            >×</button>
          </div>
        )}

        {/* Bulk success banner */}
        {bulkResult && (
          <BulkRemediationSuccessBanner result={bulkResult} onDismiss={() => setBulkResult(null)} />
        )}

        {/* Bulk fix bar for fixable issue types */}
        {issueType && BULK_FIXABLE_TYPES.has(issueType) && total > 0 && (
          <div style={{
            padding: '10px 24px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1e40af', whiteSpace: 'nowrap' }}>Bulk fix:</span>
            <input
              type="text"
              placeholder="Enter ID to apply to all..."
              value={bulkFixInput}
              onChange={(e) => setBulkFixInput(e.target.value)}
              style={{
                flex: 1, padding: '5px 10px', borderRadius: 6, border: '1px solid #93c5fd',
                fontSize: 12, outline: 'none',
              }}
            />
            <button
              onClick={() => handleBulkPreview(issueType, bulkFixInput)}
              disabled={!bulkFixInput.trim()}
              style={{
                padding: '5px 14px', borderRadius: 6, border: '1px solid #2563eb',
                background: '#2563eb', color: '#fff', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', whiteSpace: 'nowrap',
                opacity: bulkFixInput.trim() ? 1 : 0.5,
              }}
            >
              Preview
            </button>
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading issues...</div>
          ) : mode === 'grouped' ? (
            <div>
              {groups.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No issues found</div>
              ) : groups.map((g: any) => (
                <div key={g.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <div
                    onClick={() => handleGroupClick(g)}
                    style={{
                      padding: '14px 24px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      cursor: 'pointer', transition: 'background .1s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f8fafc'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{g.label || 'Unknown'}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                        {g.count} issue{g.count !== 1 ? 's' : ''}
                        {g.blockersCount > 0 && ` · ${g.blockersCount} export blocker${g.blockersCount !== 1 ? 's' : ''}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {issueType && BULK_FIXABLE_TYPES.has(issueType) && g.count > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const filters = groupBy === 'orgUnit' ? { orgUnitId: g.key }
                              : groupBy === 'legalEntity' ? { legalEntityId: g.key } : {};
                            if (bulkFixInput.trim()) {
                              handleBulkPreview(issueType, bulkFixInput, filters);
                            }
                          }}
                          style={{
                            padding: '3px 10px', borderRadius: 5, border: '1px solid #6366f1',
                            background: '#eef2ff', color: '#4338ca', fontSize: 11, fontWeight: 600,
                            cursor: 'pointer', whiteSpace: 'nowrap',
                          }}
                        >
                          Bulk fix ({g.count})
                        </button>
                      )}
                      <IssueBadge count={g.count} severity={g.blockersCount > 0 ? 'error' : 'warning'} />
                      <span style={{ color: '#94a3b8', fontSize: 18 }}>›</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              {issues.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No issues found</div>
              ) : issues.map((issue: any) => (
                <div
                  key={issue.id}
                  style={{
                    padding: '14px 24px', borderBottom: '1px solid #f1f5f9',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>
                        {issue.title}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
                        <span style={{
                          padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                          background: issue.severity === 'ERROR' || issue.severity === 'CRITICAL' ? '#fee2e2' : issue.severity === 'WARNING' ? '#fef9c3' : '#e0f2fe',
                          color: issue.severity === 'ERROR' || issue.severity === 'CRITICAL' ? '#991b1b' : issue.severity === 'WARNING' ? '#854d0e' : '#0c4a6e',
                        }}>
                          {issue.severity}
                        </span>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>
                          {ISSUE_TYPE_LABELS[issue.issueType] || issue.issueType}
                        </span>
                        {issue.blocksExport && (
                          <span style={{
                            padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                            background: '#fee2e2', color: '#991b1b',
                          }}>
                            Blocks export
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {issue.recommendedAction && (
                        <button
                          onClick={() => handleNavigate(issue)}
                          style={{
                            padding: '5px 10px', borderRadius: 6, border: '1px solid #6366f1',
                            background: '#eef2ff', color: '#4338ca', fontSize: 11, fontWeight: 600,
                            cursor: 'pointer', whiteSpace: 'nowrap',
                          }}
                        >
                          {issue.recommendedAction.label}
                        </button>
                      )}
                      {confirmDismiss === issue.id ? (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <button
                            onClick={() => handleDismiss(issue.id)}
                            disabled={actionInProgress === issue.id}
                            style={{
                              padding: '5px 10px', borderRadius: 6, border: '1px solid #ef4444',
                              background: '#fef2f2', color: '#dc2626', fontSize: 11, fontWeight: 600,
                              cursor: 'pointer', whiteSpace: 'nowrap',
                              opacity: actionInProgress === issue.id ? 0.5 : 1,
                            }}
                          >
                            {actionInProgress === issue.id ? 'Dismissing...' : 'Confirm'}
                          </button>
                          <button
                            onClick={() => setConfirmDismiss(null)}
                            style={{
                              padding: '5px 8px', borderRadius: 6, border: '1px solid #e2e8f0',
                              background: '#f8fafc', color: '#475569', fontSize: 11,
                              cursor: 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDismiss(issue.id)}
                          style={{
                            padding: '5px 10px', borderRadius: 6, border: '1px solid #e2e8f0',
                            background: '#f8fafc', color: '#475569', fontSize: 11, fontWeight: 500,
                            cursor: 'pointer', whiteSpace: 'nowrap',
                          }}
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {mode === 'list' && groupBy && (
          <div style={{ padding: '12px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <button
              onClick={() => { setMode('grouped'); loadData(); }}
              style={{
                padding: '6px 14px', borderRadius: 6, border: '1px solid #e2e8f0',
                background: '#fff', fontSize: 12, cursor: 'pointer', color: '#475569',
              }}
            >
              ← Back to grouped view
            </button>
          </div>
        )}
      </div>

      <BulkRemediationPreviewModal
        open={bulkPreviewOpen}
        preview={bulkPreview}
        issueTypeLabel={ISSUE_TYPE_LABELS[bulkTargetType ?? ''] || bulkTargetType || ''}
        applying={bulkApplying}
        onApply={handleBulkApply}
        onRequestApproval={handleRequestApproval}
        onClose={() => { setBulkPreviewOpen(false); setBulkPreview(null); }}
      />
    </div>
  );
};
