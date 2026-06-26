/**
 * Insurer Profile Service
 * Provides extraction profiles specific to each insurance company's quote format
 */

import { loadDomainJson } from './domainBundleLoader';
import { TemplateRegistryEntry } from '../types/templateGraph';
import { getCanonicalCoverageName, getCanonicalCoverageNames } from '../config/domainConstants';

export interface CoverageMapping {
  canonicalName: string;
  variations: string[];
}

export interface ValidationRule {
  field: string;
  type: 'range' | 'regex' | 'enum';
  value: unknown;
  errorMessage: string;
}

export interface InsurerExtractionProfile {
  insurerName: string;
  displayName: string;
  formatPatterns: RegExp[];
  promptTemplate: string;
  coverageMappings: CoverageMapping[];
  validationRules: ValidationRule[];
  fewShotExamples: string[];
}

// Canonical coverage names for PYME (loaded from data/domains/pyme/taxonomy.json)
const C = {
  INCENDIO: () => getCanonicalCoverageName('pyme', 0),
  LUCRO_CESANTE: () => getCanonicalCoverageName('pyme', 1),
  SUSTRACCION: () => getCanonicalCoverageName('pyme', 2),
  EQUIPO_ELECTRICO: () => getCanonicalCoverageName('pyme', 3),
  ROTURA_MAQUINARIA: () => getCanonicalCoverageName('pyme', 4),
  RC: () => getCanonicalCoverageName('pyme', 5),
  VIDRIOS: () => getCanonicalCoverageName('pyme', 6),
  MANEJO_GLOBAL: () => getCanonicalCoverageName('pyme', 7),
  TRANSPORTE_MERCANCIAS: () => getCanonicalCoverageName('pyme', 8),
  TRANSPORTE_VALORES: () => getCanonicalCoverageName('pyme', 9),
  ASISTENCIA_PYME: () => getCanonicalCoverageName('pyme', 10),
  ASISTENCIA_LEGAL: () => getCanonicalCoverageName('pyme', 11),
  HMACC: () => getCanonicalCoverageName('pyme', 12),
  TERREMOTO: () => getCanonicalCoverageName('pyme', 13),
};

const BBVA_PROFILE: InsurerExtractionProfile = {
  insurerName: 'BBVA',
  displayName: 'BBVA Seguros',
  formatPatterns: [
    /BBVA\s+Seguros/i,
    /COT-\d{4}-\d+/i,
    /TODO\s+RIESGO\s+DAÑO\s+MATERIAL/i
  ],
  coverageMappings: [
    { canonicalName: C.INCENDIO(), variations: ['Todo Riesgo Daños Materiales', 'Incendio', 'Daño Material'] },
    { canonicalName: C.RC(), variations: ['Responsabilidad Civil', 'RC'] },
    { canonicalName: C.SUSTRACCION(), variations: ['Hurto', 'Sustracción'] },
    { canonicalName: C.LUCRO_CESANTE(), variations: ['Lucro Cesante'] },
    { canonicalName: C.EQUIPO_ELECTRICO(), variations: ['Equipo Eléctrico', 'Equipo Electrónico'] }
  ],
  validationRules: [
    { field: 'priceAnnual', type: 'range', value: { min: 100000, max: 500000000 }, errorMessage: 'Prima fuera de rango esperado' }
  ],
  fewShotExamples: [
    `Ejemplo BBVA:
    ASEGURADORA: BBVA Seguros
    PRIMA: $5.200.000
    COBERTURAS:
    - Todo Riesgo Daños Materiales: $100.000.000 (Ded: 10%)
    - Responsabilidad Civil: $500.000.000 (Ded: 5 SMMLV)`
  ],
  promptTemplate: `Extrae datos de cotización BBVA. Formato: tabla con coberturas en filas, prima al final.
    Aseguradora siempre es "BBVA Seguros".
    Usa nombres canónicos para coberturas.
    Extrae deducibles exactos como aparecen.`
};

const SBS_PROFILE: InsurerExtractionProfile = {
  insurerName: 'SBS',
  displayName: 'SBS Seguros',
  formatPatterns: [
    /SBS\s+SEGUROS/i,
    /COT\d+/i,
    /SEGURO\s+INTEGRAL/i
  ],
  coverageMappings: [
    { canonicalName: C.INCENDIO(), variations: ['Todo riesgo daños materiales', 'Daños Materiales', 'Amparo Básico', 'Amparo Basico', 'AMPARO BASICO - TODO RIESGO DANO MATERIAL'] },
    { canonicalName: C.SUSTRACCION(), variations: ['Hurto calificado', 'Hurto'] },
    { canonicalName: C.RC(), variations: ['Responsabilidad civil extracontractual', 'RC'] },
    { canonicalName: C.MANEJO_GLOBAL(), variations: ['Manejo global comercial', 'Manejo Global'] },
    { canonicalName: C.LUCRO_CESANTE(), variations: ['Lucro cesante por daños materiales', 'Lucro Cesante'] }
  ],
  validationRules: [
    { field: 'priceAnnual', type: 'range', value: { min: 100000, max: 500000000 }, errorMessage: 'Prima fuera de rango esperado' }
  ],
  fewShotExamples: [
    `Ejemplo SBS:
    ASEGURADORA: SBS SEGUROS COLOMBIA S.A.
    PRIMA: $4.584.105
    COBERTURAS:
    - Todo riesgo daños materiales: $119.600.000 (Ded: 10%)
    - Hurto calificado: $257.770.000 (Ded: 10% + 1 SMMLV)
    - Responsabilidad civil extracontractual: $1.000.000.000 (Ded: 5 SMMLV)`
  ],
  promptTemplate: `Extrae datos de cotización SBS. Formato: tabla "Resumen de coberturas y primas" con coberturas en filas.
    Nota: SBS usa "Hurto calificado" en vez de "Sustracción".
    Aseguradora siempre es "SBS SEGUROS COLOMBIA S.A.".
    Extrae prima total de la fila "Totales".`
};

const MAPFRE_PROFILE: InsurerExtractionProfile = {
  insurerName: 'MAPFRE',
  displayName: 'MAPFRE Seguros',
  formatPatterns: [
    /MAPFRE/i,
    /PÓLIZA\s+PYME/i
  ],
  coverageMappings: [
    { canonicalName: C.INCENDIO(), variations: ['Incendio y/o Líneas Aliadas', 'Incendio'] },
    { canonicalName: C.SUSTRACCION(), variations: ['Robo y/o Hurto', 'Sustracción'] },
    { canonicalName: C.RC(), variations: ['Responsabilidad Civil', 'RC'] }
  ],
  validationRules: [
    { field: 'priceAnnual', type: 'range', value: { min: 100000, max: 500000000 }, errorMessage: 'Prima fuera de rango esperado' }
  ],
  fewShotExamples: [
    `Ejemplo MAPFRE:
    ASEGURADORA: MAPFRE
    PRIMA: $3.850.000
    COBERTURAS:
    - Incendio y/o Líneas Aliadas: $150.000.000 (Ded: 10%)
    - Robo y/o Hurto: $50.000.000 (Ded: 10% + 1 SMMLV)`
  ],
  promptTemplate: `Extrae datos de cotización MAPFRE. Formato: tabla estándar con coberturas en columnas.
    MAPFRE usa "Robo y/o Hurto" para sustracción.
    Aseguradora siempre es "MAPFRE".`
};

const GENERIC_PROFILE: InsurerExtractionProfile = {
  insurerName: 'GENERIC',
  displayName: 'Genérico',
  formatPatterns: [],
  coverageMappings: getCanonicalCoverageNames().map(name => ({
    canonicalName: name,
    variations: [name]
  })),
  validationRules: [
    { field: 'priceAnnual', type: 'range', value: { min: 100000, max: 500000000 }, errorMessage: 'Prima fuera de rango esperado' }
  ],
  fewShotExamples: [],
  promptTemplate: `Extrae datos de cotización de seguros PYME colombiano.
    Identifica la aseguradora del encabezado.
    Extrae todas las coberturas con sus valores y deducibles.
    Usa nombres canónicos estándar para las coberturas.
    La prima anual debe ser un número sin símbolos de moneda.`
};

// Profile registry
const PROFILES: Map<string, InsurerExtractionProfile> = new Map([
  ['BBVA', BBVA_PROFILE],
  ['SBS', SBS_PROFILE],
  ['MAPFRE', MAPFRE_PROFILE],
  ['GENERIC', GENERIC_PROFILE]
]);

export const insurerProfileService = {
  /**
   * Detect insurer from PDF text
   */
  detectInsurer(text: string): string {
    if (!text || typeof text !== 'string') {
      console.warn('⚠️ [insurerProfileService] No text provided for insurer detection');
      return 'GENERIC';
    }
    const upperText = text.toUpperCase();
    
    for (const [name, profile] of PROFILES) {
      if (name === 'GENERIC') continue;
      
      for (const pattern of profile.formatPatterns) {
        if (pattern.test(text) || pattern.test(upperText)) {
          return name;
        }
      }
    }
    
    // Check for insurer names in text
    if (upperText.includes('BBVA')) return 'BBVA';
    if (upperText.includes('SBS')) return 'SBS';
    if (upperText.includes('MAPFRE')) return 'MAPFRE';
    if (upperText.includes('AXA')) return 'AXA';
    if (upperText.includes('CHUBB')) return 'CHUBB';
    if (upperText.includes('BOLIVAR')) return 'BOLIVAR';
    if (upperText.includes('HDI')) return 'HDI';
    
    return 'GENERIC';
  },

  /**
   * Get profile for insurer
   */
  getProfile(insurerName: string): InsurerExtractionProfile {
    const upperName = insurerName.toUpperCase();
    
    for (const [name, profile] of PROFILES) {
      if (upperName.includes(name.toUpperCase())) {
        return profile;
      }
    }
    
    return GENERIC_PROFILE;
  },

  /**
   * Map coverage name to canonical name
   */
  mapCoverage(coverageName: string, profile: InsurerExtractionProfile): string {
    const normalized = coverageName.toLowerCase().trim();
    
    for (const mapping of profile.coverageMappings) {
      for (const variation of mapping.variations) {
        if (normalized.includes(variation.toLowerCase()) || 
            variation.toLowerCase().includes(normalized)) {
          return mapping.canonicalName;
        }
      }
    }
    
    return coverageName;
  },

  /**
   * Deterministic insurer-aware lookup that returns a canonical coverage name
   * when the insurer profile has an explicit mapping for the raw coverage.
   * Returns null when no deterministic override exists, letting the generic
   * ontology/cache path decide.
   */
  getCanonicalMapping(insurerName: string, rawName: string): string | null {
    if (!insurerName || !rawName) return null;

    const profile = this.getProfile(insurerName);
    if (profile.insurerName === 'GENERIC') return null;

    const normalizedRaw = rawName.toLowerCase().trim();

    for (const mapping of profile.coverageMappings) {
      for (const variation of mapping.variations) {
        const normalizedVariation = variation.toLowerCase().trim();
        if (
          normalizedRaw.includes(normalizedVariation) ||
          normalizedVariation.includes(normalizedRaw)
        ) {
          return mapping.canonicalName;
        }
      }
    }

    return null;
  },

  /**
   * Get all supported insurers
   */
  getSupportedInsurers(): string[] {
    return Array.from(PROFILES.keys()).filter(k => k !== 'GENERIC');
  },

  /**
   * Get the registry seed entry for a supported insurer.
   */
  getRegistrySeed(insurerName: string): TemplateRegistryEntry | undefined {
    const seeds = loadDomainJson<TemplateRegistryEntry[]>('pyme', 'template-seeds.json');
    return seeds.find((seed) => seed.insurer.toUpperCase() === insurerName.toUpperCase());
  },

  /**
   * Get registry seed entries for all supported insurers.
   */
  getAllRegistrySeeds(): TemplateRegistryEntry[] {
    const seeds = loadDomainJson<TemplateRegistryEntry[]>('pyme', 'template-seeds.json');
    const supported = new Set(this.getSupportedInsurers().map((name) => name.toUpperCase()));
    return seeds.filter((seed) => supported.has(seed.insurer.toUpperCase()));
  },

  /**
   * Register a new profile
   */
  registerProfile(profile: InsurerExtractionProfile): void {
    PROFILES.set(profile.insurerName, profile);
  }
};

export default insurerProfileService;
