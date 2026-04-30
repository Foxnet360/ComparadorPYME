"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const gemini_1 = require("../gemini");
/**
 * Integration tests for structured extraction
 * Tests JSON mode extraction with schema validation
 */
(0, vitest_1.describe)('extractStructured Integration', () => {
    const sampleQuoteText = `
SEGUROS BOLIVAR S.A.
COTIZACION SEGURO PYME EMPRESARIAL

Cliente: Empresa Test S.A.S.
NIT: 900.123.456-7

PRIMA ANUAL: $8.500.000 COP
VIGENCIA: 01/01/2024 - 31/12/2024

COBERTURAS:
1. Incendio (Edificio y Contenidos): $500.000.000
   Deducible: 10%
2. Lucro Cesante: $100.000.000
   Deducible: No aplica
3. Sustraccion / Hurto: $200.000.000
   Deducible: 10% / Min. 2 SMMLV
4. Equipo Electrico y Electronico: $150.000.000
   Deducible: 15%
5. Rotura de Maquinaria: $100.000.000
   Deducible: 10%
6. Responsabilidad Civil (RCE): $100.000.000
   Deducible: 5 SMMLV
7. Vidrios Planos: $50.000.000
   Deducible: No aplica
8. Manejo Global / Infidelidad: $100.000.000
   Deducible: 10%
9. Transporte de Mercancias: $50.000.000
   Deducible: 10%
10. Transporte de Valores: $50.000.000
    Deducible: 10%
11. Asistencia PYME: Incluido
    Deducible: No aplica
12. Asistencia Legal: Incluido
    Deducible: No aplica
13. Huelga, Motin, Asonada (HMACC): $100.000.000
    Deducible: 10%
14. Terremoto y Eventos Catastroficos: $200.000.000
    Deducible: 20%

CONDICIONES ESPECIALES:
- Aplica clausula de ajuste por inflacion
- Vigencia de 12 meses
  `;
    const structuredPrompt = `Eres un extractor experto de cotizaciones de seguros PYME colombianos.

### REGLAS CRITICAS

1. Nombres de coberturas: Usa EXACTAMENTE estos 14 nombres canonicos:
   - "Incendio (Edificio y Contenidos)"
   - "Lucro Cesante"
   - "Sustraccion / Hurto"
   - "Equipo Electrico y Electronico"
   - "Rotura de Maquinaria"
   - "Responsabilidad Civil (RCE)"
   - "Vidrios Planos"
   - "Manejo Global / Infidelidad"
   - "Transporte de Mercancias"
   - "Transporte de Valores"
   - "Asistencia PYME"
   - "Asistencia Legal"
   - "Huelga, Motin, Asonada (HMACC)"
   - "Terremoto y Eventos Catastroficos"

2. Si una cobertura no aparece en el documento, incluyela con:
   { "name": "[Nombre exacto de plantilla]", "value": "NO ESPECIFICADO", "deductible": "" }

3. NO inventes coberturas que no esten en el documento.

4. Prima anual: Extrae solo el numero, sin simbolos de moneda.

5. Devuelve SOLO el JSON, sin texto adicional.`;
    (0, vitest_1.it)('should extract structured data from sample quote text', () => __awaiter(void 0, void 0, void 0, function* () {
        // Skip if no API key available
        if (!process.env.GEMINI_API_KEY) {
            console.warn('Skipping integration test: No GEMINI_API_KEY available');
            return;
        }
        const result = yield gemini_1.geminiService.extractStructured(sampleQuoteText, structuredPrompt);
        // Verify schema compliance
        (0, vitest_1.expect)(result).toBeDefined();
        (0, vitest_1.expect)(result.insurerName).toBeDefined();
        (0, vitest_1.expect)(result.policyName).toBeDefined();
        (0, vitest_1.expect)(typeof result.priceAnnual).toBe('number');
        (0, vitest_1.expect)(result.currency).toMatch(/^(COP|USD)$/);
        (0, vitest_1.expect)(Array.isArray(result.coverages)).toBe(true);
        // Verify coverage structure
        if (result.coverages.length > 0) {
            const firstCoverage = result.coverages[0];
            (0, vitest_1.expect)(firstCoverage).toHaveProperty('name');
            (0, vitest_1.expect)(firstCoverage).toHaveProperty('value');
            (0, vitest_1.expect)(firstCoverage).toHaveProperty('deductible');
        }
    }));
    (0, vitest_1.it)('should return valid JSON conforming to QuoteExtractionSchema', () => __awaiter(void 0, void 0, void 0, function* () {
        if (!process.env.GEMINI_API_KEY) {
            console.warn('Skipping integration test: No GEMINI_API_KEY available');
            return;
        }
        const result = yield gemini_1.geminiService.extractStructured(sampleQuoteText, structuredPrompt);
        // Validate schema structure manually
        (0, vitest_1.expect)(result).toMatchObject({
            insurerName: vitest_1.expect.any(String),
            policyName: vitest_1.expect.any(String),
            priceAnnual: vitest_1.expect.any(Number),
            currency: vitest_1.expect.any(String),
            coverages: vitest_1.expect.any(Array),
        });
        // Validate each coverage object
        result.coverages.forEach((coverage) => {
            (0, vitest_1.expect)(coverage).toMatchObject({
                name: vitest_1.expect.any(String),
                value: vitest_1.expect.any(String),
                deductible: vitest_1.expect.any(String),
            });
        });
    }));
    (0, vitest_1.it)('should handle missing data gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
        if (!process.env.GEMINI_API_KEY) {
            console.warn('Skipping integration test: No GEMINI_API_KEY available');
            return;
        }
        const incompleteText = `
      ASEGURADORA: Aseguradora Test
      POLIZA: Poliza Basica
      // Missing premium and coverages
    `;
        const result = yield gemini_1.geminiService.extractStructured(incompleteText, structuredPrompt);
        // Should still return valid structure with defaults
        (0, vitest_1.expect)(result).toBeDefined();
        (0, vitest_1.expect)(result.insurerName).toBeDefined();
        (0, vitest_1.expect)(Array.isArray(result.coverages)).toBe(true);
    }));
    (0, vitest_1.it)('should validate QuoteExtractionSchema structure', () => {
        // Verify schema has required properties
        (0, vitest_1.expect)(gemini_1.QuoteExtractionSchema).toBeDefined();
        (0, vitest_1.expect)(gemini_1.QuoteExtractionSchema.type).toBe('object');
        (0, vitest_1.expect)(gemini_1.QuoteExtractionSchema.properties).toBeDefined();
        (0, vitest_1.expect)(gemini_1.QuoteExtractionSchema.properties).toHaveProperty('insurerName');
        (0, vitest_1.expect)(gemini_1.QuoteExtractionSchema.properties).toHaveProperty('policyName');
        (0, vitest_1.expect)(gemini_1.QuoteExtractionSchema.properties).toHaveProperty('priceAnnual');
        (0, vitest_1.expect)(gemini_1.QuoteExtractionSchema.properties).toHaveProperty('currency');
        (0, vitest_1.expect)(gemini_1.QuoteExtractionSchema.properties).toHaveProperty('coverages');
        (0, vitest_1.expect)(gemini_1.QuoteExtractionSchema.required).toContain('insurerName');
        (0, vitest_1.expect)(gemini_1.QuoteExtractionSchema.required).toContain('policyName');
        (0, vitest_1.expect)(gemini_1.QuoteExtractionSchema.required).toContain('priceAnnual');
        (0, vitest_1.expect)(gemini_1.QuoteExtractionSchema.required).toContain('currency');
        (0, vitest_1.expect)(gemini_1.QuoteExtractionSchema.required).toContain('coverages');
        // Verify coverage array schema
        const coveragesSchema = gemini_1.QuoteExtractionSchema.properties.coverages;
        (0, vitest_1.expect)(coveragesSchema.type).toBe('array');
        (0, vitest_1.expect)(coveragesSchema.items).toBeDefined();
        (0, vitest_1.expect)(coveragesSchema.items.properties).toHaveProperty('name');
        (0, vitest_1.expect)(coveragesSchema.items.properties).toHaveProperty('value');
        (0, vitest_1.expect)(coveragesSchema.items.properties).toHaveProperty('deductible');
    });
});
