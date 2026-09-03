import React, { Suspense, lazy } from 'react';
import { LayoutDashboard } from 'lucide-react';
import { ViewLoadingFallback } from '../components/layout/ViewLoadingFallback';
import { useAnalysisFlow } from '../hooks/useAnalysisFlow';

const ComparisonReport = lazy(() => import('../components/ComparisonReport'));

interface ReportPageProps {
  onBackToDashboard: () => void;
  onNewAudit: () => void;
}

const ReportPage: React.FC<ReportPageProps> = ({ onBackToDashboard, onNewAudit }) => {
  const { state, dispatch, resetFlow } = useAnalysisFlow();
  const report = state.report;

  if (!report) return null;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={onBackToDashboard}
          className="text-sm text-slate-500 hover:text-indigo-600 font-medium px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors flex items-center"
        >
          <LayoutDashboard size={16} className="mr-2" />
          Volver al Dashboard
        </button>
        <button
          onClick={() => {
            resetFlow();
            onNewAudit();
          }}
          className="text-sm text-white bg-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          Nueva Auditoría
        </button>
      </div>
      <Suspense fallback={<ViewLoadingFallback />}>
        <ComparisonReport
          report={report}
          onUpdateReport={(updatedReport) =>
            dispatch({ type: 'SET_REPORT', payload: updatedReport })
          }
        />
      </Suspense>
    </div>
  );
};

export default ReportPage;
