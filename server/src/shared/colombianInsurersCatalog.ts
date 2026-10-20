import { InsuranceDomain, type InsuranceDomainType } from './insuranceDomain';

export interface ColombianInsurerProfile {
  id: string;
  code: string;
  name: string;
  shortName: string;
  officialName: string;
  nit: string;
  domainUrl: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  monogram: string;
  marketPosition: string;
  description: string;
  integrationInfo: string;
  rpaEnabled: boolean;
  apiEnabled: boolean;
  supportedDomains: InsuranceDomainType[];
  aliases: string[];
  contactEmail?: string;
  phone?: string;
  isActive: boolean;
}

export const COLOMBIAN_INSURERS_CATALOG: ColombianInsurerProfile[] = [
  {
    id: 'ins-sura',
    code: 'sura',
    name: 'Seguros SURA',
    shortName: 'SURA',
    officialName: 'Seguros Generales Suramericana S.A.',
    nit: '890.903.407-9',
    domainUrl: 'segurossura.com.co',
    logoUrl: 'https://www.google.com/s2/favicons?domain=segurossura.com.co&sz=128',
    primaryColor: '#0033A0',
    accentColor: '#00AEC7',
    monogram: 'SURA',
    marketPosition: 'Líder del mercado en Colombia',
    description:
      'Líder del mercado en Colombia. Es aliada prioritaria en la integración robótica (RPA via Rocketbot) para la captura automática de primas y cotizaciones en Autos, PYMEs, Vida y ARL.',
    integrationInfo: 'RPA Rocketbot + Captura automática multiramo (Autos, PYMEs, Vida, ARL)',
    rpaEnabled: true,
    apiEnabled: true,
    supportedDomains: [
      InsuranceDomain.PYME,
      InsuranceDomain.AUTOS,
      InsuranceDomain.HOGAR,
      InsuranceDomain.COPROPIEDADES,
      InsuranceDomain.VIDA_GRUPO,
      InsuranceDomain.SALUD,
      InsuranceDomain.CUMPLIMIENTO,
      InsuranceDomain.TRANSPORTE,
      InsuranceDomain.EQUIPO_MAQUINARIA,
      InsuranceDomain.CASCO_EMBARCACION,
    ],
    aliases: ['sura', 'suramericana', 'seguros sura', 'seguros generales suramericana', 'arl sura'],
    contactEmail: 'servicioalcliente@sura.com.co',
    phone: '01 8000 51 8888',
    isActive: true,
  },
  {
    id: 'ins-bolivar',
    code: 'bolivar',
    name: 'Seguros Bolívar',
    shortName: 'Bolívar',
    officialName: 'Compañía de Seguros Bolívar S.A.',
    nit: '860.002.503-2',
    domainUrl: 'segurosbolivar.com',
    logoUrl: 'https://www.google.com/s2/favicons?domain=segurosbolivar.com&sz=128',
    primaryColor: '#00843D',
    accentColor: '#FFD100',
    monogram: 'SB',
    marketPosition: 'Aliado estratégico clave en fidelización y CPQ',
    description:
      'Aliado estratégico clave en programas de fidelización y cotización asistida; integrada en los pilotos iniciales de automatización de renovaciones y comparativos CPQ.',
    integrationInfo: 'Automatización de renovaciones y comparativos CPQ asistidos',
    rpaEnabled: true,
    apiEnabled: true,
    supportedDomains: [
      InsuranceDomain.PYME,
      InsuranceDomain.AUTOS,
      InsuranceDomain.HOGAR,
      InsuranceDomain.COPROPIEDADES,
      InsuranceDomain.VIDA_GRUPO,
      InsuranceDomain.SALUD,
      InsuranceDomain.CUMPLIMIENTO,
    ],
    aliases: [
      'bolivar',
      'bolívar',
      'seguros bolivar',
      'seguros bolívar',
      'compania de seguros bolivar',
      'comerciales bolivar',
    ],
    contactEmail: 'servicioalcliente@segurosbolivar.com',
    phone: '#322',
    isActive: true,
  },
  {
    id: 'ins-allianz',
    code: 'allianz',
    name: 'Allianz Colombia',
    shortName: 'Allianz',
    officialName: 'Allianz Seguros S.A.',
    nit: '860.026.182-5',
    domainUrl: 'allianz.co',
    logoUrl: 'https://www.google.com/s2/favicons?domain=allianz.co&sz=128',
    primaryColor: '#003781',
    accentColor: '#0062B8',
    monogram: 'AZ',
    marketPosition: 'Alto volumen en líneas personales y comerciales',
    description:
      'Compañía de alto volumen en líneas personales y comerciales, conectada mediante conectores de scraping y APIs para multicotización acelerada.',
    integrationInfo: 'Conectores de scraping y APIs de multicotización acelerada',
    rpaEnabled: true,
    apiEnabled: true,
    supportedDomains: [
      InsuranceDomain.PYME,
      InsuranceDomain.AUTOS,
      InsuranceDomain.HOGAR,
      InsuranceDomain.COPROPIEDADES,
      InsuranceDomain.VIDA_GRUPO,
      InsuranceDomain.SALUD,
      InsuranceDomain.TRANSPORTE,
      InsuranceDomain.EQUIPO_MAQUINARIA,
      InsuranceDomain.CASCO_EMBARCACION,
    ],
    aliases: ['allianz', 'allianz seguros', 'allianz colombia', 'colseguros'],
    contactEmail: 'servicioalcliente@allianz.co',
    phone: '#265',
    isActive: true,
  },
  {
    id: 'ins-mapfre',
    code: 'mapfre',
    name: 'MAPFRE Seguros',
    shortName: 'MAPFRE',
    officialName: 'MAPFRE Seguros Generales de Colombia S.A.',
    nit: '891.700.037-9',
    domainUrl: 'mapfre.com.co',
    logoUrl: 'https://www.google.com/s2/favicons?domain=mapfre.com.co&sz=128',
    primaryColor: '#D81E05',
    accentColor: '#9E1B0E',
    monogram: 'MPF',
    marketPosition: 'Aliado fundamental en seguros generales, vehículos y PYMEs',
    description:
      'Aliado fundamental en seguros generales, vehículos y PYMEs, integrada en el flujo de consulta estandarizada del cotizador.',
    integrationInfo: 'Flujo de consulta estandarizada del cotizador multiramo',
    rpaEnabled: true,
    apiEnabled: false,
    supportedDomains: [
      InsuranceDomain.PYME,
      InsuranceDomain.AUTOS,
      InsuranceDomain.HOGAR,
      InsuranceDomain.COPROPIEDADES,
      InsuranceDomain.VIDA_GRUPO,
      InsuranceDomain.CUMPLIMIENTO,
      InsuranceDomain.TRANSPORTE,
    ],
    aliases: ['mapfre', 'mapfre seguros', 'mapfre colombia', 'mapfre generales'],
    contactEmail: 'servicioalcliente@mapfre.com.co',
    phone: '#624',
    isActive: true,
  },
  {
    id: 'ins-estado',
    code: 'estado',
    name: 'Seguros del Estado',
    shortName: 'Estado',
    officialName: 'Seguros del Estado S.A.',
    nit: '860.009.578-6',
    domainUrl: 'segurosdelestado.com',
    logoUrl: 'https://www.google.com/s2/favicons?domain=segurosdelestado.com&sz=128',
    primaryColor: '#004B87',
    accentColor: '#E3A800',
    monogram: 'SDE',
    marketPosition: 'Referente en Cumplimiento (fianzas) y vehículos',
    description:
      'Aseguradora referente en el ramo de Cumplimiento (garantías/fianzas) y vehículos, priorizada para las validaciones pre-emisión de cupos y SARLAFT.',
    integrationInfo: 'Validaciones pre-emisión de cupos de fianzas y SARLAFT',
    rpaEnabled: true,
    apiEnabled: true,
    supportedDomains: [
      InsuranceDomain.CUMPLIMIENTO,
      InsuranceDomain.AUTOS,
      InsuranceDomain.PYME,
      InsuranceDomain.COPROPIEDADES,
      InsuranceDomain.VIDA_GRUPO,
      InsuranceDomain.TRANSPORTE,
      InsuranceDomain.EQUIPO_MAQUINARIA,
    ],
    aliases: ['estado', 'seguros del estado', 'seguros de vida del estado'],
    contactEmail: 'atencionalcliente@segurosdelestado.com',
    phone: '#388',
    isActive: true,
  },
  {
    id: 'ins-axa',
    code: 'axa',
    name: 'AXA Colpatria',
    shortName: 'AXA Colpatria',
    officialName: 'AXA Colpatria Seguros S.A.',
    nit: '860.002.184-6',
    domainUrl: 'axacolpatria.co',
    logoUrl: 'https://www.google.com/s2/favicons?domain=axacolpatria.co&sz=128',
    primaryColor: '#00008F',
    accentColor: '#FF1721',
    monogram: 'AXA',
    marketPosition: 'Operador relevante en generales, salud, vida grupo y ARL',
    description:
      'Operador relevante en seguros generales, salud, vida grupo y riesgos laborales (ARL), con participación en los esquemas de cotización multiramo.',
    integrationInfo: 'Esquemas de cotización multiramo, Salud, Vida Grupo y ARL',
    rpaEnabled: true,
    apiEnabled: true,
    supportedDomains: [
      InsuranceDomain.PYME,
      InsuranceDomain.AUTOS,
      InsuranceDomain.HOGAR,
      InsuranceDomain.COPROPIEDADES,
      InsuranceDomain.VIDA_GRUPO,
      InsuranceDomain.SALUD,
      InsuranceDomain.CUMPLIMIENTO,
      InsuranceDomain.TRANSPORTE,
    ],
    aliases: ['axa', 'colpatria', 'axa colpatria', 'axa colpatria seguros'],
    contactEmail: 'serviciocliente@axacolpatria.co',
    phone: '#247',
    isActive: true,
  },
  {
    id: 'ins-hdi',
    code: 'hdi',
    name: 'HDI Seguros',
    shortName: 'HDI',
    officialName: 'HDI Seguros Colombia S.A. (antes Liberty Seguros)',
    nit: '860.039.988-0',
    domainUrl: 'hdiseguros.com.co',
    logoUrl: 'https://www.google.com/s2/favicons?domain=hdiseguros.com.co&sz=128',
    primaryColor: '#009639',
    accentColor: '#006325',
    monogram: 'HDI',
    marketPosition: 'Alto impacto en movilidad y propiedad (integró Liberty)',
    description:
      'Compañía de alto impacto en movilidad y propiedad (anteriormente Liberty Seguros), integrada en las rutas robóticas de extracción de condiciones y cartera.',
    integrationInfo: 'Rutas robóticas de extracción de condiciones y cartera',
    rpaEnabled: true,
    apiEnabled: true,
    supportedDomains: [
      InsuranceDomain.PYME,
      InsuranceDomain.AUTOS,
      InsuranceDomain.HOGAR,
      InsuranceDomain.COPROPIEDADES,
      InsuranceDomain.CUMPLIMIENTO,
      InsuranceDomain.TRANSPORTE,
      InsuranceDomain.EQUIPO_MAQUINARIA,
    ],
    aliases: [
      'hdi',
      'hdi seguros',
      'hdi colombia',
      'liberty',
      'liberty seguros',
      'hdi liberty',
      'pdfpolizaprima',
    ],
    contactEmail: 'servicioalcliente@hdiseguros.com.co',
    phone: '#204',
    isActive: true,
  },
  {
    id: 'ins-previsora',
    code: 'previsora',
    name: 'La Previsora Seguros',
    shortName: 'Previsora',
    officialName: 'La Previsora S.A. Compañía de Seguros',
    nit: '860.002.400-2',
    domainUrl: 'previsora.gov.co',
    logoUrl: 'https://www.google.com/s2/favicons?domain=previsora.gov.co&sz=128',
    primaryColor: '#1D428A',
    accentColor: '#6CC24A',
    monogram: 'PRV',
    marketPosition: 'Entidad líder en el segmento estatal y seguros generales',
    description:
      'Entidad líder en el segmento estatal y de seguros generales, participante en los procesos de suscripción empresarial y comparativos técnicos.',
    integrationInfo: 'Suscripción empresarial, estatal y comparativos técnicos',
    rpaEnabled: false,
    apiEnabled: false,
    supportedDomains: [
      InsuranceDomain.PYME,
      InsuranceDomain.AUTOS,
      InsuranceDomain.COPROPIEDADES,
      InsuranceDomain.CUMPLIMIENTO,
      InsuranceDomain.TRANSPORTE,
      InsuranceDomain.EQUIPO_MAQUINARIA,
      InsuranceDomain.CASCO_EMBARCACION,
    ],
    aliases: ['previsora', 'la previsora', 'previsora seguros', 'la previsora s.a.'],
    contactEmail: 'contactenos@previsora.gov.co',
    phone: '#345',
    isActive: true,
  },
  {
    id: 'ins-solidaria',
    code: 'solidaria',
    name: 'Aseguradora Solidaria',
    shortName: 'Solidaria',
    officialName: 'Aseguradora Solidaria de Colombia Entidad Cooperativa',
    nit: '860.524.654-6',
    domainUrl: 'aseguradorasolidaria.com.co',
    logoUrl: 'https://www.google.com/s2/favicons?domain=aseguradorasolidaria.com.co&sz=128',
    primaryColor: '#005596',
    accentColor: '#F58220',
    monogram: 'SOL',
    marketPosition: 'Aliada estratégica en cumplimiento, RC y autos',
    description:
      'Aliada estratégica en ramos de cumplimiento, responsabilidad civil y autos, integrada en las soluciones de distribución y consulta de recaudos.',
    integrationInfo: 'Soluciones de distribución y consulta de recaudos',
    rpaEnabled: true,
    apiEnabled: false,
    supportedDomains: [
      InsuranceDomain.CUMPLIMIENTO,
      InsuranceDomain.AUTOS,
      InsuranceDomain.PYME,
      InsuranceDomain.COPROPIEDADES,
      InsuranceDomain.VIDA_GRUPO,
      InsuranceDomain.HOGAR,
    ],
    aliases: [
      'solidaria',
      'aseguradora solidaria',
      'solidaria de colombia',
      'aseguradora solidaria de colombia',
    ],
    contactEmail: 'servicioalcliente@solidaria.com.co',
    phone: '#789',
    isActive: true,
  },
  {
    id: 'ins-mundial',
    code: 'mundial',
    name: 'Seguros Mundial',
    shortName: 'Mundial',
    officialName: 'Compañía Mundial de Seguros S.A.',
    nit: '860.037.013-6',
    domainUrl: 'segurosmundial.com.co',
    logoUrl: 'https://www.google.com/s2/favicons?domain=segurosmundial.com.co&sz=128',
    primaryColor: '#00AEEF',
    accentColor: '#1B365D',
    monogram: 'MUN',
    marketPosition: 'Especializada en SOAT, seguros masivos y cumplimiento',
    description:
      'Compañía especializada en SOAT, seguros masivos y cumplimiento, incorporada en la matriz de comparación express y canales digitales.',
    integrationInfo: 'Matriz de comparación express y canales digitales',
    rpaEnabled: true,
    apiEnabled: true,
    supportedDomains: [
      InsuranceDomain.CUMPLIMIENTO,
      InsuranceDomain.AUTOS,
      InsuranceDomain.PYME,
      InsuranceDomain.TRANSPORTE,
      InsuranceDomain.HOGAR,
    ],
    aliases: ['mundial', 'seguros mundial', 'compania mundial de seguros', 'mundial de seguros'],
    contactEmail: 'servicioalcliente@segurosmundial.com.co',
    phone: '01 8000 111 935',
    isActive: true,
  },
  {
    id: 'ins-sbs',
    code: 'sbs',
    name: 'SBS Seguros Colombia',
    shortName: 'SBS',
    officialName: 'SBS Seguros Colombia S.A.',
    nit: '860.037.707-9',
    domainUrl: 'sbseguros.co',
    logoUrl: 'https://www.google.com/s2/favicons?domain=sbseguros.co&sz=128',
    primaryColor: '#E30613',
    accentColor: '#2B2E34',
    monogram: 'SBS',
    marketPosition: 'Soluciones corporativas, autos y transporte',
    description:
      'Aseguradora aliada en soluciones corporativas, autos y transporte, conectada al motor de lectura de sábanas y recaudos.',
    integrationInfo: 'Motor de lectura de sábanas y recaudos corporativos',
    rpaEnabled: true,
    apiEnabled: false,
    supportedDomains: [
      InsuranceDomain.PYME,
      InsuranceDomain.AUTOS,
      InsuranceDomain.HOGAR,
      InsuranceDomain.COPROPIEDADES,
      InsuranceDomain.TRANSPORTE,
      InsuranceDomain.CUMPLIMIENTO,
    ],
    aliases: ['sbs', 'sbs seguros', 'sbs seguros colombia', 'aig'],
    contactEmail: 'servicioalcliente@sbseguros.co',
    phone: '#360',
    isActive: true,
  },
  {
    id: 'ins-equidad',
    code: 'equidad',
    name: 'La Equidad Seguros',
    shortName: 'La Equidad',
    officialName: 'La Equidad Seguros Generales Organismo Cooperativo',
    nit: '860.028.415-5',
    domainUrl: 'laequidadseguros.coop',
    logoUrl: 'https://www.google.com/s2/favicons?domain=laequidadseguros.coop&sz=128',
    primaryColor: '#007A33',
    accentColor: '#84BD00',
    monogram: 'EQU',
    marketPosition: 'Sector cooperativo en autos, vida y riesgos patrimoniales',
    description:
      'Entidad del sector cooperativo con presencia en autos, vida y riesgos patrimoniales, contemplada en las reglas del catálogo unificado.',
    integrationInfo: 'Reglas estandarizadas del catálogo unificado multiramo',
    rpaEnabled: false,
    apiEnabled: false,
    supportedDomains: [
      InsuranceDomain.PYME,
      InsuranceDomain.AUTOS,
      InsuranceDomain.COPROPIEDADES,
      InsuranceDomain.VIDA_GRUPO,
      InsuranceDomain.CUMPLIMIENTO,
    ],
    aliases: ['equidad', 'la equidad', 'la equidad seguros', 'equidad seguros'],
    contactEmail: 'servicioalcliente@laequidadseguros.coop',
    phone: '#324',
    isActive: true,
  },
  {
    id: 'ins-chubb',
    code: 'chubb',
    name: 'Chubb Seguros Colombia',
    shortName: 'Chubb',
    officialName: 'Chubb Seguros Colombia S.A.',
    nit: '860.026.518-6',
    domainUrl: 'chubb.com/co-es',
    logoUrl: 'https://www.google.com/s2/favicons?domain=chubb.com&sz=128',
    primaryColor: '#150F96',
    accentColor: '#FF671F',
    monogram: 'CHB',
    marketPosition: 'Especializado en líneas empresariales, RC, Transporte y Cyber',
    description:
      'Aliado especializado en líneas empresariales (PYMEs, Responsabilidad Civil, Transporte y Cyber) e iniciativas de microseguros.',
    integrationInfo: 'Suscripción especializada PYMEs, RC, Transporte y Cyber',
    rpaEnabled: false,
    apiEnabled: true,
    supportedDomains: [
      InsuranceDomain.PYME,
      InsuranceDomain.TRANSPORTE,
      InsuranceDomain.HOGAR,
      InsuranceDomain.COPROPIEDADES,
      InsuranceDomain.VIDA_GRUPO,
      InsuranceDomain.CUMPLIMIENTO,
      InsuranceDomain.EQUIPO_MAQUINARIA,
      InsuranceDomain.CASCO_EMBARCACION,
    ],
    aliases: ['chubb', 'chubb seguros', 'chubb colombia', 'ace seguros'],
    contactEmail: 'servicioalcliente.co@chubb.com',
    phone: '01 8000 917 500',
    isActive: true,
  },
  {
    id: 'ins-zurich',
    code: 'zurich',
    name: 'Zurich Seguros Colombia',
    shortName: 'Zurich',
    officialName: 'Zurich Colombia Seguros S.A.',
    nit: '860.002.534-0',
    domainUrl: 'zurichseguros.com.co',
    logoUrl: 'https://www.google.com/s2/favicons?domain=zurichseguros.com.co&sz=128',
    primaryColor: '#2167AE',
    accentColor: '#003366',
    monogram: 'ZUR',
    marketPosition: 'Enfocado en seguros corporativos y patrimoniales',
    description:
      'Compañía enfocada en seguros corporativos y patrimoniales, integrada en la tarificación de riesgos comerciales.',
    integrationInfo: 'Tarificación técnica de riesgos comerciales y patrimoniales',
    rpaEnabled: false,
    apiEnabled: true,
    supportedDomains: [
      InsuranceDomain.PYME,
      InsuranceDomain.AUTOS,
      InsuranceDomain.TRANSPORTE,
      InsuranceDomain.EQUIPO_MAQUINARIA,
      InsuranceDomain.COPROPIEDADES,
    ],
    aliases: ['zurich', 'zurich seguros', 'zurich colombia', 'zurich seguros colombia'],
    contactEmail: 'clientes.colombia@zurich.com',
    phone: '#379',
    isActive: true,
  },
  {
    id: 'ins-positiva',
    code: 'positiva',
    name: 'Positiva Compañía de Seguros',
    shortName: 'Positiva',
    officialName: 'Positiva Compañía de Seguros S.A.',
    nit: '860.011.153-6',
    domainUrl: 'positiva.gov.co',
    logoUrl: 'https://www.google.com/s2/favicons?domain=positiva.gov.co&sz=128',
    primaryColor: '#F37021',
    accentColor: '#004B87',
    monogram: 'POS',
    marketPosition: 'Referente público en Riesgos Laborales (ARL) y Vida Colectivo',
    description:
      'Entidad pública referente en la cobertura de Riesgos Laborales (ARL) y seguros de vida colectivo.',
    integrationInfo: 'Cobertura de Riesgos Laborales (ARL), Vida Grupo y Accidentes Personales',
    rpaEnabled: false,
    apiEnabled: false,
    supportedDomains: [InsuranceDomain.VIDA_GRUPO, InsuranceDomain.SALUD],
    aliases: ['positiva', 'positiva seguros', 'positiva compania de seguros', 'positiva arl'],
    contactEmail: 'servicioalcliente@positiva.gov.co',
    phone: '#533',
    isActive: true,
  },
];

function normalizeSearchKey(input: string): string {
  return (input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findColombianInsurerProfile(
  insurerNameOrCode?: string | null,
  customCatalog: ColombianInsurerProfile[] = COLOMBIAN_INSURERS_CATALOG
): ColombianInsurerProfile | undefined {
  if (!insurerNameOrCode) return undefined;
  const target = normalizeSearchKey(insurerNameOrCode);
  if (!target) return undefined;

  // 1. Exact match on code, name, or shortName
  for (const item of customCatalog) {
    if (
      normalizeSearchKey(item.code) === target ||
      normalizeSearchKey(item.name) === target ||
      normalizeSearchKey(item.shortName) === target ||
      normalizeSearchKey(item.officialName) === target
    ) {
      return item;
    }
  }

  // 2. Alias match
  for (const item of customCatalog) {
    for (const alias of item.aliases || []) {
      const normAlias = normalizeSearchKey(alias);
      if (normAlias && (target === normAlias || target.includes(normAlias) || normAlias.includes(target))) {
        return item;
      }
    }
  }

  return undefined;
}

/**
 * Generates an inline SVG data URI badge with the insurer's official brand colors and monogram.
 * Works 100% offline, has zero CORS restrictions in Canvas/PDF/Web, and serves as a deterministic fallback.
 */
export function buildInsurerSvgDataUri(
  insurerName: string,
  profile?: Partial<ColombianInsurerProfile>
): string {
  const matched = profile?.primaryColor ? profile : findColombianInsurerProfile(insurerName);
  const bg = matched?.primaryColor || '#1E293B';
  const accent = matched?.accentColor || '#38BDF8';
  const text = (
    matched?.monogram ||
    insurerName
      .replace(/seguros|compania|de|colombia|s\.a\./gi, '')
      .trim()
      .slice(0, 4)
      .toUpperCase() ||
    'SEG'
  ).slice(0, 4);

  const fontSize = text.length >= 4 ? 22 : text.length === 3 ? 26 : 30;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bg}" />
        <stop offset="100%" stop-color="${bg}" stop-opacity="0.92" />
      </linearGradient>
    </defs>
    <rect width="96" height="96" rx="20" fill="url(#g)" />
    <path d="M0 76 L96 60 L96 96 L0 96 Z" fill="${accent}" fill-opacity="0.28" />
    <circle cx="80" cy="16" r="6" fill="${accent}" />
    <text x="48" y="56" font-family="Inter, Arial, sans-serif" font-weight="800" font-size="${fontSize}" fill="#FFFFFF" text-anchor="middle" letter-spacing="0.5">${text}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
