/**
 * Insurer Name Normalization Service
 * Maps extracted insurer names from quotes to database names
 * Handles variations like "SBS SEGUROS COLOMBIA S.A." → "SBS"
 */

// Known mappings from extracted names to database names
const INSURER_NAME_MAPPINGS: Record<string, string> = {
  // SBS variations
  'SBS SEGUROS COLOMBIA S.A.': 'SBS',
  'SBS SEGUROS': 'SBS',
  'SBS COLOMBIA': 'SBS',
  'SBS PYME': 'SBS',

  // AXA Colpatria variations
  'AXA COLPATRIA SEGUROS S.A.': 'AXA Colpatria',
  'AXA COLPATRIA': 'AXA Colpatria',
  AXA: 'AXA Colpatria',
  COLPATRIA: 'AXA Colpatria',

  // BBVA variations
  'BBVA SEGUROS COLOMBIA S.A.': 'BBVA',
  'BBVA SEGUROS': 'BBVA',
  'BBVA COLOMBIA': 'BBVA',

  // CHUBB variations
  'CHUBB SEGUROS COLOMBIA S.A.': 'CHUBB',
  'CHUBB SEGUROS': 'CHUBB',
  'CHUBB COLOMBIA': 'CHUBB',

  // HDI variations
  'HDI SEGUROS COLOMBIA S.A.': 'HDI',
  'HDI SEGUROS': 'HDI',
  'HDI COLOMBIA': 'HDI',

  // MAPFRE variations
  'MAPFRE SEGUROS COLOMBIA S.A.': 'MAPFRE',
  'MAPFRE SEGUROS': 'MAPFRE',
  'MAPFRE COLOMBIA': 'MAPFRE',
  'MAPFRE SEGUROS GENERALES': 'MAPFRE',

  // ALLIANZ variations
  'ALLIANZ SEGUROS S.A.': 'ALLIANZ',
  'ALLIANZ SEGUROS': 'ALLIANZ',
  'ALLIANZ COLOMBIA': 'ALLIANZ',
  ALLIANZ: 'ALLIANZ',

  // SURA variations
  'SEGUROS GENERALES SURAMERICANA S.A.': 'SURA',
  'SEGUROS SURA': 'SURA',
  SURAMERICANA: 'SURA',
  SURA: 'SURA',

  // BOLÍVAR variations
  'COMPAÑÍA DE SEGUROS BOLÍVAR S.A.': 'BOLÍVAR',
  'SEGUROS BOLIVAR': 'BOLÍVAR',
  'SEGUROS BOLÍVAR': 'BOLÍVAR',
  BOLIVAR: 'BOLÍVAR',
  BOLÍVAR: 'BOLÍVAR',
};

// Short name aliases for fuzzy matching
const SHORT_NAME_ALIASES: Record<string, string[]> = {
  SBS: ['sbs'],
  'AXA Colpatria': ['axa', 'colpatria'],
  BBVA: ['bbva', 'bbva seguros'],
  CHUBB: ['chubb', 'chubb seguros'],
  HDI: ['hdi', 'hdi seguros'],
  MAPFRE: ['mapfre', 'mapfre seguros'],
  ALLIANZ: ['allianz', 'allianz seguros'],
  SURA: ['sura', 'suramericana', 'segurossura'],
  BOLÍVAR: ['bolivar', 'bolívar', 'seguros bolivar', 'seguros bolívar'],
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

    // Return original if no match found, but record telemetry
    recordUnmappedName(extractedName);
    return extractedName;
  },

  /**
   * Verify if an extracted name matches a database name
   */
  verifyMatch: (extractedName: string, dbName: string): boolean => {
    const normalized = insurerNameNormalizer.normalize(extractedName);
    return normalized.toUpperCase() === dbName.toUpperCase();
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
