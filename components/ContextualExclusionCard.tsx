import React, { useState } from 'react';
import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp, Shield } from 'lucide-react';

interface ContextualExclusionCardProps {
  exclusion: string;
  contextualRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  explanation: string;
  mitigationSuggestions: string[];
  estimatedAdditionalCost?: string;
}

export const ContextualExclusionCard: React.FC<ContextualExclusionCardProps> = ({
  exclusion,
  contextualRiskLevel,
  explanation,
  mitigationSuggestions,
  estimatedAdditionalCost,
}) => {
  const [expanded, setExpanded] = useState(false);

  const getRiskConfig = () => {
    switch (contextualRiskLevel) {
      case 'CRITICAL':
        return {
          icon: <AlertCircle className="text-red-600" size={20} />,
          badge: 'bg-red-100 text-red-800 border-red-200',
          label: 'CRÍTICO para este cliente',
        };
      case 'HIGH':
        return {
          icon: <AlertTriangle className="text-amber-600" size={20} />,
          badge: 'bg-amber-100 text-amber-800 border-amber-200',
          label: 'ALTO para este cliente',
        };
      case 'MEDIUM':
        return {
          icon: <Info className="text-blue-600" size={20} />,
          badge: 'bg-blue-100 text-blue-800 border-blue-200',
          label: 'MEDIO para este cliente',
        };
      case 'LOW':
        return {
          icon: <Shield className="text-green-600" size={20} />,
          badge: 'bg-green-100 text-green-800 border-green-200',
          label: 'BAJO para este cliente',
        };
    }
  };

  const config = getRiskConfig();

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          {config.icon}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded border ${config.badge}`}>
                {config.label}
              </span>
            </div>

            <p className="text-sm font-medium text-slate-800 mb-2">{exclusion}</p>

            <p className="text-sm text-slate-600">{explanation}</p>

            {estimatedAdditionalCost && (
              <p className="text-sm text-indigo-600 mt-2">
                💰 Costo estimado: {estimatedAdditionalCost}
              </p>
            )}
          </div>

          <button
            onClick={() => setExpanded(!expanded)}
            className="text-slate-400 hover:text-slate-600"
          >
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3">
          <h4 className="text-sm font-medium text-slate-700 mb-2">💡 Sugerencias de Mitigación</h4>
          <ul className="space-y-2">
            {mitigationSuggestions.map((suggestion, idx) => (
              <li key={idx} className="text-sm text-slate-600 flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5">•</span>
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ContextualExclusionCard;
