import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AnalysisProvider, useAnalysis } from '../../../contexts/AnalysisContext';
import { UIProvider } from '../../../contexts/UIContext';
import AnalyzerPage from '../../../pages/AnalyzerPage';
import DashboardPage from '../../../pages/DashboardPage';
import ReportPage from '../../../pages/ReportPage';
import ClientsPage from '../../../pages/ClientsPage';
import AnalyticsPage from '../../../pages/AnalyticsPage';
import UsersPage from '../../../pages/UsersPage';
import type { ComparisonReport as ReportType } from '../../../types';

vi.mock('../../../components/DomainSelector', () => ({
  __esModule: true,
  default: () => <div data-testid="domain-selector" />,
}));

vi.mock('../../../components/ClientSelector', () => ({
  __esModule: true,
  default: () => <div data-testid="client-selector" />,
}));

vi.mock('../../../components/FileUploader', () => ({
  __esModule: true,
  default: () => <div data-testid="file-uploader" />,
}));

vi.mock('../../../components/ClauseSelector', () => ({
  ClauseSelector: () => <div data-testid="clause-selector" />,
}));

vi.mock('../../../components/TechnicalDashboard', () => ({
  __esModule: true,
  default: () => <div data-testid="technical-dashboard" />,
}));

vi.mock('../../../components/ComparisonReport', () => ({
  __esModule: true,
  default: () => <div data-testid="comparison-report" />,
}));

vi.mock('../../../components/ClientManager', () => ({
  __esModule: true,
  default: () => <div data-testid="client-manager" />,
}));

vi.mock('../../../components/ExecutiveAnalytics', () => ({
  __esModule: true,
  default: () => <div data-testid="executive-analytics" />,
}));

vi.mock('../../../components/UserManagement', () => ({
  __esModule: true,
  default: () => <div data-testid="user-management" />,
}));

const noop = () => {};

const SeedReport: React.FC<{ report: ReportType }> = ({ report }) => {
  const { dispatch } = useAnalysis();
  React.useEffect(() => {
    dispatch({ type: 'SET_REPORT', payload: report });
  }, [dispatch, report]);
  return null;
};

const baseReport = {
  quotes: [],
  recommendation: 'Recomendación de prueba',
  timestamp: new Date().toISOString(),
  analysisVersion: '2.0-rag',
} as unknown as ReportType;

describe('extracted pages (ARCH-1)', () => {
  it('App.tsx stays under 250 LOC as a composition shell', () => {
    const appSource = readFileSync(join(__dirname, '../../../App.tsx'), 'utf8');
    expect(appSource.split('\n').length).toBeLessThan(250);
  });

  it('AnalyzerPage renders in isolation with provider state', () => {
    render(
      <AnalysisProvider>
        <UIProvider>
          <AnalyzerPage onAnalysisComplete={noop} />
        </UIProvider>
      </AnalysisProvider>
    );
    expect(screen.getByText('Nueva Comparación de Seguros')).toBeTruthy();
  });

  it('DashboardPage renders in isolation', async () => {
    render(<DashboardPage onNewAnalysis={noop} onViewReport={noop} />);
    expect(await screen.findByTestId('technical-dashboard')).toBeTruthy();
  });

  it('ReportPage renders in isolation with a seeded report', async () => {
    render(
      <AnalysisProvider>
        <UIProvider>
          <SeedReport report={baseReport} />
          <ReportPage onBackToDashboard={noop} onNewAudit={noop} />
        </UIProvider>
      </AnalysisProvider>
    );
    expect(await screen.findByText('Nueva Auditoría')).toBeTruthy();
    expect(await screen.findByTestId('comparison-report')).toBeTruthy();
  });

  it('ClientsPage renders in isolation', async () => {
    render(
      <AnalysisProvider>
        <UIProvider>
          <ClientsPage onSelectClientForAudit={noop} onViewReport={noop} />
        </UIProvider>
      </AnalysisProvider>
    );
    expect(await screen.findByTestId('client-manager')).toBeTruthy();
  });

  it('AnalyticsPage renders in isolation', async () => {
    render(<AnalyticsPage onBackToDashboard={noop} />);
    expect(await screen.findByTestId('executive-analytics')).toBeTruthy();
  });

  it('UsersPage renders in isolation', async () => {
    render(<UsersPage currentUserRole="super_admin" currentAllyId="ally-100" onClose={noop} />);
    expect(await screen.findByTestId('user-management')).toBeTruthy();
  });
});
