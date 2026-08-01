'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { auditApi } from '@/lib/api-audit';
import { PERMISSIONS } from '@/lib/permissions.generated';
import SummaryCards from '@/components/audit-insights/SummaryCards';
import HighRiskTable from '@/components/audit-insights/HighRiskTable';
import RoleChangeTimeline from '@/components/audit-insights/RoleChangeTimeline';
import { ShieldCheck, Calendar, Filter } from 'lucide-react';

export default function AuditInsightsPage() {
  const { can } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [insights, setInsights] = useState<any>(null);
  
  // Date filtering state (default to last 7 days for better initial UX)
  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() - 7);
  
  const [startDate, setStartDate] = useState(defaultStart.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!can(PERMISSIONS.AUDIT.READ)) return;
    loadInsights();
  }, [can]);

  const toApiDate = (value: string | Date): string => {
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }
    return value.replaceAll('/', '-');
  };

  const loadInsights = async () => {
    try {
      setLoading(true);
      setError('');
      
      const startParam = toApiDate(startDate);
      const endParam = toApiDate(endDate);

      const data = await auditApi.getAuditInsights(startParam, endParam);
      setInsights(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load audit insights');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    loadInsights();
  };

  if (!can(PERMISSIONS.AUDIT.READ)) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-gray-500">You do not have permission to view audit insights.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <ShieldCheck className="w-6 h-6 mr-2 text-indigo-600" />
            Security & Audit Insights
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Actionable intelligence derived from immutable audit logs.
          </p>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleApplyFilters} className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="date"
                className="input pl-10"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="date"
                className="input pl-10"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center">
            <button type="submit" className="btn btn-primary flex items-center" disabled={loading}>
              <Filter className="w-4 h-4 mr-2" />
              {loading ? 'Filtering...' : 'Apply Filter'}
            </button>
          </div>
        </form>
        <p className="text-xs text-gray-500 mt-2">* Note: Queries are restricted to a maximum window of 30 days.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {loading && !insights ? (
        <div className="flex justify-center items-center h-64">
          <p className="text-gray-500">Aggregating security signals...</p>
        </div>
      ) : insights ? (
        <div className="space-y-6">
          <SummaryCards summary={insights.summary} />
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {insights.anomalies && insights.anomalies.length > 0 && (
                <HighRiskTable 
                  events={insights.anomalies} 
                  title="System Anomalies (Rate Limits & Spoofing)" 
                />
              )}

              <HighRiskTable 
                events={insights.highRiskEvents} 
                title="High-Risk Actions" 
              />
              
              <HighRiskTable 
                events={insights.failedActions} 
                title="Failed Privileged Actions" 
              />
              
              {/* Cross Org Attempts (Using same table structure since shape is similar) */}
              <HighRiskTable 
                events={insights.crossOrgAttempts.map((e: any) => ({
                  ...e,
                  riskLevel: e.result === 'success' ? 'critical' : 'medium',
                  reason: `Cross-org access ${e.result}`
                }))}
                title="Cross-Organization Access Attempts" 
              />
            </div>
            
            <div>
              <RoleChangeTimeline timelines={insights.roleChangeTimeline} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
