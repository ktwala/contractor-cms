import React from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAccess } from '../hooks/useAccess';
import * as styles from '../styles/common';

/** Permission codes aligned with EMPLOYEE_SELF_SERVICE in RBAC_SPEC. Any one in the list grants visibility. */
const NAV_ITEMS = [
  { name: 'Dashboard', href: '/', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', requiredPermissions: ['self:profile:read'] },
  { name: 'Payslips', href: '/payslips', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', requiredPermissions: ['self:payslips:read'] },
  { name: 'Tax Certificates', href: '/tax-certificates', icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z', requiredPermissions: ['self:tax:read'] },
  { name: 'Profile', href: '/profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', requiredPermissions: ['self:profile:read', 'self:profile:update'] },
  { name: 'Change Requests', href: '/change-requests', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', requiredPermissions: ['self:profile:update'] },
  { name: 'Notifications', href: '/notifications', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', requiredPermissions: ['self:profile:read'] },
  { name: 'Documents', href: '/documents', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z', requiredPermissions: ['self:profile:read'] },
  { name: 'Team Directory', href: '/team', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', requiredPermissions: ['self:profile:read'] },
  { name: 'Pay Calendar', href: '/pay-calendar', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', requiredPermissions: ['self:payslips:read'] },
  { name: 'Export Center', href: '/export', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4', requiredPermissions: ['self:profile:read'] },
  { name: 'Settings', href: '/settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', requiredPermissions: ['self:profile:read'] },
  { name: 'Help & Support', href: '/help', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', requiredPermissions: ['self:profile:read'] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { canAny } = useAccess();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navigation = NAV_ITEMS.filter((item) => canAny(item.requiredPermissions));

  const isActive = (path: string) => location.pathname === path;

  const headerStyle: React.CSSProperties = {
    background: 'white',
    borderBottom: '1px solid #e2e8f0',
    position: 'sticky' as const,
    top: 0,
    zIndex: 50,
  };

  const sidebarStyle: React.CSSProperties = {
    width: sidebarCollapsed ? '80px' : '260px',
    minHeight: 'calc(100vh - 64px)',
    background: 'white',
    borderRight: '1px solid #e2e8f0',
    transition: 'width 0.2s ease',
    position: 'fixed' as const,
    top: '64px',
    left: 0,
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
  };

  const navItemStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    padding: sidebarCollapsed ? '0.75rem' : '0.75rem 1rem',
    marginBottom: '0.25rem',
    borderRadius: '10px',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: active ? styles.colors.primary : styles.colors.textSecondary,
    background: active ? '#e0e7ff' : 'transparent',
    textDecoration: 'none',
    transition: 'all 0.15s ease',
    cursor: 'pointer',
    justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
  });

  const mobileMenuStyle: React.CSSProperties = {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 100,
    display: mobileMenuOpen ? 'block' : 'none',
  };

  const mobileDrawerStyle: React.CSSProperties = {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    width: '280px',
    height: '100%',
    background: 'white',
    zIndex: 101,
    overflowY: 'auto' as const,
    transform: mobileMenuOpen ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform 0.3s ease',
    boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
  };

  return (
    <div style={{ minHeight: '100vh', background: styles.colors.background }}>
      {/* Header */}
      <header style={headerStyle}>
        <div style={{ maxWidth: '100%', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }}
              className="mobile-menu-btn"
            >
              <svg width="24" height="24" fill="none" stroke={styles.colors.textPrimary} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '36px', height: '36px', background: styles.colors.gradientPrimary, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" fill="none" stroke="white" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: styles.colors.textPrimary }}>Hubsec Workforce</span>
            </div>
          </div>

          {/* Desktop actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }} className="desktop-actions">
            <Link to="/notifications" style={{ position: 'relative', padding: '0.5rem', borderRadius: '10px', background: styles.colors.background }}>
              <svg width="20" height="20" fill="none" stroke={styles.colors.textSecondary} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span style={{ position: 'absolute', top: '4px', right: '4px', width: '8px', height: '8px', background: styles.colors.danger, borderRadius: '50%' }}></span>
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '36px', height: '36px', background: '#e2e8f0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" fill="none" stroke={styles.colors.textSecondary} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <span style={{ fontSize: '0.875rem', fontWeight: 500, color: styles.colors.textPrimary }}>{user?.firstName || 'User'}</span>
            </div>
            <button onClick={handleLogout} style={{ ...styles.buttonSecondary, padding: '0.5rem 1rem' }}>
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </header>

      <div style={{ display: 'flex' }}>
        {/* Sidebar - Desktop */}
        <aside style={sidebarStyle} className="desktop-sidebar">
          <nav style={{ padding: '1rem' }}>
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                style={navItemStyle(isActive(item.href))}
                onMouseEnter={(e) => { if (!isActive(item.href)) e.currentTarget.style.background = '#f1f5f9'; }}
                onMouseLeave={(e) => { if (!isActive(item.href)) e.currentTarget.style.background = 'transparent'; }}
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
                {!sidebarCollapsed && <span style={{ marginLeft: '0.75rem' }}>{item.name}</span>}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Mobile Menu Overlay */}
        <div style={mobileMenuStyle} onClick={() => setMobileMenuOpen(false)} />

        {/* Mobile Drawer */}
        <div style={mobileDrawerStyle} className="mobile-drawer">
          <div style={{ padding: '1.5rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '36px', height: '36px', background: styles.colors.gradientPrimary, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" fill="none" stroke="white" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span style={{ fontSize: '1.125rem', fontWeight: 700, color: styles.colors.textPrimary }}>Hubsec Workforce</span>
            </div>
            <button onClick={() => setMobileMenuOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }}>
              <svg width="24" height="24" fill="none" stroke={styles.colors.textSecondary} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <nav style={{ padding: '1rem' }}>
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                style={navItemStyle(isActive(item.href))}
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
                <span style={{ marginLeft: '0.75rem' }}>{item.name}</span>
              </Link>
            ))}
            <button
              onClick={handleLogout}
              style={{ ...navItemStyle(false), width: '100%', border: 'none', marginTop: '1rem', color: styles.colors.danger }}
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span style={{ marginLeft: '0.75rem' }}>Logout</span>
            </button>
          </nav>
        </div>

        {/* Main Content */}
        <main style={{ flex: 1, marginLeft: '260px', minHeight: 'calc(100vh - 64px)' }} className="main-content">
          <Outlet />
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .mobile-menu-btn { display: block !important; }
          .desktop-actions { display: none !important; }
          .main-content { margin-left: 0 !important; }
        }
        @media (min-width: 769px) {
          .mobile-drawer { display: none !important; }
        }
      `}</style>
    </div>
  );
}
