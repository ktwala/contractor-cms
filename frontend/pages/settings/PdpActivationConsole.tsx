import React, { useEffect, useState } from 'react';
import { Plus, ShieldAlert, Shield } from 'lucide-react';
import { ActivationRuleModal } from '../../components/pdp/ActivationRuleModal';
import { PreviewEvaluationPanel } from '../../components/pdp/PreviewEvaluationPanel';
import { PdpActivationRule, pdpActivationService } from '../../services/pdp-activation.service';
import { useAuth } from '../../lib/auth-context';
import { PERMISSIONS } from '../../lib/permissions.generated';

export const PdpActivationConsole: React.FC = () => {
  const { can } = useAuth();
  const [rules, setRules] = useState<PdpActivationRule[]>([]);
  const [isEmergencyOverride, setIsEmergencyOverride] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PdpActivationRule | undefined>();

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await pdpActivationService.listRules();
      setRules(res.rules);
      setIsEmergencyOverride(res.isEmergencyOverrideActive);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleCreate = () => {
    setEditingRule(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (rule: PdpActivationRule) => {
    setEditingRule(rule);
    setIsModalOpen(true);
  };

  const handleDowngradeToShadow = async (rule: PdpActivationRule) => {
    if (!window.confirm('Are you sure you want to downgrade this rule to SHADOW?')) return;
    try {
      await pdpActivationService.updateRule(rule.id, { enforcementLevel: 'SHADOW' });
      fetchRules();
    } catch (err: any) {
      alert(err.message || 'Failed to downgrade rule');
    }
  };

  const handleDisable = async (rule: PdpActivationRule) => {
    const notes = window.prompt('Please provide a reason for disabling this rule:');
    if (notes === null) return;
    try {
      await pdpActivationService.disableRule(rule.id, notes);
      fetchRules();
    } catch (err: any) {
      alert(err.message || 'Failed to disable rule');
    }
  };

  const getBadgeColor = (level: string) => {
    switch (level) {
      case 'SHADOW':
        return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
      case 'WARN':
        return 'bg-amber-50 text-amber-900 border border-amber-200';
      case 'APPROVAL_REQUIRED':
        return 'bg-orange-50 text-orange-900 border border-orange-200';
      case 'SOFT_BLOCK':
        return 'bg-red-50 text-red-800 border border-red-200';
      case 'HARD_BLOCK':
        return 'bg-rose-100 text-rose-900 border border-rose-300 font-semibold';
      default:
        return 'bg-gray-100 text-gray-700 border border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Governance Activation</h1>
          <p className="text-gray-600 mt-1">
            Control policy rollout and simulate enforcement decisions
          </p>
        </div>
        {can(PERMISSIONS.PDP_ACTIVATION.MANAGE) && (
          <button type="button" onClick={handleCreate} className="btn btn-primary flex items-center">
            <Plus className="w-4 h-4 mr-2" />
            New Activation Rule
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded relative text-sm">{error}</div>
      )}

      {isEmergencyOverride && (
        <div className="bg-red-50 border border-red-200 text-red-900 px-4 py-3 rounded-lg flex items-start gap-3">
          <ShieldAlert className="w-6 h-6 shrink-0 text-red-600 mt-0.5" aria-hidden />
          <div>
            <h3 className="font-semibold">Emergency override active</h3>
            <p className="text-sm text-red-800 mt-1">
              All PDP enforcement rules are globally bypassed. The engine is running in absolute SHADOW mode.
            </p>
          </div>
        </div>
      )}

      <PreviewEvaluationPanel />

      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Active rollout rules</h2>
          <span className="text-sm text-gray-500">
            {rules.filter((r) => r.isActive).length} active
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Level
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Target reason / action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Scope (env / org)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rollout
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    Loading activation rules…
                  </td>
                </tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" aria-hidden />
                    <p className="font-medium text-gray-700">No activation rules yet</p>
                    <p className="text-sm mt-1 max-w-md mx-auto">
                      Create a rule to roll out enforcement beyond default SHADOW behavior, or use the simulation
                      playground above to preview decisions.
                    </p>
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr
                    key={rule.id}
                    className={`hover:bg-gray-50 ${!rule.isActive ? 'opacity-60' : ''}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      {rule.isActive ? (
                        <span
                          className="inline-flex w-2.5 h-2.5 rounded-full bg-emerald-500"
                          title="Active"
                          aria-label="Active"
                        />
                      ) : (
                        <span
                          className="inline-flex w-2.5 h-2.5 rounded-full bg-gray-300"
                          title="Inactive"
                          aria-label="Inactive"
                        />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded text-xs font-medium ${getBadgeColor(rule.enforcementLevel)}`}>
                        {rule.enforcementLevel}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-mono text-gray-900">{rule.reasonCode || '*'}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{rule.action || 'Any action'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      <div>{rule.environment}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {rule.organizationId || rule.domain || 'Global'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-primary-600" style={{ width: `${rule.rolloutPercent}%` }} />
                        </div>
                        <span className="text-xs text-gray-600">{rule.rolloutPercent}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-800">{rule.priority}</td>
                    <td className="px-6 py-4 text-right text-sm">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        {can(PERMISSIONS.PDP_ACTIVATION.MANAGE) && rule.isActive && rule.enforcementLevel !== 'SHADOW' && (
                          <button
                            type="button"
                            onClick={() => handleDowngradeToShadow(rule)}
                            className="text-emerald-700 hover:text-emerald-900 text-xs font-medium"
                          >
                            Downgrade to shadow
                          </button>
                        )}
                        {can(PERMISSIONS.PDP_ACTIVATION.MANAGE) && (
                          <button
                            type="button"
                            onClick={() => handleEdit(rule)}
                            className="text-primary-600 hover:text-primary-900 font-medium"
                          >
                            Edit
                          </button>
                        )}
                        {can(PERMISSIONS.PDP_ACTIVATION.MANAGE) && rule.isActive && (
                          <button
                            type="button"
                            onClick={() => handleDisable(rule)}
                            className="text-red-600 hover:text-red-800 font-medium"
                          >
                            Disable
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <ActivationRuleModal
          rule={editingRule}
          onClose={() => setIsModalOpen(false)}
          onSave={() => {
            setIsModalOpen(false);
            fetchRules();
          }}
        />
      )}
    </div>
  );
};
