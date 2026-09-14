/**
 * RenewalAnalysisSection (renovacion-polizas PR-5, task 1.24)
 *
 * Renders the schemaVersion-3 renewal payload on the report page: the
 * "Póliza Actual" baseline summary (R2.2) and the per-candidate gap/delta
 * panels (R2.3/R2.4/R2.5). Mounted lazily from ComparisonReport and only for
 * v3 reports, so NEW-mode (v1/v2) rendering stays byte-identical (XC-3).
 */

import React from 'react';
import { BaselineColumnBadge } from '../BaselineColumnBadge';
import { GapDeltaPanel } from '../GapDeltaPanel';
import type { CandidateRenewalAnalytics, RenewalBaseline } from '../../types';

interface RenewalAnalysisSectionProps {
  baseline?: RenewalBaseline;
  analytics?: CandidateRenewalAnalytics[];
}

const RenewalAnalysisSection: React.FC<RenewalAnalysisSectionProps> = ({ baseline, analytics }) => {
  const hasAnalytics = !!analytics && analytics.length > 0;
  if (!baseline && !hasAnalytics) return null;

  return (
    <section aria-label="Análisis de renovación" className="space-y-4">
      {baseline && (
        <header className="flex flex-wrap items-center gap-3 border border-emerald-200 bg-emerald-50/50 rounded-lg p-4">
          <BaselineColumnBadge insurerName={baseline.insurerName} />
          {baseline.priceAnnual !== null && (
            <span className="text-sm text-slate-700">
              Prima anual actual: {baseline.priceAnnual}
            </span>
          )}
        </header>
      )}

      {hasAnalytics && (
        <div className="grid gap-4 md:grid-cols-2">
          {analytics!.map((candidate) => (
            <GapDeltaPanel key={candidate.insurer} analytics={candidate} />
          ))}
        </div>
      )}
    </section>
  );
};

export default RenewalAnalysisSection;
