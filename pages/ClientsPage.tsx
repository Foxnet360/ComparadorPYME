import React, { Suspense, lazy } from 'react';
import { ViewLoadingFallback } from '../components/layout/ViewLoadingFallback';
import { useAnalysisFlow } from '../hooks/useAnalysisFlow';
import type { Client, ComparisonReport as ReportType } from '../types';

const ClientManager = lazy(() => import('../components/ClientManager'));

interface ClientsPageProps {
  onSelectClientForAudit: (client: Client) => void;
  onViewReport: (report: ReportType) => void;
}

const ClientsPage: React.FC<ClientsPageProps> = ({ onSelectClientForAudit, onViewReport }) => {
  const { dispatch } = useAnalysisFlow();

  return (
    <Suspense fallback={<ViewLoadingFallback />}>
      <ClientManager
        onSelectClientForAudit={(client) => {
          dispatch({ type: 'SET_SELECTED_CLIENT', payload: client });
          onSelectClientForAudit(client);
        }}
        onViewReport={(rep) => {
          dispatch({ type: 'SET_REPORT', payload: rep });
          onViewReport(rep);
        }}
      />
    </Suspense>
  );
};

export default ClientsPage;
