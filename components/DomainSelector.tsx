import React from 'react';
import { Building2, Car } from 'lucide-react';

export type InsuranceDomain = 'pyme' | 'autos';

export interface DomainOption {
  id: InsuranceDomain;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}

export interface DomainSelectorProps {
  selectedDomain: InsuranceDomain;
  onChange: (domain: InsuranceDomain) => void;
  disabled?: boolean;
  className?: string;
}

const DOMAIN_OPTIONS: DomainOption[] = [
  {
    id: 'pyme',
    label: 'Pyme / Comercial',
    sublabel: 'Cotizaciones multiriesgo y comercial',
    icon: Building2,
  },
  {
    id: 'autos',
    label: 'Seguro de Autos',
    sublabel: 'Cotizaciones de vehículos y flotas',
    icon: Car,
  },
];

export const DomainSelector: React.FC<DomainSelectorProps> = ({
  selectedDomain = 'pyme',
  onChange,
  disabled = false,
  className = '',
}) => {
  return (
    <div className={`w-full ${className}`}>
      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
        Ramo de Seguro
      </label>
      <div
        role="radiogroup"
        aria-label="Seleccionar ramo de seguro"
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        {DOMAIN_OPTIONS.map((option) => {
          const isSelected = selectedDomain === option.id;
          const Icon = option.icon;

          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={option.label}
              disabled={disabled}
              onClick={() => !disabled && onChange(option.id)}
              className={`flex items-center p-3.5 rounded-xl border-2 transition-all duration-200 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 ${
                isSelected
                  ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              } ${
                disabled
                  ? 'opacity-50 cursor-not-allowed pointer-events-none border-slate-200 bg-slate-50 text-slate-400'
                  : ''
              }`}
            >
              <div
                className={`p-2 rounded-lg mr-3 flex-shrink-0 transition-colors ${
                  isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <Icon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm leading-snug truncate">{option.label}</div>
                <div
                  className={`text-xs truncate mt-0.5 ${
                    isSelected ? 'text-indigo-700 font-medium' : 'text-slate-500'
                  }`}
                >
                  {option.sublabel}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DomainSelector;
