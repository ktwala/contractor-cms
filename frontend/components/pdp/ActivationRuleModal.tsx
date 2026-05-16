import React, { useState } from 'react';
import { PdpActivationRule, pdpActivationService } from '../../services/pdp-activation.service';

interface ActivationRuleModalProps {
  rule?: PdpActivationRule;
  onClose: () => void;
  onSave: () => void;
}

export const ActivationRuleModal: React.FC<ActivationRuleModalProps> = ({ rule, onClose, onSave }) => {
  const isEdit = !!rule;
  
  const [formData, setFormData] = useState<Partial<PdpActivationRule>>({
    enforcementLevel: rule?.enforcementLevel || 'WARN',
    environment: rule?.environment || 'production',
    reasonCode: rule?.reasonCode || '',
    action: rule?.action || '',
    domain: rule?.domain || '',
    organizationId: rule?.organizationId || '',
    rolloutPercent: rule?.rolloutPercent ?? 100,
    priority: rule?.priority ?? 0,
    expiresAt: rule?.expiresAt ? new Date(rule.expiresAt).toISOString().slice(0, 16) : '',
    approvedBy: rule?.approvedBy || '',
    notes: rule?.notes || '',
    isActive: rule?.isActive ?? true
  });
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isHardBlock = formData.enforcementLevel === 'HARD_BLOCK';
  const isProd = formData.environment === 'production';
  const isGlobal = !formData.organizationId && !formData.domain;

  const requiresApproval = isHardBlock && isProd;
  const requiresExpiry = isHardBlock && isGlobal;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (requiresApproval && !formData.approvedBy) {
      setError('HARD_BLOCK in production requires explicit executive approval (approvedBy).');
      setLoading(false);
      return;
    }

    if (requiresExpiry && !formData.expiresAt) {
      setError('Global HARD_BLOCK rules must have an expiry date to prevent permanent platform lockouts.');
      setLoading(false);
      return;
    }

    try {
      const payload = {
        ...formData,
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt as string).toISOString() : undefined,
        // cleanup empty strings
        reasonCode: formData.reasonCode || undefined,
        action: formData.action || undefined,
        domain: formData.domain || undefined,
        organizationId: formData.organizationId || undefined,
      };

      if (isEdit && rule) {
        await pdpActivationService.updateRule(rule.id, payload);
      } else {
        await pdpActivationService.createRule(payload);
      }
      onSave();
    } catch (err: any) {
      setError(err.message || 'Failed to save rule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
      <div className="bg-white border border-gray-200 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">{isEdit ? 'Edit Activation Rule' : 'New Activation Rule'}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none" aria-label="Close">
            &times;
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded text-sm flex items-start gap-2">
              <span aria-hidden>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {requiresApproval && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded text-sm">
              <strong>Production HARD_BLOCK.</strong> Executive approval is required before activating this rule.
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Enforcement level *</label>
              <select
                value={formData.enforcementLevel}
                onChange={(e) => setFormData({ ...formData, enforcementLevel: e.target.value })}
                className="input w-full"
                required
              >
                <option value="SHADOW">Shadow (allow & audit)</option>
                <option value="WARN">Warn user</option>
                <option value="APPROVAL_REQUIRED">Require approval</option>
                <option value="SOFT_BLOCK">Soft block (overrideable)</option>
                <option value="HARD_BLOCK">Hard block</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Environment *</label>
              <select
                value={formData.environment}
                onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                className="input w-full"
                required
              >
                <option value="development">Development</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason code</label>
              <input
                type="text"
                placeholder="e.g. POST_EXPIRY_LABOR_PROHIBITED"
                value={formData.reasonCode}
                onChange={(e) => setFormData({ ...formData, reasonCode: e.target.value })}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
              <select
                value={formData.action}
                onChange={(e) => setFormData({ ...formData, action: e.target.value })}
                className="input w-full"
              >
                <option value="">Any</option>
                <option value="SUBMIT_TIMESHEET">SUBMIT_TIMESHEET</option>
                <option value="SUBMIT_INVOICE">SUBMIT_INVOICE</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target organization (tenant)</label>
              <input
                type="text"
                placeholder="Leave blank for global"
                value={formData.organizationId}
                onChange={(e) => setFormData({ ...formData, organizationId: e.target.value })}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Governance domain</label>
              <input
                type="text"
                placeholder="e.g. FINANCIAL"
                value={formData.domain}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                className="input w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rollout percent (0–100) *</label>
              <input
                type="number"
                min={0}
                max={100}
                value={formData.rolloutPercent}
                onChange={(e) => setFormData({ ...formData, rolloutPercent: parseInt(e.target.value, 10) })}
                className="input w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority (higher wins) *</label>
              <input
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value, 10) })}
                className="input w-full"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expiry date {requiresExpiry && <span className="text-red-600">*</span>}
              </label>
              <input
                type="datetime-local"
                value={formData.expiresAt}
                onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                className={`input w-full ${requiresExpiry && !formData.expiresAt ? 'border-red-500' : ''}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Approved by {requiresApproval && <span className="text-red-600">*</span>}
              </label>
              <input
                type="text"
                placeholder="Name or title"
                value={formData.approvedBy}
                onChange={(e) => setFormData({ ...formData, approvedBy: e.target.value })}
                className={`input w-full ${requiresApproval && !formData.approvedBy ? 'border-red-500' : ''}`}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes / justification</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input w-full h-24"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary disabled:opacity-50">
              {loading ? 'Saving…' : 'Save activation rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
