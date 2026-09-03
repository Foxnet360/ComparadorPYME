import React, { Suspense, lazy } from 'react';
import { ViewLoadingFallback } from '../components/layout/ViewLoadingFallback';
import type { UserRole } from '../types';

const UserManagement = lazy(() => import('../components/UserManagement'));

interface UsersPageProps {
  currentUserRole: UserRole;
  currentAllyId: string;
  onClose: () => void;
}

const UsersPage: React.FC<UsersPageProps> = ({ currentUserRole, currentAllyId, onClose }) => (
  <Suspense fallback={<ViewLoadingFallback />}>
    <UserManagement
      currentUserRole={currentUserRole}
      currentAllyId={currentAllyId}
      onClose={onClose}
    />
  </Suspense>
);

export default UsersPage;
