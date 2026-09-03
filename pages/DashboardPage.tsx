import React, { Suspense, lazy } from 'react';
import { ViewLoadingFallback } from '../components/layout/ViewLoadingFallback';
import type { ComparisonReport as ReportType } from '../types';

const TechnicalDashboard = lazy(() => import('../components/TechnicalDashboard'));

interface DashboardPageProps {
  onNewAnalysis: () => void;
  onViewReport: (report: ReportType) => void;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ onNewAnalysis, onViewReport }) => (
  <Suspense fallback={<ViewLoadingFallback />}>
    <TechnicalDashboard onNewAnalysis={onNewAnalysis} onViewReport={onViewReport} />
  </Suspense>
);

export default DashboardPage;
