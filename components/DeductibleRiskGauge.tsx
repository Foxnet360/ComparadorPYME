import React from 'react';
import { AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';
import { formatCOP } from '../utils/formatCurrency';

interface DeductibleRiskGaugeProps {
  deductibleRatio: number; // 0.0 to 1.0
  deductibleAmount: number;
  insuredAmount: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  hasCap: boolean;
  capAmount?: number;
}

export const DeductibleRiskGauge: React.FC<DeductibleRiskGaugeProps> = ({
  deductibleRatio,
  deductibleAmount,
  insuredAmount,
  riskLevel,
  hasCap,
  capAmount
}) => {
  const percentage = deductibleRatio * 100;
  
  const getColor = () => {
    switch (riskLevel) {
      case 'LOW': return 'text-green-600';
      case 'MEDIUM': return 'text-amber-600';
      case 'HIGH': return 'text-red-600';
    }
  };
  
  const getBgColor = () => {
    switch (riskLevel) {
      case 'LOW': return 'bg-green-500';
      case 'MEDIUM': return 'bg-amber-500';
      case 'HIGH': return 'bg-red-500';
    }
  };
  
  const getIcon = () => {
    switch (riskLevel) {
      case 'LOW': return <CheckCircle className="text-green-600" size={20} />;
      case 'MEDIUM': return <AlertTriangle className="text-amber-600" size={20} />;
      case 'HIGH': return <AlertCircle className="text-red-600" size={20} />;
    }
  };
  
  const getLabel = () => {
    switch (riskLevel) {
      case 'LOW': return 'Riesgo Bajo';
      case 'MEDIUM': return 'Riesgo Medio';
      case 'HIGH': return 'Riesgo Alto';
    }
  };
  
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {getIcon()}
          <span className={`font-semibold ${getColor()}`}>{getLabel()}</span>
        </div>
        <span className="text-sm text-slate-500">
          {percentage.toFixed(1)}% del valor asegurado
        </span>
      </div>
      
      {/* Gauge */}
      <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden mb-3">
        <div 
          className={`absolute h-full ${getBgColor()} transition-all duration-500`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
        {/* Markers */}
        <div className="absolute top-0 bottom-0 w-0.5 bg-slate-300" style={{ left: '10%' }} />
        <div className="absolute top-0 bottom-0 w-0.5 bg-slate-300" style={{ left: '15%' }} />
      </div>
      
      <div className="flex justify-between text-xs text-slate-400 mb-3">
        <span>0%</span>
        <span>10%</span>
        <span>15%</span>
        <span>20%+</span>
      </div>
      
      {/* Details */}
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-600">Valor Asegurado:</span>
          <span className="font-medium">{formatCOP(insuredAmount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Deducible Real:</span>
          <span className="font-medium">{formatCOP(deductibleAmount)}</span>
        </div>
        {hasCap && capAmount && (
          <div className="flex justify-between">
            <span className="text-slate-600">Tope Máximo:</span>
            <span className="font-medium text-green-600">{formatCOP(capAmount)}</span>
          </div>
        )}
        {!hasCap && (
          <div className="flex justify-between">
            <span className="text-slate-600">Tope Máximo:</span>
            <span className="font-medium text-red-600">No aplica</span>
          </div>
        )}
      </div>
    </div>
  );
};



export default DeductibleRiskGauge;
