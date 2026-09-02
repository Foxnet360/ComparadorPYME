/**
 * Dual Extraction Service for Critical Coverages
 * Extracts Incendio and RC twice with different prompts to detect hallucinations
 * Flags discrepancies >20% for manual review
 */

import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

export interface DualExtractionResult {
  coverageName: string;
  firstExtraction: {
    value: string;
    deductible: string;
    confidence: number;
  };
  secondExtraction: {
    value: string;
    deductible: string;
    confidence: number;
  };
  discrepancy: number; // Percentage difference (0-100)
  isDiscrepancy: boolean;
  recommendation: string;
}

/**
 * Compare two extracted values and calculate discrepancy
 */
function calculateDiscrepancy(value1: string, value2: string): number {
  // Parse numeric values
  const num1 = parseNumericValue(value1);
  const num2 = parseNumericValue(value2);

  if (num1 === null || num2 === null) {
    // If either is not numeric, check for exact string match
    return value1.toUpperCase().trim() === value2.toUpperCase().trim() ? 0 : 100;
  }

  // Calculate percentage difference
  if (num1 === 0 && num2 === 0) return 0;
  const avg = (num1 + num2) / 2;
  const diff = Math.abs(num1 - num2);
  return (diff / avg) * 100;
}

/**
 * Parse numeric value from string (handles SMMLV, %, currency)
 */
function parseNumericValue(value: string): number | null {
  if (!value || value === 'NO ESPECIFICADO' || value === 'No aplica') {
    return null;
  }

  const cleanValue = value
    .toUpperCase()
    .replace(/[$\s.]/g, '')
    .replace(/,/g, '');

  // Check for percentage
  const percentMatch = cleanValue.match(/(\d+(?:\.\d+)?)\s*%/);
  if (percentMatch) return parseFloat(percentMatch[1]!);

  // Check for SMMLV
  const smmlvMatch = cleanValue.match(/(\d+)\s*(?:SMMLV|SM)/i);
  if (smmlvMatch) return parseFloat(smmlvMatch[1]!);

  // Check for plain number
  const numMatch = cleanValue.match(/(\d+(?:\.\d+)?)/);
  if (numMatch) return parseFloat(numMatch[1]!);

  return null;
}

/**
 * Extract critical coverages with dual prompts
 * This should be called after the initial extraction
 */
export const dualExtractionService = {
  /**
   * Validate critical coverages with dual extraction
   * Call this after initial extraction to verify Incendio and RC values
   */
  validateCriticalCoverages: async (
    coverages: Array<{ name: string; value: string; deductible?: string; confidence?: number }>,
    rawText: string
  ): Promise<DualExtractionResult[]> => {
    const criticalCategories = ['Incendio', 'Responsabilidad Civil', 'RC', 'RCE'];
    const results: DualExtractionResult[] = [];

    for (const coverage of coverages) {
      const coverageNameLower = coverage.name.toLowerCase();

      // Check if this is a critical coverage
      const isCritical = criticalCategories.some((cat) =>
        coverageNameLower.includes(cat.toLowerCase())
      );

      if (!isCritical) continue;

      // Real second extraction via Gemini API
      const secondExtraction = await extractFromGemini(rawText, coverage.name);

      const discrepancy = calculateDiscrepancy(coverage.value, secondExtraction.value);
      const isDiscrepancy = discrepancy > 20;

      results.push({
        coverageName: coverage.name,
        firstExtraction: {
          value: coverage.value,
          deductible: coverage.deductible || 'NO ESPECIFICADO',
          confidence: coverage.confidence || 70,
        },
        secondExtraction: {
          value: secondExtraction.value,
          deductible: secondExtraction.deductible,
          confidence: secondExtraction.confidence,
        },
        discrepancy: Math.round(discrepancy * 100) / 100,
        isDiscrepancy,
        recommendation: isDiscrepancy
          ? `⚠️ DISCREPANCIA DETECTADA (${discrepancy.toFixed(1)}%): Verificar manualmente el valor de ${coverage.name}`
          : `✅ Valor verificado: ${coverage.name} consistente entre extracciones`,
      });
    }

    return results;
  },

  /**
   * Check if coverage needs manual review
   */
  needsManualReview: (results: DualExtractionResult[]): boolean => {
    return results.some((r) => r.isDiscrepancy);
  },
};

/**
 * Second extraction via real Gemini API call for critical coverages
 * Uses gemini-2.5-flash with focused verification prompt
 */
async function extractFromGemini(
  rawText: string,
  coverageName: string
): Promise<{
  value: string;
  deductible: string;
  confidence: number;
}> {
  const prompt = `Analiza el siguiente texto de cotización y extrae EXCLUSIVAMENTE la información para la cobertura "${coverageName}".

TEXTO DE COTIZACIÓN:
${rawText.substring(0, 8000)}

INSTRUCCIONES:
1. Busca específicamente la cobertura "${coverageName}" en el texto
2. Extrae el valor asegurado (SA) o suma asegurada
3. Extrae el deducible asociado
4. Si no encuentras la cobertura, responde "NO ESPECIFICADO"
5. Responde ÚNICAMENTE en este formato JSON:
{"value": "valor extraído", "deductible": "deducible extraído"}

RESPUESTA (solo JSON):`;

  try {
    const modelName = env.GEMINI_MODEL || 'gemini-2.5-flash';
    const result = await genAI.models.generateContent({
      model: modelName,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      },
    });

    const responseText = result.text || '{}';
    const extracted = JSON.parse(responseText);

    return {
      value: extracted.value || 'NO ESPECIFICADO',
      deductible: extracted.deductible || 'NO ESPECIFICADO',
      confidence: extracted.value ? 90 : 50,
    };
  } catch (error) {
    console.error('❌ [DualExtraction] Gemini API call failed:', error);
    return {
      value: 'NO ESPECIFICADO',
      deductible: 'NO ESPECIFICADO',
      confidence: 0,
    };
  }
}

export default dualExtractionService;
