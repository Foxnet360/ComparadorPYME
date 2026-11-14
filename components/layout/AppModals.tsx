import React, { Suspense, lazy } from 'react';
import { LegalModal } from '../legal/LegalModal';
import { ToastContainer } from '../ToastNotification';
import type { LegalTabType } from './AppFooter';
import type { ComparisonReport, UserProfile } from '../../types';

const ChatBot = lazy(() => import('../ChatBot'));
const ProfileScreen = lazy(() => import('../ProfileScreen'));
const ClauseAdmin = lazy(() => import('../ClauseAdmin'));

interface AppModalsProps {
  currentUser: UserProfile | null;
  report: ComparisonReport | null;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  showProfile: boolean;
  setShowProfile: (show: boolean) => void;
  showClauseAdmin: boolean;
  setShowClauseAdmin: (show: boolean) => void;
  showLegalModal: boolean;
  setShowLegalModal: (show: boolean) => void;
  legalTab: LegalTabType;
  updateUser: (user: UserProfile) => void;
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  clearToast: () => void;
}

export const AppModals: React.FC<AppModalsProps> = ({
  currentUser,
  report,
  chatOpen,
  setChatOpen,
  showProfile,
  setShowProfile,
  showClauseAdmin,
  setShowClauseAdmin,
  showLegalModal,
  setShowLegalModal,
  legalTab,
  updateUser,
  toast,
  clearToast,
}) => (
  <>
    {showProfile && currentUser && (
      <Suspense fallback={null}>
        <ProfileScreen
          currentUser={currentUser}
          onUpdateProfile={updateUser}
          onClose={() => setShowProfile(false)}
        />
      </Suspense>
    )}
    {showClauseAdmin && (
      <Suspense fallback={null}>
        <ClauseAdmin currentUser={currentUser} onClose={() => setShowClauseAdmin(false)} />
      </Suspense>
    )}
    <Suspense fallback={null}>
      <ChatBot
        reportContext={report || undefined}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
      />
    </Suspense>
    <LegalModal
      isOpen={showLegalModal}
      onClose={() => setShowLegalModal(false)}
      initialTab={legalTab}
    />
    <ToastContainer
      toasts={toast ? [{ id: 'global-toast', message: toast.message, type: toast.type }] : []}
      onClose={clearToast}
    />
  </>
);
