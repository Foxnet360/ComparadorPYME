import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';

interface InverseCoverageAlertProps {
  coverageName: string;
  isMandatory: boolean;
  clauseReference?: string;
}

export const InverseCoverageAlert: React.FC<InverseCoverageAlertProps> = ({
  coverageName,
  isMandatory,
  clauseReference,
}) => {
  if (isMandatory) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
        <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-800">Cobertura Obligatoria Omitida</p>
          <p className="text-sm text-amber-700 mt-1">
            La cotización no incluye <strong>{coverageName}</strong>, que es una cobertura
            obligatoria según el clausulado.
          </p>
          {clauseReference && (
            <p className="text-xs text-amber-600 mt-1">Referencia: {clauseReference}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-3">
      <Info className="text-blue-600 flex-shrink-0 mt-0.5" size={18} />
      <div className="flex-1">
        <p className="text-sm font-medium text-blue-800">Cobertura Opcional No Contratada</p>
        <p className="text-sm text-blue-700 mt-1">
          La cotización no incluye <strong>{coverageName}</strong>. Esta cobertura es opcional según
          el clausulado.
        </p>
      </div>
    </div>
  );
};

export default InverseCoverageAlert;
