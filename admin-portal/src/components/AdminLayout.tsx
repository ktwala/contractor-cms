import React from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import * as styles from '../styles/common';
import { useAccess } from '../hooks/useAccess';
import { refreshAdminSessionFromApi } from '../lib/syncAdminSession';
import { AppShell, TopBar, ui } from '../ui/layout';

/** Permission codes aligned with backend RBAC (docs/RBAC_SPEC.md). Any one in the list grants visibility. */

type NavItem = {
  name: string;
  href: string;
  icon: string;
  requiredPermissions?: string[];
};

type NavSection = {
  title: string;
  items: NavItem[];
};

type NavGroup = {
  title: string;
  requiredPermissions: string[];
  sections?: NavSection[];
  items?: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Dashboard',
    requiredPermissions: [
      'iam:legal_entities:manage',
      'iam:roles:manage',
      'iam:users:manage',
      'employee:read',
      'employment:read',
      'payrun:read',
      'sars:irp5:read',
      'audit:events:read',
      'hr:read',
    ],
    items: [
      {
        name: 'Overview',
        href: '/dashboard',
        icon: 'M3 13h8V3H3v10zm10 8h8V3h-8v18zM3 21h8v-6H3v6z',
      },
    ],
  },
  {
    title: 'Organisation',
    requiredPermissions: [
      'iam:legal_entities:manage',
      'iam:roles:manage',
      'iam:users:manage',
      'audit:events:read',
      'hr:read',
    ],
    items: [
      {
        name: 'Overview',
        href: '/enterprise/organisation',
        icon: 'M3 3h18v6H3V3zm0 8h18v10H3V11zm2 2v6h6v-6H5zm8 0v2h6v-2h-6zm0 4v2h6v-2h-6',
      },
      {
        name: 'Legal Entities',
        href: '/enterprise/legal-entities',
        icon: 'M12 2l9 4.5v11L12 22 3 17.5v-11L12 2z',
        requiredPermissions: ['iam:legal_entities:manage'],
      },
      {
        name: 'Company Groups',
        href: '/enterprise/company-groups',
        icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
      },
      {
        name: 'Org Structure',
        href: '/enterprise/org-structure',
        icon: 'M6 4h12M6 10h12M6 16h12M4 4v4m0 6v4m16-8v4m0-6v4',
        requiredPermissions: ['iam:legal_entities:manage'],
      },
      {
        name: 'Positions',
        href: '/enterprise/positions',
        icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
      },
      {
        name: 'Cost Centers',
        href: '/enterprise/cost-centers',
        icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
      },
    ],
  },
  {
    title: 'Workforce',
    requiredPermissions: [
      'employee:read',
      'employment:read',
      'data_import:read',
      'data_import:write',
      'data_import:approve',
      'data_import:publish',
      'hr:read',
    ],
    items: [
      {
        name: 'Employees',
        href: '/enterprise/employees',
        icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
      },
      {
        name: 'Employment Assignments',
        href: '/enterprise/employment-assignments',
        icon: 'M9 12h6m-6 4h6M7 4h10a2 2 0 012 2v14H5V6a2 2 0 012-2z',
      },
      {
        name: 'Data Imports',
        href: '/enterprise/data-imports',
        icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
        requiredPermissions: [
          'data_import:read',
          'data_import:write',
          'data_import:approve',
          'data_import:publish',
        ],
      },
      {
        name: 'Import Wizard',
        href: '/enterprise/data-imports/wizard',
        icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
        requiredPermissions: [
          'data_import:write',
          'data_import:approve',
          'data_import:publish',
          'iam:legal_entities:manage',
        ],
      },
      {
        name: 'Bootstrap Organisation',
        href: '/enterprise/bootstrap-organisation',
        icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
        requiredPermissions: [
          'data_import:write',
          'iam:legal_entities:manage',
        ],
      },
      {
        name: 'Manager Hierarchy',
        href: '/enterprise/manager-hierarchy',
        icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
      },
      {
        name: 'Org Manager Review',
        href: '/workforce/org-unit-manager-review',
        icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
      },
      {
        name: 'Remediation Queue',
        href: '/workforce/remediation',
        icon: 'M4 6h16M4 12h16M4 18h7',
      },
      {
        name: 'Bulk Fix History',
        href: '/workforce/remediation/history',
        icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      },
      {
        name: 'Approvals',
        href: '/workforce/remediation/approvals',
        icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      },
      {
        name: 'Audit Trail',
        href: '/workforce/remediation/audit',
        icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
      },
      {
        name: 'Entity Readiness',
        href: '/workforce/legal-entity-progress',
        icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      },
      {
        name: 'HR Export (IGA)',
        href: '/enterprise/hr-export',
        icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
        requiredPermissions: ['hr:read'],
      },
    ],
  },
  {
    title: 'Payroll',
    requiredPermissions: [
      'payrun:read',
      'payrun:create',
      'payrun:approve',
      'payrun:pay',
      'payrun:admin',
      'pay_group:read',
    ],
    items: [
      {
        name: 'Run Center',
        href: '/payroll/run-center',
        icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z',
      },
      {
        name: 'Payruns',
        href: '/payroll/payruns',
        icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
      },
      {
        name: 'Payrolls',
        href: '/payroll/payrolls',
        icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
        requiredPermissions: ['pay_group:read'],
      },
      {
        name: 'Governance portfolio',
        href: '/payroll/governance-portfolio',
        icon: 'M11 3.055A9.001 9.001 0 1020.945 13H11V3.055zM20.488 9H15V3.512A9.025 9.025 0 0120.488 9zM4 15a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5z',
      },
      {
        name: 'Governance policies',
        href: '/payroll/governance-policies',
        icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
        requiredPermissions: ['payrun:admin'],
      },
      {
        name: 'Calendars',
        href: '/payroll/calendars',
        icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      },
      {
        name: 'Checklist',
        href: '/payroll/checklist',
        icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
      },
      {
        name: 'Exceptions',
        href: '/payroll/exceptions',
        icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
      },
      {
        name: 'Payment Batches',
        href: '/payroll/payment-batches',
        icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
      },
      {
        name: 'Reconciliation',
        href: '/payroll/reconciliation',
        icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
      },
      {
        name: 'Payroll Reports',
        href: '/payroll/reports',
        icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      },
      {
        name: 'Forecasting',
        href: '/payroll/forecasting',
        icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
        requiredPermissions: ['payrun:read'],
      },
      {
        name: 'CTC Optimiser',
        href: '/payroll/ctc-optimiser',
        icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        requiredPermissions: ['payroll:ctc_optimiser:view'],
      },
    ],
  },
  {
    title: 'Compliance',
    requiredPermissions: [
      'sars:irp5:read',
      'sars:emp201:read',
      'sars:emp501:read',
      'audit:events:read',
      'iam:legal_entities:manage',
      'payrun:read',
    ],
    items: [
      {
        name: 'Compliance Workspace',
        href: '/payroll/compliance',
        icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      },
      {
        name: 'SARS Reports',
        href: '/payroll/sars-reports',
        icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z',
      },
      {
        name: 'Tax Tables',
        href: '/admin/payroll/tax-tables',
        icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
      },
      {
        name: 'Compliance Dashboard',
        href: '/payroll/compliance-dashboard',
        icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      },
      {
        name: 'Statutory Returns',
        href: '/payroll/statutory-returns',
        icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      },
      {
        name: 'Statutory Config',
        href: '/admin/statutory-config',
        icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
      },
    ],
  },
  {
    title: 'Talent',
    requiredPermissions: ['recruitment:requisitions:view'],
    items: [
      {
        name: 'Job Requisitions',
        href: '/recruitment/job-requisitions',
        icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
      },
      {
        name: 'Candidates',
        href: '/recruitment/candidates',
        icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
      },
      {
        name: 'Interviews',
        href: '/recruitment/interviews',
        icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      },
      {
        name: 'Offers',
        href: '/recruitment/offers',
        requiredPermissions: ['recruitment:offers:view'],
        icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      },
      {
        name: 'Onboarding',
        href: '/recruitment/onboarding',
        icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
      },
    ],
  },
  {
    title: 'Governance',
    requiredPermissions: [
      'iam:users:manage',
      'iam:roles:manage',
      'audit:events:read',
    ],
    items: [
      {
        name: 'Users',
        href: '/enterprise/users',
        icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
      },
      {
        name: 'Role Templates',
        href: '/enterprise/roles',
        icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
      },
      {
        name: 'Approval Workflows',
        href: '/enterprise/workflows',
        icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
      },
    ],
  },
];

export default function AdminLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { canAny } = useAccess();
    const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
    const [permRefreshing, setPermRefreshing] = React.useState(false);
    const [permRefreshHint, setPermRefreshHint] = React.useState<string | null>(null);

    React.useEffect(() => {
        void refreshAdminSessionFromApi();
    }, []);

    async function handleRefreshPermissions() {
        setPermRefreshing(true);
        setPermRefreshHint(null);
        try {
            const ok = await refreshAdminSessionFromApi();
            setPermRefreshHint(ok ? 'Permissions synced from server.' : 'Could not sync permissions. Try again or re-login.');
        } finally {
            setPermRefreshing(false);
            window.setTimeout(() => setPermRefreshHint(null), 5000);
        }
    }

    const sidebarWidth = sidebarCollapsed ? 70 : 260;

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('role');
        localStorage.removeItem('admin_permissions');
        navigate('/login');
    };

    const navGroups = NAV_GROUPS.filter((group) => canAny(group.requiredPermissions));
    const isActive = (path: string) => location.pathname === path;
    const canSeeItem = (item: NavItem) =>
      !item.requiredPermissions || item.requiredPermissions.length === 0 || canAny(item.requiredPermissions);

    const renderNavLink = (item: NavItem) => (
      <Link
        key={item.href}
        to={item.href}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: sidebarCollapsed ? '12px' : '12px 14px',
          marginBottom: 6,
          borderRadius: 12,
          color: isActive(item.href) ? 'white' : 'rgba(255,255,255,0.72)',
          background: isActive(item.href) ? 'rgba(79, 70, 229, 0.38)' : 'transparent',
          textDecoration: 'none',
          fontSize: 14,
          fontWeight: isActive(item.href) ? 800 : 600,
          justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
          transition: 'all 0.15s ease',
        }}
      >
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
        </svg>
        {!sidebarCollapsed && <span style={{ marginLeft: 12 }}>{item.name}</span>}
      </Link>
    );

    const sidebar = (
        <aside
            style={{
                width: sidebarWidth,
                background: styles.colors.sidebarBg,
                height: '100vh',
                position: 'fixed',
                left: 0,
                top: 0,
                transition: 'width 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 50,
            }}
        >
            {/* Logo */}
            <div
                style={{
                    padding: ui.space.lg,
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: ui.space.sm,
                }}
            >
                <div
                    style={{
                        width: 36,
                        height: 36,
                        background: styles.colors.gradientAdmin,
                        borderRadius: ui.radius.sm,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                    }}
                >
                    <svg width="20" height="20" fill="none" stroke="white" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </div>
                {!sidebarCollapsed && (
                    <span style={{ color: 'white', fontWeight: 900, fontSize: 16 }}>Hubsec Workforce</span>
                )}
            </div>

            {/* Navigation */}
            <nav style={{ padding: `${ui.space.md}px ${ui.space.sm}px`, flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
                {navGroups.map((group) => (
                    <div key={group.title} style={{ marginBottom: ui.space.lg }}>
                        {!sidebarCollapsed && (
                            <p
                                style={{
                                    padding: `0 ${ui.space.sm}px`,
                                    marginBottom: ui.space.xs,
                                    fontSize: 11,
                                    fontWeight: 800,
                                    color: 'rgba(255,255,255,0.45)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.06em',
                                }}
                            >
                                {group.title}
                            </p>
                        )}

                        {group.sections
                          ? group.sections.map((section) => {
                              const visibleItems = section.items.filter(canSeeItem);
                              if (visibleItems.length === 0) return null;
                              return (
                                <div key={section.title} style={{ marginTop: ui.space.sm }}>
                                  {!sidebarCollapsed && (
                                    <p
                                      style={{
                                        padding: `0 ${ui.space.sm}px`,
                                        marginBottom: ui.space.xs,
                                        fontSize: 11,
                                        fontWeight: 800,
                                        color: 'rgba(255,255,255,0.35)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.06em',
                                      }}
                                    >
                                      {section.title}
                                    </p>
                                  )}
                                  {visibleItems.map((item) => renderNavLink(item))}
                                </div>
                              );
                            })
                          : (group.items || []).filter(canSeeItem).map((item) => renderNavLink(item))}
                    </div>
                ))}
            </nav>

            {/* Refresh permissions + Logout */}
            <div style={{ padding: ui.space.md, borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                    type="button"
                    data-testid="refresh-admin-permissions-sidebar"
                    disabled={permRefreshing}
                    title="Reload roles and permissions from the server (after RBAC changes)"
                    onClick={() => void handleRefreshPermissions()}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: 12,
                        color: 'rgba(255,255,255,0.85)',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        cursor: permRefreshing ? 'wait' : 'pointer',
                        fontSize: 13,
                        fontWeight: 600,
                        justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                        opacity: permRefreshing ? 0.7 : 1,
                    }}
                >
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {!sidebarCollapsed && <span style={{ marginLeft: 10 }}>{permRefreshing ? 'Syncing…' : 'Refresh permissions'}</span>}
                </button>
                <button
                    onClick={handleLogout}
                    type="button"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: 12,
                        color: 'rgba(255,255,255,0.72)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 14,
                        fontWeight: 700,
                        justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                    }}
                >
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    {!sidebarCollapsed && <span style={{ marginLeft: 12 }}>Logout</span>}
                </button>
            </div>
        </aside>
    );

    const header = (
        <TopBar
            left={
                <button
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    type="button"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}
                >
                    <svg width="24" height="24" fill="none" stroke={styles.colors.textSecondary} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
            }
            right={
                <div style={{ display: 'flex', alignItems: 'center', gap: ui.space.md, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            data-testid="refresh-admin-permissions"
                            disabled={permRefreshing}
                            title="Reload roles and permissions from the server after RBAC or seed changes"
                            onClick={() => void handleRefreshPermissions()}
                            style={{
                                padding: '8px 14px',
                                borderRadius: 10,
                                border: `1px solid ${styles.colors.border}`,
                                background: styles.colors.background,
                                color: styles.colors.textPrimary,
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: permRefreshing ? 'wait' : 'pointer',
                                opacity: permRefreshing ? 0.75 : 1,
                            }}
                        >
                            {permRefreshing ? 'Syncing…' : 'Refresh permissions'}
                        </button>
                        {permRefreshHint ? (
                            <span
                                role="status"
                                aria-live="polite"
                                style={{ fontSize: 12, color: styles.colors.textSecondary, maxWidth: 220 }}
                            >
                                {permRefreshHint}
                            </span>
                        ) : null}
                    </div>
                    <div style={{ padding: 8, borderRadius: 8, background: styles.colors.background, position: 'relative' }}>
                        <svg width="20" height="20" fill="none" stroke={styles.colors.textSecondary} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, background: styles.colors.danger, borderRadius: '50%' }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: ui.space.sm }}>
                        <div style={{ width: 36, height: 36, background: styles.colors.gradientAdmin, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>A</span>
                        </div>
                        <span style={{ fontWeight: 500, color: styles.colors.textPrimary, fontSize: 14 }}>Admin</span>
                    </div>
                </div>
            }
        />
    );

    return (
        <AppShell sidebar={sidebar} header={header} sidebarWidth={sidebarWidth}>
            <Outlet />
        </AppShell>
    );
}
