import { useState, useEffect } from 'react';
import type { ComparisonReport as ReportType } from '../types';

export interface ReportCorrection {
  field: string;
  originalValue: string;
  correctedValue: string;
}

/** Owns the editable report state and the correction pipeline for the
 * ComparisonReport shell. Behavior is identical to the previous inline
 * implementation: local state mirrors the incoming report prop and every
 * applied correction is pushed through onUpdateReport. */
export const useReportCorrections = (
  initialReport: ReportType,
  onUpdateReport?: (updatedReport: ReportType) => void
) => {
  const [report, setReport] = useState<ReportType>(initialReport);

  useEffect(() => {
    setReport(initialReport);
  }, [initialReport]);

  const handleApplyCorrection = (
    quoteId: string,
    correction: { field: string; originalValue: string; correctedValue: string }
  ) => {
    setReport((prev) => {
      const updatedQuotes = prev.quotes.map((q) => {
        if (q.id !== quoteId && q.insurerName !== quoteId) return q;
        const updatedQuote = { ...q };

        if (correction.field.startsWith('coverage_')) {
          const covName = correction.field.replace(/^coverage_/, '');
          updatedQuote.coverages = (updatedQuote.coverages || []).map((cov) =>
            cov.name === covName ? { ...cov, value: correction.correctedValue } : cov
          );
        } else if (correction.field === 'deductible') {
          updatedQuote.deductibles = correction.correctedValue;
        } else if (correction.field === 'price_annual') {
          updatedQuote.priceAnnual = Number(correction.correctedValue) || updatedQuote.priceAnnual;
        } else if (correction.field === 'price_monthly') {
          updatedQuote.priceMonthly =
            Number(correction.correctedValue) || updatedQuote.priceMonthly;
        }
        return updatedQuote;
      });

      const nextReport = { ...prev, quotes: updatedQuotes };
      if (onUpdateReport) onUpdateReport(nextReport);
      return nextReport;
    });
  };

  return { report, handleApplyCorrection };
};
