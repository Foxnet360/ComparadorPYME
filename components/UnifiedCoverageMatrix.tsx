import React, { useState } from 'react';
import { QuoteAnalysis, CoverageItem } from '../types';
import { PLANTILLA_ITEMS } from '../constants';
import { Info, AlertTriangle, ListChecks, CheckCircle, LayoutGrid, Table as TableIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { formatPercentage, formatCOP } from '../utils/formatCurrency';

interface UnifiedCoverageMatrixProps {
  quotes: QuoteAnalysis[];
  showRagReferences?: boolean;
}

// Normalize text for comparison
const normalizeText = (text: string | undefined | null) => {
  if (!text || typeof text !== 'string') return "";
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
};

// Get confidence badge color
const getConfidenceColor = (confidence: number | undefined) => {
  if (confidence === undefined || confidence === null) return 'bg-gray-100 text-gray-600';
  if (confidence >= 0.9) return 'bg-green-100 text-green-700 border-green-200';
  if (confidence >= 0.7) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  return 'bg-red-100 text-red-700 border-red-200';
};

// Get confidence label
const getConfidenceLabel = (confidence: number | undefined) => {
  if (confidence === undefined || confidence === null) return 'Sin match';
  if (confidence >= 0.9) return 'Exacto';
  if (confidence >= 0.7) return 'Aproximado';
  return 'Revisar';
};

// Get method label
const getMethodLabel = (method: string | null | undefined) => {
  switch (method) {
    case 'thesaurus': return 'Tesauro';
    case 'fuzzy': return 'Fuzzy';
    case 'embedding': return 'Embedding';
    case 'llm': return 'LLM';
    default: return 'N/A';
  }
};

// Format coverage value with Colombian currency format
const formatCoverageValue = (value: string | undefined | null): string => {
  if (!value || typeof value !== 'string') return 'NO ESPECIFICADO';
  
  const trimmed = value.trim();
  const upperValue = trimmed.toUpperCase();
  
  // Special text values - return as-is
  if (['EXCLUIDO', 'NO CUBRE', 'NO APLICA', 'NO ESPECIFICADO', 'INCLUIDO'].includes(upperValue)) {
    return trimmed;
  }
  
  // Handle "500M" format (millions)
  const millionMatch = trimmed.match(/^([\d.,]+)\s*M$/i);
  if (millionMatch) {
    const num = parseFloat(millionMatch[1].replace(/\./g, '').replace(',', '.'));
    if (!isNaN(num)) {
      return formatCOP(num * 1000000);
    }
  }
  
  // Handle values with $ sign
  const dollarMatch = trimmed.match(/^\$?\s*([\d.,]+)\s*(.*)$/);
  if (dollarMatch) {
    const numStr = dollarMatch[1].replace(/\./g, '').replace(',', '.');
    const num = parseFloat(numStr);
    if (!isNaN(num) && num > 0) {
      return formatCOP(num);
    }
  }
  
  // If nothing matched, return original value
  return trimmed;
};

// Group uncategorized coverages by canonicalName suggestion
interface GroupedCoverage {
  canonicalName: string;
  coverages: { quoteIdx: number; coverage: CoverageItem }[];
}

const groupUncategorizedBySemanticSimilarity = (
  uncategorizedCoverages: { quoteIdx: number; coverage: CoverageItem }[]
): GroupedCoverage[] => {
  const groups: Record<string, { quoteIdx: number; coverage: CoverageItem }[]> = {};

  uncategorizedCoverages.forEach((item) => {
    const key = item.coverage.canonicalName || 'Sin clasificar';
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
  });

  return Object.entries(groups).map(([canonicalName, coverages]) => ({
    canonicalName,
    coverages,
  }));
};

// Get icon based on confidence level
const getConfidenceIcon = (confidence: number | undefined) => {
  if (confidence === undefined || confidence === null) return null;
  if (confidence >= 0.9) return <CheckCircle size={14} className="text-green-600" />;
  if (confidence >= 0.7) return <Info size={14} className="text-yellow-600" />;
  return <AlertTriangle size={14} className="text-red-600" />;
};

export const UnifiedCoverageMatrix: React.FC<UnifiedCoverageMatrixProps> = ({ quotes, showRagReferences = false }) => {
  const [viewMode, setViewMode] = useState<'grouped' | 'matrix'>('grouped');
  // Build category index (1-14)
  const categories = PLANTILLA_ITEMS.map((name, index) => ({
    id: index + 1,
    name,
  }));

  // Find uncategorized coverages (no categoryId or confidence < 0.6)
  const uncategorizedCoverages: { quoteIdx: number; coverage: CoverageItem }[] = [];
  quotes.forEach((quote, quoteIdx) => {
    (quote.coverages || []).forEach(coverage => {
      if (!coverage.categoryId || (coverage.matchConfidence !== undefined && coverage.matchConfidence < 0.6)) {
        uncategorizedCoverages.push({ quoteIdx, coverage });
      }
    });
  });

  return (
    <div className="space-y-6">
      {/* Main Matrix - 14 Fixed Categories */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 md:p-6 bg-slate-50 border-b border-slate-200">
          <h3 className="font-bold text-slate-800 flex items-center text-sm md:text-base">
            <ListChecks className="mr-2 text-indigo-600 flex-shrink-0" size={20} />
            Matriz de Coberturas
          </h3>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Comparación unificada por categorías canónicas. Las coberturas se agrupan semanticamente.
          </p>
        </div>
        <div className="overflow-x-auto relative">
          <table className="w-full text-sm text-left">
            <thead className="bg-white text-slate-600 uppercase font-bold text-xs border-b border-slate-200 sticky top-0 z-20">
              <tr>
                <th className="px-4 md:px-6 py-3 md:py-4 sticky left-0 bg-white border-r border-slate-100 min-w-[200px] md:min-w-[280px] shadow-[4px_0_10px_-5px_rgba(0,0,0,0.1)] z-30">
                  Categoría
                </th>
                {quotes.map((q, i) => (
                  <th key={i} className="px-4 md:px-6 py-3 md:py-4 min-w-[180px] md:min-w-[220px] bg-slate-50/50 whitespace-nowrap">{q.insurerName}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categories.map((category) => (
                <tr key={category.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-4 md:px-6 py-3 md:py-4 font-semibold text-slate-700 bg-white sticky left-0 border-r border-slate-100 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.05)] z-10 group-hover:bg-slate-50">
                    <div className="flex items-center gap-2">
                      <span>{category.name}</span>
                      <span className="text-xs text-slate-400 font-normal">(#{category.id})</span>
                    </div>
                  </td>
                  {quotes.map((quote, colIdx) => {
                    // Find all coverages for this category
                    const matchingCoverages = (quote.coverages || []).filter(c => 
                      c.categoryId === category.id || 
                      normalizeText(c.canonicalName) === normalizeText(category.name) ||
                      normalizeText(c.name) === normalizeText(category.name)
                    );

                    if (matchingCoverages.length === 0) {
                      return (
                        <td key={colIdx} className="px-6 py-4 text-slate-300 italic bg-slate-50/30">
                          No incluida
                        </td>
                      );
                    }

                    return (
                      <td key={colIdx} className="px-6 py-4 align-top">
                        {matchingCoverages.map((coverage, covIdx) => {
                          const upperValue = coverage.value?.toUpperCase().trim() || '';
                          const isExcluded = upperValue === 'EXCLUIDO' || upperValue === 'NO CUBRE' || upperValue === 'NO APLICA';
                          
                          return (
                            <div key={covIdx} className={`${covIdx > 0 ? 'mt-3 pt-3 border-t border-slate-100' : ''}`}>
                              <div className={`font-medium ${isExcluded ? 'text-red-500 italic' : 'text-slate-700'}`}>
                                {formatCoverageValue(coverage.value)}
                              </div>
                              {coverage.deductible && coverage.deductible !== 'No aplica' && (
                                <div className="text-xs text-slate-500 mt-1">
                                  Ded: {formatCoverageValue(coverage.deductible)}
                                </div>
                              )}
                              {/* Confidence Badge */}
                              {(coverage.matchConfidence !== undefined && coverage.matchConfidence !== null) && (
                                <div className="mt-2 flex items-center gap-2">
                                  <span 
                                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border cursor-help ${getConfidenceColor(coverage.matchConfidence)}`}
                                    title={`Método: ${getMethodLabel(coverage.matchMethod)} | Confianza: ${formatPercentage(coverage.matchConfidence, 0)} | Click para más info`}
                                  >
                                    {getConfidenceLabel(coverage.matchConfidence)}
                                  </span>
                                  <span className="text-xs text-slate-400" title={coverage.name}>
                                    {coverage.name !== coverage.canonicalName && coverage.canonicalName && (
                                      <span className="italic">"{coverage.name}"</span>
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {matchingCoverages.length > 1 && (
                          <div className="mt-2 text-xs text-amber-600 font-medium flex items-center gap-1">
                            <AlertTriangle size={12} />
                            Múltiples coberturas en esta categoría
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Uncategorized Coverages Section */}
      {uncategorizedCoverages.length > 0 && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="p-6 bg-amber-100/50 border-b border-amber-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-amber-800 flex items-center">
                  <AlertTriangle className="mr-2 text-amber-600" size={20} />
                  Coberturas No Categorizadas
                  <span className="ml-2 text-sm font-normal text-amber-600">({uncategorizedCoverages.length})</span>
                </h3>
                <p className="text-sm text-amber-700 mt-1">
                  Agrupadas por similitud semántica según el tesauro.
                </p>
              </div>
              {/* View Toggle */}
              <div className="flex bg-white rounded-lg border border-amber-300 p-1">
                <button
                  onClick={() => setViewMode('grouped')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    viewMode === 'grouped'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  <LayoutGrid size={16} />
                  <span className="hidden sm:inline">Agrupada</span>
                </button>
                <button
                  onClick={() => setViewMode('matrix')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    viewMode === 'matrix'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  <TableIcon size={16} />
                  <span className="hidden sm:inline">Matriz</span>
                </button>
          </div>
          {/* Scroll indicator for mobile */}
          <div className="md:hidden flex items-center justify-center py-2 bg-slate-50 text-xs text-slate-500 border-t border-slate-100">
            <span className="flex items-center gap-1">
              <ChevronDown size={14} className="rotate-90" />
              Desliza horizontalmente para ver más
              <ChevronDown size={14} className="-rotate-90" />
            </span>
          </div>
        </div>
      </div>

          <div className="p-6">
            {viewMode === 'grouped' ? (
              /* Grouped View */
              <div className="space-y-4">
                {groupUncategorizedBySemanticSimilarity(uncategorizedCoverages).map((group, groupIdx) => (
                  <div key={groupIdx} className="bg-white rounded-lg border border-amber-200 overflow-hidden">
                    <div className="px-4 py-3 bg-amber-50/50 border-b border-amber-100">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-amber-800">
                          {group.canonicalName === 'Sin clasificar' ? 'Sin clasificar' : `Sugerido: ${group.canonicalName}`}
                        </span>
                        <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                          {group.coverages.length} cobertura{group.coverages.length > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {group.coverages.map((item, idx) => (
                        <div key={idx} className="bg-slate-50 rounded-lg p-3 border border-slate-100 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between">
                            <div className="font-medium text-slate-800 text-sm">{item.coverage.name}</div>
                            {getConfidenceIcon(item.coverage.matchConfidence)}
                          </div>
                          <div className="text-sm text-slate-600 mt-1">{formatCoverageValue(item.coverage.value)}</div>
                          {item.coverage.deductible && (
                            <div className="text-xs text-slate-500 mt-1">
                              Ded: {formatCoverageValue(item.coverage.deductible)}
                            </div>
                          )}
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            {item.coverage.matchConfidence !== undefined && (
                              <span 
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getConfidenceColor(item.coverage.matchConfidence)}`}
                                title={`Confianza: ${formatPercentage(item.coverage.matchConfidence, 0)}`}
                              >
                                {formatPercentage(item.coverage.matchConfidence, 0)}
                              </span>
                            )}
                            {item.coverage.matchMethod && (
                              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                {getMethodLabel(item.coverage.matchMethod)}
                              </span>
                            )}
                            <span className="text-xs text-amber-600 font-medium ml-auto">
                              {quotes[item.quoteIdx]?.insurerName}
                            </span>
                          </div>
                          {item.coverage.name !== item.coverage.canonicalName && item.coverage.canonicalName && (
                            <div className="mt-1 text-xs text-slate-400 italic">
                              → {item.coverage.canonicalName}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Matrix View */
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-amber-100 text-amber-800 font-bold text-xs uppercase sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left w-64 sticky left-0 bg-amber-100 border-r border-amber-200 z-10">
                        Cobertura
                      </th>
                      {quotes.map((q, i) => (
                        <th key={i} className="px-4 py-3 text-center min-w-[180px]">
                          {q.insurerName}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100">
                    {uncategorizedCoverages.map((item, idx) => (
                      <tr key={idx} className="hover:bg-amber-50/30 transition-colors">
                        <td className="px-4 py-3 bg-white sticky left-0 border-r border-amber-100 z-10">
                          <div className="font-medium text-slate-800">{item.coverage.name}</div>
                          <div className="text-xs text-slate-500 mt-1">
                            {item.coverage.canonicalName && item.coverage.canonicalName !== item.coverage.name && (
                              <span className="italic">→ {item.coverage.canonicalName}</span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-1">
                            {getConfidenceIcon(item.coverage.matchConfidence)}
                            {item.coverage.matchConfidence !== undefined && (
                              <span className="text-xs text-slate-500">
                                {formatPercentage(item.coverage.matchConfidence, 0)}
                              </span>
                            )}
                            {item.coverage.matchMethod && (
                              <span className="text-xs text-slate-400">| {getMethodLabel(item.coverage.matchMethod)}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="text-slate-700">{formatCoverageValue(item.coverage.value)}</div>
                          {item.coverage.deductible && (
                            <div className="text-xs text-slate-500 mt-1">
                              Ded: {formatCoverageValue(item.coverage.deductible)}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};


