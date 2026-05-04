import React from 'react';
import { QuoteAnalysis, CoverageItem } from '../types';
import { PLANTILLA_ITEMS } from '../constants';
import { Info, AlertTriangle, ListChecks } from 'lucide-react';
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

export const UnifiedCoverageMatrix: React.FC<UnifiedCoverageMatrixProps> = ({ quotes, showRagReferences = false }) => {
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
        <div className="p-6 bg-slate-50 border-b border-slate-200">
          <h3 className="font-bold text-slate-800 flex items-center">
            <ListChecks className="mr-2 text-indigo-600" size={20} />
            Matriz de Coberturas
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Comparación unificada por categorías canónicas. Las coberturas se agrupan semanticamente.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white text-slate-600 uppercase font-bold text-xs border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 sticky left-0 bg-white border-r border-slate-100 min-w-[280px] shadow-[4px_0_10px_-5px_rgba(0,0,0,0.1)] z-10">
                  Categoría
                </th>
                {quotes.map((q, i) => (
                  <th key={i} className="px-6 py-4 min-w-[220px] bg-slate-50/50">{q.insurerName}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categories.map((category) => (
                <tr key={category.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4 font-semibold text-slate-700 bg-white sticky left-0 border-r border-slate-100 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.05)] z-10 group-hover:bg-slate-50">
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
                                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getConfidenceColor(coverage.matchConfidence)}`}
                                    title={`Método: ${getMethodLabel(coverage.matchMethod)} | Confianza: ${formatPercentage(coverage.matchConfidence, 0)}`}
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
            <h3 className="font-bold text-amber-800 flex items-center">
              <AlertTriangle className="mr-2 text-amber-600" size={20} />
              Coberturas No Categorizadas
            </h3>
            <p className="text-sm text-amber-700 mt-1">
              Estas coberturas no pudieron ser mapeadas a ninguna categoría canónica automáticamente.
            </p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {uncategorizedCoverages.map((item, idx) => (
                <div key={idx} className="bg-white rounded-lg border border-amber-200 p-4">
                  <div className="font-medium text-slate-800">{item.coverage.name}</div>
                  <div className="text-sm text-slate-600 mt-1">{formatCoverageValue(item.coverage.value)}</div>
                  <div className="text-xs text-slate-500 mt-2">{item.coverage.deductible && `Ded: ${formatCoverageValue(item.coverage.deductible)}`}</div>
                  <div className="mt-2 text-xs text-amber-600 font-medium">
                    {quotes[item.quoteIdx]?.insurerName}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


