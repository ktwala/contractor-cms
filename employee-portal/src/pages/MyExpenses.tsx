import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Eye,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  DollarSign,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import api from '../services/api';
import { format } from 'date-fns';

interface ExpenseClaim {
  id: string;
  claim_number: string;
  claim_date: string;
  period_start: string;
  period_end: string;
  status: string;
  total_amount: number;
  approved_amount?: number;
  currency: string;
  created_at: string;
}

export default function MyExpenses() {
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending');

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    try {
      const response = await api.get('/expenses/employees/current/claims');

      setClaims(response.data || []);
    } catch (error) {
      console.error('Failed to load expenses:', error);
      setClaims([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
      case 'paid':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending_approval':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'submitted':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'rejected':
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'draft':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
      case 'paid':
        return <CheckCircle className="w-4 h-4" />;
      case 'rejected':
      case 'cancelled':
        return <XCircle className="w-4 h-4" />;
      case 'pending_approval':
      case 'submitted':
        return <Clock className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const formatCurrency = (amount: number, currency: string = 'ZAR') => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const pendingClaims = claims.filter(c => ['draft', 'pending_approval', 'submitted'].includes(c.status));
  const displayClaims = activeTab === 'pending' ? pendingClaims : claims;

  const totalPending = pendingClaims.reduce((sum, c) => sum + c.total_amount, 0);
  const totalApproved = claims.filter(c => c.status === 'approved').reduce((sum, c) => sum + (c.approved_amount || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading your expenses...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Expenses</h1>
          <p className="text-gray-600 mt-1">Submit and track your expense claims</p>
        </div>
        <Link
          to="/expenses/create"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Claim
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Claims</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{claims.length}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Amount</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(totalPending)}
              </p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-full">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Approved Amount</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(totalApproved)}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'pending'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Pending Claims ({pendingClaims.length})
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'all'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              All Claims ({claims.length})
            </button>
          </nav>
        </div>

        {/* Claims List */}
        <div className="p-6">
          {displayClaims.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">No expense claims found</p>
              <p className="text-sm text-gray-400 mt-1">Create a new claim to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {displayClaims.map((claim) => (
                <div
                  key={claim.id}
                  className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <Link
                        to={`/expenses/${claim.id}`}
                        className="text-lg font-semibold text-blue-600 hover:text-blue-700"
                      >
                        {claim.claim_number}
                      </Link>
                      <p className="text-sm text-gray-500 mt-1">
                        Submitted on {format(new Date(claim.created_at), 'dd MMM yyyy')}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                        claim.status
                      )}`}
                    >
                      {getStatusIcon(claim.status)}
                      <span className="capitalize">{claim.status.replace('_', ' ')}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="flex items-center text-sm text-gray-600 mb-1">
                        <Calendar className="w-4 h-4 mr-1" />
                        Claim Period
                      </div>
                      <p className="text-sm font-medium text-gray-900">
                        {format(new Date(claim.period_start), 'dd MMM')} -{' '}
                        {format(new Date(claim.period_end), 'dd MMM yyyy')}
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center text-sm text-gray-600 mb-1">
                        <DollarSign className="w-4 h-4 mr-1" />
                        Total Amount
                      </div>
                      <p className="text-sm font-medium text-gray-900">
                        {formatCurrency(claim.total_amount, claim.currency)}
                      </p>
                    </div>

                    {claim.approved_amount && (
                      <div>
                        <div className="flex items-center text-sm text-gray-600 mb-1">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approved Amount
                        </div>
                        <p className="text-sm font-medium text-green-700">
                          {formatCurrency(claim.approved_amount, claim.currency)}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <Link
                      to={`/expenses/${claim.id}`}
                      className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
