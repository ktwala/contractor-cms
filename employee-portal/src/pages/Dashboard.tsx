import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { format } from 'date-fns';

interface YTDStats {
  gross: number;
  paye: number;
  net: number;
  currency: string;
}

export default function Dashboard() {
  const [recentPayslips, setRecentPayslips] = useState<any[]>([]);
  const [ytdStats, setYTDStats] = useState<YTDStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [leaveBalances, setLeaveBalances] = useState<any[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [nextPayDate, setNextPayDate] = useState<string | null>(null);
  const [monthlyComparison, setMonthlyComparison] = useState<{ current: number; previous: number } | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [payslipsRes, profileRes, notificationsRes, scheduleRes] = await Promise.all([
        api.get('/self-service/payslips', { params: { limit: 6 } }),
        api.get('/self-service/profile').catch(() => ({ data: { leave_balances: [] } })),
        api.get('/self-service/notifications').catch(() => ({ data: { notifications: [] } })),
        api.get('/self-service/pay-schedule').catch(() => ({ data: { schedule: [] } })),
      ]);

      const payslips = payslipsRes.data.payslips || [];
      setRecentPayslips(payslips.slice(0, 3));

      if (payslips.length > 0) {
        const ytd = payslips.reduce((acc: any, p: any) => ({
          gross: (acc.gross || 0) + p.gross,
          paye: (acc.paye || 0) + (p.paye || 0),
          net: (acc.net || 0) + p.net,
          currency: p.currency || 'ZAR',
        }), {});
        setYTDStats(ytd);

        if (payslips.length >= 2) {
          setMonthlyComparison({
            current: payslips[0].net,
            previous: payslips[1].net,
          });
        }
      }

      setLeaveBalances(profileRes.data.leave_balances || []);
      const notifications = notificationsRes.data.notifications || [];
      setUnreadNotifications(notifications.filter((n: any) => !n.read).length);
      const schedule = scheduleRes.data.schedule || [];
      const upcoming = schedule.find((s: any) => new Date(s.pay_date) > new Date());
      if (upcoming) setNextPayDate(upcoming.pay_date);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      // Demo data
      setYTDStats({ gross: 540000, paye: 117300, net: 394200, currency: 'ZAR' });
      setMonthlyComparison({ current: 32850, previous: 31200 });
      setLeaveBalances([
        { leave_type: 'Annual', available: 15, unit: 'days' },
        { leave_type: 'Sick', available: 10, unit: 'days' },
      ]);
      setUnreadNotifications(3);
      setNextPayDate(new Date(2026, 0, 25).toISOString());
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'ZAR') => {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency }).format(amount);
  };

  // Styles
  const styles = {
    container: {
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '2rem'
    },
    header: {
      marginBottom: '2rem'
    },
    headerTitle: {
      fontSize: '2rem',
      fontWeight: '700',
      color: '#1e293b',
      marginBottom: '0.25rem'
    },
    headerSubtitle: {
      color: '#64748b',
      fontSize: '1rem'
    },
    grid4: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      gap: '1.5rem',
      marginBottom: '1.5rem'
    },
    grid3: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: '1.5rem',
      marginBottom: '1.5rem'
    },
    card: {
      background: 'white',
      borderRadius: '16px',
      padding: '1.5rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      border: '1px solid #e2e8f0',
      transition: 'all 0.2s ease'
    },
    cardHover: {
      transform: 'translateY(-2px)',
      boxShadow: '0 8px 25px rgba(0,0,0,0.1)'
    },
    highlightCard: {
      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
      color: 'white'
    },
    cardLabel: {
      fontSize: '0.875rem',
      fontWeight: '500',
      color: '#64748b',
      marginBottom: '0.5rem'
    },
    cardValue: {
      fontSize: '1.75rem',
      fontWeight: '700',
      color: '#1e293b'
    },
    iconContainer: {
      width: '48px',
      height: '48px',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    loadingContainer: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#f8fafc'
    }
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #e2e8f0',
            borderTopColor: '#6366f1',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }}></div>
          <p style={{ color: '#64748b' }}>Loading your dashboard...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>Dashboard</h1>
        <p style={styles.headerSubtitle}>Welcome back! Here's your payroll overview.</p>
      </div>

      {/* Top Row - Key Stats */}
      <div style={styles.grid4}>
        {/* Next Pay Date */}
        {nextPayDate && (
          <div style={{ ...styles.card, ...styles.highlightCard }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem' }}>Next Pay Date</p>
                <p style={{ fontSize: '2rem', fontWeight: '700' }}>
                  {format(new Date(nextPayDate), 'dd MMM')}
                </p>
                <p style={{ fontSize: '0.875rem', opacity: 0.8, marginTop: '0.25rem' }}>
                  {format(new Date(nextPayDate), 'yyyy')}
                </p>
              </div>
              <div style={{ ...styles.iconContainer, background: 'rgba(255,255,255,0.2)' }}>
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* This Month */}
        {monthlyComparison && (
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={styles.cardLabel}>This Month</p>
                <p style={styles.cardValue}>{formatCurrency(monthlyComparison.current)}</p>
                <p style={{
                  fontSize: '0.875rem',
                  marginTop: '0.5rem',
                  color: monthlyComparison.current > monthlyComparison.previous ? '#10b981' : '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}>
                  {monthlyComparison.current > monthlyComparison.previous ? (
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  )}
                  {((monthlyComparison.current - monthlyComparison.previous) / monthlyComparison.previous * 100).toFixed(1)}% vs last month
                </p>
              </div>
              <div style={{ ...styles.iconContainer, background: 'linear-gradient(135deg, #dbeafe, #e0e7ff)' }}>
                <svg width="24" height="24" fill="none" stroke="#3b82f6" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* Notifications */}
        <Link to="/notifications" style={{ textDecoration: 'none' }}>
          <div style={styles.card} className="hover-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={styles.cardLabel}>Notifications</p>
                <p style={styles.cardValue}>{unreadNotifications}</p>
                <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.5rem' }}>Unread messages</p>
              </div>
              <div style={{ ...styles.iconContainer, background: 'linear-gradient(135deg, #fae8ff, #f5d0fe)' }}>
                <svg width="24" height="24" fill="none" stroke="#a855f7" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
            </div>
          </div>
        </Link>

        {/* Leave Balance */}
        <Link to="/profile" style={{ textDecoration: 'none' }}>
          <div style={styles.card} className="hover-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={styles.cardLabel}>Leave Balance</p>
                <p style={styles.cardValue}>
                  {leaveBalances.find(l => l.leave_type === 'Annual')?.available || 15}
                </p>
                <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.5rem' }}>Days available</p>
              </div>
              <div style={{ ...styles.iconContainer, background: 'linear-gradient(135deg, #fef3c7, #fde68a)' }}>
                <svg width="24" height="24" fill="none" stroke="#f59e0b" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* YTD Stats */}
      {ytdStats && (
        <div style={styles.grid3}>
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={styles.cardLabel}>YTD Gross Earnings</p>
                <p style={{ ...styles.cardValue, fontSize: '2rem' }}>{formatCurrency(ytdStats.gross, ytdStats.currency)}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(90deg, #10b981, #34d399)', borderRadius: '3px' }}></div>
                  </div>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
                  Tax rate: {((ytdStats.paye / ytdStats.gross) * 100).toFixed(1)}%
                </p>
              </div>
              <div style={{ ...styles.iconContainer, background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)' }}>
                <svg width="28" height="28" fill="none" stroke="#059669" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={styles.cardLabel}>YTD Tax Deductions</p>
                <p style={{ ...styles.cardValue, fontSize: '2rem' }}>{formatCurrency(ytdStats.paye, ytdStats.currency)}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${(ytdStats.paye / ytdStats.gross) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #ef4444, #f87171)', borderRadius: '3px' }}></div>
                  </div>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>PAYE contributions</p>
              </div>
              <div style={{ ...styles.iconContainer, background: 'linear-gradient(135deg, #fee2e2, #fecaca)' }}>
                <svg width="28" height="28" fill="none" stroke="#dc2626" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={styles.cardLabel}>YTD Net Income</p>
                <p style={{ ...styles.cardValue, fontSize: '2rem' }}>{formatCurrency(ytdStats.net, ytdStats.currency)}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${(ytdStats.net / ytdStats.gross) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #60a5fa)', borderRadius: '3px' }}></div>
                  </div>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.5rem' }}>
                  {((ytdStats.net / ytdStats.gross) * 100).toFixed(1)}% take-home
                </p>
              </div>
              <div style={{ ...styles.iconContainer, background: 'linear-gradient(135deg, #dbeafe, #bfdbfe)' }}>
                <svg width="28" height="28" fill="none" stroke="#2563eb" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', marginBottom: '1rem' }}>Quick Actions</h2>
      <div style={styles.grid3}>
        <Link to="/payslips" style={{ textDecoration: 'none' }}>
          <div style={styles.card} className="hover-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ ...styles.iconContainer, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                <svg width="24" height="24" fill="none" stroke="white" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#1e293b' }}>View Payslips</h3>
                <p style={{ fontSize: '0.875rem', color: '#64748b' }}>Access your payment history</p>
              </div>
              <svg style={{ marginLeft: 'auto' }} width="20" height="20" fill="none" stroke="#94a3b8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </Link>

        <Link to="/tax-certificates" style={{ textDecoration: 'none' }}>
          <div style={styles.card} className="hover-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ ...styles.iconContainer, background: 'linear-gradient(135deg, #10b981, #34d399)' }}>
                <svg width="24" height="24" fill="none" stroke="white" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#1e293b' }}>Tax Certificates</h3>
                <p style={{ fontSize: '0.875rem', color: '#64748b' }}>Download IRP5 forms</p>
              </div>
              <svg style={{ marginLeft: 'auto' }} width="20" height="20" fill="none" stroke="#94a3b8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </Link>

        <Link to="/profile" style={{ textDecoration: 'none' }}>
          <div style={styles.card} className="hover-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ ...styles.iconContainer, background: 'linear-gradient(135deg, #f59e0b, #fbbf24)' }}>
                <svg width="24" height="24" fill="none" stroke="white" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#1e293b' }}>My Profile</h3>
                <p style={{ fontSize: '0.875rem', color: '#64748b' }}>View and edit your details</p>
              </div>
              <svg style={{ marginLeft: 'auto' }} width="20" height="20" fill="none" stroke="#94a3b8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </Link>
      </div>

      {/* Recent Payslips */}
      <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', margin: '2rem 0 1rem' }}>Recent Payslips</h2>
      <div style={{ ...styles.card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: '500', color: '#64748b' }}>Payment History</span>
          <Link to="/payslips" style={{ fontSize: '0.875rem', color: '#6366f1', textDecoration: 'none', fontWeight: '500' }}>
            View all →
          </Link>
        </div>
        {recentPayslips.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            <svg style={{ margin: '0 auto 1rem' }} width="48" height="48" fill="none" stroke="#cbd5e1" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            No payslips available yet
          </div>
        ) : (
          recentPayslips.map((payslip, index) => (
            <div key={payslip.id} style={{
              padding: '1rem 1.5rem',
              borderBottom: index < recentPayslips.length - 1 ? '1px solid #f1f5f9' : 'none',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              transition: 'background 0.2s'
            }} className="hover-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '40px', height: '40px', background: '#f1f5f9', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" fill="none" stroke="#64748b" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p style={{ fontWeight: '500', color: '#1e293b' }}>
                    {format(new Date(payslip.period_end), 'MMMM yyyy')}
                  </p>
                  <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    {format(new Date(payslip.period_start), 'dd MMM')} - {format(new Date(payslip.period_end), 'dd MMM yyyy')}
                  </p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Net Pay</p>
                <p style={{ fontWeight: '600', color: '#1e293b', fontSize: '1.125rem' }}>
                  {formatCurrency(payslip.net)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        .hover-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.1);
        }
        .hover-row:hover {
          background: #f8fafc;
        }
      `}</style>
    </div>
  );
}
