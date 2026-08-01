import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { format } from 'date-fns';
import * as styles from '../styles/common';

interface Notification {
  id: string;
  type: 'payslip' | 'approval' | 'announcement' | 'info';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  link?: string;
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const response = await api.get('/self-service/notifications');
      setNotifications(response.data.notifications || []);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      // Demo data
      setNotifications([
        { id: '1', type: 'payslip', title: 'New Payslip Available', message: 'Your payslip for January 2026 is now available.', read: false, created_at: new Date().toISOString(), link: '/payslips' },
        { id: '2', type: 'approval', title: 'Change Request Approved', message: 'Your bank account change has been approved.', read: false, created_at: new Date(Date.now() - 86400000).toISOString() },
        { id: '3', type: 'announcement', title: 'Public Holiday Reminder', message: 'The office will be closed on Monday.', read: true, created_at: new Date(Date.now() - 172800000).toISOString() },
        { id: '4', type: 'info', title: 'Tax Certificate Ready', message: 'Your IRP5 is now available for download.', read: true, created_at: new Date(Date.now() - 259200000).toISOString(), link: '/tax-certificates' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = (id: string) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const getIcon = (type: string) => {
    const iconStyle = { width: 20, height: 20 };
    switch (type) {
      case 'payslip':
        return <svg {...iconStyle} fill="none" stroke="#3b82f6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
      case 'approval':
        return <svg {...iconStyle} fill="none" stroke="#10b981" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
      case 'announcement':
        return <svg {...iconStyle} fill="none" stroke="#f59e0b" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;
      default:
        return <svg {...iconStyle} fill="none" stroke="#6366f1" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    }
  };

  const getIconBg = (type: string) => {
    switch (type) {
      case 'payslip': return '#dbeafe';
      case 'approval': return '#d1fae5';
      case 'announcement': return '#fef3c7';
      default: return '#e0e7ff';
    }
  };

  const filteredNotifications = filter === 'unread' ? notifications.filter(n => !n.read) : notifications;
  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div style={styles.pageContainer}>
        <div style={styles.loadingContainer}>
          <div style={styles.loadingSpinner}></div>
          <p style={{ color: styles.colors.textSecondary }}>Loading notifications...</p>
        </div>
        <style>{styles.spinKeyframes}</style>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer}>
      {/* Header */}
      <div style={{ ...styles.flexBetween, ...styles.pageHeader }}>
        <div>
          <h1 style={styles.pageTitle}>Notifications</h1>
          <p style={styles.pageSubtitle}>
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllAsRead} style={styles.buttonSecondary}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Mark all as read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={styles.tabContainer}>
        <button onClick={() => setFilter('all')} style={styles.tab(filter === 'all')}>
          All ({notifications.length})
        </button>
        <button onClick={() => setFilter('unread')} style={styles.tab(filter === 'unread')}>
          Unread ({unreadCount})
        </button>
      </div>

      {/* Content */}
      {filteredNotifications.length === 0 ? (
        <div style={{ ...styles.card, ...styles.emptyState }}>
          <svg style={styles.emptyStateIcon} width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <h3 style={styles.emptyStateTitle}>No notifications</h3>
          <p style={styles.emptyStateText}>
            {filter === 'unread' ? 'You have no unread notifications' : 'You have no notifications yet'}
          </p>
        </div>
      ) : (
        <div style={{ ...styles.card, padding: 0, overflow: 'hidden' }}>
          {filteredNotifications.map((notification, index) => (
            <div
              key={notification.id}
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: index < filteredNotifications.length - 1 ? `1px solid ${styles.colors.borderLight}` : 'none',
                background: !notification.read ? '#f0f9ff' : 'white',
                transition: 'background 0.2s',
              }}
            >
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={styles.iconContainerSmall(getIconBg(notification.type))}>
                  {getIcon(notification.type)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <h3 style={{ fontWeight: 600, color: styles.colors.textPrimary, fontSize: '0.95rem' }}>
                      {notification.title}
                    </h3>
                    {!notification.read && <span style={styles.badge('info')}>New</span>}
                  </div>
                  <p style={{ color: styles.colors.textSecondary, fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                    {notification.message}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontSize: '0.75rem', color: styles.colors.textMuted }}>
                      {format(new Date(notification.created_at), "MMM dd, yyyy 'at' h:mm a")}
                    </span>
                    {notification.link && (
                      <a href={notification.link} style={{ fontSize: '0.8rem', color: styles.colors.primary, textDecoration: 'none', fontWeight: 500 }}>
                        View details →
                      </a>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {!notification.read && (
                    <button
                      onClick={() => markAsRead(notification.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '8px', color: styles.colors.textMuted }}
                      title="Mark as read"
                    >
                      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotification(notification.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '8px', color: styles.colors.textMuted }}
                    title="Delete"
                  >
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{styles.spinKeyframes}</style>
    </div>
  );
}
