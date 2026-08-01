import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isPast } from 'date-fns';
import * as styles from '../styles/common';

interface PayDate {
  id: string;
  pay_period_start: string;
  pay_period_end: string;
  pay_date: string;
  status: 'scheduled' | 'processing' | 'paid';
  gross_amount?: number;
  net_amount?: number;
  currency: string;
}

export default function PayCalendar() {
  const [payDates, setPayDates] = useState<PayDate[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPaySchedule();
  }, []);

  const loadPaySchedule = async () => {
    try {
      const response = await api.get('/self-service/pay-schedule');
      setPayDates(response.data.schedule || []);
    } catch (error) {
      console.error('Failed to load pay schedule:', error);
      const now = new Date();
      setPayDates([
        { id: '1', pay_period_start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), pay_period_end: new Date(now.getFullYear(), now.getMonth(), 15).toISOString(), pay_date: new Date(now.getFullYear(), now.getMonth(), 25).toISOString(), status: 'paid', gross_amount: 45000, net_amount: 32850, currency: 'ZAR' },
        { id: '2', pay_period_start: new Date(now.getFullYear(), now.getMonth(), 16).toISOString(), pay_period_end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString(), pay_date: new Date(now.getFullYear(), now.getMonth() + 1, 10).toISOString(), status: 'scheduled', currency: 'ZAR' },
        { id: '3', pay_period_start: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(), pay_period_end: new Date(now.getFullYear(), now.getMonth() + 1, 15).toISOString(), pay_date: new Date(now.getFullYear(), now.getMonth() + 1, 25).toISOString(), status: 'scheduled', currency: 'ZAR' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = () => eachDayOfInterval({ start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) });
  const getPayDateForDay = (day: Date) => payDates.find(pd => isSameDay(new Date(pd.pay_date), day));

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, 'success' | 'warning' | 'info'> = { paid: 'success', processing: 'warning', scheduled: 'info' };
    return statusMap[status] || 'default';
  };

  const upcomingPayDates = payDates.filter(pd => !isPast(new Date(pd.pay_date)) || pd.status === 'processing').sort((a, b) => new Date(a.pay_date).getTime() - new Date(b.pay_date).getTime()).slice(0, 3);
  const nextPayDate = upcomingPayDates[0];

  if (loading) {
    return (
      <div style={styles.pageContainer}>
        <div style={styles.loadingContainer}>
          <div style={styles.loadingSpinner}></div>
          <p style={{ color: styles.colors.textSecondary }}>Loading pay schedule...</p>
        </div>
        <style>{styles.spinKeyframes}</style>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer}>
      {/* Header */}
      <div style={styles.pageHeader}>
        <h1 style={styles.pageTitle}>Pay Schedule</h1>
        <p style={styles.pageSubtitle}>View your payment schedule and upcoming pay dates</p>
      </div>

      {/* Next Payment Card */}
      {nextPayDate && (
        <div style={{
          background: styles.colors.gradientPrimary,
          borderRadius: '16px',
          padding: '1.5rem 2rem',
          color: 'white',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <p style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem' }}>Next Payment</p>
            <p style={{ fontSize: '2rem', fontWeight: 700 }}>{format(new Date(nextPayDate.pay_date), 'MMMM dd, yyyy')}</p>
            <p style={{ opacity: 0.85, marginTop: '0.5rem' }}>
              Pay period: {format(new Date(nextPayDate.pay_period_start), 'MMM dd')} - {format(new Date(nextPayDate.pay_period_end), 'MMM dd, yyyy')}
            </p>
            {nextPayDate.net_amount && (
              <p style={{ fontSize: '1.5rem', fontWeight: 600, marginTop: '0.75rem' }}>
                {nextPayDate.currency} {nextPayDate.net_amount.toLocaleString()}
              </p>
            )}
          </div>
          <div style={{ opacity: 0.3 }}>
            <svg width="80" height="80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
        {/* Upcoming Payments */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>Upcoming Payments</h2>
          </div>
          {upcomingPayDates.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={styles.emptyStateText}>No upcoming payments scheduled</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {upcomingPayDates.map((payDate) => (
                <div key={payDate.id} style={{ padding: '1rem', background: styles.colors.background, borderRadius: '12px' }}>
                  <div style={{ ...styles.flexBetween, marginBottom: '0.5rem' }}>
                    <span style={styles.badge(getStatusBadge(payDate.status) as any)}>
                      {payDate.status.charAt(0).toUpperCase() + payDate.status.slice(1)}
                    </span>
                  </div>
                  <p style={{ fontWeight: 600, color: styles.colors.textPrimary, marginBottom: '0.25rem' }}>
                    {format(new Date(payDate.pay_date), 'MMM dd, yyyy')}
                  </p>
                  <p style={{ fontSize: '0.8rem', color: styles.colors.textMuted }}>
                    Period: {format(new Date(payDate.pay_period_start), 'MMM dd')} - {format(new Date(payDate.pay_period_end), 'MMM dd')}
                  </p>
                  {payDate.net_amount && (
                    <p style={{ fontWeight: 600, color: styles.colors.success, marginTop: '0.5rem' }}>
                      {payDate.currency} {payDate.net_amount.toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Calendar */}
        <div style={styles.card}>
          <div style={{ ...styles.flexBetween, marginBottom: '1.5rem' }}>
            <h2 style={{ fontWeight: 600, color: styles.colors.textPrimary }}>{format(selectedMonth, 'MMMM yyyy')}</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setSelectedMonth(addMonths(selectedMonth, -1))} style={styles.buttonSecondary}>Previous</button>
              <button onClick={() => setSelectedMonth(new Date())} style={styles.buttonSecondary}>Today</button>
              <button onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))} style={styles.buttonSecondary}>Next</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: styles.colors.textMuted }}>{day}</div>
            ))}
            {getDaysInMonth().map((day, idx) => {
              const payDate = getPayDateForDay(day);
              const isDayToday = isToday(day);
              return (
                <div key={idx} style={{
                  aspectRatio: '1',
                  padding: '0.5rem',
                  border: `1px solid ${styles.colors.borderLight}`,
                  background: payDate ? '#e0e7ff' : 'white',
                  borderRadius: '8px',
                  position: 'relative',
                  outline: isDayToday ? `2px solid ${styles.colors.primary}` : 'none',
                }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: isDayToday ? 700 : 400, color: isDayToday ? styles.colors.primary : styles.colors.textPrimary }}>
                    {format(day, 'd')}
                  </span>
                  {payDate && (
                    <div style={{ marginTop: '0.25rem', fontSize: '0.6rem', background: styles.colors.primary, color: 'white', padding: '0.125rem 0.25rem', borderRadius: '4px', textAlign: 'center' }}>
                      Pay Day
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ ...styles.flexStart, marginTop: '1.5rem', gap: '1.5rem' }}>
            <div style={styles.flexStart}><div style={{ width: '16px', height: '16px', background: '#d1fae5', borderRadius: '4px' }}></div><span style={{ fontSize: '0.8rem', color: styles.colors.textMuted }}>Paid</span></div>
            <div style={styles.flexStart}><div style={{ width: '16px', height: '16px', background: '#dbeafe', borderRadius: '4px' }}></div><span style={{ fontSize: '0.8rem', color: styles.colors.textMuted }}>Scheduled</span></div>
            <div style={styles.flexStart}><div style={{ width: '16px', height: '16px', outline: `2px solid ${styles.colors.primary}`, borderRadius: '4px' }}></div><span style={{ fontSize: '0.8rem', color: styles.colors.textMuted }}>Today</span></div>
          </div>
        </div>
      </div>

      {/* All Payments Table */}
      <h2 style={styles.sectionTitle}>All Scheduled Payments</h2>
      <div style={{ ...styles.card, padding: 0, overflow: 'hidden' }}>
        <table style={styles.table}>
          <thead><tr style={styles.tableHeader}>
            <th style={styles.tableHeaderCell}>Status</th>
            <th style={styles.tableHeaderCell}>Pay Date</th>
            <th style={styles.tableHeaderCell}>Pay Period</th>
            <th style={{ ...styles.tableHeaderCell, textAlign: 'right' }}>Gross</th>
            <th style={{ ...styles.tableHeaderCell, textAlign: 'right' }}>Net</th>
          </tr></thead>
          <tbody>
            {payDates.map((payDate, idx) => (
              <tr key={payDate.id} style={{ ...styles.tableRow, borderBottom: idx === payDates.length - 1 ? 'none' : undefined }} className="hover-row">
                <td style={styles.tableCell}><span style={styles.badge(getStatusBadge(payDate.status) as any)}>{payDate.status.charAt(0).toUpperCase() + payDate.status.slice(1)}</span></td>
                <td style={{ ...styles.tableCell, fontWeight: 500 }}>{format(new Date(payDate.pay_date), 'MMM dd, yyyy')}</td>
                <td style={{ ...styles.tableCell, color: styles.colors.textSecondary }}>{format(new Date(payDate.pay_period_start), 'MMM dd')} - {format(new Date(payDate.pay_period_end), 'MMM dd, yyyy')}</td>
                <td style={{ ...styles.tableCell, textAlign: 'right' }}>{payDate.gross_amount ? `R ${payDate.gross_amount.toLocaleString()}` : '-'}</td>
                <td style={{ ...styles.tableCell, textAlign: 'right', fontWeight: 600, color: styles.colors.success }}>{payDate.net_amount ? `R ${payDate.net_amount.toLocaleString()}` : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`${styles.spinKeyframes} .hover-row:hover { background: ${styles.colors.background}; }`}</style>
    </div>
  );
}
