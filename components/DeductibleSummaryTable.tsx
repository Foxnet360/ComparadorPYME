import React from 'react';
import { Scale, AlertTriangle, CheckCircle, Info, TrendingUp, ChevronDown } from 'lucide-react';
import { QuoteAnalysis } from '../types';
import { PLANTILLA_ITEMS } from '../constants';
import { formatPercentage, formatNumber } from '../utils/formatCurrency';
import { calculateDeductibleSeverity, getSeverityWidth } from '../utils/severityCalculator';

interface DeductibleSummaryTableProps {
  quotes: QuoteAnalysis[];
}

// Parse deductible text to extract structured information
const parseDeductible = (deductibleText: string | undefined | null) => {
  if (!deductibleText || typeof deductibleText !== 'string' || deductibleText === 'No aplica' || deductibleText === '') {
    return { percentage: null, minimum: null, appliesTo: null, hasData: false };
  }
  
  const lower = deductibleText.toLowerCase();
  
  // Extract percentage (handle both dot and comma as decimal separator)
  const percentMatch = deductibleText.match(/(\d+(?:[.,]\d+)?)\s*%/);
  const percentage = percentMatch ? parseFloat(percentMatch[1].replace(',', '.')) : null;
  
  // Extract minimum (SMMLV or salaries)
  const minMatch = deductibleText.match(/(?:m[ií]n\.?|mínimo)\s*:?\s*(\d+(?:\.\d+)?)\s*(?:SMMLV|salarios?)/i);
  const minimum = minMatch ? parseFloat(minMatch[1]) : null;
  
  // Determine what it applies to
  let appliesTo: 'perdida' | 'valor' | null = null;
  if (lower.includes('valor asegurado') || lower.includes('suma asegurada') || lower.includes('sobre el valor') || lower.includes('aplica sobre valor')) {
    appliesTo = 'valor';
  } else if (lower.includes('perdida') || lower.includes('siniestro') || lower.includes('sobre la pérdida') || lower.includes('aplica sobre pérdida')) {
    appliesTo = 'perdida';
  }
  
  return { percentage, minimum, appliesTo, hasData: true };
};

// Get severity level for visual coding
const getSeverity = (percentage: number | null, appliesTo: 'perdida' | 'valor' | null) => {
  if (!percentage) return 'neutral';
  
  if (appliesTo === 'valor') return 'critical';
  if (percentage > 15) return 'warning';
  if (percentage <= 5) return 'good';
  return 'neutral';
};

// Check if values differ between insurers for the same category
const hasDifferences = (values: Array<{ percentage: number | null; minimum: number | null; appliesTo: string | null }>) => {
  const validValues = values.filter(v => v.hasData);
  if (validValues.length <= 1) return false;
  
  const first = validValues[0];
  return validValues.some(v => 
    v.percentage !== first.percentage || 
    v.minimum !== first.minimum || 
    v.appliesTo !== first.appliesTo
  );
};

export const DeductibleSummaryTable: React.FC<DeductibleSummaryTableProps> = ({ quotes }) => {
  // Use canonical categories (14 fixed) instead of dynamic coverage names
  const categories = PLANTILLA_ITEMS.map((name, index) => ({
    id: index + 1,
    name,
  }));

  // Helper to find coverage by category for a quote
  const findCoverageByCategory = (quote: QuoteAnalysis, categoryId: number, categoryName: string) => {
    return quote.coverages?.find((c: any) => {
      if (c.categoryId === categoryId) return true;
      const coverageName = c.canonicalName || c.name;
      if (normalizeText(coverageName) === normalizeText(categoryName)) return true;
      return false;
    });
  };
  
  // Normalize text for comparison
  const normalizeText = (text: string | undefined | null) => {
    if (!text || typeof text !== 'string') return "";
    return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  };
  
  // Check if any quote has deductibles
  const hasAnyDeductibles = quotes.some(q => 
    q.coverages?.some((c: any) => c.deductible && c.deductible !== 'No aplica' && c.deductible !== '')
  );
  
  if (!hasAnyDeductibles) {
    return (
      <div className="bg-slate-50 p-8 rounded-xl text-center">
        <Info className="mx-auto mb-4 text-slate-400" size={48} />
        <p className="text-slate-600">No se encontraron deducibles específicos por cobertura.</p>
        <p className="text-sm text-slate-500 mt-2">Revisa el texto completo de deducibles a continuación.</p>
      </div>
    );
  }
  
  // Pre-calculate all deductible data
  const categoryData = categories.map(category => {
    const quoteData = quotes.map(quote => {
      const coverage = findCoverageByCategory(quote, category.id, category.name);
      const deductible = coverage?.deductible || '';
      const parsed = parseDeductible(deductible);
      return {
        quote,
        coverage,
        deductible,
        parsed,
      };
    });
    
    const hasDiffs = hasDifferences(quoteData.map(q => q.parsed));
    
    return {
      category,
      quoteData,
      hasDifferences: hasDiffs,
    };
  });
  
  // Severity color classes
  const severityClasses = {
    good: 'bg-green-50 border-green-200 text-green-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    critical: 'bg-red-50 border-red-200 text-red-800',
    neutral: 'bg-slate-50 border-slate-200 text-slate-600'
  };
  
  const severityDotClasses = {
    good: 'bg-green-500',
    warning: 'bg-amber-500',
    critical: 'bg-red-500',
    neutral: 'bg-slate-400'
  };
  
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 md:p-6 bg-gradient-to-r from-indigo-50 to-white border-b border-slate-200">
        <h3 className="font-bold text-slate-800 flex items-center text-base md:text-lg">
          <Scale className="mr-2 md:mr-3 text-indigo-600 flex-shrink-0" size={20} />
          Resumen Estructurado de Deducibles
        </h3>
        <p className="text-sm text-slate-600 mt-2">
          Comparativa visual de porcentajes, mínimos y tipo de deducible por categoría.
        </p>
        <div className="flex flex-wrap gap-4 mt-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-slate-600">Sobre Pérdida (Favorable)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-slate-600">Sobre Valor Asegurado (Desfavorable)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span className="text-slate-600">Alto (&gt;15%)</span>
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-700 font-bold text-xs uppercase sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left w-56 sticky left-0 bg-slate-100 border-r border-slate-200 z-10" title="Categorías de cobertura según plantilla PYME">
                Categoría
              </th>
              {quotes.map((q, i) => (
                <th key={i} className="px-4 py-3 text-center min-w-[200px]" title={`Ver deducibles de ${q.insurerName}`}>
                  <div className="font-bold">{q.insurerName}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {categoryData.map(({ category, quoteData, hasDifferences: hasDiffs }) => (
              <tr 
                key={category.id} 
                className={`hover:bg-slate-50/50 transition-colors ${hasDiffs ? 'bg-amber-50/30' : ''}`}
              >
                <td className="px-4 py-4 font-medium text-slate-700 bg-white sticky left-0 border-r border-slate-100 z-10">
                  <div className="flex items-center gap-2">
                    <span>{category.name}</span>
                    <span className="text-xs text-slate-400 font-normal">(#{category.id})</span>
                    {hasDiffs && (
                      <span className="text-xs text-amber-600" title="Diferencias detectadas entre aseguradoras">
                        <TrendingUp size={12} />
                      </span>
                    )}
                  </div>
                </td>
                {quoteData.map(({ deductible, parsed }, qIdx) => {
                  const severity = getSeverity(parsed.percentage, parsed.appliesTo);
                  
                  const severityInfo = calculateDeductibleSeverity(deductible);
                  
                  return (
                    <td key={qIdx} className="px-4 py-4 text-center">
                      {deductible && deductible !== 'No aplica' ? (
                        <div className={`inline-flex flex-col items-center p-3 rounded-lg border ${severityClasses[severity]} ${hasDiffs ? 'ring-2 ring-amber-200 ring-offset-1' : ''} w-full max-w-[200px]`}>
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-2 h-2 rounded-full ${severityDotClasses[severity]}`}></div>
                            {parsed.percentage && (
                              <span className="text-lg font-bold">{formatPercentage(parsed.percentage, 0)}</span>
                            )}
                          </div>
                          
                          {/* Severity Bar */}
                          {parsed.percentage && parsed.percentage > 0 && (
                            <div className="w-full mt-2 mb-2">
                              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all ${severityInfo.color}`}
                                  style={{ width: getSeverityWidth(parsed.percentage) }}
                                ></div>
                              </div>
                              <div className="flex justify-between text-xs mt-1">
                                <span className="text-slate-400">0%</span>
                                <span className={`font-medium ${
                                  severityInfo.level === 'critical' ? 'text-red-600' :
                                  severityInfo.level === 'high' ? 'text-red-500' :
                                  severityInfo.level === 'medium' ? 'text-amber-600' :
                                  'text-green-600'
                                }`}>
                                  {severityInfo.label}
                                </span>
                              </div>
                            </div>
                          )}
                          
                          {parsed.minimum && (
                            <span className="text-xs mt-1">Mín: {formatNumber(parsed.minimum)} SMMLV</span>
                          )}
                          {parsed.appliesTo === 'valor' && (
                            <span className="flex items-center gap-1 text-xs mt-2 text-red-600 font-semibold">
                              <AlertTriangle size={12} /> Sobre Valor Aseg.
                            </span>
                          )}
                          {parsed.appliesTo === 'perdida' && (
                            <span className="flex items-center gap-1 text-xs mt-2 text-green-600 font-semibold">
                              <CheckCircle size={12} /> Sobre Pérdida
                            </span>
                          )}
                          {!parsed.appliesTo && !parsed.percentage && (
                            <span className="text-xs">{deductible}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No aplica</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Scroll indicator for mobile */}
      <div className="md:hidden flex items-center justify-center py-2 bg-slate-50 text-xs text-slate-500 border-t border-slate-100">
        <span className="flex items-center gap-1">
          <ChevronDown size={14} className="rotate-90" />
          Desliza horizontalmente para ver más
          <ChevronDown size={14} className="-rotate-90" />
        </span>
      </div>
      
      {/* Legend for differences */}
      <div className="px-4 md:px-6 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-amber-600" />
          <span>Las filas marcadas con <TrendingUp size={12} className="inline text-amber-600" /> indican diferencias entre aseguradoras para esa categoría.</span>
        </div>
      </div>
    </div>
  );
};

export default DeductibleSummaryTable;
