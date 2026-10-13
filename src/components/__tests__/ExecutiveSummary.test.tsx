import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExecutiveSummary } from '../../../components/ExecutiveSummary';
import { QuoteAnalysis } from '../../../types';

const mockQuotes: QuoteAnalysis[] = [
  {
    insurerName: 'Seguros Bolívar',
    policyNumber: 'BOL-001',
    score: 95,
    priceAnnual: 12000000,
    coverages: [
      { name: 'Incendio', limit: '$1.000.000.000' },
      { name: 'Terremoto', limit: '$1.000.000.000' },
    ],
    missingCoverages: [],
    alerts: [{ level: 'WARNING', message: 'Revisar cláusula de garantías', description: 'Garantías' }],
  },
  {
    insurerName: 'Chubb Seguros',
    policyNumber: 'CHUBB-002',
    score: 82,
    priceAnnual: 15500000,
    coverages: [{ name: 'Incendio', limit: '$800.000.000' }],
    missingCoverages: ['Terremoto', 'Lucro Cesante'],
    alerts: [
      { level: 'CRITICAL', message: 'Exclusión crítica de terremoto', description: 'Exclusión' },
    ],
  },
];

describe('ExecutiveSummary', () => {
  const onNavigate = vi.fn();

  it('renders null when quotes array is empty', () => {
    const { container } = render(
      <ExecutiveSummary quotes={[]} recommendation="Test" onNavigate={onNavigate} />
    );
    expect(container.firstChild).toBeNull();
  });

  describe('technical view mode', () => {
    it('renders technical headers, alerts and score summary', () => {
      render(
        <ExecutiveSummary
          quotes={mockQuotes}
          recommendation="Dictamen de auditoría técnica"
          onNavigate={onNavigate}
          viewMode="technical"
        />
      );

      expect(screen.getByText('Resumen Ejecutivo')).toBeDefined();
      expect(screen.getByText('Insights clave del análisis comparativo')).toBeDefined();
      expect(screen.getByText('Mejor Opción')).toBeDefined();
      expect(screen.getByText('Mayor Riesgo')).toBeDefined();
      expect(screen.getByText('Seguros Bolívar')).toBeDefined();
      expect(screen.getByText('Chubb Seguros')).toBeDefined();
      expect(screen.getByText('Dictamen de auditoría técnica')).toBeDefined();
    });
  });

  describe('client view mode (commercial pitch)', () => {
    it('renders commercial executive pitch and decision pillars for decision makers', () => {
      render(
        <ExecutiveSummary
          quotes={mockQuotes}
          recommendation="Recomendación para la junta directiva"
          onNavigate={onNavigate}
          viewMode="client"
        />
      );

      // Client view headers
      expect(screen.getByText('Resumen Ejecutivo de Decisión Comercial')).toBeDefined();
      expect(
        screen.getByText('Recomendación estratégica para la toma de decisión del asegurado')
      ).toBeDefined();

      // Client view cards
      expect(screen.getByText('Opción Recomendada')).toBeDefined();
      expect(screen.getByText('Protección Patrimonial')).toBeDefined();

      // Pitch deck block
      expect(
        screen.getByText('Propuesta Comercial y Argumentación de Decisión')
      ).toBeDefined();
      expect(screen.getByText('1. Cobertura Integral')).toBeDefined();
      expect(screen.getByText('2. Deducibles Favorables')).toBeDefined();
      expect(screen.getByText('3. Retorno de Inversión')).toBeDefined();

      // Competitor risk breakdown in plain terms
      expect(
        screen.getByText('Factores Diferenciales frente a Alternativas Competidoras:')
      ).toBeDefined();
      expect(
        screen.getByText(/Omite amparos clave \(Terremoto, Lucro Cesante\)/)
      ).toBeDefined();
    });
  });
});
