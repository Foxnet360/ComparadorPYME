/**
 * Format Family Detection Service
 * Detects document layout family from extracted text patterns
 */

export type FormatFamily =
  | 'TABLE-DOUBLE'
  | 'TABLE-INTEGRATED'
  | 'SECTIONS'
  | 'DESCRIPTIVE'
  | 'PRICE-TABLE'
  | 'TEXT'
  | 'UNKNOWN';

export interface FormatDetectionResult {
  family: FormatFamily;
  confidence: number;
  detectedPatterns: string[];
  pageCount: number;
  hasTables: boolean;
  hasSections: boolean;
}

interface FormatPattern {
  family: FormatFamily;
  patterns: RegExp[];
  keywords: string[];
  weight: number;
}

const FORMAT_PATTERNS: FormatPattern[] = [
  {
    family: 'TABLE-DOUBLE',
    patterns: [
      /DEDUCIBLES\s+QUE\s+APLICAN/i,
      /AMPAROS\s+BASICOS/i,
    ],
    keywords: ['DEDUCIBLES', 'AMPAROS', 'COBERTURAS'],
    weight: 1.0,
  },
  {
    family: 'TABLE-INTEGRATED',
    patterns: [
      /Suma\s+Asegurada/i,
      /Deducible/i,
      /sub[líi]mite/i,
    ],
    keywords: ['Suma Asegurada', 'Deducible', 'Sublímite'],
    weight: 1.0,
  },
  {
    family: 'SECTIONS',
    patterns: [
      /SECCION\s+(PRIMERA|SEGUNDA|TERCERA|CUARTA|QUINTA)/i,
    ],
    keywords: ['SECCION', 'AMPARO'],
    weight: 1.0,
  },
  {
    family: 'DESCRIPTIVE',
    patterns: [
      /Este\s+amparo\s+cubre/i,
      /Se\s+cubren\s+los\s+daños/i,
      /cubre\s+las\s+pérdidas/i,
      /Este\s+amparo\s+cubre\s+las\s+pérdidas/i,
    ],
    keywords: ['cubre', 'amparo', 'pérdidas'],
    weight: 0.9,
  },
  {
    family: 'PRICE-TABLE',
    patterns: [
      /Resumen\s+de\s+coberturas\s+y\s+primas/i,
      /\$\s*[\d.,]+\s*(?:PRIMA|IMPUESTOS)/i,
    ],
    keywords: ['Resumen', 'coberturas', 'primas', 'PRIMA', 'IMPUESTOS'],
    weight: 1.0,
  },
];

/**
 * Detect format family from extracted text
 */
export function detectFormatFamily(text: string): FormatDetectionResult {
  if (!text || text.length < 100) {
    return {
      family: 'UNKNOWN',
      confidence: 0,
      detectedPatterns: [],
      pageCount: 0,
      hasTables: false,
      hasSections: false,
    };
  }

  const upperText = text.toUpperCase();
  const detectedPatterns: string[] = [];
  let bestFamily: FormatFamily = 'TEXT';
  let bestScore = 0;
  let hasTables = false;
  let hasSections = false;

  // Check each format pattern
  for (const format of FORMAT_PATTERNS) {
    let score = 0;
    const matchedPatterns: string[] = [];

    // Check regex patterns
    for (const pattern of format.patterns) {
      if (pattern.test(text) || pattern.test(upperText)) {
        score += 30 * format.weight;
        matchedPatterns.push(pattern.source);
      }
    }

    // Check keywords
    for (const keyword of format.keywords) {
      if (upperText.includes(keyword.toUpperCase())) {
        score += 10 * format.weight;
        matchedPatterns.push(`keyword:${keyword}`);
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestFamily = format.family;
      detectedPatterns.push(...matchedPatterns);
    }
  }

  // Detect table structures
  hasTables = /\|.*\|.*\|/.test(text) || 
              text.includes('Suma Asegurada') || 
              text.includes('Deducible');

  // Detect sections
  hasSections = /SECCION\s+\d|SECCION\s+(PRIMERA|SEGUNDA|TERCERA)/i.test(text);

  // Calculate confidence
  let confidence = Math.min(bestScore, 100);
  if (bestFamily === 'TEXT' && bestScore === 0) {
    confidence = 50; // Default confidence for fallback
  }

  return {
    family: bestFamily,
    confidence,
    detectedPatterns: [...new Set(detectedPatterns)],
    pageCount: 0, // Will be set by caller
    hasTables,
    hasSections,
  };
}

/**
 * Get confidence score for format detection
 */
export function getFormatConfidence(result: FormatDetectionResult): number {
  return result.confidence;
}

/**
 * Quick extract for format detection (first N chars)
 */
export function extractForDetection(fullText: string, maxChars: number = 2000): string {
  return fullText.substring(0, maxChars);
}

/**
 * Get description of format family
 */
export function getFormatFamilyDescription(family: FormatFamily): string {
  const descriptions: Record<FormatFamily, string> = {
    'TABLE-DOUBLE': 'Tabla de coberturas + tabla de deducibles en página separada (HDI style)',
    'TABLE-INTEGRATED': 'Tabla única con coberturas, sumas y deducibles (CHUBB style)',
    'SECTIONS': 'Coberturas agrupadas en secciones numeradas (MAPFRE style)',
    'DESCRIPTIVE': 'Texto descriptivo extenso por cobertura (AXA style)',
    'PRICE-TABLE': 'Tabla de primas por cobertura (SBS style)',
    'TEXT': 'Texto corrido/carta sin estructura tabular definida (BOLIVAR style)',
    'UNKNOWN': 'No se pudo determinar el formato',
  };
  return descriptions[family] || 'Formato desconocido';
}
