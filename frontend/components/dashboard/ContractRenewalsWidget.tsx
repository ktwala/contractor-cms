'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { AlertCircle, Clock, CalendarDays } from 'lucide-react';
import Link from 'next/link';

export function ContractRenewalsWidget() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    expired: 0,
    month: 0,
    quarter: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [expiredRes, monthRes, quarterRes] = await Promise.all([
        api.getContracts({ expiryState: 'expired', limit: 1 }),
        api.getContracts({ expiresWithinDays: 30, limit: 1 }),
        api.getContracts({ expiresWithinDays: 90, limit: 1 }),
      ]);

      setMetrics({
        expired: expiredRes.total || 0,
        month: monthRes.total || 0,
        quarter: quarterRes.total || 0,
      });
    } catch (error) {
      console.error('Failed to load contract renewal metrics', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="card h-full flex items-center justify-center min-h-[150px]">
        <span className="text-gray-500">Loading renewals...</span>
      </div>
    );
  }

  return (
    <div className="card h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Contract Renewals</h3>
        <Link href="/contracts" className="text-sm text-indigo-600 hover:text-indigo-800">
          View all
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="p-4 rounded-lg border border-red-200 bg-red-50 flex flex-col items-center justify-center text-center">
          <AlertCircle className="w-6 h-6 text-red-500 mb-2" />
          <span className="text-2xl font-bold text-red-700">{metrics.expired}</span>
          <span className="text-xs text-red-600 uppercase tracking-wide font-semibold mt-1">Expired</span>
        </div>

        <div className="p-4 rounded-lg border border-orange-200 bg-orange-50 flex flex-col items-center justify-center text-center">
          <Clock className="w-6 h-6 text-orange-500 mb-2" />
          <span className="text-2xl font-bold text-orange-700">{metrics.month}</span>
          <span className="text-xs text-orange-600 uppercase tracking-wide font-semibold mt-1">&lt; 30 Days</span>
        </div>

        <div className="p-4 rounded-lg border border-yellow-200 bg-yellow-50 flex flex-col items-center justify-center text-center">
          <CalendarDays className="w-6 h-6 text-yellow-500 mb-2" />
          <span className="text-2xl font-bold text-yellow-700">{metrics.quarter}</span>
          <span className="text-xs text-yellow-600 uppercase tracking-wide font-semibold mt-1">&lt; 90 Days</span>
        </div>
      </div>
    </div>
  );
}
