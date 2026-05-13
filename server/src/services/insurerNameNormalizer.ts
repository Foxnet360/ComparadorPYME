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
    'AXA': 'AXA Colpatria',
    'COLPATRIA': 'AXA Colpatria',
    
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
};

// Short name aliases for fuzzy matching
const SHORT_NAME_ALIASES: Record<string, string[]> = {
    'SBS': ['sbs', 'seguros bolivar', 'bolivar'],
    'AXA Colpatria': ['axa', 'colpatria'],
    'BBVA': ['bbva', 'bbva seguros'],
    'CHUBB': ['chubb', 'chubb seguros'],
    'HDI': ['hdi', 'hdi seguros'],
    'MAPFRE': ['mapfre', 'mapfre seguros'],
};

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
        
        // Return original if no match found
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
    }
};

export default insurerNameNormalizer;
