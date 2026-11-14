import React from 'react';
import { Pin, Scale } from 'lucide-react';
import { QuoteAnalysis } from '../../types';
import { InsurerLogo } from '../common/InsurerLogo';

export interface MatrixTableHeaderProps {
  quotes: QuoteAnalysis[];
  pinnedColumns: Set<number>;
  complianceByInsurer: Map<
    string,
    { compliantCount: number; totalCount: number; isFullyCompliant: boolean; details: string }
  >;
  onTogglePinnedColumn: (idx: number) => void;
}

export const MatrixTableHeader: React.FC<MatrixTableHeaderProps> = ({
  quotes,
  pinnedColumns,
  complianceByInsurer,
  onTogglePinnedColumn,
}) => {
  return (
    <thead className="bg-[#E6F0FA] text-[#0066CC] font-bold text-xs uppercase border-b border-blue-200 sticky top-0 z-30 shadow-xs">
      <tr role="row">
        <th
          role="columnheader"
          className="px-6 py-4 sticky left-0 top-0 bg-[#E6F0FA] border-r border-blue-100 min-w-[220px] md:min-w-[280px] shadow-[4px_0_10px_-5px_rgba(0,0,0,0.08)] z-40"
        >
          Concepto / Variable
        </th>
        {quotes.map((q, i) => {
          const isPinned = pinnedColumns.has(i);
          const isHiddenByPinning = pinnedColumns.size > 0 && !isPinned;
          if (isHiddenByPinning) return null;

          return (
            <th
              key={i}
              role="columnheader"
              className={`px-6 py-4 min-w-[200px] md:min-w-[240px] whitespace-nowrap text-center text-[#0066CC] bg-[#E6F0FA] border-b border-blue-100 relative group/th ${
                isPinned ? '!bg-indigo-100/90 border-x border-indigo-200 shadow-sm' : ''
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <InsurerLogo insurerName={q.insurerName} size="xs" />
                <span>{q.insurerName}</span>
                {quotes.length >= 3 && (
                  <button
                    type="button"
                    onClick={() => onTogglePinnedColumn(i)}
                    className={`p-1 rounded transition-colors cursor-pointer ${
                      isPinned
                        ? 'text-indigo-700 bg-white shadow-xs'
                        : 'text-slate-400 hover:text-indigo-600 hover:bg-blue-100/50'
                    }`}
                    title={
                      isPinned
                        ? 'Quitar de la comparativa frente a frente'
                        : 'Fijar para comparar frente a frente'
                    }
                  >
                    <Pin size={12} className={isPinned ? 'fill-indigo-600' : ''} />
                  </button>
                )}
              </div>
              {/* Regulatory Compliance Scorecard */}
              {(() => {
                const comp = complianceByInsurer.get(q.insurerName);
                if (!comp || comp.totalCount === 0) return null;
                return (
                  <div className="mt-1.5 flex items-center justify-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                        comp.isFullyCompliant
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300/70'
                          : 'bg-amber-50 text-amber-700 border-amber-300/70'
                      }`}
                      title={comp.details}
                    >
                      <Scale size={11} />
                      <span>
                        {comp.compliantCount}/{comp.totalCount} Reglas Legales
                      </span>
                    </span>
                  </div>
                );
              })()}
            </th>
          );
        })}
      </tr>
    </thead>
  );
};
