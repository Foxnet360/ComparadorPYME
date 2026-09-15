/**
 * Insurer Sanitizer
 * Normalizes insurer names to clean canonical corporate brands in Colombia,
 * stripping extraneous customer names, product suffixes, and file naming noise.
 */

interface KnownBrand {
  brand: string;
  patterns: RegExp[];
}

const KNOWN_INSURERS: KnownBrand[] = [
  { brand: 'ALLIANZ', patterns: [/\ballianz\b/i] },
  { brand: 'SURA', patterns: [/\bsura\b/i, /\bsuramericana\b/i] },
  { brand: 'SBS', patterns: [/\bsbs\b/i] },
  { brand: 'MAPFRE', patterns: [/\bmapfre\b/i] },
  { brand: 'BOLÍVAR', patterns: [/\bbol[ií]var\b/i] },
  { brand: 'AXA COLPATRIA', patterns: [/\baxa\b/i, /\bcolpatria\b/i] },
  { brand: 'CHUBB', patterns: [/\bchubb\b/i] },
  { brand: 'SEGUROS DEL ESTADO', patterns: [/\bdel\s+estado\b/i, /\bseguros\s+estado\b/i] },
  { brand: 'LA PREVISORA', patterns: [/\bprevisora\b/i] },
  { brand: 'SOLIDARIA', patterns: [/\bsolidaria\b/i] },
  { brand: 'LIBERTY', patterns: [/\bliberty\b/i, /\bhdi\b/i] },
  { brand: 'ZURICH', patterns: [/\bzurich\b/i] },
  { brand: 'POSITIVA', patterns: [/\bpositiva\b/i] },
  { brand: 'BERKLEY', patterns: [/\bberkley\b/i] },
  { brand: 'BBVA', patterns: [/\bbbva\b/i] },
  { brand: 'LA EQUIDAD', patterns: [/\bequidad\b/i] },
  { brand: 'PAN AMERICAN', patterns: [/\bpan\s*american\b/i, /\bpalic\b/i] },
];

/**
 * Extract clean corporate insurer name from raw string or filename.
 * E.g.: "ALLIANZ HOGAR ISABEL CRISTINA VASCO" -> "ALLIANZ"
 *       "COTIZACION-SURA-PLAN-HOGAR.pdf" -> "SURA"
 *       "mapfre_copropiedades_cot.pdf" -> "MAPFRE"
 *       "SBS SEGUROS S.A." -> "SBS"
 */
export function extractCanonicalInsurerName(raw: string): string {
  if (!raw || typeof raw !== 'string') return 'Desconocido';
  // Replace underscores, hyphens, and dots with spaces so word boundaries work on filenames
  const normalizedForSearch = raw.replace(/[_\-.]+/g, ' ').trim();

  for (const { brand, patterns } of KNOWN_INSURERS) {
    if (patterns.some((p) => p.test(normalizedForSearch) || p.test(raw))) {
      return brand;
    }
  }

  // Fallback: clean common file prefixes, extensions and insurance domain words
  const cleaned = raw
    .replace(/^COTIZACION.*?-\s*/i, '')
    .replace(/\.pdf$/i, '')
    .replace(/[_\-]+/g, ' ')
    .replace(/\b(HOGAR|PYME|COPROPIEDADES|AUTOS|SALUD|VIDA|SEGUROS|POLIZA|COTIZACION)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || raw.trim();
}
