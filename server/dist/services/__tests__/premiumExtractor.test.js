"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const premiumExtractor_1 = require("../premiumExtractor");
(0, vitest_1.describe)('premiumExtractor', () => {
    (0, vitest_1.describe)('extractPremiumWithRegex', () => {
        (0, vitest_1.it)('should extract premium with "prima" keyword', () => {
            const text = 'La prima anual es de 1.234.567 COP';
            const result = (0, premiumExtractor_1.extractPremiumWithRegex)(text);
            (0, vitest_1.expect)(result).not.toBeNull();
            (0, vitest_1.expect)(result === null || result === void 0 ? void 0 : result.priceAnnual).toBe(1234567);
            (0, vitest_1.expect)(result === null || result === void 0 ? void 0 : result.currency).toBe('COP');
            (0, vitest_1.expect)(result === null || result === void 0 ? void 0 : result.source).toBe('regex_fallback');
        });
        (0, vitest_1.it)('should extract premium with "total a pagar" keyword', () => {
            const text = 'Total a pagar: $ 2.500.000';
            const result = (0, premiumExtractor_1.extractPremiumWithRegex)(text);
            (0, vitest_1.expect)(result).not.toBeNull();
            (0, vitest_1.expect)(result === null || result === void 0 ? void 0 : result.priceAnnual).toBe(2500000);
        });
        (0, vitest_1.it)('should extract premium with "valor total" keyword', () => {
            const text = 'Valor total del seguro: 5.000.000';
            const result = (0, premiumExtractor_1.extractPremiumWithRegex)(text);
            (0, vitest_1.expect)(result).not.toBeNull();
            (0, vitest_1.expect)(result === null || result === void 0 ? void 0 : result.priceAnnual).toBe(5000000);
        });
        (0, vitest_1.it)('should handle Colombian number format', () => {
            const text = 'Prima: 1.234.567,89 COP';
            const result = (0, premiumExtractor_1.extractPremiumWithRegex)(text);
            (0, vitest_1.expect)(result).not.toBeNull();
            (0, vitest_1.expect)(result === null || result === void 0 ? void 0 : result.priceAnnual).toBe(1234568); // Rounded from 1234567.89
        });
        (0, vitest_1.it)('should return null when no premium found', () => {
            const text = 'Este documento no tiene información de prima';
            const result = (0, premiumExtractor_1.extractPremiumWithRegex)(text);
            (0, vitest_1.expect)(result).toBeNull();
        });
        (0, vitest_1.it)('should handle premium with no currency symbol', () => {
            const text = 'prima neta: 1000000';
            const result = (0, premiumExtractor_1.extractPremiumWithRegex)(text);
            (0, vitest_1.expect)(result).not.toBeNull();
            (0, vitest_1.expect)(result === null || result === void 0 ? void 0 : result.priceAnnual).toBe(1000000);
        });
    });
    (0, vitest_1.describe)('validatePremium', () => {
        (0, vitest_1.it)('should validate premium within range', () => {
            const result = (0, premiumExtractor_1.validatePremium)(500000);
            (0, vitest_1.expect)(result.valid).toBe(true);
            (0, vitest_1.expect)(result.suspect).toBe(false);
        });
        (0, vitest_1.it)('should flag premium below minimum', () => {
            const result = (0, premiumExtractor_1.validatePremium)(50000);
            (0, vitest_1.expect)(result.valid).toBe(true);
            (0, vitest_1.expect)(result.suspect).toBe(true);
        });
        (0, vitest_1.it)('should flag premium above maximum', () => {
            const result = (0, premiumExtractor_1.validatePremium)(600000000);
            (0, vitest_1.expect)(result.valid).toBe(true);
            (0, vitest_1.expect)(result.suspect).toBe(true);
        });
        (0, vitest_1.it)('should invalidate zero premium', () => {
            const result = (0, premiumExtractor_1.validatePremium)(0);
            (0, vitest_1.expect)(result.valid).toBe(false);
        });
    });
    (0, vitest_1.describe)('createPremiumPrompt', () => {
        (0, vitest_1.it)('should include premium-specific instructions', () => {
            const prompt = (0, premiumExtractor_1.createPremiumPrompt)('Extract quote data');
            (0, vitest_1.expect)(prompt).toContain('Extract quote data');
            (0, vitest_1.expect)(prompt).toContain('PRIMA');
            (0, vitest_1.expect)(prompt).toContain('COP');
        });
    });
    (0, vitest_1.describe)('extractAndValidatePremium', () => {
        (0, vitest_1.it)('should use structured price when available', () => {
            const text = 'prima: 1.000.000';
            const result = (0, premiumExtractor_1.extractAndValidatePremium)(2000000, text);
            (0, vitest_1.expect)(result.priceAnnual).toBe(2000000);
            (0, vitest_1.expect)(result.source).toBe('structured');
            (0, vitest_1.expect)(result.confidence).toBe(95);
        });
        (0, vitest_1.it)('should fallback to regex when structured is 0', () => {
            const text = 'prima total: 1.500.000 COP';
            const result = (0, premiumExtractor_1.extractAndValidatePremium)(0, text);
            (0, vitest_1.expect)(result.priceAnnual).toBe(1500000);
            (0, vitest_1.expect)(result.source).toBe('regex_fallback');
            (0, vitest_1.expect)(result.isValid).toBe(true);
        });
        (0, vitest_1.it)('should return unknown when no premium found', () => {
            const text = 'no premium information here';
            const result = (0, premiumExtractor_1.extractAndValidatePremium)(0, text);
            (0, vitest_1.expect)(result.priceAnnual).toBe(0);
            (0, vitest_1.expect)(result.source).toBe('unknown');
            (0, vitest_1.expect)(result.isValid).toBe(false);
        });
        (0, vitest_1.it)('should flag suspect premium', () => {
            const text = 'prima: 50.000 COP'; // Below minimum
            const result = (0, premiumExtractor_1.extractAndValidatePremium)(0, text);
            (0, vitest_1.expect)(result.priceAnnual).toBe(50000);
            (0, vitest_1.expect)(result.isSuspect).toBe(true);
            (0, vitest_1.expect)(result.confidence).toBe(50);
        });
    });
});
