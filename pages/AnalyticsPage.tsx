import React, { Suspense, lazy } from 'react';
import { ViewLoadingFallback } from '../components/layout/ViewLoadingFallback';
import { UserRole } from '../types';

const ExecutiveAnalytics = lazy(() => import('../components/ExecutiveAnalytics'));

interface AnalyticsPageProps {
  onBackToDashboard: () => void;
  currentUserRole?: UserRole;
}

const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ onBackToDashboard, currentUserRole }) => (
  <Suspense fallback={<ViewLoadingFallback />}>
    <ExecutiveAnalytics onBackToDashboard={onBackToDashboard} currentUserRole={currentUserRole} />
  </Suspense>
);

export default AnalyticsPage;
