import React, { useState } from 'react';

interface DeductibleGaugeProps {
  deductible: string;
  size?: number;
}

interface GaugeConfig {
  percentage: number;
  color: string;
  label: string;
  recommendation: string;
}

const parseDeductible = (deductible: string): GaugeConfig => {
  const upperValue = deductible?.toUpperCase().trim() || '';

  // No deductible
  if (
    !upperValue ||
    upperValue === 'NO APLICA' ||
    upperValue === 'SIN DEDUCIBLE' ||
    upperValue === 'INCLUIDO'
  ) {
    return {
      percentage: 0,
      color: '#10b981', // green
      label: 'Sin deducible',
      recommendation: 'Excelente: Sin deducible adicional',
    };
  }

  // Unspecified - highest risk
  if (upperValue === 'NO ESPECIFICADO' || upperValue === 'N/A') {
    return {
      percentage: 100,
      color: '#ef4444', // red
      label: 'No especificado',
      recommendation: '⚠️ Riesgo: El deducible no está especificado. Solicitar aclaración.',
    };
  }

  // Parse percentage
  const percentMatch = upperValue.match(/(\d+)%/);
  if (percentMatch) {
    const percentage = parseInt(percentMatch[1]);
    if (percentage > 10) {
      return {
        percentage: Math.min(percentage, 100),
        color: '#ef4444', // red
        label: `${percentage}%`,
        recommendation: '⚠️ Alto: Deducible superior al 10% del mercado',
      };
    } else if (percentage > 0) {
      return {
        percentage: percentage * 5, // Scale to 0-50 range
        color: '#f59e0b', // yellow
        label: `${percentage}%`,
        recommendation: 'Moderado: Dentro del rango estándar del mercado',
      };
    }
  }

  // Parse absolute values (SMMLV, etc.)
  const smmlvMatch = upperValue.match(/(\d+)\s*SMMLV/i);
  if (smmlvMatch) {
    const smmlv = parseInt(smmlvMatch[1]);
    if (smmlv > 5) {
      return {
        percentage: Math.min(smmlv * 10, 100),
        color: '#ef4444',
        label: `${smmlv} SMMLV`,
        recommendation: '⚠️ Alto: Deducible elevado en términos absolutos',
      };
    } else {
      return {
        percentage: smmlv * 10,
        color: '#f59e0b',
        label: `${smmlv} SMMLV`,
        recommendation: 'Moderado: Deducible estándar',
      };
    }
  }

  // Default for unrecognized formats
  return {
    percentage: 50,
    color: '#f59e0b',
    label: deductible,
    recommendation: 'Revisar: Formato de deducible no estándar',
  };
};

export const DeductibleGauge: React.FC<DeductibleGaugeProps> = ({ deductible, size = 60 }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const config = parseDeductible(deductible);

  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (config.percentage / 100) * circumference;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={config.color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>

      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold text-slate-700">{config.label}</span>
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
          <div className="bg-slate-800 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap shadow-lg">
            <div className="font-semibold mb-1">{deductible || 'No especificado'}</div>
            <div className="text-slate-300">{config.recommendation}</div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
              <div className="w-2 h-2 bg-slate-800 rotate-45"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeductibleGauge;
