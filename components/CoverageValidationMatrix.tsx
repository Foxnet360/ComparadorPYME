import React from 'react';
import { CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

interface CoverageValidation {
  coverageName: string;
  status: 'VERIFIED' | 'PHANTOM' | 'MANDATORY_MISSING' | 'OPTIONAL_MISSING';
  alertLevel?: 'CRITICAL' | 'WARNING' | 'INFO';
}

interface CoverageValidationMatrixProps {
  validations: CoverageValidation[];
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'VERIFIED':
      return <CheckCircle className="text-green-500" size={18} />;
    case 'PHANTOM':
      return <AlertCircle className="text-red-500" size={18} />;
    case 'MANDATORY_MISSING':
      return <AlertTriangle className="text-amber-500" size={18} />;
    case 'OPTIONAL_MISSING':
      return <Info className="text-blue-500" size={18} />;
    default:
      return <Info className="text-gray-400" size={18} />;
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'VERIFIED':
      return 'Verificada';
    case 'PHANTOM':
      return 'Fantasma';
    case 'MANDATORY_MISSING':
      return 'Obligatoria Omitida';
    case 'OPTIONAL_MISSING':
      return 'Opcional Omitida';
    default:
      return status;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'VERIFIED':
      return 'bg-green-50 border-green-200 text-green-800';
    case 'PHANTOM':
      return 'bg-red-50 border-red-200 text-red-800';
    case 'MANDATORY_MISSING':
      return 'bg-amber-50 border-amber-200 text-amber-800';
    case 'OPTIONAL_MISSING':
      return 'bg-blue-50 border-blue-200 text-blue-800';
    default:
      return 'bg-gray-50 border-gray-200 text-gray-800';
  }
};

export const CoverageValidationMatrix: React.FC<CoverageValidationMatrixProps> = ({ validations }) => {
  if (!validations || validations.length === 0) {
    return (
      <div className="text-sm text-slate-500 p-4">
        No hay datos de validación de coberturas.
      </div>
    );
  }

  const verified = validations.filter(v => v.status === 'VERIFIED');
  const phantom = validations.filter(v => v.status === 'PHANTOM');
  const mandatoryMissing = validations.filter(v => v.status === 'MANDATORY_MISSING');

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 rounded-lg p-3 border border-green-200">
          <div className="flex items-center gap-2">
            <CheckCircle className="text-green-600" size={16} />
            <span className="text-sm font-medium text-green-800">Verificadas</span>
          </div>
          <p className="text-2xl font-bold text-green-700 mt-1">{verified.length}</p>
        </div>
        
        <div className="bg-red-50 rounded-lg p-3 border border-red-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="text-red-600" size={16} />
            <span className="text-sm font-medium text-red-800">Fantasma</span>
          </div>
          <p className="text-2xl font-bold text-red-700 mt-1">{phantom.length}</p>
        </div>
        
        <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-amber-600" size={16} />
            <span className="text-sm font-medium text-amber-800">Oblig. Omitida</span>
          </div>
          <p className="text-2xl font-bold text-amber-700 mt-1">{mandatoryMissing.length}</p>
        </div>
      </div>

      {/* Matrix */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-slate-700">Cobertura</th>
              <th className="text-left px-4 py-2 font-medium text-slate-700">Estado</th>
              <th className="text-left px-4 py-2 font-medium text-slate-700">Validación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {validations.map((validation, idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-medium text-slate-800">
                  {validation.coverageName}
                </td>
                <td className="px-4 py-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(validation.status)}`}>
                    {getStatusIcon(validation.status)}
                    {getStatusLabel(validation.status)}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {validation.status === 'VERIFIED' && '✓ Confirmada en clausulado'}
                  {validation.status === 'PHANTOM' && '✗ No existe en clausulado'}
                  {validation.status === 'MANDATORY_MISSING' && '⚠ Obligatoria según clausulado'}
                  {validation.status === 'OPTIONAL_MISSING' && 'ℹ No contratada'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CoverageValidationMatrix;
