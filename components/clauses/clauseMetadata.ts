import { InsuranceDomain, InsuranceDomainType } from '@shared/insuranceDomain';

export interface ClauseDocumentItem {
  id: string;
  documentName: string;
  documentType: string;
  version?: string;
  productName?: string;
  totalPages: number;
  isActive: boolean;
  createdAt: string;
  domain?: string;
  insurer: {
    id: string;
    name: string;
  };
}

export interface ClauseUploadFormData {
  insurerName: string;
  documentName: string;
  documentType: string;
  productName: string;
  version: string;
  domain: string;
}

export const CLAUSE_DOMAIN_OPTIONS: ReadonlyArray<{
  value: InsuranceDomainType;
  label: string;
  color: string;
}> = [
  {
    value: InsuranceDomain.PYME,
    label: 'PYME Comercial',
    color: 'bg-blue-50 text-blue-700 ring-blue-700/10',
  },
  {
    value: InsuranceDomain.COPROPIEDADES,
    label: 'Copropiedades (Ley 675)',
    color: 'bg-amber-50 text-amber-700 ring-amber-700/10',
  },
  {
    value: InsuranceDomain.AUTOS,
    label: 'Vehículos y Flotas',
    color: 'bg-emerald-50 text-emerald-700 ring-emerald-700/10',
  },
  {
    value: InsuranceDomain.HOGAR,
    label: 'Hogar y Habitación',
    color: 'bg-indigo-50 text-indigo-700 ring-indigo-700/10',
  },
  {
    value: InsuranceDomain.SALUD,
    label: 'Salud y Prepagada',
    color: 'bg-rose-50 text-rose-700 ring-rose-700/10',
  },
  {
    value: InsuranceDomain.VIDA_GRUPO,
    label: 'Vida Grupo y Colectivo',
    color: 'bg-violet-50 text-violet-700 ring-violet-700/10',
  },
  {
    value: InsuranceDomain.CUMPLIMIENTO,
    label: 'Cumplimiento y Fianzas',
    color: 'bg-slate-50 text-slate-700 ring-slate-700/10',
  },
  {
    value: InsuranceDomain.TRANSPORTE,
    label: 'Transporte de Mercancías',
    color: 'bg-orange-50 text-orange-700 ring-orange-700/10',
  },
  {
    value: InsuranceDomain.EQUIPO_MAQUINARIA,
    label: 'Maquinaria y Equipo',
    color: 'bg-yellow-50 text-yellow-800 ring-yellow-800/10',
  },
  {
    value: InsuranceDomain.CASCO_EMBARCACION,
    label: 'Casco Embarcación',
    color: 'bg-cyan-50 text-cyan-700 ring-cyan-700/10',
  },
];

export const getDocumentTypeBadge = (type: string): string => {
  switch (type) {
    case 'CLAUSULADO_GENERAL':
      return 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10';
    case 'CLAUSULADO_PARTICULAR':
      return 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-700/10';
    case 'ANEXO':
      return 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-700/10';
    case 'COTIZACION':
      return 'bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-600/10';
    default:
      return 'bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-600/10';
  }
};

export const getDocumentTypeLabel = (type: string): string => {
  switch (type) {
    case 'CLAUSULADO_GENERAL':
      return 'General';
    case 'CLAUSULADO_PARTICULAR':
      return 'Particular';
    case 'ANEXO':
      return 'Anexo';
    case 'COTIZACION':
      return 'Cotización';
    default:
      return type;
  }
};

export const getDomainLabel = (dom?: string): string => {
  const found = CLAUSE_DOMAIN_OPTIONS.find((d) => d.value === dom);
  return found ? found.label : dom ? dom.toUpperCase() : 'General';
};

export const getDomainBadgeClass = (dom?: string): string => {
  const found = CLAUSE_DOMAIN_OPTIONS.find((d) => d.value === dom);
  return found ? found.color : 'bg-slate-50 text-slate-700 ring-slate-700/10';
};
