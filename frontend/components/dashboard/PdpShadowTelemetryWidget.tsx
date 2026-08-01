"use client";

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { POLICY_EVALUATION_LABELS } from '@/lib/policy-evaluation-labels';

const Card = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => <div className={`rounded-xl ${className}`}>{children}</div>;
const CardHeader = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => <div className={`p-6 ${className}`}>{children}</div>;
const CardTitle = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => <h3 className={`font-semibold leading-none tracking-tight ${className}`}>{children}</h3>;
const CardContent = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => <div className={`p-6 pt-0 ${className}`}>{children}</div>;
const Badge = ({ children, className = '' }: { children: React.ReactNode, className?: string, variant?: string }) => <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${className}`}>{children}</span>;

export function PdpShadowTelemetryWidget() {
  const [telemetry, setTelemetry] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTelemetry() {
      try {
        const data = await api.getPdpTelemetry(30);
        setTelemetry(data);
      } catch (error) {
        console.error('Failed to fetch PDP telemetry:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchTelemetry();
  }, []);

  if (loading) return <Card><CardContent className="p-6">Loading policy evaluation telemetry…</CardContent></Card>;
  if (!telemetry) return <Card><CardContent className="p-6">Failed to load policy evaluation telemetry.</CardContent></Card>;

  return (
    <Card className="col-span-full xl:col-span-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-white shadow-md">
      <CardHeader className="pb-2 border-b border-indigo-100">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-semibold text-indigo-900">
            {POLICY_EVALUATION_LABELS.shadowTelemetryTitle}
          </CardTitle>
          <Badge variant="outline" className="border-indigo-300 text-indigo-700 bg-indigo-100">
            Evaluating Only
          </Badge>
        </div>
        <p className="text-xs text-indigo-600 mt-1">Simulated blocks over the last 30 days (No production workflows halted)</p>
      </CardHeader>
      
      <CardContent className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <p className="text-sm text-slate-500 font-medium">Evaluations</p>
            <p className="text-2xl font-bold text-slate-800">{telemetry.totalEvaluations}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <p className="text-sm text-slate-500 font-medium">Shadow Blocks</p>
            <p className="text-2xl font-bold text-red-600">{telemetry.shadowBlocks}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <p className="text-sm text-slate-500 font-medium">Shadow Holds</p>
            <p className="text-2xl font-bold text-orange-500">{telemetry.shadowHolds}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <p className="text-sm text-slate-500 font-medium">Approvals Req.</p>
            <p className="text-2xl font-bold text-yellow-600">{telemetry.approvalRequired}</p>
          </div>
        </div>

        {telemetry.topReasonCodes && telemetry.topReasonCodes.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Top Governance Friction Points</h4>
            <div className="space-y-2">
              {telemetry.topReasonCodes.map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-100">
                  <span className="text-sm font-mono text-slate-800">{item.reason_code}</span>
                  <span className="text-sm font-semibold text-slate-600 px-2 py-1 bg-white rounded shadow-sm">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
