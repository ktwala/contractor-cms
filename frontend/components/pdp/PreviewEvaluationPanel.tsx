import React, { useState } from 'react';
import { PreviewEvaluationDto, pdpActivationService, PreviewEvaluationResponse } from '../../services/pdp-activation.service';

export const PreviewEvaluationPanel: React.FC = () => {
  const [formData, setFormData] = useState<PreviewEvaluationDto>({
    action: 'SUBMIT_TIMESHEET',
    supplierId: '',
    transactionDate: new Date().toISOString().slice(0, 10),
    contractorId: '',
    poId: '',
    organizationId: '',
  });

  const [result, setResult] = useState<PreviewEvaluationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload = {
        ...formData,
        supplierId: formData.supplierId || undefined,
        contractorId: formData.contractorId || undefined,
        poId: formData.poId || undefined,
        organizationId: formData.organizationId || undefined,
        transactionDate: new Date(formData.transactionDate).toISOString(),
      } as PreviewEvaluationDto;

      const res = await pdpActivationService.previewEvaluation(payload);
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch preview');
    } finally {
      setLoading(false);
    }
  };

  const getBadgeColor = (decision: string) => {
    switch (decision) {
      case 'ALLOW':
        return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
      case 'WARN':
        return 'bg-amber-50 text-amber-900 border border-amber-200';
      case 'APPROVAL_REQUIRED':
        return 'bg-orange-50 text-orange-900 border border-orange-200';
      case 'SOFT_BLOCK':
        return 'bg-red-50 text-red-800 border border-red-200';
      case 'HARD_BLOCK':
        return 'bg-rose-100 text-rose-900 border border-rose-300 font-semibold';
      case 'HOLD':
        return 'bg-gray-100 text-gray-800 border border-gray-200';
      default:
        return 'bg-gray-100 text-gray-700 border border-gray-200';
    }
  };

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Simulation playground</h2>
        <p className="text-sm text-gray-600 mt-1">Dry-run a transaction to see what the engine will enforce.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
        <form onSubmit={handlePreview} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
              <select
                value={formData.action}
                onChange={(e) => setFormData({ ...formData, action: e.target.value })}
                className="input w-full"
                required
              >
                <option value="SUBMIT_TIMESHEET">SUBMIT_TIMESHEET</option>
                <option value="SUBMIT_INVOICE">SUBMIT_INVOICE</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={formData.transactionDate}
                onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
                className="input w-full"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier ID</label>
            <input
              type="text"
              value={formData.supplierId}
              onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
              className="input w-full"
              placeholder="UUID from Suppliers"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contractor ID</label>
              <input
                type="text"
                value={formData.contractorId}
                onChange={(e) => setFormData({ ...formData, contractorId: e.target.value })}
                className="input w-full"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PO ID</label>
              <input
                type="text"
                value={formData.poId}
                onChange={(e) => setFormData({ ...formData, poId: e.target.value })}
                className="input w-full"
                placeholder="Optional"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organization ID</label>
            <input
              type="text"
              value={formData.organizationId}
              onChange={(e) => setFormData({ ...formData, organizationId: e.target.value })}
              className="input w-full"
              placeholder="Optional tenant scope"
            />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary w-full sm:w-auto">
            {loading ? 'Evaluating…' : 'Simulate enforcement'}
          </button>

          {error && <div className="text-sm text-red-600">{error}</div>}
        </form>

        <div className="p-6 bg-gray-50 flex flex-col justify-center items-center text-center min-h-[200px]">
          {!result && !loading && (
            <p className="text-sm text-gray-500">Enter context on the left to see the effective outcome.</p>
          )}

          {loading && <p className="text-sm text-primary-600 animate-pulse">Evaluating…</p>}

          {result && (
            <div className="w-full max-w-sm space-y-4 text-left">
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Engine decision
                </div>
                <span className={`inline-block px-2.5 py-1 rounded text-sm font-medium ${getBadgeColor(result.evaluatedDecision)}`}>
                  {result.evaluatedDecision}
                </span>
                {result.reason_code && (
                  <div className="font-mono text-sm text-gray-800 mt-2">{result.reason_code}</div>
                )}
                {result.message && <div className="text-xs text-gray-600 mt-1">{result.message}</div>}
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Final effective enforcement
                </div>
                <span className={`inline-block px-3 py-1.5 rounded-md text-base font-semibold ${getBadgeColor(result.effectiveDecision)}`}>
                  {result.effectiveDecision}
                </span>
                {result.isShadow && (
                  <p className="mt-3 text-xs text-emerald-700 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden />
                    Protected by shadow mode
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
