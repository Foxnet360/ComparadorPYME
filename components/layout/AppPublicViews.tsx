import React from 'react';
import LandingPage from '../LandingPage';
import LoginScreen from '../LoginScreen';
import RegisterScreen from '../RegisterScreen';
import ResetPasswordScreen from '../ResetPasswordScreen';
import LegalPage from '../../pages/LegalPage';
import type { LegalTabType } from './AppFooter';
import type { AppView } from '../../hooks/useAnalysisFlow';
import type { UserProfile } from '../../types';

interface AppPublicViewsProps {
  currentView: AppView;
  currentUser: UserProfile | null;
  legalTab: LegalTabType;
  setLegalTab: (tab: LegalTabType) => void;
  navigateTo: (view: AppView, opts?: { replace?: boolean }) => void;
  handleLogin: (user: UserProfile) => void;
}

export const renderPublicView = ({
  currentView,
  currentUser,
  legalTab,
  setLegalTab,
  navigateTo,
  handleLogin,
}: AppPublicViewsProps): React.ReactElement | null => {
  if (currentView === 'LANDING') {
    return (
      <LandingPage
        onLoginClick={() => navigateTo('LOGIN')}
        onRegisterClick={() => navigateTo('REGISTER')}
        onOpenLegal={(tab) => {
          if (tab) setLegalTab(tab as LegalTabType);
          navigateTo('LEGAL');
        }}
      />
    );
  }
  if (currentView === 'LOGIN') {
    return (
      <LoginScreen onLoginSuccess={handleLogin} onRegisterClick={() => navigateTo('REGISTER')} />
    );
  }
  if (currentView === 'REGISTER') {
    return (
      <RegisterScreen onRegisterSuccess={handleLogin} onBackToLogin={() => navigateTo('LOGIN')} />
    );
  }
  if (currentView === 'RESET_PASSWORD') {
    return (
      <ResetPasswordScreen
        onSuccess={() => navigateTo('LOGIN')}
        onBackToLogin={() => navigateTo('LOGIN')}
      />
    );
  }
  if (currentView === 'LEGAL') {
    return (
      <LegalPage
        defaultTab={legalTab}
        onBack={() => navigateTo(currentUser ? 'DASHBOARD' : 'LANDING')}
      />
    );
  }
  return null;
};
