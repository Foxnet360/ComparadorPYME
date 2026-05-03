import { describe, it, expect } from 'vitest';
import {
  extractPremiumWithRegex,
  validatePremium,
  createPremiumPrompt,
  extractAndValidatePremium,
} from '../premiumExtractor';

describe('premiumExtractor', () => {
  describe('extractPremiumWithRegex', () => {
    it('should extract premium with "prima" keyword', () => {
      const text = 'La prima anual es de 1.234.567 COP';
      const result = extractPremiumWithRegex(text);
      
      expect(result).not.toBeNull();
      expect(result?.priceAnnual).toBe(1234567);
      expect(result?.currency).toBe('COP');
      expect(result?.source).toBe('regex_fallback');
    });

    it('should extract premium with "total a pagar" keyword', () => {
      const text = 'Total a pagar: $ 2.500.000';
      const result = extractPremiumWithRegex(text);
      
      expect(result).not.toBeNull();
      expect(result?.priceAnnual).toBe(2500000);
    });

    it('should extract premium with "valor total" keyword', () => {
      const text = 'Valor total del seguro: 5.000.000';
      const result = extractPremiumWithRegex(text);
      
      expect(result).not.toBeNull();
      expect(result?.priceAnnual).toBe(5000000);
    });

    it('should handle Colombian number format', () => {
      const text = 'Prima: 1.234.567,89 COP';
      const result = extractPremiumWithRegex(text);
      
      expect(result).not.toBeNull();
      expect(result?.priceAnnual).toBe(1234568); // Rounded from 1234567.89
    });

    it('should return null when no premium found', () => {
      const text = 'Este documento no tiene información de prima';
      const result = extractPremiumWithRegex(text);
      
      expect(result).toBeNull();
    });

    it('should handle premium with no currency symbol', () => {
      const text = 'prima neta: 1000000';
      const result = extractPremiumWithRegex(text);
      
      expect(result).not.toBeNull();
      expect(result?.priceAnnual).toBe(1000000);
    });
  });

  describe('validatePremium', () => {
    it('should validate premium within range', () => {
      const result = validatePremium(500000);
      expect(result.valid).toBe(true);
      expect(result.suspect).toBe(false);
    });

    it('should flag premium below minimum', () => {
      const result = validatePremium(50000);
      expect(result.valid).toBe(true);
      expect(result.suspect).toBe(true);
    });

    it('should flag premium above maximum', () => {
      const result = validatePremium(600000000);
      expect(result.valid).toBe(true);
      expect(result.suspect).toBe(true);
    });

    it('should invalidate zero premium', () => {
      const result = validatePremium(0);
      expect(result.valid).toBe(false);
    });
  });

  describe('createPremiumPrompt', () => {
    it('should include premium-specific instructions', () => {
      const prompt = createPremiumPrompt('Extract quote data');
      
      expect(prompt).toContain('Extract quote data');
      expect(prompt).toContain('PRIMA');
      expect(prompt).toContain('COP');
    });
  });

  describe('extractAndValidatePremium', () => {
    it('should use structured price when available', () => {
      const text = 'prima: 1.000.000';
      const result = extractAndValidatePremium(2000000, text);
      
      expect(result.priceAnnual).toBe(2000000);
      expect(result.source).toBe('structured');
      expect(result.confidence).toBe(95);
    });

    it('should fallback to regex when structured is 0', () => {
      const text = 'prima total: 1.500.000 COP';
      const result = extractAndValidatePremium(0, text);
      
      expect(result.priceAnnual).toBe(1500000);
      expect(result.source).toBe('regex_fallback');
      expect(result.isValid).toBe(true);
    });

    it('should return unknown when no premium found', () => {
      const text = 'no premium information here';
      const result = extractAndValidatePremium(0, text);
      
      expect(result.priceAnnual).toBe(0);
      expect(result.source).toBe('unknown');
      expect(result.isValid).toBe(false);
    });

    it('should flag suspect premium', () => {
      const text = 'prima: 50.000 COP'; // Below minimum
      const result = extractAndValidatePremium(0, text);
      
      expect(result.priceAnnual).toBe(50000);
      expect(result.isSuspect).toBe(true);
      expect(result.confidence).toBe(50);
    });
  });
});
