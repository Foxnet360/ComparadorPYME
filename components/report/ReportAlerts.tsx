import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { QuoteAnalysis } from '../../types';

interface ReportAlertsProps {
  quotes: QuoteAnalysis[];
}

/**
 * ARCH-1: extraction-quality alerts rendered above the report header —
 * low-confidence banner plus dual-extraction discrepancy details.
 */
export const ReportAlerts: React.FC<ReportAlertsProps> = ({ quotes }) => {
  return (
    <>
      {/* Confidence Banner */}
      {quotes.some((q) => q.needsReview) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-amber-800">Extracción Requiere Revisión</h3>
            <p className="text-sm text-amber-700 mt-1">
              Algunas cotizaciones tienen baja confianza de extracción. Se recomienda verificar los
              datos manualmente.
            </p>
          </div>
        </div>
      )}

      {/* Dual Extraction Discrepancy Alerts */}
      {quotes.some((q) => q.dualExtractionValidation?.some((v) => v.isDiscrepancy)) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-red-800">
              Discrepancias Detectadas en Extracción Dual
            </h3>
            <p className="text-sm text-red-700 mt-1">
              Se detectaron diferencias significativas (&gt;20%) entre las extracciones de
              coberturas críticas (Incendio y RC). Por favor verifique los valores manualmente.
            </p>
            <div className="mt-2 space-y-1">
              {quotes.map((q, idx) =>
                q.dualExtractionValidation
                  ?.filter((v) => v.isDiscrepancy)
                  .map((v, vIdx) => (
                    <div key={`${idx}-${vIdx}`} className="text-sm text-red-600">
                      <strong>{q.insurerName}</strong> - {v.coverageName}:{' '}
                      {v.discrepancy.toFixed(1)}% de diferencia
                      <br />
                      <span className="text-red-500">
                        Extracción 1: {v.firstExtraction.value} | Extracción 2:{' '}
                        {v.secondExtraction.value}
                      </span>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ReportAlerts;
