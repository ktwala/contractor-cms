import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuditInsightsPage from '../app/settings/audit-insights/page';
import { AuthProvider } from '../lib/auth-context';
import { auditApi } from '../lib/api-audit';

// Mock the API client
jest.mock('../lib/api-audit', () => ({
  auditApi: {
    getAuditInsights: jest.fn(),
  },
}));

// Mock AuthContext
jest.mock('../lib/auth-context', () => ({
  useAuth: () => ({
    can: jest.fn().mockReturnValue(true),
  }),
  AuthProvider: ({ children }: any) => <>{children}</>,
}));

describe('Security Insights Acceptance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders cleanly with empty states', async () => {
    (auditApi.getAuditInsights as jest.Mock).mockResolvedValue({
      summary: {
        roleChangesLast24h: 0,
        failedAdminActions: 0,
        newUsersCreated: 0,
        deactivatedUsers: 0,
        auditExports: 0,
        criticalAnomalies: 0,
        spoofAttempts: 0,
      },
      highRiskEvents: [],
      failedActions: [],
      roleChangeTimeline: [],
      crossOrgAttempts: [],
      anomalies: [],
    });

    render(<AuditInsightsPage />);

    // Wait for the loading to finish
    await waitFor(() => {
      expect(screen.getByText('Critical Anomalies')).toBeInTheDocument();
    });

    // Check that summary cards render with zero values
    expect(screen.getByText('Spoofing Attempts')).toBeInTheDocument();
    
    // No anomalies table should render if empty
    expect(screen.queryByText('System Anomalies (Rate Limits & Spoofing)')).not.toBeInTheDocument();
  });

  it('renders CRITICAL anomalies and SPOOF_ATTEMPT counts correctly', async () => {
    (auditApi.getAuditInsights as jest.Mock).mockResolvedValue({
      summary: {
        roleChangesLast24h: 0,
        failedAdminActions: 0,
        newUsersCreated: 0,
        deactivatedUsers: 0,
        auditExports: 0,
        criticalAnomalies: 5,
        spoofAttempts: 3,
      },
      anomalies: [],
      highRiskEvents: [],
      failedActions: [],
      roleChangeTimeline: [],
      crossOrgAttempts: [],
    });

    render(<AuditInsightsPage />);

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument(); // Critical Anomalies count
      expect(screen.getByText('3')).toBeInTheDocument(); // Spoofing Attempts count
    });
  });
});
