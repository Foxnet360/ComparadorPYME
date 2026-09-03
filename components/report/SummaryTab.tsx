import React from 'react';
import { Check } from 'lucide-react';
import { ExecutiveSummary } from '../ExecutiveSummary';
import { QuoteScoreCard, type QuoteCorrection } from './QuoteScoreCard';
import { ReportCharts } from './ReportCharts';
import type { QuoteAnalysis } from '../../types';

interface SummaryTabProps {
  quotes: QuoteAnalysis[];
  bestQuote: QuoteAnalysis;
  recommendation: string;
  viewMode: 'technical' | 'client';
  onCorrection: (quote: QuoteAnalysis, correction: QuoteCorrection) => void;
  onNavigate: (tab: 'resumen' | 'coberturas' | 'deducibles' | 'auditoria') => void;
}

/**
 * ARCH-1: "Dashboard Resumen" tab — executive summary, quote scoring cards,
 * qualitative/price charts and the auditor recommendation. Extracted from
 * the ComparisonReport shell.
 */
export const SummaryTab: React.FC<SummaryTabProps> = ({
  quotes,
  bestQuote,
  recommendation,
  viewMode,
  onCorrection,
  onNavigate,
}) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Executive Summary */}
      <ExecutiveSummary quotes={quotes} recommendation={recommendation} onNavigate={onNavigate} />

      {/* Scoring Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {quotes.map((q, idx) => {
          const isBest = q.insurerName === bestQuote.insurerName;
          return (
            <QuoteScoreCard
              key={idx}
              quote={q}
              isBest={isBest}
              viewMode={viewMode}
              onCorrection={onCorrection}
            />
          );
        })}
      </div>

      <ReportCharts quotes={quotes} />

      {/* Recommendation Text */}
      <div className="bg-slate-800 text-white p-6 rounded-xl shadow-lg">
        <h3 className="text-lg font-bold mb-3 flex items-center">
          <Check className="mr-2 text-green-400" /> Dictamen del Auditor
        </h3>
        <p className="leading-relaxed text-slate-200 font-light">{recommendation}</p>
      </div>
    </div>
  );
};

export default SummaryTab;
