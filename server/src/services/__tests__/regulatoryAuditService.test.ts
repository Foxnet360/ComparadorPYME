import { describe, it, expect } from 'vitest';
import {
  auditQuoteCompliance,
  auditReportCompliance,
  buildRegulatoryBackingPayload,
  getDomainLegalPromptContext,
} from '../regulatoryAuditService';
import type { QuoteAnalysis } from '../../types';

describe('regulatoryAuditService', () => {
  const mockPymeQuote: QuoteAnalysis = {
    insurerName: 'SURA',
    score: 95,
    clientAnalysis: 'Good',
    technicalAnalysis: 'Solid',
    scoringBreakdown: {
      coverageScore: 40,
      deductibleScore: 25,
      priceScore: 20,
      reputationScore: 10,
    },
    alerts: [],
    coverages: [
      { name: 'Incendio y Todo Riesgo Daño Material', value: '$1.000.000.000', isPositive: true },
      { name: 'Terremoto y Temblor', value: '$1.000.000.000', isPositive: true },
      { name: 'Responsabilidad Civil Extracontractual PLO', value: '$500.000.000', isPositive: true },
      { name: 'Sustracción con Violencia', value: '$100.000.000', isPositive: true },
    ],
  };

  const mockNonCompliantPymeQuote: QuoteAnalysis = {
    insurerName: 'Aseguradora Incompleta',
    score: 60,
    clientAnalysis: 'Weak',
    technicalAnalysis: 'Missing Earthquake and RCE',
    scoringBreakdown: {
      coverageScore: 20,
      deductibleScore: 20,
      priceScore: 15,
      reputationScore: 5,
    },
    alerts: [],
    coverages: [
      { name: 'Incendio Básico', value: '$500.000.000', isPositive: true },
      { name: 'Terremoto', value: 'No incluido', isPositive: false },
    ],
  };

  it('audits compliant PYME quote successfully', () => {
    const results = auditQuoteCompliance(mockPymeQuote, 'pyme');
    expect(results).toHaveLength(4);
    expect(results.every((r) => r.status === 'COMPLIANT')).toBe(true);
    expect(results[0].legalBasis).toContain('Código de Comercio');
  });

  it('detects missing critical and warning rules in non-compliant quote', () => {
    const results = auditQuoteCompliance(mockNonCompliantPymeQuote, 'pyme');
    const compliant = results.filter((r) => r.status === 'COMPLIANT');
    const nonCompliant = results.filter((r) => r.status === 'NON_COMPLIANT');
    const warnings = results.filter((r) => r.status === 'WARNING');

    expect(compliant.length).toBe(1); // Only Incendio
    expect(nonCompliant.length).toBeGreaterThan(0); // Terremoto, RCE are CRITICAL
    expect(warnings.length).toBeGreaterThan(0); // Sustraccion is WARNING
  });

  it('audits multiple quotes for report compliance', () => {
    const reportCompliance = auditReportCompliance(
      [mockPymeQuote, mockNonCompliantPymeQuote],
      'pyme'
    );
    expect(reportCompliance['SURA']).toBeDefined();
    expect(reportCompliance['Aseguradora Incompleta']).toBeDefined();
    expect(reportCompliance['SURA'].filter((r) => r.status === 'COMPLIANT').length).toBe(4);
  });

  it('builds full regulatory backing payload with metadata and primary laws', () => {
    const payload = buildRegulatoryBackingPayload([mockPymeQuote], 'copropiedades');
    expect(payload.domain).toBe('copropiedades');
    expect(payload.displayName).toContain('Copropiedad');
    expect(payload.primaryLaws.some((l) => l.code.includes('Ley 675'))).toBe(true);
    expect(payload.perQuoteCompliance['SURA']).toBeDefined();
  });

  it('generates domain legal prompt context for LLM', () => {
    const context = getDomainLegalPromptContext('cumplimiento');
    expect(context).toContain('Ley 80/1993');
    expect(context).toContain('MARCO NORMATIVO');
    expect(context).toContain('CUMPLIMIENTO');
  });
});
