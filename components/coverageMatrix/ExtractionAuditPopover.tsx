import React from 'react';
import { Award, AlertTriangle } from 'lucide-react';
import { MatrixCell } from '../../types';
import { formatPercentage } from '../../utils/formatCurrency';
import { getConfidenceText, isLowConfidence } from './matrixFormatters';

interface ExtractionAuditPopoverProps {
  cell: MatrixCell;
  needsReview: boolean;
}

export const ExtractionAuditPopover: React.FC<ExtractionAuditPopoverProps> = ({
  cell,
  needsReview,
}) => {
  const lowConfidence = isLowConfidence(cell.confidence);

  return (
    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-80 p-4 bg-slate-900 text-slate-100 text-xs rounded-xl shadow-xl z-50 border border-slate-700 pointer-events-none transition-all duration-200">
      <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-800">
        <Award className="text-blue-400" size={14} />
        <span className="font-bold text-white text-[11px] tracking-wide uppercase">
          Auditoría de Extracción
        </span>
      </div>

      {/* Confidence Section */}
      {cell.confidence !== undefined && (
        <div className="flex justify-between py-0.5">
          <span className="text-slate-400">Confianza:</span>
          <span className={`font-semibold ${lowConfidence ? 'text-yellow-400' : 'text-white'}`}>
            {formatPercentage(cell.confidence, 0)} ({getConfidenceText(cell.confidence)})
          </span>
        </div>
      )}

      {/* Canonical Name & Match Method */}
      {(cell.canonicalName || cell.matchMethod) && (
        <div className="mt-2 pt-2 border-t border-slate-800">
          {cell.canonicalName && (
            <div className="flex justify-between py-0.5">
              <span className="text-slate-400">Nombre canónico:</span>
              <span className="font-semibold text-white text-right max-w-[180px] truncate">
                {cell.canonicalName}
              </span>
            </div>
          )}
          {cell.matchMethod && (
            <div className="flex justify-between py-0.5">
              <span className="text-slate-400">Método:</span>
              <span className="font-semibold text-white capitalize">
                {cell.matchMethod}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Page Evidence */}
      {(cell.calculatedPage !== undefined || cell.pageNumber !== undefined) && (
        <div className="flex justify-between py-0.5">
          <span className="text-slate-400">Página:</span>
          <span className="font-semibold text-white">
            {cell.calculatedPage !== undefined
              ? `Pág. ${cell.calculatedPage} (calculada)`
              : `Pág. ${cell.pageNumber}`}
          </span>
        </div>
      )}

      {/* Notes / Raw Text Snippet */}
      {(cell.notes || cell.rawTextSnippet) && (
        <div className="mt-2 pt-2 border-t border-slate-800">
          <span className="font-semibold text-slate-400 block mb-1">
            {cell.notes ? 'Notas' : 'Evidencia textual (verbatim):'}
          </span>
          <div className="bg-slate-800/50 rounded-lg p-2 text-[11px] text-slate-300 leading-relaxed italic border border-slate-700/50">
            "
            {cell.notes && cell.notes.length > 200
              ? `${cell.notes.slice(0, 200)}...`
              : cell.notes || cell.rawTextSnippet}
            "
          </div>
        </div>
      )}

      {/* Justification */}
      {cell.justification && (
        <div className="mt-2 pt-2 border-t border-slate-800">
          <span className="font-semibold text-slate-400 block mb-1">
            Justificación IA:
          </span>
          <div className="text-[11px] text-slate-300 leading-relaxed">
            {cell.justification}
          </div>
        </div>
      )}

      {/* Human Review Flag */}
      {needsReview && (
        <div className="mt-2 pt-2 border-t border-slate-800">
          <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-2 flex items-center gap-2">
            <AlertTriangle
              size={12}
              className="text-red-400 flex-shrink-0"
            />
            <span className="text-[11px] text-red-300">
              Doble agente en discrepancia. Se requiere validación humana.
            </span>
          </div>
        </div>
      )}

      <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-6 border-r-6 border-t-6 border-transparent border-t-slate-900"></div>
    </div>
  );
};
