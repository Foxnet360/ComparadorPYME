import React from 'react';
import { CoverageValidationMatrix } from '../CoverageValidationMatrix';
import { DeductibleRiskGauge } from '../DeductibleRiskGauge';
import { ContextualExclusionCard } from '../ContextualExclusionCard';
import { WarrantyComplianceDashboard } from '../WarrantyComplianceDashboard';
import { LegalOpinionCard } from '../LegalOpinionCard';
import { NegotiationPointsList } from '../NegotiationPointsList';
import { InverseCoverageAlert } from '../InverseCoverageAlert';
import type { QuoteAnalysis } from '../../types';

interface AdvancedAnalysisTabProps {
  quotes: QuoteAnalysis[];
}

/** Content of the "Análisis Avanzado" tab: coverage validation, deductible
 * risk, contextual risk, warranty compliance, legal opinion, inverse
 * coverage and negotiation points. */
export const AdvancedAnalysisTab: React.FC<AdvancedAnalysisTabProps> = ({ quotes }) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coverage Validation */}
        {quotes.some((q) => q.clauseValidation?.results?.length) && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Validación de Coberturas</h3>
            {quotes
              .filter((q) => q.clauseValidation?.results?.length)
              .map((quote, idx) => (
                <CoverageValidationMatrix
                  key={idx}
                  validations={quote.clauseValidation!.results!}
                />
              ))}
          </div>
        )}

        {/* Deductible Risk */}
        {quotes.some((q) => q.deductibleAnalysis?.length) && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Riesgo de Deducibles</h3>
            {quotes
              .filter((q) => q.deductibleAnalysis?.length)
              .flatMap((quote, qIdx) =>
                quote.deductibleAnalysis!.map((analysis, i) => (
                  <DeductibleRiskGauge key={`${quote.id ?? qIdx}-${i}`} {...analysis} />
                ))
              )}
          </div>
        )}

        {/* Contextual Risk */}
        {quotes.some((q) => q.contextualRisk?.exclusions.length) && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Riesgo Contextualizado</h3>
            {quotes
              .filter((q) => q.contextualRisk?.exclusions.length)
              .flatMap((quote, qIdx) =>
                quote.contextualRisk!.exclusions.map((ex, i) => (
                  <ContextualExclusionCard
                    key={`${quote.id ?? qIdx}-${i}`}
                    exclusion={ex.exclusion}
                    contextualRiskLevel={ex.contextualRiskLevel}
                    explanation={ex.explanation}
                    mitigationSuggestions={ex.mitigationSuggestions}
                  />
                ))
              )}
          </div>
        )}

        {/* Warranty Compliance */}
        {quotes.some((q) => q.warrantyCompliance) && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Cumplimiento de Garantías</h3>
            {quotes
              .filter((q) => q.warrantyCompliance)
              .map((quote, idx) => (
                <WarrantyComplianceDashboard key={idx} summary={quote.warrantyCompliance!} />
              ))}
          </div>
        )}

        {/* Legal Opinion */}
        {quotes.some((q) => q.legalOpinion?.length) && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Asesoría Legal</h3>
            {quotes
              .filter((q) => q.legalOpinion?.length)
              .flatMap((quote, qIdx) =>
                quote.legalOpinion!.map((opinion, i) => (
                  <LegalOpinionCard
                    key={`${quote.id ?? qIdx}-${i}`}
                    coverageName={opinion.coverageName}
                    riskScenario={opinion.riskScenario}
                    clauseInterpretation={opinion.clauseInterpretation}
                    recommendation={opinion.recommendation}
                    citations={opinion.citations}
                    confidence={opinion.confidence}
                  />
                ))
              )}
          </div>
        )}

        {/* Inverse Coverage */}
        {quotes.some((q) => (q.clauseValidation?.mandatoryMissingCount ?? 0) > 0) && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Coberturas Omitidas</h3>
            {quotes
              .filter((q) => (q.clauseValidation?.mandatoryMissingCount ?? 0) > 0)
              .flatMap((quote, qIdx) =>
                (quote.clauseValidation?.results ?? [])
                  .filter((r) => r.status === 'MANDATORY_MISSING')
                  .map((r, i) => (
                    <InverseCoverageAlert
                      key={`${quote.id ?? qIdx}-${i}`}
                      coverageName={r.coverageName}
                      isMandatory={r.isMandatory}
                    />
                  ))
              )}
          </div>
        )}

        {/* Negotiation Points */}
        {quotes.some((q) => q.legalOpinion?.some((lo) => lo.negotiationPoints.length > 0)) && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Puntos de Negociación</h3>
            {quotes
              .filter((q) => q.legalOpinion?.some((lo) => lo.negotiationPoints.length > 0))
              .map((quote, idx) => (
                <NegotiationPointsList
                  key={idx}
                  points={quote.legalOpinion!.flatMap((lo) => lo.negotiationPoints)}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
};
