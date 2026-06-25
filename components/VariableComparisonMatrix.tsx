import React, { useState } from 'react';
import { VariableComparison } from '../types/analysis';
import { BarChart3, ChevronDown, ChevronUp, AlertTriangle, Check} from 'lucide-react';

interface VariableComparisonMatrixProps {
  comparisons: VariableComparison[];
  insurers: string[];
}

const VariableComparisonMatrix: React.FC<VariableComparisonMatrixProps> = ({ comparisons, insurers }) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showOnlyDifferences, setShowOnlyDifferences] = useState(false);

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const formatValue = (value: any): string => {
    if (!value) return '-';
    if (typeof value === 'object') {
      if (value.value && value.currency) {
        return `${value.currency} ${value.value.toLocaleString()}`;
      }
      return JSON.stringify(value);
    }
    return String(value);
  };

  const formatDeductible = (deductible: any): string => {
    if (!deductible) return '-';
    if (deductible.normalized) {
      const parts = [];
      if (deductible.normalized.percentage > 0) parts.push(`${deductible.normalized.percentage}%`);
      if (deductible.normalized.minAmount > 0) parts.push(`min: ${deductible.normalized.minAmount.toLocaleString()}`);
      if (deductible.normalized.maxAmount > 0 && deductible.normalized.maxAmount !== Infinity) {
        parts.push(`max: ${deductible.normalized.maxAmount.toLocaleString()}`);
      }
      const formatted = parts.join(', ');
      if (formatted) return formatted;
    }
    if (deductible.rawText) return deductible.rawText;
    return '-';
  };

  const filteredComparisons = showOnlyDifferences
    ? comparisons.filter(c => {
        // Show if there are differences in values or if coverage is exclusive
        const values = c.variables.map(v => v.insuredAmount?.value);
        const uniqueValues = [...new Set(values)];
        return uniqueValues.length > 1 || c.exclusiveCoverages.length > 0;
      })
    : comparisons;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="text-indigo-600" size={24} />
            <h2 className="text-xl font-bold text-slate-900">Matriz de Comparación Variable a Variable</h2>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyDifferences}
              onChange={(e) => setShowOnlyDifferences(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Mostrar solo diferencias
          </label>
        </div>
        
        <p className="text-slate-600 text-sm">
          Comparación directa de valores asegurados, deducibles, sublímites y exclusiones 
          sin forzar categorías canónicas.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-48">
                Variable / Aseguradora
              </th>
              {insurers.map(insurer => (
                <th 
                  key={insurer}
                  className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[150px]"
                >
                  {insurer}
                </th>
              ))}
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">
                Análisis
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredComparisons.map((comparison) => (
              <React.Fragment key={comparison.groupId}>
                <tr 
                  className={`hover:bg-slate-50 cursor-pointer ${
                    comparison.exclusiveCoverages.length > 0 ? 'bg-amber-50/50' : ''
                  }`}
                  onClick={() => toggleGroup(comparison.groupId)}
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{comparison.groupName}</span>
                      {comparison.exclusiveCoverages.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          <AlertTriangle size={12} />
                          Exclusiva
                        </span>
                      )}
                      {expandedGroups.has(comparison.groupId) ? (
                        <ChevronUp size={16} className="text-slate-400" />
                      ) : (
                        <ChevronDown size={16} className="text-slate-400" />
                      )}
                    </div>
                  </td>
                  
                  {insurers.map(insurer => {
                    const variable = comparison.variables.find(v => v.insurerName === insurer);
                    return (
                      <td key={insurer} className="px-4 py-4 text-center">
                        {variable ? (
                          <div className="space-y-1">
                            <div className="text-sm font-medium text-slate-900">
                              {formatValue(variable.insuredAmount)}
                            </div>
                            <div className="text-xs text-slate-500">
                              {formatDeductible(variable.deductible)}
                            </div>
                            {variable.sublimit && (
                              <div className="text-xs text-indigo-600">
                                Tope: {formatValue(variable.sublimit)}
                              </div>
                            )}
                            {variable.exclusions.length > 0 && (
                              <div className="text-xs text-red-600">
                                {variable.exclusions.length} exclusiones
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-sm">No aplica</span>
                        )}
                      </td>
                    );
                  })}
                  
                  <td className="px-4 py-4 text-center">
                    {comparison.analysis.bestInsuredAmount && (
                      <div className="flex items-center justify-center gap-1 text-xs text-green-600">
                        <Check size={12} />
                        Mejor valor
                      </div>
                    )}
                    {comparison.analysis.bestDeductible && (
                      <div className="flex items-center justify-center gap-1 text-xs text-green-600">
                        <Check size={12} />
                        Mejor deducible
                      </div>
                    )}
                    {comparison.exclusiveCoverages.length > 0 && (
                      <div className="flex items-center justify-center gap-1 text-xs text-amber-600">
                        <AlertTriangle size={12} />
                        Exclusiva
                      </div>
                    )}
                  </td>
                </tr>
                
                {expandedGroups.has(comparison.groupId) && (
                  <tr className="bg-slate-50/50">
                    <td colSpan={insurers.length + 2} className="px-4 py-4">
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-slate-700">Detalles de cobertura</h4>
                        
                        {comparison.variables.map((variable) => (
                          <div key={variable.insurerName} className="bg-white rounded-lg p-3 border border-slate-200">
                            <div className="font-medium text-slate-900 mb-2">{variable.insurerName}</div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-slate-500">Nombre original: </span>
                                <span className="text-slate-900">{variable.rawName}</span>
                              </div>
                              <div>
                                <span className="text-slate-500">Confianza: </span>
                                <span className="text-slate-900">{(variable.confidence * 100).toFixed(0)}%</span>
                              </div>
                              <div>
                                <span className="text-slate-500">Valor asegurado: </span>
                                <span className="text-slate-900">{formatValue(variable.insuredAmount)}</span>
                              </div>
                              <div>
                                <span className="text-slate-500">Deducible: </span>
                                <span className="text-slate-900">{formatDeductible(variable.deductible)}</span>
                              </div>
                            </div>
                            
                            {variable.exclusions.length > 0 && (
                              <div className="mt-2">
                                <span className="text-xs text-slate-500">Exclusiones: </span>
                                <span className="text-xs text-red-600">{variable.exclusions.join(', ')}</span>
                              </div>
                            )}
                            
                            {variable.conditions.length > 0 && (
                              <div className="mt-2">
                                <span className="text-xs text-slate-500">Condiciones: </span>
                                <span className="text-xs text-slate-700">{variable.conditions.join(', ')}</span>
                              </div>
                            )}
                          </div>
                        ))}
                        
                        {comparison.exclusiveCoverages.length > 0 && (
                          <div className="mt-3">
                            <div className="flex items-center gap-2 text-amber-700 bg-amber-50 p-3 rounded-lg">
                              <AlertTriangle size={16} />
                              <span className="text-sm font-medium">
                                Coberturas exclusivas: {comparison.exclusiveCoverages.map(e => 
                                  `${e.rawName} (${e.insurerName})`
                                ).join(', ')}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      
      {filteredComparisons.length === 0 && (
        <div className="p-8 text-center text-slate-500">
          No se encontraron diferencias entre las cotizaciones.
        </div>
      )}
    </div>
  );
};

export default VariableComparisonMatrix;