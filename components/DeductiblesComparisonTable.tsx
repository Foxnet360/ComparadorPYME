import React from 'react';
import { Scale, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { QuoteAnalysis } from '../types';

interface DeductiblesComparisonTableProps {
  quotes: QuoteAnalysis[];
}

export const DeductiblesComparisonTable: React.FC<DeductiblesComparisonTableProps> = ({ quotes }) => {
  // Extraer todas las coberturas que tienen deducibles
  const coverageSet = new Set<string>();
  quotes?.forEach(q => {
    q.coverages?.forEach((c: any) => {
      if (c.deductible && c.deductible !== 'No aplica' && c.deductible !== '' && c.name) {
        coverageSet.add(c.name);
      }
    });
  });
  
  const coverages = Array.from(coverageSet);
  
  // Función para parsear deducible
  const parseDeductible = (deductibleText: string | undefined | null) => {
    if (!deductibleText || typeof deductibleText !== 'string' || deductibleText === 'No aplica' || deductibleText === '') {
      return { percentage: null, minimum: null, appliesTo: null };
    }
    
    const lower = deductibleText.toLowerCase();
    
    // Extraer porcentaje
    const percentMatch = deductibleText.match(/(\d+(?:\.\d+)?)\s*%/);
    const percentage = percentMatch ? percentMatch[1] + '%' : null;
    
    // Extraer mínimo
    const minMatch = deductibleText.match(/(?:m[ií]n\.?|mínimo)\s*:?\s*(\d+(?:\.\d+)?)\s*(?:SMMLV|salarios?)/i);
    const minimum = minMatch ? minMatch[1] : null;
    
    // Determinar sobre qué aplica
    let appliesTo: 'perdida' | 'valor' | null = null;
    if (lower.includes('valor asegurado') || lower.includes('suma asegurada') || lower.includes('sobre el valor')) {
      appliesTo = 'valor';
    } else if (lower.includes('perdida') || lower.includes('siniestro') || lower.includes('sobre la pérdida')) {
      appliesTo = 'perdida';
    }
    
    return { percentage, minimum, appliesTo };
  };
  
  // Función para determinar severidad
  const getSeverity = (percentage: string | null, appliesTo: 'perdida' | 'valor' | null) => {
    if (!percentage) return 'neutral';
    const num = parseFloat(percentage);
    
    if (appliesTo === 'valor') return 'critical';
    if (num > 15) return 'warning';
    if (num <= 5) return 'good';
    return 'neutral';
  };
  
  if (coverages.length === 0) {
    return (
      <div className="bg-slate-50 p-8 rounded-xl text-center">
        <Info className="mx-auto mb-4 text-slate-400" size={48} />
        <p className="text-slate-600">No se encontraron deducibles específicos por cobertura.</p>
        <p className="text-sm text-slate-500 mt-2">Revisa el texto completo de deducibles a continuación.</p>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 bg-gradient-to-r from-indigo-50 to-white border-b border-slate-200">
        <h3 className="font-bold text-slate-800 flex items-center text-lg">
          <Scale className="mr-3 text-indigo-600" size={24} />
          Comparativa de Deducibles por Cobertura
        </h3>
        <div className="flex flex-wrap gap-4 mt-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
            <span className="text-slate-600">Sobre Pérdida (Favorable)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
            <span className="text-slate-600">Sobre Valor Asegurado (Desfavorable)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-amber-100 border border-amber-300 rounded"></div>
            <span className="text-slate-600">Alto (&gt;15%)</span>
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-700 font-bold text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left w-56 sticky left-0 bg-slate-100 border-r border-slate-200 z-10">
                Cobertura
              </th>
              {quotes.map((q, i) => (
                <th key={i} className="px-4 py-3 text-center min-w-[200px]">
                  <div className="font-bold">{q.insurerName}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {coverages.map((coverageName, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-4 font-medium text-slate-700 bg-white sticky left-0 border-r border-slate-100 z-10">
                  {coverageName}
                </td>
                {quotes.map((q, qIdx) => {
                  const coverage = q.coverages?.find((c: any) => c.name === coverageName);
                  const deductible = coverage?.deductible || '';
                  const { percentage, minimum, appliesTo } = parseDeductible(deductible);
                  const severity = getSeverity(percentage, appliesTo);
                  
                  const severityClasses = {
                    good: 'bg-green-50 border-green-200 text-green-800',
                    warning: 'bg-amber-50 border-amber-200 text-amber-800',
                    critical: 'bg-red-50 border-red-200 text-red-800',
                    neutral: 'bg-slate-50 border-slate-200 text-slate-600'
                  };
                  
                  return (
                    <td key={qIdx} className="px-4 py-4 text-center">
                      {deductible ? (
                        <div className={`inline-flex flex-col items-center p-3 rounded-lg border ${severityClasses[severity]}`}>
                          {percentage && (
                            <span className="text-lg font-bold">{percentage}</span>
                          )}
                          {minimum && (
                            <span className="text-xs mt-1">Mín. {minimum} SMMLV</span>
                          )}
                          {appliesTo === 'valor' && (
                            <span className="flex items-center gap-1 text-xs mt-2 text-red-600 font-semibold">
                              <AlertTriangle size={12} /> Sobre Valor Aseg.
                            </span>
                          )}
                          {appliesTo === 'perdida' && (
                            <span className="flex items-center gap-1 text-xs mt-2 text-green-600 font-semibold">
                              <CheckCircle size={12} /> Sobre Pérdida
                            </span>
                          )}
                          {!appliesTo && !percentage && (
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
    </div>
  );
};
