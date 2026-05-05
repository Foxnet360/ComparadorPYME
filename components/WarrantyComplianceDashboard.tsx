import React from 'react';
import { AlertTriangle, CheckCircle, Clock, FileText, Wrench, DollarSign } from 'lucide-react';

interface WarrantyComplianceDashboardProps {
  summary: {
    totalConditions: number;
    byType: {
      documental: { count: number; compliant: number; risk: string };
      operacional: { count: number; compliant: number; risk: string };
      tecnico: { count: number; compliant: number; risk: string };
      financiero: { count: number; compliant: number; risk: string };
    };
    overallRisk: string;
    compliancePercentage: number;
  };
}

const getRiskColor = (risk: string) => {
  switch (risk) {
    case 'HIGH': return 'text-red-600 bg-red-50 border-red-200';
    case 'MEDIUM': return 'text-amber-600 bg-amber-50 border-amber-200';
    case 'LOW': return 'text-green-600 bg-green-50 border-green-200';
    default: return 'text-slate-600 bg-slate-50 border-slate-200';
  }
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'documental': return <FileText size={18} />;
    case 'operacional': return <Clock size={18} />;
    case 'tecnico': return <Wrench size={18} />;
    case 'financiero': return <DollarSign size={18} />;
    default: return <FileText size={18} />;
  }
};

export const WarrantyComplianceDashboard: React.FC<WarrantyComplianceDashboardProps> = ({
  summary
}) => {
  const types = [
    { key: 'documental', label: 'Documentales' },
    { key: 'operacional', label: 'Operacionales' },
    { key: 'tecnico', label: 'Técnicas' },
    { key: 'financiero', label: 'Financieras' }
  ];

  return (
    <div className="space-y-4">
      {/* Overall Status */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-800">Condiciones de la Póliza</h3>
            <p className="text-sm text-slate-500">
              {summary.totalConditions} condiciones encontradas
            </p>
          </div>
          <div className="text-right">
            <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(summary.overallRisk)}`}>
              {summary.overallRisk === 'HIGH' && <AlertTriangle size={14} />}
              {summary.overallRisk === 'LOW' && <CheckCircle size={14} />}
              Riesgo: {summary.overallRisk}
            </div>
          </div>
        </div>

        {/* Compliance Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-600">Cumplimiento Estimado</span>
            <span className="font-medium">{summary.compliancePercentage}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                summary.compliancePercentage >= 80 ? 'bg-green-500' :
                summary.compliancePercentage >= 50 ? 'bg-amber-500' :
                'bg-red-500'
              }`}
              style={{ width: `${summary.compliancePercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Type Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {types.map(({ key, label }) => {
          const typeData = summary.byType[key as keyof typeof summary.byType];
          const percentage = typeData.count > 0 
            ? Math.round((typeData.compliant / typeData.count) * 100)
            : 0;

          return (
            <div key={key} className="bg-white rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">{getTypeIcon(key)}</span>
                  <span className="font-medium text-slate-700">{label}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${getRiskColor(typeData.risk)}`}>
                  {typeData.risk}
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Condiciones</span>
                  <span className="font-medium">{typeData.count}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Cumplidas</span>
                  <span className="font-medium text-green-600">{typeData.compliant}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full mt-2">
                  <div
                    className={`h-full rounded-full ${
                      percentage >= 80 ? 'bg-green-500' :
                      percentage >= 50 ? 'bg-amber-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WarrantyComplianceDashboard;
