import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuditDashboard } from '../../../components/AuditDashboard';
import { QuoteAnalysis } from '../../../types';

describe('AuditDashboard', () => {
  const mockQuotes: QuoteAnalysis[] = [
    {
      insurerName: 'Seguros Bolívar',
      policyName: 'Empresarial Plus',
      priceAnnual: 8500000,
      currency: 'COP',
      coverages: [{ name: 'Responsabilidad Civil', value: '100M', deductible: '5 SMMLV' }],
      score: 85,
      parseConfidence: 95,
      specialConditions: [],
      scoringBreakdown: {
        coverage: 90,
        deductibles: 80,
        exclusions: 85,
        priceRatio: 75,
        sublimits: 80,
        warranties: 70,
      },
      clientAnalysis: '',
      technicalAnalysis: '',
      keyFindings: [],
      alerts: [
        { level: 'CRITICAL', title: 'Test', description: 'Test critical' },
        { level: 'WARNING', title: 'Test', description: 'Test warning' },
      ],
      crossReferenceSummary: {
        verifiedCoverages: 2,
        totalCoverages: 2,
        criticalAlerts: 1,
        warningAlerts: 1,
      },
      extractionConfidence: 95,
      needsReview: false,
      isCritical: false,
      validationFlags: [],
      validationSummary: '2/2 coberturas',
    },
  ];

  it('renders basic metrics without advanced data', () => {
    render(
      <AuditDashboard
        quotes={mockQuotes}
        crossInsurerRisks={[]}
        businessContextAnalysis=""
        viewMode="technical"
      />
    );

    // Should show alert counter labels
    expect(screen.getByText('Críticos')).toBeTruthy();
    expect(screen.getByText('Advertencias')).toBeTruthy();
    expect(screen.getByText('Destacados')).toBeTruthy();

    // Should not show validation section without clauseValidation
    expect(screen.queryByText('Validación de Coberturas')).toBeNull();
  });

  it('renders clause validation metrics when data is available', () => {
    const quotesWithValidation = [
      {
        ...mockQuotes[0],
        clauseValidation: {
          hasClauseDocument: true,
          verifiedCount: 2,
          phantomCount: 1,
          mandatoryMissingCount: 0,
          optionalMissingCount: 0,
          scoreImpact: 0,
        },
      },
    ];

    render(
      <AuditDashboard
        quotes={quotesWithValidation}
        crossInsurerRisks={[]}
        businessContextAnalysis=""
        viewMode="technical"
      />
    );

    expect(screen.getByText('Validación de Coberturas')).toBeTruthy();
    expect(screen.getByText(/Verificadas/)).toBeTruthy();
    expect(screen.getByText(/Fantasma/)).toBeTruthy();
  });

  it('renders deductible risk metrics when data is available', () => {
    const quotesWithDeductibles = [
      {
        ...mockQuotes[0],
        deductibleAnalysis: [
          { coverage: 'Incendio', level: 'LOW', riskScore: 65 },
          { coverage: 'Robo', level: 'HIGH', riskScore: 85 },
        ],
      },
    ];

    render(
      <AuditDashboard
        quotes={quotesWithDeductibles}
        crossInsurerRisks={[]}
        businessContextAnalysis=""
        viewMode="technical"
      />
    );

    expect(screen.getByText('Riesgo de Deducibles')).toBeTruthy();
    expect(screen.getByText('Riesgo Bajo')).toBeTruthy();
    expect(screen.getByText('Riesgo Alto')).toBeTruthy();
  });

  it('renders business context analysis when provided', () => {
    render(
      <AuditDashboard
        quotes={mockQuotes}
        crossInsurerRisks={[]}
        businessContextAnalysis="Análisis contextual de prueba"
        viewMode="technical"
      />
    );

    expect(screen.getByText('Análisis Contextual del Negocio')).toBeTruthy();
    expect(screen.getByText('Análisis contextual de prueba')).toBeTruthy();
  });

  it('shows cross-insurer risk matrix when risks exist', () => {
    const risks = [
      {
        riskTitle: 'Riesgo Común',
        severity: 'CRITICAL' as const,
        affectedInsurers: ['Seguros Bolívar', 'Seguros del Estado'],
        description: 'Descripción',
      },
    ];

    render(
      <AuditDashboard
        quotes={mockQuotes}
        crossInsurerRisks={risks}
        businessContextAnalysis=""
        viewMode="technical"
      />
    );

    expect(screen.getByText('Matriz de Riesgos Cruzados')).toBeTruthy();
    expect(screen.getByText('Riesgo Común')).toBeTruthy();
    expect(screen.getByText('CRITICAL')).toBeTruthy();
    expect(screen.getByText('Seguros Bolívar')).toBeTruthy();
  });

  it('hides technical sections in client view mode', () => {
    const quotesWithValidation = [
      {
        ...mockQuotes[0],
        clauseValidation: {
          hasClauseDocument: true,
          verifiedCount: 2,
          phantomCount: 0,
          mandatoryMissingCount: 0,
          optionalMissingCount: 0,
          scoreImpact: 0,
        },
      },
    ];

    render(
      <AuditDashboard
        quotes={quotesWithValidation}
        crossInsurerRisks={[]}
        businessContextAnalysis="Análisis"
        viewMode="client"
      />
    );

    // Should not show technical sections in client mode
    expect(screen.queryByText('Validación de Coberturas')).toBeNull();
    expect(screen.queryByText('Análisis Contextual del Negocio')).toBeNull();

    // But should still show basic counters
    expect(screen.getByText('Críticos')).toBeTruthy();
  });

  it('handles empty quotes array', () => {
    render(
      <AuditDashboard
        quotes={[]}
        crossInsurerRisks={[]}
        businessContextAnalysis=""
        viewMode="technical"
      />
    );

    // Should render without errors
    expect(screen.getByText('Críticos')).toBeTruthy();
    expect(screen.getByText('Advertencias')).toBeTruthy();
  });
});
