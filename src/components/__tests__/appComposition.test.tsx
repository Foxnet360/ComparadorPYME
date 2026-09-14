import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AuthProvider, useAuth } from '../../../contexts/AuthContext';
import { UIProvider, useUI } from '../../../contexts/UIContext';
import { AnalysisProvider, useAnalysis } from '../../../contexts/AnalysisContext';

const AuthProbe: React.FC = () => {
  const auth = useAuth();
  return <div data-testid="auth-probe">{auth.currentUser === null ? 'no-user' : 'has-user'}</div>;
};

const UIProbe: React.FC = () => {
  const ui = useUI();
  return (
    <div data-testid="ui-probe">
      {ui.chatOpen ? 'chat-open' : 'chat-closed'}:{ui.clientSelectorOpen ? 'cs-open' : 'cs-closed'}
    </div>
  );
};

const AnalysisProbe: React.FC = () => {
  const { state } = useAnalysis();
  return <div data-testid="analysis-probe">{state.status}</div>;
};

const readSource = (relPath: string) => readFileSync(join(__dirname, '../../..', relPath), 'utf8');

describe('app composition (ARCH-2, ARCH-3)', () => {
  it('useAuth returns provider state within AuthProvider', () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );
    expect(screen.getByTestId('auth-probe').textContent).toBe('no-user');
  });

  it('useUI returns provider state within UIProvider', () => {
    render(
      <UIProvider>
        <UIProbe />
      </UIProvider>
    );
    expect(screen.getByTestId('ui-probe').textContent).toBe('chat-closed:cs-closed');
  });

  it('useAnalysis returns provider state within AnalysisProvider', () => {
    render(
      <AnalysisProvider>
        <AnalysisProbe />
      </AnalysisProvider>
    );
    expect(screen.getByTestId('analysis-probe').textContent).toBe('IDLE');
  });

  it('mounts AuthProvider, UIProvider and AnalysisProvider at the app root', () => {
    const appSource = readSource('App.tsx');
    expect(appSource).toContain('<AuthProvider>');
    expect(appSource).toContain('<UIProvider>');
    expect(appSource).toContain('<AnalysisProvider>');
  });

  it('App reads analyzer state from AnalysisContext instead of duplicating it', () => {
    const appSource = readSource('App.tsx');
    expect(appSource).toContain('useAnalysisFlow()');
    expect(appSource).not.toContain('useState<AppStatus>');
    expect(appSource).not.toContain('useState<ReportType');
    expect(appSource).not.toContain('useState<Client');
  });

  it('AuthContext resolves the session through authService', () => {
    const authSource = readSource('contexts/AuthContext.tsx');
    expect(authSource).toContain('../services/authService');
  });
});

describe('renewal portfolio wiring (renovacion-polizas PR-5, XC-3)', () => {
  it('App lazy-loads the Portfolio page and routes the PORTFOLIO view', () => {
    const appSource = readSource('App.tsx');
    expect(appSource).toContain("lazy(() => import('./pages/Portfolio'))");
    expect(appSource).toContain("currentView === 'PORTFOLIO'");
    expect(appSource).toContain('PortfolioProvider');
  });

  it('App lazy-loads the RenewalDetail page and routes the RENEWAL_DETAIL view', () => {
    const appSource = readSource('App.tsx');
    expect(appSource).toContain("lazy(() => import('./pages/RenewalDetail'))");
    expect(appSource).toContain("currentView === 'RENEWAL_DETAIL'");
  });

  it('AppHeader exposes a portfolio navigation action', () => {
    const headerSource = readSource('components/layout/AppHeader.tsx');
    expect(headerSource).toContain('onOpenPortfolio');
  });
});
