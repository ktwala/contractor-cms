import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import * as styles from '../styles/common';
import { useAccess } from '../hooks/useAccess';
import { Page, Card, CardHeader, Banner, Grid } from '../ui/layout';
import { classifyError } from '../utils/pageState';
import { usePageStateTelemetry } from '../utils/pageStateTelemetry';
import { PageBlockedView } from '../ui/PageStateViews';
import type { PageState } from '../utils/pageState';

const TASK_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#f1f5f9', text: '#475569' },
  in_progress: { bg: '#eff6ff', text: '#2563eb' },
  completed: { bg: '#f0fdf4', text: '#16a34a' },
  skipped: { bg: '#f1f5f9', text: '#94a3b8' },
};

const SECTIONS = ['PRE_CALCULATION', 'POST_CALCULATION_REVIEW', 'APPROVAL_READINESS', 'PAYMENT_READINESS', 'CLOSE', 'STATUTORY_FOLLOW_UP'];
const SECTION_LABELS: Record<string, string> = {
  PRE_CALCULATION: 'Pre-Calculation',
  POST_CALCULATION_REVIEW: 'Post-Calculation Review',
  APPROVAL_READINESS: 'Approval Readiness',
  PAYMENT_READINESS: 'Payment Readiness',
  CLOSE: 'Close',
  STATUTORY_FOLLOW_UP: 'Statutory Follow-Up',
  pre_calculation: 'Pre-Calculation',
  post_calculation: 'Post-Calculation Review',
  approval: 'Approval Readiness',
  payment: 'Payment Readiness',
  close: 'Close',
  statutory: 'Statutory Follow-Up',
};

export default function PayrollChecklist() {
  const { can } = useAccess();
  const [payGroups, setPayGroups] = useState<any[]>([]);
  const [selectedPayGroupId, setSelectedPayGroupId] = useState('');
  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [checklist, setChecklist] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [assignModal, setAssignModal] = useState<{ taskId: string; userId: string } | null>(null);
  const [blockedState, setBlockedState] = useState<PageState | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/pay-groups?limit=200');
        const pgs = res.data?.items ?? res.data ?? [];
        setPayGroups(pgs);
        if (pgs.length > 0) setSelectedPayGroupId(pgs[0].id);
      } catch (err: any) {
        const state = classifyError(err);
        if (state.kind === 'blocked') setBlockedState(state);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selectedPayGroupId) return;
    (async () => {
      try {
        const res = await api.get(`/api/payroll-cycle/calendars/${selectedPayGroupId}/periods`);
        const items = res.data?.items ?? res.data ?? [];
        setPeriods(items);
        if (items.length > 0) setSelectedPeriodId(items[0].id);
        else setSelectedPeriodId('');
      } catch { setPeriods([]); }
    })();
  }, [selectedPayGroupId]);

  useEffect(() => {
    if (!selectedPeriodId) { setChecklist(null); setTasks([]); return; }
    loadChecklist();
  }, [selectedPeriodId]);

  const loadChecklist = async () => {
    if (!selectedPeriodId) return;
    try {
      setLoading(true); setError(null);
      const res = await api.get(`/api/payroll-cycle/periods/${selectedPeriodId}/checklist`);
      const data = res.data;
      if (data?.tasks) {
        setChecklist(data);
        setTasks(data.tasks ?? []);
      } else if (Array.isArray(data)) {
        const cl = data[0];
        setChecklist(cl);
        setTasks(cl?.tasks ?? []);
      } else {
        setChecklist(data);
        setTasks(data?.tasks ?? []);
      }
    } catch {
      setChecklist(null);
      setTasks([]);
    } finally { setLoading(false); }
  };

  const completeTask = async (taskId: string) => {
    try {
      setActionLoading(true); setActionMsg(null);
      await api.post(`/api/payroll-cycle/checklist-tasks/${taskId}/complete`);
      setActionMsg('Task completed');
      await loadChecklist();
    } catch (e: any) { setError(e?.response?.data?.message ?? 'Failed to complete task'); }
    finally { setActionLoading(false); }
  };

  const assignTask = async () => {
    if (!assignModal?.userId) return;
    try {
      setActionLoading(true);
      await api.post(`/api/payroll-cycle/checklist-tasks/${assignModal.taskId}/assign`, { userId: assignModal.userId });
      setActionMsg('Task assigned');
      setAssignModal(null);
      await loadChecklist();
    } catch (e: any) { setError(e?.response?.data?.message ?? 'Failed to assign task'); }
    finally { setActionLoading(false); }
  };

  const createChecklist = async () => {
    if (!selectedPeriodId) return;
    try {
      setActionLoading(true); setActionMsg(null);
      await api.post(`/api/payroll-cycle/periods/${selectedPeriodId}/checklist`, {});
      setActionMsg('Checklist created');
      await loadChecklist();
    } catch (e: any) { setError(e?.response?.data?.message ?? 'Failed to create checklist'); }
    finally { setActionLoading(false); }
  };

  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const totalCount = tasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const overdueCount = tasks.filter(t => t.status !== 'completed' && t.dueDate && new Date(t.dueDate ?? t.due_date) < new Date()).length;

  const groupedTasks = tasks.reduce((acc: Record<string, any[]>, t: any) => {
    const section = t.taskCategory ?? t.task_category ?? t.section ?? 'OTHER';
    if (!acc[section]) acc[section] = [];
    acc[section].push(t);
    return acc;
  }, {});

  const pageState: PageState = blockedState ?? (loading ? { kind: 'loading' } as PageState : (tasks.length === 0 ? { kind: 'empty' } : { kind: 'ready' }));
  usePageStateTelemetry('payroll.checklist', 'payroll', pageState);

  if (blockedState && blockedState.kind === 'blocked') {
    return (
      <Page title="Payroll Checklist" subtitle="Track operational payroll tasks across periods and payruns.">
        <PageBlockedView code={blockedState.code} message={blockedState.message} page="payroll.checklist" module="payroll" />
      </Page>
    );
  }

  return (
    <Page
      title="Payroll Checklist"
      subtitle="Track operational payroll tasks across periods and payruns."
    >
      {error && <Banner variant="error">{error}</Banner>}
      {actionMsg && <Banner variant="success">{actionMsg}</Banner>}

      {/* Filters */}
      <Card>
        <div style={{ display: 'flex', gap: 12, padding: '12px 16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 11, color: styles.colors.textMuted, display: 'block', marginBottom: 4 }}>Pay Group</label>
            <select style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}`, fontSize: 13, minWidth: 180 }} value={selectedPayGroupId} onChange={e => setSelectedPayGroupId(e.target.value)}>
              {payGroups.map(pg => <option key={pg.id} value={pg.id}>{pg.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: styles.colors.textMuted, display: 'block', marginBottom: 4 }}>Period</label>
            <select style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}`, fontSize: 13, minWidth: 180 }} value={selectedPeriodId} onChange={e => setSelectedPeriodId(e.target.value)}>
              {periods.length === 0 && <option value="">No periods</option>}
              {periods.map(p => <option key={p.id} value={p.id}>{p.year} P{p.periodNum ?? p.period_num}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {/* Progress */}
      {selectedPeriodId && (
        <>
          <Grid cols="1fr 1fr 1fr 1fr" gap={12}>
            <Card><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Total Tasks</div><div style={{ fontSize: 22, fontWeight: 700 }}>{totalCount}</div></Card>
            <Card><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Completed</div><div style={{ fontSize: 22, fontWeight: 700, color: '#16a34a' }}>{completedCount}</div></Card>
            <Card><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Overdue</div><div style={{ fontSize: 22, fontWeight: 700, color: overdueCount > 0 ? '#dc2626' : '#16a34a' }}>{overdueCount}</div></Card>
            <Card><div style={{ fontSize: 11, color: styles.colors.textMuted }}>Completion</div><div style={{ fontSize: 22, fontWeight: 700, color: progress === 100 ? '#16a34a' : styles.colors.primary }}>{progress.toFixed(0)}%</div></Card>
          </Grid>

          {/* Progress bar */}
          {totalCount > 0 && (
            <Card>
              <div style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Checklist Progress</span>
                  <span style={{ fontSize: 13, color: styles.colors.textMuted }}>{completedCount} / {totalCount}</span>
                </div>
                <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: progress === 100 ? '#16a34a' : styles.colors.primary, borderRadius: 4, transition: 'width 0.3s' }} />
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Tasks grouped by section */}
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center' }}><div style={styles.loadingSpinner} /></div>
      ) : tasks.length === 0 ? (
        <Card>
          <div style={{ padding: 32, textAlign: 'center', color: styles.colors.textMuted }}>
            {selectedPeriodId ? (
              <>
                <p>No checklist found for this period.</p>
                <button style={{ ...styles.buttonPrimary, marginTop: 12 }} disabled={actionLoading} onClick={createChecklist}>Create Checklist</button>
              </>
            ) : (
              <p>Select a pay group and period to view the checklist.</p>
            )}
          </div>
        </Card>
      ) : (
        Object.entries(groupedTasks).map(([section, sectionTasks]) => (
          <Card key={section}>
            <CardHeader title={SECTION_LABELS[section] ?? section.replace(/_/g, ' ')} right={<span style={{ fontSize: 12, color: styles.colors.textMuted }}>{(sectionTasks as any[]).filter(t => t.status === 'completed').length}/{(sectionTasks as any[]).length}</span>} />
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead><tr style={styles.tableHeader}>
                  <th style={{ ...styles.tableHeaderCell, width: 32 }}></th>
                  <th style={styles.tableHeaderCell}>Task</th>
                  <th style={styles.tableHeaderCell}>Assigned To</th>
                  <th style={styles.tableHeaderCell}>Due Date</th>
                  <th style={styles.tableHeaderCell}>Status</th>
                  <th style={styles.tableHeaderCell}>Actions</th>
                </tr></thead>
                <tbody>
                  {(sectionTasks as any[]).map((task: any) => {
                    const st = task.status ?? 'pending';
                    const sc = TASK_STATUS_COLORS[st] ?? TASK_STATUS_COLORS.pending;
                    const isOverdue = st !== 'completed' && (task.dueDate ?? task.due_date) && new Date(task.dueDate ?? task.due_date) < new Date();
                    return (
                      <tr key={task.id} style={{ ...styles.tableRow, opacity: st === 'completed' ? 0.7 : 1 }}>
                        <td style={styles.tableCell}>
                          <div style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${st === 'completed' ? '#16a34a' : styles.colors.border}`, background: st === 'completed' ? '#16a34a' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => st !== 'completed' && completeTask(task.id)}>
                            {st === 'completed' && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>}
                          </div>
                        </td>
                        <td style={styles.tableCell}>
                          <div style={{ fontWeight: 500, textDecoration: st === 'completed' ? 'line-through' : 'none' }}>{task.taskName ?? task.task_name ?? task.title}</div>
                          {(task.taskDescription ?? task.task_description ?? task.description) && <div style={{ fontSize: 11, color: styles.colors.textMuted }}>{task.taskDescription ?? task.task_description ?? task.description}</div>}
                        </td>
                        <td style={styles.tableCell}><span style={{ fontSize: 12 }}>{task.assignedToName ?? task.assigned_to_name ?? task.assignedTo ?? task.assigned_to ?? '—'}</span></td>
                        <td style={styles.tableCell}><span style={{ fontSize: 12, color: isOverdue ? '#dc2626' : styles.colors.textMuted }}>{(task.dueDate ?? task.due_date) ? new Date(task.dueDate ?? task.due_date).toLocaleDateString() : '—'}{isOverdue && ' (overdue)'}</span></td>
                        <td style={styles.tableCell}><span style={{ background: sc.bg, color: sc.text, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{st}</span></td>
                        <td style={styles.tableCell}>
                          {st !== 'completed' && (
                            <div style={{ display: 'flex', gap: 4 }}>
                              {can('payroll:checklist:complete') && <button style={{ ...styles.buttonSecondary, fontSize: 11, padding: '3px 8px' }} disabled={actionLoading} onClick={() => completeTask(task.id)}>Complete</button>}
                              {can('payroll:checklist:assign') && <button style={{ ...styles.buttonSecondary, fontSize: 11, padding: '3px 8px', color: '#94a3b8' }} disabled={actionLoading} onClick={() => setAssignModal({ taskId: task.id, userId: '' })}>Assign</button>}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ))
      )}
      {assignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, width: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Assign Task</h3>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: styles.colors.textMuted }}>User ID *</label>
            <input value={assignModal.userId} onChange={e => setAssignModal({ ...assignModal, userId: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${styles.colors.border}`, fontSize: 13 }} placeholder="Enter user ID to assign" />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button style={styles.buttonSecondary} onClick={() => setAssignModal(null)}>Cancel</button>
              <button style={styles.buttonPrimary} disabled={!assignModal.userId.trim() || actionLoading} onClick={assignTask}>{actionLoading ? 'Assigning...' : 'Assign'}</button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
