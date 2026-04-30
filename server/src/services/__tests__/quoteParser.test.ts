import { describe, it, expect } from 'vitest';
import { quoteParser, ParsedQuote } from '../quoteParser';

describe('quoteParser', () => {
    const sampleGeminiOutput = `=== INICIO EXTRACCIÓN ===

ASEGURADORA: Seguros Bolívar
PÓLIZA: Póliza PYME Empresarial
PRIMA ANUAL: 8.500.000
MONEDA: COP
VIGENCIA: 2024-01-01 - 2024-12-31

COBERTURAS:
- Incendio (Edificio y Contenidos): 500.000.000
  Deducible: 10%
- Responsabilidad Civil: 100.000.000
  Deducible: 5 SMMLV
- Robo y Hurto: 200.000.000
  Deducible: 10%
- Cristales: 50.000.000
  Deducible: No aplica
- Equipo Electrónico: 150.000.000
  Deducible: 15%

CONDICIONES ESPECIALES:
- Aplica cláusula de ajuste por inflación
- No cubre terremotos en zona de falla
- Vigencia de 12 meses con opción a renovación automática

=== FIN EXTRACCIÓN ===`;

    it('should parse basic quote information', async () => {
        const result = await quoteParser.parse(sampleGeminiOutput);
        
        expect(result.insurerName).toBe('Seguros Bolívar');
        expect(result.policyName).toBe('Póliza PYME Empresarial');
        expect(result.priceAnnual).toBe(8500000);
        expect(result.currency).toBe('COP');
        expect(result.validityPeriod).toBe('2024-01-01 - 2024-12-31');
    });

    it('should parse coverages correctly', async () => {
        const result = await quoteParser.parse(sampleGeminiOutput);
        
        expect(result.coverages).toHaveLength(5);
        expect(result.coverages[0].name).toBe('Incendio (Edificio y Contenidos)');
        expect(result.coverages[0].value).toBe('500.000.000');
        expect(result.coverages[0].deductible).toBe('10%');
    });

    it('should normalize coverage names using thesaurus', async () => {
        const result = await quoteParser.parse(sampleGeminiOutput);
        
        // Some coverages should be normalized based on thesaurus
        const incendio = result.coverages.find(c => c.name.includes('Incendio'));
        expect(incendio?.canonicalName).toBeDefined();
    });

    it('should parse special conditions', async () => {
        const result = await quoteParser.parse(sampleGeminiOutput);
        
        expect(result.specialConditions).toHaveLength(3);
        expect(result.specialConditions[0]).toBe('Aplica cláusula de ajuste por inflación');
    });

    it('should calculate parse confidence', async () => {
        const result = await quoteParser.parse(sampleGeminiOutput);
        
        expect(result.parseConfidence).toBeGreaterThan(0);
        expect(result.parseConfidence).toBeLessThanOrEqual(100);
    });

    it('should handle missing data gracefully', async () => {
        const incompleteText = `=== INICIO EXTRACCIÓN ===
ASEGURADORA: Aseguradora Test
=== FIN EXTRACCIÓN ===`;
        
        const result = await quoteParser.parse(incompleteText);
        
        expect(result.insurerName).toBe('Aseguradora Test');
        expect(result.policyName).toBe('NO ESPECIFICADO');
        expect(result.priceAnnual).toBe(0);
        expect(result.coverages).toHaveLength(0);
    });

    it('should handle empty or malformed input', async () => {
        const result = await quoteParser.parse('');
        
        expect(result.insurerName).toBe('NO ESPECIFICADO');
        expect(result.coverages).toHaveLength(0);
        expect(result.parseConfidence).toBe(0);
    });

    it('should parse multiple quotes from combined text', async () => {
        const combinedText = `=== INICIO COTIZACIÓN: Aseguradora A ===
ASEGURADORA: Aseguradora A
PRIMA ANUAL: 5.000.000
COBERTURAS:
- Cobertura 1: 100.000.000
  Deducible: 10%
=== FIN COTIZACIÓN ===

=== INICIO COTIZACIÓN: Aseguradora B ===
ASEGURADORA: Aseguradora B
PRIMA ANUAL: 7.000.000
COBERTURAS:
- Cobertura 1: 150.000.000
  Deducible: 5%
=== FIN COTIZACIÓN ===`;
        
        const results = await quoteParser.parseMultiple(combinedText);
        
        expect(results).toHaveLength(2);
        expect(results[0].insurerName).toBe('Aseguradora A');
        expect(results[1].insurerName).toBe('Aseguradora B');
    });

    it('should parse price with different formats', async () => {
        const formats = [
            { input: 'PRIMA ANUAL: 8.500.000', expected: 8500000 },
            { input: 'PRIMA ANUAL: $8,500,000', expected: 8500000 },
            { input: 'PRIMA ANUAL: 8500000', expected: 8500000 },
        ];
        
        for (const format of formats) {
            const text = `=== INICIO EXTRACCIÓN ===\n${format.input}\nMONEDA: COP\n=== FIN EXTRACCIÓN ===`;
            const result = await quoteParser.parse(text);
            expect(result.priceAnnual).toBe(format.expected);
        }
    });

    it('should assign confidence scores to coverages', async () => {
        const result = await quoteParser.parse(sampleGeminiOutput);
        
        for (const coverage of result.coverages) {
            expect(coverage.confidence).toBeGreaterThanOrEqual(0);
            expect(coverage.confidence).toBeLessThanOrEqual(100);
        }
    });
});
