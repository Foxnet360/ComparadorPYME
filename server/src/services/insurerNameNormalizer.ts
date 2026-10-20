/**
 * Insurer Name Normalization Service
 * Maps extracted insurer names from quotes to database names
 * Handles variations like "SBS SEGUROS COLOMBIA S.A." → "SBS"
 * Synchronized with all 15 official Colombian insurers in colombianInsurersCatalog.ts
 */

import {
  COLOMBIAN_INSURERS_CATALOG,
  findColombianInsurerProfile,
  type ColombianInsurerProfile,
} from '../shared/colombianInsurersCatalog';

// Known mappings from extracted names to canonical database names
const INSURER_NAME_MAPPINGS: Record<string, string> = {
  // 1. Seguros SURA
  'SEGUROS GENERALES SURAMERICANA S.A.': 'SURA',
  'SEGUROS GENERALES SURAMERICANA': 'SURA',
  'SEGUROS DE VIDA SURAMERICANA S.A.': 'SURA',
  'SEGUROS SURA': 'SURA',
  'ARL SURA': 'SURA',
  SURAMERICANA: 'SURA',
  SURA: 'SURA',

  // 2. Seguros Bolívar
  'COMPAÑÍA DE SEGUROS BOLÍVAR S.A.': 'BOLÍVAR',
  'COMPANIA DE SEGUROS BOLIVAR S.A.': 'BOLÍVAR',
  'COMPANIA DE SEGUROS BOLIVAR': 'BOLÍVAR',
  'SEGUROS COMERCIALES BOLÍVAR S.A.': 'BOLÍVAR',
  'COMERCIALES BOLIVAR': 'BOLÍVAR',
  'SEGUROS BOLIVAR': 'BOLÍVAR',
  'SEGUROS BOLÍVAR': 'BOLÍVAR',
  BOLIVAR: 'BOLÍVAR',
  BOLÍVAR: 'BOLÍVAR',

  // 3. Allianz Colombia
  'ALLIANZ SEGUROS S.A.': 'ALLIANZ',
  'ALLIANZ SEGUROS DE VIDA S.A.': 'ALLIANZ',
  'ALLIANZ SEGUROS': 'ALLIANZ',
  'ALLIANZ COLOMBIA': 'ALLIANZ',
  COLSEGUROS: 'ALLIANZ',
  ALLIANZ: 'ALLIANZ',

  // 4. MAPFRE Seguros
  'MAPFRE SEGUROS GENERALES DE COLOMBIA S.A.': 'MAPFRE',
  'MAPFRE COLOMBIA VIDA SEGUROS S.A.': 'MAPFRE',
  'MAPFRE SEGUROS COLOMBIA S.A.': 'MAPFRE',
  'MAPFRE SEGUROS': 'MAPFRE',
  'MAPFRE COLOMBIA': 'MAPFRE',
  'MAPFRE SEGUROS GENERALES': 'MAPFRE',
  'MAPFRE GENERALES': 'MAPFRE',
  MAPFRE: 'MAPFRE',

  // 5. Seguros del Estado
  'SEGUROS DEL ESTADO S.A.': 'SEGUROS DEL ESTADO',
  'SEGUROS DE VIDA DEL ESTADO S.A.': 'SEGUROS DEL ESTADO',
  'SEGUROS DE VIDA DEL ESTADO': 'SEGUROS DEL ESTADO',
  'SEGUROS DEL ESTADO': 'SEGUROS DEL ESTADO',
  ESTADO: 'SEGUROS DEL ESTADO',

  // 6. AXA Colpatria
  'AXA COLPATRIA SEGUROS S.A.': 'AXA Colpatria',
  'AXA COLPATRIA SEGUROS DE VIDA S.A.': 'AXA Colpatria',
  'AXA COLPATRIA SEGUROS': 'AXA Colpatria',
  'AXA COLPATRIA': 'AXA Colpatria',
  AXA: 'AXA Colpatria',
  COLPATRIA: 'AXA Colpatria',

  // 7. HDI Seguros (incluye integración de Liberty)
  'HDI SEGUROS COLOMBIA S.A. (ANTES LIBERTY SEGUROS)': 'HDI',
  'HDI SEGUROS (ANTES LIBERTY SEGUROS)': 'HDI',
  'HDI SEGUROS COLOMBIA S.A.': 'HDI',
  'HDI SEGUROS': 'HDI',
  'HDI COLOMBIA': 'HDI',
  'HDI (ANTES LIBERTY)': 'HDI',
  'HDI LIBERTY': 'HDI',
  PDFPOLIZAPRIMA: 'HDI',
  HDI: 'HDI',

  // Liberty legacy direct mappings (preserved for backward compatibility)
  'LIBERTY SEGUROS S.A.': 'LIBERTY',
  'LIBERTY SEGUROS': 'LIBERTY',
  LIBERTY: 'LIBERTY',

  // 8. La Previsora Seguros
  'LA PREVISORA S.A. COMPAÑÍA DE SEGUROS': 'LA PREVISORA',
  'LA PREVISORA S.A. COMPANIA DE SEGUROS': 'LA PREVISORA',
  'LA PREVISORA S.A.': 'LA PREVISORA',
  'LA PREVISORA SEGUROS': 'LA PREVISORA',
  'PREVISORA SEGUROS': 'LA PREVISORA',
  'LA PREVISORA': 'LA PREVISORA',
  PREVISORA: 'LA PREVISORA',

  // 9. Aseguradora Solidaria
  'ASEGURADORA SOLIDARIA DE COLOMBIA ENTIDAD COOPERATIVA': 'SOLIDARIA',
  'ASEGURADORA SOLIDARIA DE COLOMBIA': 'SOLIDARIA',
  'ASEGURADORA SOLIDARIA': 'SOLIDARIA',
  'SOLIDARIA DE COLOMBIA': 'SOLIDARIA',
  SOLIDARIA: 'SOLIDARIA',

  // 10. Seguros Mundial
  'COMPAÑÍA MUNDIAL DE SEGUROS S.A.': 'MUNDIAL',
  'COMPANIA MUNDIAL DE SEGUROS S.A.': 'MUNDIAL',
  'COMPANIA MUNDIAL DE SEGUROS': 'MUNDIAL',
  'MUNDIAL DE SEGUROS': 'MUNDIAL',
  'SEGUROS MUNDIAL': 'MUNDIAL',
  MUNDIAL: 'MUNDIAL',

  // 11. SBS Seguros Colombia
  'SBS SEGUROS COLOMBIA S.A.': 'SBS',
  'SBS SEGUROS COLOMBIA': 'SBS',
  'SBS SEGUROS': 'SBS',
  'SBS COLOMBIA': 'SBS',
  'SBS PYME': 'SBS',
  AIG: 'SBS',
  SBS: 'SBS',

  // 12. La Equidad Seguros
  'LA EQUIDAD SEGUROS GENERALES ORGANISMO COOPERATIVO': 'LA EQUIDAD',
  'LA EQUIDAD SEGUROS GENERALES': 'LA EQUIDAD',
  'LA EQUIDAD SEGUROS': 'LA EQUIDAD',
  'EQUIDAD SEGUROS': 'LA EQUIDAD',
  'LA EQUIDAD': 'LA EQUIDAD',
  EQUIDAD: 'LA EQUIDAD',

  // 13. Chubb Seguros Colombia
  'CHUBB SEGUROS COLOMBIA S.A.': 'CHUBB',
  'CHUBB SEGUROS COLOMBIA': 'CHUBB',
  'CHUBB SEGUROS': 'CHUBB',
  'CHUBB COLOMBIA': 'CHUBB',
  'ACE SEGUROS': 'CHUBB',
  CHUBB: 'CHUBB',

  // 14. Zurich Seguros Colombia
  'ZURICH COLOMBIA SEGUROS S.A.': 'ZURICH',
  'ZURICH SEGUROS COLOMBIA': 'ZURICH',
  'ZURICH COLOMBIA': 'ZURICH',
  'ZURICH SEGUROS': 'ZURICH',
  ZURICH: 'ZURICH',

  // 15. Positiva Compañía de Seguros
  'POSITIVA COMPAÑÍA DE SEGUROS S.A.': 'POSITIVA',
  'POSITIVA COMPANIA DE SEGUROS S.A.': 'POSITIVA',
  'POSITIVA COMPAÑÍA DE SEGUROS': 'POSITIVA',
  'POSITIVA COMPANIA DE SEGUROS': 'POSITIVA',
  'POSITIVA SEGUROS': 'POSITIVA',
  'POSITIVA ARL': 'POSITIVA',
  POSITIVA: 'POSITIVA',

  // Additional market insurers
  'BBVA SEGUROS COLOMBIA S.A.': 'BBVA',
  'BBVA SEGUROS': 'BBVA',
  'BBVA COLOMBIA': 'BBVA',
  'BERKLEY INTERNATIONAL SEGUROS COLOMBIA S.A.': 'BERKLEY',
  'BERKLEY SEGUROS': 'BERKLEY',
  BERKLEY: 'BERKLEY',
  'QUÁLITAS COMPAÑÍA DE SEGUROS COLOMBIA S.A.': 'QUÁLITAS',
  'QUALITAS COMPAÑIA DE SEGUROS COLOMBIA S.A.': 'QUÁLITAS',
  'QUÁLITAS COMPAÑÍA DE SEGUROS': 'QUÁLITAS',
  'QUALITAS COMPAÑIA DE SEGUROS': 'QUÁLITAS',
  'QUÁLITAS SEGUROS': 'QUÁLITAS',
  'QUALITAS SEGUROS': 'QUÁLITAS',
  QUÁLITAS: 'QUÁLITAS',
  QUALITAS: 'QUÁLITAS',
};

// Short name aliases for fuzzy matching (ordered so specific compound aliases match first)
const SHORT_NAME_ALIASES: Record<string, string[]> = {
  SBS: ['sbs', 'sbs seguros', 'sbs seguros colombia'],
  'AXA Colpatria': ['axa', 'colpatria', 'axa colpatria'],
  BBVA: ['bbva', 'bbva seguros'],
  CHUBB: ['chubb', 'chubb seguros', 'chubb colombia', 'ace seguros'],
  HDI: ['hdi', 'hdi seguros', 'hdi colombia', 'hdi liberty', 'pdfpolizaprima'],
  LIBERTY: ['liberty', 'liberty seguros'],
  ZURICH: ['zurich', 'zurich seguros', 'zurich colombia'],
  SOLIDARIA: ['solidaria', 'aseguradora solidaria', 'solidaria de colombia'],
  'LA PREVISORA': ['previsora', 'la previsora', 'previsora seguros'],
  'SEGUROS DEL ESTADO': ['seguros del estado', 'del estado', 'seguros estado'],
  POSITIVA: ['positiva', 'positiva seguros', 'positiva compania de seguros', 'positiva arl'],
  BERKLEY: ['berkley', 'berkley seguros'],
  'LA EQUIDAD': ['equidad', 'la equidad', 'la equidad seguros', 'equidad seguros'],
  QUÁLITAS: ['quálitas', 'qualitas', 'quálitas seguros', 'qualitas seguros'],
  MUNDIAL: ['mundial', 'seguros mundial', 'compañía mundial', 'compania mundial'],
  MAPFRE: ['mapfre', 'mapfre seguros', 'mapfre colombia', 'mapfre generales'],
  ALLIANZ: ['allianz', 'allianz seguros', 'allianz colombia', 'colseguros'],
  SURA: ['sura', 'suramericana', 'segurossura', 'seguros sura', 'arl sura'],
  BOLÍVAR: [
    'bolivar',
    'bolívar',
    'seguros bolivar',
    'seguros bolívar',
    'compania de seguros bolivar',
    'comerciales bolivar',
  ],
};

// In-memory telemetry for unmapped insurer names
const unmappedFrequencyCounter: Map<string, number> = new Map();

function recordUnmappedName(name: string): void {
  const count = (unmappedFrequencyCounter.get(name) || 0) + 1;
  unmappedFrequencyCounter.set(name, count);
  console.warn(`⚠️ [InsurerNameNormalizer] Unmapped insurer name: "${name}" (frequency: ${count})`);
}

export const insurerNameNormalizer = {
  /**
   * Normalize an extracted insurer name to match database names
   */
  normalize: (extractedName: string): string => {
    if (!extractedName) return '';

    const upperName = extractedName.toUpperCase().trim();

    // Direct mapping lookup
    if (INSURER_NAME_MAPPINGS[upperName]) {
      return INSURER_NAME_MAPPINGS[upperName];
    }

    // Try case-insensitive lookup
    for (const [key, value] of Object.entries(INSURER_NAME_MAPPINGS)) {
      if (upperName === key.toUpperCase()) {
        return value;
      }
    }

    // Check if extracted name contains a known short name
    for (const [dbName, aliases] of Object.entries(SHORT_NAME_ALIASES)) {
      for (const alias of aliases) {
        if (upperName.includes(alias.toUpperCase())) {
          return dbName;
        }
      }
    }

    // Fallback to official Colombian Insurers Catalog
    const catalogMatch = findColombianInsurerProfile(extractedName, COLOMBIAN_INSURERS_CATALOG);
    if (catalogMatch) {
      return INSURER_NAME_MAPPINGS[catalogMatch.name.toUpperCase()] || catalogMatch.shortName;
    }

    // Return original if no match found, but record telemetry
    recordUnmappedName(extractedName);
    return extractedName;
  },

  /**
   * Resolve the official ColombianInsurerProfile from an extracted or normalized name
   */
  getCatalogProfile: (extractedName: string): ColombianInsurerProfile | undefined => {
    return findColombianInsurerProfile(extractedName, COLOMBIAN_INSURERS_CATALOG);
  },

  /**
   * Verify if an extracted name matches a database name
   */
  verifyMatch: (extractedName: string, dbName: string): boolean => {
    const normalizedA = insurerNameNormalizer.normalize(extractedName);
    const normalizedB = insurerNameNormalizer.normalize(dbName);
    return (
      normalizedA.toUpperCase() === dbName.toUpperCase() ||
      normalizedA.toUpperCase() === normalizedB.toUpperCase()
    );
  },

  /**
   * Get all known insurer names
   */
  getKnownInsurers: (): string[] => {
    return Object.keys(SHORT_NAME_ALIASES);
  },

  /**
   * Add a new mapping (for runtime extensions)
   */
  addMapping: (extractedName: string, dbName: string): void => {
    INSURER_NAME_MAPPINGS[extractedName.toUpperCase().trim()] = dbName;
  },

  /**
   * Get telemetry for unmapped insurer names
   */
  getUnmappedTelemetry: (): Array<{ name: string; frequency: number }> => {
    return Array.from(unmappedFrequencyCounter.entries())
      .map(([name, frequency]) => ({ name, frequency }))
      .sort((a, b) => b.frequency - a.frequency);
  },

  /**
   * Clear unmapped name telemetry (useful for testing)
   */
  clearTelemetry: (): void => {
    unmappedFrequencyCounter.clear();
  },
};

export default insurerNameNormalizer;
