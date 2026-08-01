'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-layout';
import RequirePermission from '@/components/RequirePermission';
import StatusBadge from '@/components/ui/status-badge';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions.generated';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/lib/auth-context';
import { EXTERNAL_WORKFORCE_LABELS } from '@/lib/external-workforce-labels';
import { isHcmLinkedResponsibleManagerView } from '@/lib/business-responsible-manager';
import { CheckCircle2, XCircle, ClipboardList } from 'lucide-react';

type ResponsibleManagerTask = {
  id: string;
  taskType: string;
  status: string;
  title: string;
  description?: string | null;
  dueAt?: string | null;
  engagement?: {
    role: string;
    contractor?: { firstName: string; lastName: string; email: string };
    contract?: { contractNumber: string };
  };
};

const TASK_TYPE_LABELS: Record<string, string> = {
  ACCESS_NEED_CONFIRMATION: 'Access confirmation',
  CERTIFICATION_READINESS: 'Certification',
  RENEWAL_REVIEW: 'Renewal',
  OFFBOARDING_PROMPT: 'Offboarding',
};

export default function ResponsibleManagerTasksPage() {
  const { user, can, loading: authLoading } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [tasks, setTasks] = useState<ResponsibleManagerTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('OPEN');
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user && !user.responsibleManagerAccountabilityInboxEnabled) {
      router.replace('/dashboard');
    }
  }, [authLoading, user, router]);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getResponsibleManagerTasks({
        status: statusFilter || undefined,
        limit: 50,
      });
      setTasks(res.data || []);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load sponsor tasks';
      showToast('error', message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, showToast]);

  useEffect(() => {
    if (!user?.responsibleManagerAccountabilityInboxEnabled) {
      return;
    }
    void loadTasks();
  }, [loadTasks, user?.responsibleManagerAccountabilityInboxEnabled]);

  const handleComplete = async (task: ResponsibleManagerTask) => {
    setActingId(task.id);
    try {
      await api.completeResponsibleManagerTask(task.id, {
        notes: 'Completed from sponsor task inbox',
        accessConfirmed:
          task.taskType === 'ACCESS_NEED_CONFIRMATION' ? true : undefined,
      });
      showToast('success', 'Task completed');
      await loadTasks();
    } catch {
      showToast('error', 'Could not complete task');
    } finally {
      setActingId(null);
    }
  };

  const handleDismiss = async (task: ResponsibleManagerTask) => {
    setActingId(task.id);
    try {
      await api.dismissResponsibleManagerTask(task.id, 'Dismissed from sponsor task inbox');
      showToast('success', 'Task dismissed');
      await loadTasks();
    } catch {
      showToast('error', 'Could not dismiss task');
    } finally {
      setActingId(null);
    }
  };

  const hcmSponsor = isHcmLinkedResponsibleManagerView(user, can);

  return (
    <RequirePermission permission={PERMISSIONS.RESPONSIBLE_MANAGER_TASKS.READ}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
                <ClipboardList className="w-7 h-7 text-primary-600" />
                {hcmSponsor
                  ? EXTERNAL_WORKFORCE_LABELS.myResponsibleManagerAccountability
                  : EXTERNAL_WORKFORCE_LABELS.sponsorAccountability}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Access confirmation, certification, renewal, and offboarding
                accountability for your sponsored placements.
              </p>
            </div>
            <select
              className="input max-w-xs"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="OPEN">Open</option>
              <option value="COMPLETED">Completed</option>
              <option value="DISMISSED">Dismissed</option>
              <option value="">All</option>
            </select>
          </div>

          {loading ? (
            <p className="text-gray-500">Loading tasks…</p>
          ) : tasks.length === 0 ? (
            <div className="card text-center py-12 text-gray-500">
              No tasks in this view. Tasks are created for engagements where you
              are the assigned business sponsor.
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Task
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Contractor
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    {can(PERMISSIONS.RESPONSIBLE_MANAGER_TASKS.MANAGE) && (
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tasks.map((task) => (
                    <tr key={task.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{task.title}</p>
                        <p className="text-xs text-gray-500">
                          {TASK_TYPE_LABELS[task.taskType] || task.taskType}
                          {task.engagement?.contract?.contractNumber
                            ? ` · ${task.engagement.contract.contractNumber}`
                            : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {task.engagement?.contractor
                          ? `${task.engagement.contractor.firstName} ${task.engagement.contractor.lastName}`
                          : '—'}
                        <br />
                        <span className="text-xs text-gray-400">
                          {task.engagement?.contractor?.email}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={task.status} />
                      </td>
                      {can(PERMISSIONS.RESPONSIBLE_MANAGER_TASKS.MANAGE) && (
                        <td className="px-4 py-3 text-right space-x-2">
                          {task.status === 'OPEN' && (
                            <>
                              <button
                                type="button"
                                disabled={actingId === task.id}
                                className="btn btn-sm btn-primary inline-flex items-center gap-1"
                                onClick={() => handleComplete(task)}
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                Complete
                              </button>
                              <button
                                type="button"
                                disabled={actingId === task.id}
                                className="btn btn-sm btn-secondary inline-flex items-center gap-1"
                                onClick={() => handleDismiss(task)}
                              >
                                <XCircle className="w-4 h-4" />
                                Dismiss
                              </button>
                            </>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DashboardLayout>
    </RequirePermission>
  );
}
