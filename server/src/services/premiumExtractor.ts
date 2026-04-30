/**
 * Premium Extractor Module
 * Multi-strategy premium extraction with regex fallback
 */

import { normalizeColombianNumbers } from './textPreprocessor';

export type PremiumSource = 'structured' | 'regex_fallback' | 'prompt_retry' | 'unknown';

export interface PremiumExtractionResult {
  priceAnnual: number;
  currency: string;
  source: PremiumSource;
  confidence: number; // 0-100
}

const PREMIUM_PATTERNS = [
  // "prima anual" or "prima total" or "prima neta" followed by number
  /prima\s+(?:anual|total|neta)[:\s]*(?:\$\s*)?(\d[\d.,]+)/i,
  // "prima" followed by number
  /prima[:\s]+(?:\$\s*)?(\d[\d.,]+)/i,
  // "total a pagar" followed by number
  /total\s+a\s+pagar[:\s]*(?:\$\s*)?(\d[\d.,]+)/i,
  // "valor total" followed by number (with optional text in between)
  /valor\s+total(?:\s+\w+){0,5}[:\s]*(?:\$\s*)?(\d[\d.,]+)/i,
  // Generic number with currency context
  /(?:\$\s*)?(\d[\d.,]+)\s*(?:COP|USD)/i,
];

// Valid premium range for Colombian PYME insurance
const MIN_PREMIUM = 100000; // 100K COP
const MAX_PREMIUM = 500000000; // 500M COP

/**
 * Extract premium using regex patterns from preprocessed text
 */
export function extractPremiumWithRegex(text: string): PremiumExtractionResult | null {
  if (!text || text.length === 0) return null;

  // Normalize Colombian numbers first
  const normalizedText = normalizeColombianNumbers(text);

  for (const pattern of PREMIUM_PATTERNS) {
    const match = normalizedText.match(pattern);
    if (match && match[1]) {
      // After normalization, numbers are in format 1234567.89
      // Just remove any remaining commas and parse
      const rawValue = match[1].replace(/,/g, '');
      const value = parseFloat(rawValue);

      if (!isNaN(value) && value > 0) {
        const isValidRange = value >= MIN_PREMIUM && value <= MAX_PREMIUM;
        
        return {
          priceAnnual: Math.round(value),
          currency: 'COP',
          source: 'regex_fallback',
          confidence: isValidRange ? 75 : 50, // Lower confidence if outside normal range
        };
      }
    }
  }

  return null;
}

/**
 * Validate premium value
 */
export function validatePremium(value: number): { valid: boolean; suspect: boolean } {
  if (value <= 0) return { valid: false, suspect: false };
  if (value < MIN_PREMIUM || value > MAX_PREMIUM) return { valid: true, suspect: true };
  return { valid: true, suspect: false };
}

/**
 * Create enhanced prompt for Gemini retry with explicit premium focus
 */
export function createPremiumPrompt(basePrompt: string): string {
  return `${basePrompt}

INSTRUCCIONES ESPECÍFICAS PARA PRIMA:
1. Busca específicamente la "prima anual", "prima neta", "total a pagar" o "valor total"
2. El valor suele estar en pesos colombianos (COP)
3. Los formatos numéricos pueden usar puntos como separadores de miles: 1.234.567,89
4. Si no encuentras prima, marca priceAnnual como 0
5. Si la prima está en millones, conviértela a valor numérico (ej: 1.5 millones = 1500000)

IMPORTANTE: Extrae el valor numérico exacto de la prima anual total.`;
}

/**
 * Premium extraction result with validation flags
 */
export interface ValidatedPremiumResult extends PremiumExtractionResult {
  isValid: boolean;
  isSuspect: boolean;
}

/**
 * Full premium extraction pipeline
 */
export function extractAndValidatePremium(
  structuredPrice: number,
  preprocessedText: string
): ValidatedPremiumResult {
  // Strategy 1: Use structured extraction if valid
  if (structuredPrice > 0) {
    const validation = validatePremium(structuredPrice);
    return {
      priceAnnual: structuredPrice,
      currency: 'COP',
      source: 'structured',
      confidence: validation.suspect ? 70 : 95,
      isValid: validation.valid,
      isSuspect: validation.suspect,
    };
  }

  // Strategy 2: Try regex fallback
  const regexResult = extractPremiumWithRegex(preprocessedText);
  if (regexResult) {
    const validation = validatePremium(regexResult.priceAnnual);
    return {
      ...regexResult,
      isValid: validation.valid,
      isSuspect: validation.suspect,
    };
  }

  // Strategy 3: No premium found
  return {
    priceAnnual: 0,
    currency: 'COP',
    source: 'unknown',
    confidence: 0,
    isValid: false,
    isSuspect: false,
  };
}
