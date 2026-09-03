import React from 'react';
import {
  Building2,
  Car,
  Building,
  Users,
  Stethoscope,
  Scale,
  Truck,
  Home,
  Cog,
  Anchor,
} from 'lucide-react';

export type InsuranceDomain =
  | 'pyme'
  | 'autos'
  | 'copropiedades'
  | 'vida_grupo'
  | 'salud'
  | 'cumplimiento'
  | 'transporte'
  | 'hogar'
  | 'equipo_maquinaria'
  | 'casco_embarcacion';

export interface DomainOption {
  id: InsuranceDomain;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string; size?: string | number }>;
}

export interface DomainSelectorProps {
  selectedDomain: InsuranceDomain;
  onChange: (domain: InsuranceDomain) => void;
  disabled?: boolean;
  className?: string;
  allowedDomains?: InsuranceDomain[];
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
  {
    id: 'copropiedades',
    label: 'Copropiedades',
    sublabel: 'Edificios, conjuntos y Ley 675',
    icon: Building,
  },
  {
    id: 'vida_grupo',
    label: 'Vida Grupo / Colectivo',
    sublabel: 'Pólizas colectivas de vida y amparos',
    icon: Users,
  },
  {
    id: 'salud',
    label: 'Salud / Medicina Prepagada',
    sublabel: 'Planes voluntarios de salud (Res. 244/2019)',
    icon: Stethoscope,
  },
  {
    id: 'cumplimiento',
    label: 'Cumplimiento y Fianzas',
    sublabel: 'Garantías contractuales y estatales (Ley 80/1993)',
    icon: Scale,
  },
  {
    id: 'transporte',
    label: 'Transporte de Mercancías',
    sublabel: 'Fletes terrestres, aéreos y marítimos (Incoterms 2020)',
    icon: Truck,
  },
  {
    id: 'hogar',
    label: 'Seguro de Hogar',
    sublabel: 'Vivienda, contenidos, RCE y reglamentación (Ley 675 / Ley 1796)',
    icon: Home,
  },
  {
    id: 'equipo_maquinaria',
    label: 'Maquinaria y Equipo',
    sublabel: 'Rotura de maquinaria, equipo amarillo y contratista (C.Co 1083)',
    icon: Cog,
  },
  {
    id: 'casco_embarcacion',
    label: 'Casco Embarcación',
    sublabel: 'Navegación marítima, fluvial, DIMAR e Institute Time Clauses',
    icon: Anchor,
  },
];

export const DomainSelector: React.FC<DomainSelectorProps> = ({
  selectedDomain = 'pyme',
  onChange,
  disabled = false,
  className = '',
  allowedDomains,
}) => {
  const visibleOptions = allowedDomains
    ? DOMAIN_OPTIONS.filter((option) => allowedDomains.includes(option.id))
    : DOMAIN_OPTIONS;

  return (
    <div
      className={`w-full bg-white p-5 rounded-2xl border border-slate-200 shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center">
          <span className="w-2 h-2 rounded-full bg-indigo-600 mr-2"></span>
          Seleccionar Ramo de Seguro a Comparar (10 Ramos Soportados)
        </label>
        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
          Ramo Activo: {DOMAIN_OPTIONS.find((d) => d.id === selectedDomain)?.label || 'PYME'}
        </span>
      </div>

      <div
        role="radiogroup"
        aria-label="Seleccionar ramo de seguro"
        className="grid grid-cols-2 sm:grid-cols-5 gap-3"
      >
        {visibleOptions.map((option) => {
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
              className={`flex flex-col p-3 rounded-xl border-2 transition-all duration-200 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                isSelected
                  ? 'border-indigo-600 bg-indigo-50/90 text-indigo-950 shadow-md ring-1 ring-indigo-500'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-slate-50/80'
              } ${
                disabled
                  ? 'opacity-50 cursor-not-allowed pointer-events-none border-slate-200 bg-slate-50 text-slate-400'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <div
                  className={`p-2 rounded-lg transition-colors ${
                    isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Icon size={18} />
                </div>
                {isSelected && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                )}
              </div>
              <div className="font-bold text-xs leading-snug truncate">{option.label}</div>
              <div
                className={`text-[11px] truncate mt-0.5 ${
                  isSelected ? 'text-indigo-700 font-semibold' : 'text-slate-500'
                }`}
              >
                {option.sublabel}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DomainSelector;
