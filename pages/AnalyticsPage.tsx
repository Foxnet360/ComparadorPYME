import React, { Suspense, lazy } from 'react';
import { ViewLoadingFallback } from '../components/layout/ViewLoadingFallback';

const ExecutiveAnalytics = lazy(() => import('../components/ExecutiveAnalytics'));

interface AnalyticsPageProps {
  onBackToDashboard: () => void;
}

const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ onBackToDashboard }) => (
  <Suspense fallback={<ViewLoadingFallback />}>
    <ExecutiveAnalytics onBackToDashboard={onBackToDashboard} />
  </Suspense>
);

export default AnalyticsPage;
