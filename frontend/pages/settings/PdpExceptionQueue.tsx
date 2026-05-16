import React, { useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { PdpExceptionRequest, pdpExceptionService } from '../../services/pdp-exception.service';
import { useAuth } from '../../lib/auth-context';
import { PERMISSIONS } from '../../lib/permissions.generated';

export const PdpExceptionQueue: React.FC = () => {
  const { user, can } = useAuth();
  const [exceptions, setExceptions] = useState<PdpExceptionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED'>('PENDING');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchExceptions = async () => {
    setLoading(true);
    try {
      const res = await pdpExceptionService.listExceptions(activeTab);
      setExceptions(res);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch exceptions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExceptions();
  }, [activeTab]);

  const handleApprove = async (id: string, requestedBy: string) => {
    if (requestedBy === user?.id) {
      alert('Segregation of duties: You cannot approve your own exception request.');
      return;
    }

    const notes = window.prompt('Enter approval notes:');
    if (notes === null) return;

    const tomorrow = new Date();
    tomorrow.setHours(tomorrow.getHours() + 24);

    setProcessingId(id);
    try {
      await pdpExceptionService.approveException(id, notes, tomorrow.toISOString());
      fetchExceptions();
    } catch (err: any) {
      alert(err.message || 'Failed to approve exception');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    const notes = window.prompt('Enter rejection reason:');
    if (notes === null) return;

    setProcessingId(id);
    try {
      await pdpExceptionService.rejectException(id, notes);
      fetchExceptions();
    } catch (err: any) {
      alert(err.message || 'Failed to reject exception');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-amber-50 text-amber-900 border border-amber-200';
      case 'APPROVED':
        return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
      case 'REJECTED':
        return 'bg-red-50 text-red-800 border border-red-200';
      case 'EXPIRED':
        return 'bg-gray-100 text-gray-700 border border-gray-200';
      default:
        return 'bg-gray-100 text-gray-700 border border-gray-200';
    }
  };

  const emptyMessage =
    activeTab === 'PENDING'
      ? 'No pending exceptions found'
      : `No ${activeTab.toLowerCase()} exceptions found`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Governance Exceptions</h1>
        <p className="text-gray-600 mt-1">Review and approve temporary policy overrides</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded text-sm">{error}</div>
      )}

      <div className="card">
        <div className="border-b border-gray-200 px-4 flex flex-wrap gap-1">
          {(['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reason / action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Justification
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Requested by
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dates
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Loading exceptions…
                  </td>
                </tr>
              ) : exceptions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" aria-hidden />
                    <p className="font-medium text-gray-700">{emptyMessage}</p>
                  </td>
                </tr>
              ) : (
                exceptions.map((ex) => (
                  <tr key={ex.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded text-xs font-medium ${getStatusBadge(ex.status)}`}>
                        {ex.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-mono text-gray-900">{ex.reasonCode}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{ex.action}</div>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <div className="text-sm text-gray-800 truncate" title={ex.justification}>
                        {ex.justification}
                      </div>
                      {ex.approvalNotes && (
                        <div className="text-xs text-gray-600 mt-1 truncate" title={ex.approvalNotes}>
                          Note: {ex.approvalNotes}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{ex.requestedBy}</td>
                    <td className="px-6 py-4 text-xs text-gray-600">
                      <div>Requested: {new Date(ex.createdAt).toLocaleString()}</div>
                      {ex.expiresAt && (
                        <div className="mt-1 text-amber-800">Expires: {new Date(ex.expiresAt).toLocaleString()}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-sm">
                      {ex.status === 'PENDING' && can(PERMISSIONS.PDP_EXCEPTIONS.MANAGE) && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleReject(ex.id)}
                            disabled={processingId === ex.id}
                            className="btn btn-secondary text-sm py-1.5 px-3 disabled:opacity-50"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApprove(ex.id, ex.requestedBy)}
                            disabled={processingId === ex.id}
                            className="btn btn-primary text-sm py-1.5 px-3 disabled:opacity-50"
                          >
                            Approve (24h)
                          </button>
                        </div>
                      )}
                      {ex.status !== 'PENDING' && (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
