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
  | 'CONDITIONS'
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

// Layout/feature weights are boosted above the fallback TEXT/UNKNOWN weight so
// detection is driven by document structure instead of insurer-name heuristics.
const LAYOUT_WEIGHT = 1.2;
const FALLBACK_WEIGHT = 0.5;

const FORMAT_PATTERNS: FormatPattern[] = [
  {
    family: 'TABLE-DOUBLE',
    patterns: [
      /DEDUCIBLES\s+QUE\s+APLICAN/i,
      /AMPAROS\s+BASICOS/i,
    ],
    keywords: ['DEDUCIBLES', 'AMPAROS', 'COBERTURAS'],
    weight: LAYOUT_WEIGHT,
  },
  {
    family: 'TABLE-INTEGRATED',
    patterns: [
      /Suma\s+Asegurada/i,
      /Deducible/i,
      /sub[líi]mite/i,
    ],
    keywords: ['Suma Asegurada', 'Deducible', 'Sublímite'],
    weight: LAYOUT_WEIGHT,
  },
  {
    family: 'SECTIONS',
    patterns: [
      /SECCION\s+(PRIMERA|SEGUNDA|TERCERA|CUARTA|QUINTA)/i,
    ],
    keywords: ['SECCION', 'AMPARO'],
    weight: LAYOUT_WEIGHT,
  },
  {
    family: 'CONDITIONS',
    patterns: [
      /COBERTURA\s+BÁSICA/i,
      /COBERTURAS\s+ESPECIFICAS\s+Y\s+LIMITES/i,
      /condiciones\s+del\s+contrato/i,
      /condiciones\s+particulares/i,
      /^\s*[\d]+\s*\.\s*(?:COBERTURA|SECCION|AMPARO)/im,
    ],
    keywords: ['COBERTURA BÁSICA', 'COBERTURAS ESPECIFICAS', 'condiciones del contrato', 'condiciones particulares'],
    weight: LAYOUT_WEIGHT,
  },
  {
    family: 'TEXT',
    patterns: [],
    keywords: [],
    weight: FALLBACK_WEIGHT,
  },
  {
    family: 'PRICE-TABLE',
    patterns: [
      /Resumen\s+de\s+coberturas\s+y\s+primas/i,
      /\$\s*[\d.,]+\s*(?:PRIMA|IMPUESTOS)/i,
    ],
    keywords: ['Resumen', 'coberturas', 'primas', 'PRIMA', 'IMPUESTOS'],
    weight: LAYOUT_WEIGHT,
  },
  {
    family: 'DESCRIPTIVE',
    patterns: [
      /Este\s+amparo\s+cubre/i,
      /daños\s+súbitos/i,
    ],
    keywords: ['CUBRE', 'EXCLUSION', 'PROPIEDAD', 'DESCRIPCION'],
    weight: LAYOUT_WEIGHT,
  },
];

/**
 * Detect format family from extracted text
 */
export function detectFormatFamily(text: string): FormatDetectionResult {
  if (!text || text.length < 20) {
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
              /Suma\s+Asegurada/i.test(text) || 
              /Deducible/i.test(text) ||
              /Coberturas/i.test(text);

  // Detect sections
  hasSections = /SECCION\s+\d|SECCION\s+(PRIMERA|SEGUNDA|TERCERA)/i.test(text);

  // If no layout pattern matched, the document is genuinely unknown.
  // This removes the old "TEXT with 50 confidence" fallback driven by insurer names.
  const MIN_LAYOUT_SCORE = 20;
  if (bestScore < MIN_LAYOUT_SCORE) {
    bestFamily = 'UNKNOWN';
  }

  // Calculate confidence
  const confidence = Math.min(bestScore, 100);

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
    'TABLE-DOUBLE': 'Tabla de coberturas + tabla de deducibles en página separada',
    'TABLE-INTEGRATED': 'Tabla única con coberturas, sumas aseguradas y deducibles',
    'SECTIONS': 'Coberturas agrupadas en secciones numeradas',
    'DESCRIPTIVE': 'Texto descriptivo extenso por cobertura con párrafos descriptivos',
    'CONDITIONS': 'Documento de condiciones contractuales con bullets',
    'PRICE-TABLE': 'Tabla de primas por cobertura',
    'TEXT': 'Texto corrido/carta sin estructura tabular definida',
    'UNKNOWN': 'No se pudo determinar el formato',
  };
  return descriptions[family] || 'Formato desconocido';
}
