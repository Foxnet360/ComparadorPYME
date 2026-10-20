import React, { useState } from 'react';
import { findPedagogicalExplanation } from '../src/shared/domainRegulatoryKnowledge';

interface DeductibleBadgeProps {
  deductible: string;
  coverageName?: string;
  className?: string;
}

interface BadgeConfig {
  color: string;
  bgColor: string;
  label: string;
  recommendation: string;
  riskLevel: 'low' | 'medium' | 'high' | 'none';
}

export const normalizeDeductibleBadgeValue = (text: string): string => {
  if (!text) return text;
  return text.replace(/\bS\.?\s*M\.?\s*M\.?\s*L\.?\s*V\.?\b/gi, 'SMMLV');
};

export const parseDeductibleForBadge = (deductible: string): BadgeConfig => {
  const normalizedValue = normalizeDeductibleBadgeValue(deductible);
  const upperValue = normalizedValue?.toUpperCase().trim() || '';

  // Not quoted asset (e.g. Edificio no cotizado)
  if (
    upperValue.includes('NO COTIZADO') ||
    upperValue.includes('NO COTIZADA') ||
    (upperValue.includes('NO APLICA') && upperValue.includes('COTIZAD'))
  ) {
    return {
      color: 'text-slate-600',
      bgColor: 'bg-slate-100',
      label: 'No Aplica (No cotizado)',
      recommendation: 'El bien base de este amparo no fue cotizado en esta póliza.',
      riskLevel: 'none',
    };
  }

  // No deductible
  if (
    !upperValue ||
    upperValue === 'NO APLICA' ||
    upperValue === 'SIN DEDUCIBLE' ||
    upperValue === 'INCLUIDO' ||
    upperValue === 'N/A'
  ) {
    return {
      color: 'text-green-700',
      bgColor: 'bg-green-100',
      label: 'Sin deducible',
      recommendation: 'Sin deducible adicional',
      riskLevel: 'none',
    };
  }

  // Unspecified - highest risk
  if (upperValue === 'NO ESPECIFICADO') {
    return {
      color: 'text-red-700',
      bgColor: 'bg-red-100',
      label: 'No especificado',
      recommendation: '⚠️ Riesgo: El deducible no está especificado. Solicitar aclaración.',
      riskLevel: 'high',
    };
  }

  // Parse percentage
  const percentMatch = upperValue.match(/(\d+)%/);
  if (percentMatch) {
    const percentage = parseInt(percentMatch[1]!);
    if (percentage > 10) {
      return {
        color: 'text-red-700',
        bgColor: 'bg-red-100',
        label: `${percentage}%`,
        recommendation: '⚠️ Alto: Deducible superior al 10% del mercado',
        riskLevel: 'high',
      };
    } else if (percentage > 0) {
      return {
        color: 'text-yellow-700',
        bgColor: 'bg-yellow-100',
        label: `${percentage}%`,
        recommendation: 'Moderado: Dentro del rango estándar del mercado',
        riskLevel: 'medium',
      };
    }
  }

  // Parse absolute values (SMMLV, etc.)
  const smmlvMatch = upperValue.match(/(\d+)\s*SMMLV/i);
  if (smmlvMatch) {
    const smmlv = parseInt(smmlvMatch[1]!);
    if (smmlv > 5) {
      return {
        color: 'text-red-700',
        bgColor: 'bg-red-100',
        label: `${smmlv} SMMLV`,
        recommendation: '⚠️ Alto: Deducible elevado en términos absolutos',
        riskLevel: 'high',
      };
    } else {
      return {
        color: 'text-yellow-700',
        bgColor: 'bg-yellow-100',
        label: `${smmlv} SMMLV`,
        recommendation: 'Moderado: Deducible estándar',
        riskLevel: 'medium',
      };
    }
  }

  // Default for unrecognized formats
  return {
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    label: deductible,
    recommendation: 'Revisar: Formato de deducible no estándar',
    riskLevel: 'medium',
  };
};

export const DeductibleBadge: React.FC<DeductibleBadgeProps> = ({
  deductible,
  coverageName = '',
  className = '',
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  if (deductible && deductible.includes(';')) {
    const parts = deductible
      .split(';')
      .map((p) => p.trim())
      .filter(Boolean);
    return (
      <div className="flex flex-col gap-1 items-center">
        {parts.map((part, idx) => (
          <DeductibleBadge
            key={idx}
            deductible={part}
            coverageName={coverageName}
            className={className}
          />
        ))}
      </div>
    );
  }

  const config = parseDeductibleForBadge(deductible);
  const pedagogical = findPedagogicalExplanation(coverageName, deductible, 'deductible');

  return (
    <span
      className={`relative inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium cursor-help ${config.bgColor} ${config.color} ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          config.riskLevel === 'none'
            ? 'bg-green-500'
            : config.riskLevel === 'low'
              ? 'bg-green-500'
              : config.riskLevel === 'medium'
                ? 'bg-yellow-500'
                : 'bg-red-500'
        }`}
      />
      <span>{config.label}</span>

      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-72 sm:w-80 bg-slate-900 text-white text-xs rounded-xl p-3 shadow-2xl border border-slate-700 text-left whitespace-normal pointer-events-none">
          <div className="font-bold text-indigo-300 border-b border-slate-700/80 pb-1.5 mb-1.5">
            {deductible || 'No especificado'}
          </div>
          <div className="text-amber-300 font-semibold text-[11px] mb-1.5">
            {config.recommendation}
          </div>
          <div className="space-y-1 text-[11px] text-slate-200 leading-snug">
            <div>
              <span className="font-semibold text-emerald-300">Qué significa: </span>
              {pedagogical.whatItCovers}
            </div>
            <div>
              <span className="font-semibold text-cyan-300">Impacto en reclamo: </span>
              {pedagogical.claimImpact}
            </div>
          </div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-900"></div>
        </div>
      )}
    </span>
  );
};

export default DeductibleBadge;
