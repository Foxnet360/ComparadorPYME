import React, { useState } from 'react';
import { QuoteAnalysis, CoverageItem } from '../types';
import { PLANTILLA_ITEMS } from '../constants';

import { normalizeText } from '../utils/textUtils';

interface RiskHeatmapProps {
  quotes: QuoteAnalysis[];
}

interface HeatmapCell {
  value: string;
  deductible: string;
  riskScore: 'low' | 'medium' | 'high' | 'not-included';
  reason: string;
  coverage?: CoverageItem;
}

const getRiskScore = (
  coverage: CoverageItem | undefined
): { score: 'low' | 'medium' | 'high' | 'not-included'; reason: string } => {
  if (!coverage) {
    return { score: 'not-included', reason: 'Cobertura no incluida' };
  }

  const value = coverage.value?.toUpperCase().trim() || '';

  // Check if excluded
  if (['EXCLUIDO', 'NO CUBRE', 'NO APLICA'].includes(value)) {
    return { score: 'high', reason: 'Cobertura excluida' };
  }

  // Check deductible risk
  const deductible = coverage.deductible?.toUpperCase().trim() || '';
  if (deductible.includes('NO ESPECIFICADO')) {
    return { score: 'high', reason: 'Deducible no especificado - riesgo de sorpresas' };
  }

  // Parse deductible percentage
  const deductibleMatch = deductible.match(/(\d+)%/);
  if (deductibleMatch) {
    const percentage = parseInt(deductibleMatch[1]!);
    if (percentage > 10) {
      return { score: 'high', reason: `Deducible alto (${percentage}%)` };
    } else if (percentage > 0) {
      return { score: 'medium', reason: `Deducible moderado (${percentage}%)` };
    }
  }

  // Check value amount (if very low, it's risky)
  const numericValue = parseFloat(value.replace(/[^\d.]/g, ''));
  if (!isNaN(numericValue) && numericValue > 0 && numericValue < 1000000) {
    return { score: 'medium', reason: 'Suma asegurada baja' };
  }

  return { score: 'low', reason: 'Cobertura incluida con condiciones favorables' };
};

const getCellColor = (score: 'low' | 'medium' | 'high' | 'not-included'): string => {
  switch (score) {
    case 'low':
      return 'bg-green-100 border-green-200 hover:bg-green-200';
    case 'medium':
      return 'bg-yellow-100 border-yellow-200 hover:bg-yellow-200';
    case 'high':
      return 'bg-red-100 border-red-200 hover:bg-red-200';
    case 'not-included':
      return 'bg-gray-100 border-gray-200 hover:bg-gray-200';
  }
};

const getCellTextColor = (score: 'low' | 'medium' | 'high' | 'not-included'): string => {
  switch (score) {
    case 'low':
      return 'text-green-800';
    case 'medium':
      return 'text-yellow-800';
    case 'high':
      return 'text-red-800';
    case 'not-included':
      return 'text-gray-500';
  }
};

export const RiskHeatmap: React.FC<RiskHeatmapProps> = ({ quotes }) => {
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    cell: HeatmapCell | null;
  }>({ visible: false, x: 0, y: 0, cell: null });

  const categories = PLANTILLA_ITEMS.map((name, index) => ({
    id: index + 1,
    name,
  }));

  const getCellData = (
    quote: QuoteAnalysis,
    categoryId: number,
    categoryName: string
  ): HeatmapCell => {
    const coverage = quote.coverages?.find(
      (c) =>
        c.categoryId === categoryId ||
        normalizeText(c.canonicalName) === normalizeText(categoryName) ||
        normalizeText(c.name) === normalizeText(categoryName)
    );

    const risk = getRiskScore(coverage);

    return {
      value: coverage?.value || 'No incluida',
      deductible: coverage?.deductible || 'N/A',
      riskScore: risk.score,
      reason: risk.reason,
      coverage,
    };
  };

  const handleMouseEnter = (e: React.MouseEvent, cell: HeatmapCell) => {
    setTooltip({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      cell,
    });
  };

  const handleMouseLeave = () => {
    setTooltip({ visible: false, x: 0, y: 0, cell: null });
  };

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-100 border border-green-200 rounded"></div>
          <span className="text-slate-600">Bajo riesgo</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-100 border border-yellow-200 rounded"></div>
          <span className="text-slate-600">Riesgo medio</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-100 border border-red-200 rounded"></div>
          <span className="text-slate-600">Alto riesgo</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-100 border border-gray-200 rounded"></div>
          <span className="text-slate-600">No incluida</span>
        </div>
      </div>

      {/* Heatmap */}
      <div className={`overflow-x-auto ${quotes.length > 4 ? 'pb-2' : ''}`}>
        <div className="min-w-full">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="p-3 text-left font-semibold text-slate-700 bg-slate-50 border border-slate-200 sticky left-0 z-10">
                  Categoría
                </th>
                {quotes.map((q, i) => (
                  <th
                    key={i}
                    className="p-3 text-center font-semibold text-slate-700 bg-slate-50 border border-slate-200 min-w-[140px]"
                  >
                    {q.insurerName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <td className="p-3 font-medium text-slate-700 bg-white border border-slate-200 sticky left-0 z-10">
                    <div className="flex items-center gap-2">
                      <span>{category.name}</span>
                      <span className="text-xs text-slate-400">(#{category.id})</span>
                    </div>
                  </td>
                  {quotes.map((quote, colIdx) => {
                    const cell = getCellData(quote, category.id, category.name);
                    return (
                      <td
                        key={colIdx}
                        className={`p-3 border border-slate-200 cursor-pointer transition-colors ${getCellColor(cell.riskScore)}`}
                        onMouseEnter={(e) => handleMouseEnter(e, cell)}
                        onMouseLeave={handleMouseLeave}
                      >
                        <div
                          className={`text-center font-medium ${getCellTextColor(cell.riskScore)}`}
                        >
                          {cell.riskScore === 'not-included' ? '—' : cell.value.substring(0, 20)}
                          {cell.value.length > 20 && '...'}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip.visible && tooltip.cell && (
        <div
          className="fixed z-50 bg-white border border-slate-200 shadow-lg rounded-lg p-3 text-sm max-w-xs pointer-events-none"
          style={{
            left: tooltip.x + 10,
            top: tooltip.y - 10,
          }}
        >
          <div className="font-semibold text-slate-800 mb-1">{tooltip.cell.value}</div>
          <div className="text-slate-600 mb-1">
            <span className="font-medium">Deducible:</span> {tooltip.cell.deductible}
          </div>
          <div className="text-slate-600 mb-1">
            <span className="font-medium">Riesgo:</span>{' '}
            <span
              className={`
              ${tooltip.cell.riskScore === 'low' ? 'text-green-600' : ''}
              ${tooltip.cell.riskScore === 'medium' ? 'text-yellow-600' : ''}
              ${tooltip.cell.riskScore === 'high' ? 'text-red-600' : ''}
              ${tooltip.cell.riskScore === 'not-included' ? 'text-gray-500' : ''}
            `}
            >
              {tooltip.cell.riskScore === 'low' && 'Bajo'}
              {tooltip.cell.riskScore === 'medium' && 'Medio'}
              {tooltip.cell.riskScore === 'high' && 'Alto'}
              {tooltip.cell.riskScore === 'not-included' && 'No incluido'}
            </span>
          </div>
          <div className="text-slate-500 text-xs">{tooltip.cell.reason}</div>
        </div>
      )}
    </div>
  );
};

export default RiskHeatmap;
