import React from 'react';
import { QuoteAnalysis } from '../types';
import { PLANTILLA_ITEMS } from '../constants';
import { Shield, AlertTriangle, TrendingDown, Award } from 'lucide-react';
import { formatCOP } from '../utils/formatCurrency';

interface DeductibleMatrixProps {
  quotes: QuoteAnalysis[];
}

// Helper to parse deductible value for display
const parseDeductible = (deductible: string): { value: string; isHigh: boolean; isUnspecified: boolean } => {
  if (!deductible || deductible === 'No aplica' || deductible === 'NO ESPECIFICADO') {
    return { value: deductible || 'N/A', isHigh: false, isUnspecified: !deductible || deductible === 'NO ESPECIFICADO' };
  }
  
  const upperDed = deductible.toUpperCase();
  
  // Check for percentage
  const percentMatch = upperDed.match(/(\d+)%/);
  if (percentMatch) {
    const percent = parseInt(percentMatch[1]);
    return { value: `${percent}%`, isHigh: percent > 10, isUnspecified: false };
  }
  
  // Check for SMMLV
  const smmlvMatch = upperDed.match(/(\d+)\s*SMMLV/i);
  if (smmlvMatch) {
    const smmlv = parseInt(smmlvMatch[1]);
    return { value: `${smmlv} SMMLV`, isHigh: smmlv > 5, isUnspecified: false };
  }
  
  return { value: deductible, isHigh: false, isUnspecified: false };
};

// Get color based on deductible risk
const getDeductibleColor = (isHigh: boolean, isUnspecified: boolean): string => {
  if (isUnspecified) return 'bg-red-100 text-red-700 border-red-200';
  if (isHigh) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  return 'bg-green-100 text-green-700 border-green-200';
};

export const DeductibleMatrix: React.FC<DeductibleMatrixProps> = ({ quotes }) => {
  // Calculate best/worst deductible per coverage
  const getDeductibleRanking = (categoryName: string) => {
    const deductibleScores = quotes.map((quote, idx) => {
      const coverage = quote.coverages?.find(c => 
        c.canonicalName === categoryName || c.name === categoryName
      );
      
      if (!coverage || !coverage.deductible) return { idx, score: -1, deductible: 'N/A' };
      
      const parsed = parseDeductible(coverage.deductible);
      let score = 50; // Default
      
      if (parsed.isUnspecified) score = 0;
      else if (parsed.isHigh) score = 30;
      else score = 80;
      
      return { idx, score, deductible: coverage.deductible };
    });
    
    const validScores = deductibleScores.filter(d => d.score >= 0);
    if (validScores.length === 0) return { best: null, worst: null };
    
    const best = validScores.reduce((prev, curr) => curr.score > prev.score ? curr : prev);
    const worst = validScores.reduce((prev, curr) => curr.score < prev.score ? curr : prev);
    
    return { best, worst };
  };

  return (
    <div className="space-y-6">
      {/* Summary Panel */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
          <Shield className="mr-2 text-indigo-600" size={20} />
          Resumen de Deducibles
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4 border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <Award className="text-green-600" size={16} />
              <span className="font-semibold text-green-700">Mejor Opción</span>
            </div>
            <p className="text-sm text-slate-600">
              {quotes.length > 0 ? quotes.reduce((prev, curr) => {
                const prevScore = prev.coverages?.filter(c => c.deductible && c.deductible !== 'NO ESPECIFICADO').length || 0;
                const currScore = curr.coverages?.filter(c => c.deductible && c.deductible !== 'NO ESPECIFICADO').length || 0;
                return currScore > prevScore ? curr : prev;
              }).insurerName : 'N/A'}
            </p>
          </div>
          
          <div className="bg-white rounded-lg p-4 border border-red-200">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="text-red-600" size={16} />
              <span className="font-semibold text-red-700">Requiere Atención</span>
            </div>
            <p className="text-sm text-slate-600">
              {quotes.filter(q => q.coverages?.some(c => !c.deductible || c.deductible === 'NO ESPECIFICADO')).length} aseguradoras con deducibles no especificados
            </p>
          </div>
        </div>
      </div>

      {/* Matrix */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-xs border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left sticky left-0 bg-slate-50 border-r border-slate-100 z-10 w-64">
                  Cobertura
                </th>
                {quotes.map((q, i) => (
                  <th key={i} className="px-4 py-3 text-center min-w-[180px]">
                    {q.insurerName}
                  </th>
                ))}
                <th className="px-4 py-3 text-center bg-amber-50 min-w-[120px]">
                  <TrendingDown size={16} className="inline mr-1" />
                  Mejor
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {PLANTILLA_ITEMS.map((categoryName, idx) => {
                const ranking = getDeductibleRanking(categoryName);
                
                return (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-700 sticky left-0 bg-white border-r border-slate-100 z-10">
                      {categoryName}
                    </td>
                    
                    {quotes.map((quote, qIdx) => {
                      const coverage = quote.coverages?.find(c => 
                        c.canonicalName === categoryName || c.name === categoryName
                      );
                      
                      const parsed = coverage?.deductible ? parseDeductible(coverage.deductible) : null;
                      const isBest = ranking.best?.idx === qIdx;
                      
                      return (
                        <td key={qIdx} className={`px-4 py-3 text-center ${isBest ? 'bg-green-50/50' : ''}`}>
                          {coverage ? (
                            <div className="space-y-1">
                              <div className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${
                                parsed ? getDeductibleColor(parsed.isHigh, parsed.isUnspecified) : 'bg-gray-100 text-gray-600'
                              }`}>
                                {parsed?.value || 'N/A'}
                              </div>
                              
                              {coverage.value && coverage.value !== 'NO ESPECIFICADO' && coverage.value !== 'No aplica' && (
                                <div className="text-xs text-slate-500">
                                  SA: {formatCOP(parseFloat(coverage.value.replace(/[^\d.]/g, '')) || 0)}
                                </div>
                              )}
                              
                              {coverage.sublimit && coverage.sublimit !== 'NO ESPECIFICADO' && (
                                <div className="text-xs text-indigo-600 font-medium">
                                  Sublímite: {coverage.sublimit}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300 italic">No incluida</span>
                          )}
                        </td>
                      );
                    })}
                    
                    <td className="px-4 py-3 text-center bg-amber-50/30">
                      {ranking.best ? (
                        <div className="text-xs font-medium text-green-700">
                          {quotes[ranking.best.idx].insurerName}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DeductibleMatrix;
