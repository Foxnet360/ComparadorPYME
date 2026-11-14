/**
 * Legacy Pipeline Module (V1)
 * Text-based quote extraction using insurer profiles and structured JSON extraction.
 */

import { randomUUID } from 'crypto';
import { geminiService } from '../gemini';
import { quoteParser, ParsedQuote } from '../quoteParser';
import { normalizeCoverages } from '../thesaurusMapper';
import { insurerProfileService } from '../insurerProfileService';
import {
  validateQuoteExtraction,
  QuoteExtraction,
} from '../../schemas/extractionSchemas';
import { reconciliationService } from '../reconciliationService';
import { createExtractionMetricsEmitter } from '../extractionMetrics';
import { withTimeout, extractWithZodValidation } from './utils';
import { LegacyQuoteInput, ProcessQuoteOptions } from './types';

export const STRUCTURED_EXTRACTION_PROMPT = `Eres un extractor experto de cotizaciones de seguros PYME colombianos.

### EJEMPLO DE ENTRADA/SALIDA
Ejemplo - Cotización estándar:
ENTRADA: "Seguros Bolívar presenta: Póliza Empresarial Plus. Prima anual: $8.500.000 COP. Coberturas: Incendio Edificio $500M (ded 10%), RC $100M (ded 5 SMMLV)..."

SALIDA ESPERADA:
{
  "insurerName": "Seguros Bolívar",
  "policyName": "Empresarial Plus",
  "priceAnnual": 8500000,
  "currency": "COP",
  "validityPeriod": "2024-01-01 - 2024-12-31",
  "coverages": [
    {
      "name": "Incendio (Edificio y Contenidos)",
      "value": "500.000.000",
      "deductible": "10%"
    },
    {
      "name": "Responsabilidad Civil (RCE)",
      "value": "100.000.000",
      "deductible": "5 SMMLV"
    }
  ],
  "specialConditions": ["Aplica cláusula de ajuste por inflación"],
  "expectedCoverages": [
    { "name": "Incendio (Edificio y Contenidos)", "status": "present", "value": "500M", "deductible": "10%" },
    { "name": "Lucro Cesante", "status": "missing", "value": null, "deductible": null },
    { "name": "Sustracción / Hurto", "status": "present", "value": "100M", "deductible": "10%" },
    { "name": "Equipo Eléctrico y Electrónico", "status": "present", "value": "50M", "deductible": "No aplica" },
    { "name": "Rotura de Maquinaria", "status": "present", "value": "50M", "deductible": "15%" },
    { "name": "Responsabilidad Civil (RCE)", "status": "present", "value": "100M", "deductible": "5 SMMLV" },
    { "name": "Vidrios Planos", "status": "missing", "value": null, "deductible": null },
    { "name": "Manejo Global / Infidelidad", "status": "missing", "value": null, "deductible": null },
    { "name": "Transporte de Mercancías", "status": "missing", "value": null, "deductible": null },
    { "name": "Transporte de Valores", "status": "missing", "value": null, "deductible": null },
    { "name": "Asistencia PYME", "status": "present", "value": "Incluido", "deductible": "No aplica" },
    { "name": "Asistencia Legal", "status": "present", "value": "Incluido", "deductible": "No aplica" },
    { "name": "Huelga, Motín, Asonada (HMACC)", "status": "missing", "value": null, "deductible": null },
    { "name": "Terremoto y Eventos Catastróficos", "status": "present", "value": "200M", "deductible": "20%" }
  ]
}

### REGLAS CRÍTICAS

1. Nombres de coberturas: Usa EXACTAMENTE estos 14 nombres canónicos:
   - "Incendio (Edificio y Contenidos)"
   - "Lucro Cesante"
   - "Sustracción / Hurto"
   - "Equipo Eléctrico y Electrónico"
   - "Rotura de Maquinaria"
   - "Responsabilidad Civil (RCE)"
   - "Vidrios Planos"
   - "Manejo Global / Infidelidad"
   - "Transporte de Mercancías"
   - "Transporte de Valores"
   - "Asistencia PYME"
   - "Asistencia Legal"
   - "Huelga, Motín, Asonada (HMACC)"
   - "Terremoto y Eventos Catastróficos"

2. Si una cobertura no aparece en el documento, inclúyela con:
   { "name": "[Nombre exacto de plantilla]", "value": "NO ESPECIFICADO", "deductible": "" }

3. NO inventes coberturas que no estén en el documento.

4. Formato de deducibles:
   - Porcentaje: "10%" o "10% / Mín. 2 SMMLV"
   - Fijo: "5 SMMLV" o "$500.000"
   - No aplica: "No aplica"

5. SEPARACIÓN CRÍTICA - Valor vs Deducible:
   - El campo "value" DEBE contener SOLO el monto asegurado (ej: "$500.000.000", "500M", "Incluido")
   - El campo "deductible" DEBE contener SOLO la cuota de participación (ej: "10%", "5 SMMLV", "No aplica")
   - NUNCA mezcles ambos campos. Si ves "RC: $300M (ded 10%)", value="$300M", deductible="10%"
   - Valores sospechosos para verificación: RC o Incendio menores a $100M

6. Formato de valores de cobertura:
   - Usa el formato exacto del documento: "$500.000.000" o "500M"
   - NO inventes valores. Si no está claro, usa "NO ESPECIFICADO"
   - Para RC e Incendio, valores menores a $100M son sospechosos - verifica

7. Prima anual: Extrae solo el número entero (ej: 8500000), sin símbolos ni puntos.

6. expectedCoverages: Incluye TODAS las 14 coberturas canónicas con su estado:
   - "present": La cobertura aparece en el documento
   - "missing": La cobertura no aparece pero debería estar
   - "excluded": La cobertura fue explícitamente excluida
   
   Ejemplo:
   "expectedCoverages": [
     { "name": "Incendio (Edificio y Contenidos)", "status": "present", "value": "500M", "deductible": "10%" },
     { "name": "Lucro Cesante", "status": "missing", "value": null, "deductible": null },
     { "name": "Transporte de Mercancías", "status": "excluded", "value": "No contratado", "deductible": null }
   ]

### REGLAS ANTI-ALUCINACIÓN

- Si un campo NO aparece en el documento, usa: "NO ESPECIFICADO"
- Si la prima NO está clara, usa: 0
- NO inventes coberturas, deducibles, ni condiciones especiales
- Si hay ambigüedad, reporta la información cruda sin interpretar

Extrae la información de forma estructurada:`;

/**
 * Process a single quote using legacy text-based extraction
 * Timeout: 5 minutes per quote
 */
export async function processQuoteLegacy(
  quote: LegacyQuoteInput,
  index: number,
  total: number,
  options?: ProcessQuoteOptions
): Promise<ParsedQuote> {
  return withTimeout(
    processQuoteLegacyInternal(quote, index, total, options),
    5 * 60 * 1000, // 5 minutes max per quote
    `Quote processing timeout (legacy) (${quote.filename || 'unknown'})`
  );
}

export async function processQuoteLegacyInternal(
  quote: LegacyQuoteInput,
  index: number,
  total: number,
  options?: ProcessQuoteOptions
): Promise<ParsedQuote> {
  const domain = options?.domain ?? 'pyme';
  const quoteId = options?.quoteId ?? randomUUID();
  const metrics = options?.metrics ?? createExtractionMetricsEmitter();

  console.log(`   Quote ${index + 1}/${total}: ${quote.filename}`);

  try {
    metrics.emit({
      quoteId,
      index,
      total,
      pageCount: quote.metadata?.pageCount ?? 1,
      isScanned: quote.isScanned ?? false,
    });

    // Detect insurer and get profile
    const detectedInsurer = insurerProfileService.detectInsurer(quote.text);
    metrics.emit({
      quoteId,
      index,
      total,
      insurer: detectedInsurer,
      insurerDetectionSource: 'unknown',
      formatFamily: 'legacy',
    });
    const profile = insurerProfileService.getProfile(detectedInsurer);
    console.log(`   🔍 Detected insurer: ${detectedInsurer} (${profile.displayName})`);

    // Build prompt with profile
    const extractionPrompt = `${STRUCTURED_EXTRACTION_PROMPT}\n\n${profile.promptTemplate}\n\n${profile.fewShotExamples.join('\n\n')}`;

    // Try structured extraction first (JSON mode)
    let parsed: ParsedQuote;
    try {
      const { data: structuredResult } = await extractWithZodValidation<QuoteExtraction>(
        () =>
          geminiService.extractStructured(
            quote.text,
            extractionPrompt,
            quote.metadata?.pageCount || 1
          ),
        validateQuoteExtraction,
        'Legacy'
      );

      // Normalize coverages using thesaurus
      const normalizedCoverages = normalizeCoverages(
        (structuredResult.coverages || []).map((c) => ({
          name: c.name,
          value: c.value ?? 'NO ESPECIFICADO',
          deductible: c.deductible ?? 'NO ESPECIFICADO',
        })),
        domain
      );

      if (normalizedCoverages.needsReview) {
        console.log(`   ⚠️ Some coverages need review after thesaurus normalization`);
      }

      // Convert structured result to ParsedQuote format
      parsed = {
        insurerName: structuredResult.insurerName || 'NO ESPECIFICADO',
        policyName: structuredResult.policyName || 'NO ESPECIFICADO',
        priceAnnual: structuredResult.priceAnnual || 0,
        currency: structuredResult.currency || 'COP',
        coverages: normalizedCoverages.normalized.map((c) => ({
          name: c.name,
          canonicalName: c.name,
          value: c.value,
          deductible: c.deductible,
          confidence: c.confidence,
        })),
        specialConditions: structuredResult.specialConditions || [],
        rawText: quote.text,
        parseConfidence: normalizedCoverages.needsReview ? 75 : 95,
        expectedCoverages: (structuredResult.expectedCoverages || []).map((c) => ({
          name: c.name,
          status: c.status,
          value: c.value ?? null,
          deductible: c.deductible ?? null,
        })),
      };
    } catch (_jsonError: unknown) {
      // Fallback to text-based parsing
      console.log(`   📝 JSON extraction failed, falling back to text parsing...`);
      parsed = await quoteParser.parse(quote.text);
    }

    // Reconcile legacy quote against clause data
    try {
      const reconResults = await reconciliationService.reconcileQuote(parsed, { domain });
      if (reconResults.length > 0) {
        parsed.reconciliationResults = reconResults;
        const mismatchCount = reconResults.filter((r) => r.status === 'MISMATCH').length;
        if (mismatchCount > 0) {
          console.log(
            `   ⚠️ Legacy: found ${mismatchCount} deductible discrepancies vs clause data`
          );
        }
      }
    } catch (reconError: unknown) {
      const message = reconError instanceof Error ? reconError.message : String(reconError);
      console.warn(`   ⚠️ Legacy reconciliation failed (non-blocking): ${message}`);
    }

    console.log(
      `   ✅ Legacy extraction: ${parsed.insurerName}, ${parsed.coverages.length} coverages, premium: ${parsed.priceAnnual}`
    );
    return parsed;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`   ❌ Legacy extraction failed:`, message);
    throw error;
  }
}
