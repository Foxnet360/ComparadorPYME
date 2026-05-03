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
const quoteParser_1 = require("../quoteParser");
(0, vitest_1.describe)('quoteParser', () => {
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
    (0, vitest_1.it)('should parse basic quote information', () => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield quoteParser_1.quoteParser.parse(sampleGeminiOutput);
        (0, vitest_1.expect)(result.insurerName).toBe('Seguros Bolívar');
        (0, vitest_1.expect)(result.policyName).toBe('Póliza PYME Empresarial');
        (0, vitest_1.expect)(result.priceAnnual).toBe(8500000);
        (0, vitest_1.expect)(result.currency).toBe('COP');
        (0, vitest_1.expect)(result.validityPeriod).toBe('2024-01-01 - 2024-12-31');
    }));
    (0, vitest_1.it)('should parse coverages correctly', () => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield quoteParser_1.quoteParser.parse(sampleGeminiOutput);
        (0, vitest_1.expect)(result.coverages).toHaveLength(5);
        (0, vitest_1.expect)(result.coverages[0].name).toBe('Incendio (Edificio y Contenidos)');
        (0, vitest_1.expect)(result.coverages[0].value).toBe('500.000.000');
        (0, vitest_1.expect)(result.coverages[0].deductible).toBe('10%');
    }));
    (0, vitest_1.it)('should normalize coverage names using thesaurus', () => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield quoteParser_1.quoteParser.parse(sampleGeminiOutput);
        // Some coverages should be normalized based on thesaurus
        const incendio = result.coverages.find(c => c.name.includes('Incendio'));
        (0, vitest_1.expect)(incendio === null || incendio === void 0 ? void 0 : incendio.canonicalName).toBeDefined();
    }));
    (0, vitest_1.it)('should parse special conditions', () => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield quoteParser_1.quoteParser.parse(sampleGeminiOutput);
        (0, vitest_1.expect)(result.specialConditions).toHaveLength(3);
        (0, vitest_1.expect)(result.specialConditions[0]).toBe('Aplica cláusula de ajuste por inflación');
    }));
    (0, vitest_1.it)('should calculate parse confidence', () => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield quoteParser_1.quoteParser.parse(sampleGeminiOutput);
        (0, vitest_1.expect)(result.parseConfidence).toBeGreaterThan(0);
        (0, vitest_1.expect)(result.parseConfidence).toBeLessThanOrEqual(100);
    }));
    (0, vitest_1.it)('should handle missing data gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
        const incompleteText = `=== INICIO EXTRACCIÓN ===
ASEGURADORA: Aseguradora Test
=== FIN EXTRACCIÓN ===`;
        const result = yield quoteParser_1.quoteParser.parse(incompleteText);
        (0, vitest_1.expect)(result.insurerName).toBe('Aseguradora Test');
        (0, vitest_1.expect)(result.policyName).toBe('NO ESPECIFICADO');
        (0, vitest_1.expect)(result.priceAnnual).toBe(0);
        (0, vitest_1.expect)(result.coverages).toHaveLength(0);
    }));
    (0, vitest_1.it)('should handle empty or malformed input', () => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield quoteParser_1.quoteParser.parse('');
        (0, vitest_1.expect)(result.insurerName).toBe('NO ESPECIFICADO');
        (0, vitest_1.expect)(result.coverages).toHaveLength(0);
        (0, vitest_1.expect)(result.parseConfidence).toBe(0);
    }));
    (0, vitest_1.it)('should parse multiple quotes from combined text', () => __awaiter(void 0, void 0, void 0, function* () {
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
        const results = yield quoteParser_1.quoteParser.parseMultiple(combinedText);
        (0, vitest_1.expect)(results).toHaveLength(2);
        (0, vitest_1.expect)(results[0].insurerName).toBe('Aseguradora A');
        (0, vitest_1.expect)(results[1].insurerName).toBe('Aseguradora B');
    }));
    (0, vitest_1.it)('should parse price with different formats', () => __awaiter(void 0, void 0, void 0, function* () {
        const formats = [
            { input: 'PRIMA ANUAL: 8.500.000', expected: 8500000 },
            { input: 'PRIMA ANUAL: $8,500,000', expected: 8500000 },
            { input: 'PRIMA ANUAL: 8500000', expected: 8500000 },
        ];
        for (const format of formats) {
            const text = `=== INICIO EXTRACCIÓN ===\n${format.input}\nMONEDA: COP\n=== FIN EXTRACCIÓN ===`;
            const result = yield quoteParser_1.quoteParser.parse(text);
            (0, vitest_1.expect)(result.priceAnnual).toBe(format.expected);
        }
    }));
    (0, vitest_1.it)('should assign confidence scores to coverages', () => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield quoteParser_1.quoteParser.parse(sampleGeminiOutput);
        for (const coverage of result.coverages) {
            (0, vitest_1.expect)(coverage.confidence).toBeGreaterThanOrEqual(0);
            (0, vitest_1.expect)(coverage.confidence).toBeLessThanOrEqual(100);
        }
    }));
});
