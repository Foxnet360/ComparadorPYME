import { describe, it, expect } from 'vitest';
import { geminiService, QuoteExtractionSchema, QuoteExtraction } from '../gemini';

/**
 * Integration tests for structured extraction
 * Tests JSON mode extraction with schema validation
 */
describe('extractStructured Integration', () => {
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

  it('should extract structured data from sample quote text', async () => {
    // Skip if no API key available
    if (!process.env.GEMINI_API_KEY) {
      console.warn('Skipping integration test: No GEMINI_API_KEY available');
      return;
    }

    const result = await geminiService.extractStructured(sampleQuoteText, structuredPrompt);

    // Verify schema compliance
    expect(result).toBeDefined();
    expect(result.insurerName).toBeDefined();
    expect(result.policyName).toBeDefined();
    expect(typeof result.priceAnnual).toBe('number');
    expect(result.currency).toMatch(/^(COP|USD)$/);
    expect(Array.isArray(result.coverages)).toBe(true);

    // Verify coverage structure
    if (result.coverages.length > 0) {
      const firstCoverage = result.coverages[0];
      expect(firstCoverage).toHaveProperty('name');
      expect(firstCoverage).toHaveProperty('value');
      expect(firstCoverage).toHaveProperty('deductible');
    }
  });

  it('should return valid JSON conforming to QuoteExtractionSchema', async () => {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('Skipping integration test: No GEMINI_API_KEY available');
      return;
    }

    const result = await geminiService.extractStructured(sampleQuoteText, structuredPrompt);

    // Validate schema structure manually
    expect(result).toMatchObject({
      insurerName: expect.any(String),
      policyName: expect.any(String),
      priceAnnual: expect.any(Number),
      currency: expect.any(String),
      coverages: expect.any(Array),
    });

    // Validate each coverage object
    result.coverages.forEach((coverage: QuoteExtraction['coverages'][number]) => {
      expect(coverage).toMatchObject({
        name: expect.any(String),
        value: expect.any(String),
        deductible: expect.any(String),
      });
    });
  });

  it('should handle missing data gracefully', async () => {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('Skipping integration test: No GEMINI_API_KEY available');
      return;
    }

    const incompleteText = `
      ASEGURADORA: Aseguradora Test
      POLIZA: Poliza Basica
      // Missing premium and coverages
    `;

    const result = await geminiService.extractStructured(incompleteText, structuredPrompt);

    // Should still return valid structure with defaults
    expect(result).toBeDefined();
    expect(result.insurerName).toBeDefined();
    expect(Array.isArray(result.coverages)).toBe(true);
  });

  it('should validate QuoteExtractionSchema structure', () => {
    // Verify schema has required properties
    expect(QuoteExtractionSchema).toBeDefined();
    expect(QuoteExtractionSchema.type).toBe('object');
    expect(QuoteExtractionSchema.properties).toBeDefined();
    expect(QuoteExtractionSchema.properties).toHaveProperty('insurerName');
    expect(QuoteExtractionSchema.properties).toHaveProperty('policyName');
    expect(QuoteExtractionSchema.properties).toHaveProperty('priceAnnual');
    expect(QuoteExtractionSchema.properties).toHaveProperty('currency');
    expect(QuoteExtractionSchema.properties).toHaveProperty('coverages');
    expect(QuoteExtractionSchema.required).toContain('insurerName');
    expect(QuoteExtractionSchema.required).toContain('policyName');
    expect(QuoteExtractionSchema.required).toContain('priceAnnual');
    expect(QuoteExtractionSchema.required).toContain('currency');
    expect(QuoteExtractionSchema.required).toContain('coverages');

    // Verify coverage array schema
    const coveragesSchema = QuoteExtractionSchema.properties.coverages;
    expect(coveragesSchema.type).toBe('array');
    expect(coveragesSchema.items).toBeDefined();
    expect(coveragesSchema.items.properties).toHaveProperty('name');
    expect(coveragesSchema.items.properties).toHaveProperty('value');
    expect(coveragesSchema.items.properties).toHaveProperty('deductible');
  });
});
