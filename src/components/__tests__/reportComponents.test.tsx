import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';
import ExportModal from '../../../components/report/ExportModal';
import { AdvancedAnalysisTab } from '../../../components/report/AdvancedAnalysisTab';
import type { ComparisonReport as ReportType, QuoteAnalysis } from '../../../types';

vi.mock('../../../components/CoverageValidationMatrix', () => ({
  CoverageValidationMatrix: () => <div data-testid="coverage-validation" />,
}));

vi.mock('../../../components/DeductibleRiskGauge', () => ({
  DeductibleRiskGauge: () => <div data-testid="deductible-risk" />,
}));

vi.mock('../../../components/ContextualExclusionCard', () => ({
  ContextualExclusionCard: () => <div data-testid="contextual-risk" />,
}));

vi.mock('../../../components/WarrantyComplianceDashboard', () => ({
  WarrantyComplianceDashboard: () => <div data-testid="warranty-compliance" />,
}));

vi.mock('../../../components/LegalOpinionCard', () => ({
  LegalOpinionCard: () => <div data-testid="legal-opinion" />,
}));

vi.mock('../../../components/NegotiationPointsList', () => ({
  NegotiationPointsList: () => <div data-testid="negotiation-points" />,
}));

vi.mock('../../../components/InverseCoverageAlert', () => ({
  InverseCoverageAlert: () => <div data-testid="inverse-coverage" />,
}));

const noop = () => {};

const advancedQuote = {
  insurerName: 'Seguros Bolívar',
  priceAnnual: 8500000,
  clauseValidation: {
    mandatoryMissingCount: 1,
    results: [{ coverageName: 'Incendio', isMandatory: true, status: 'MANDATORY_MISSING' }],
  },
  deductibleAnalysis: [{ deductible: '5 SMMLV' }],
  contextualRisk: { exclusions: [{ exclusion: 'Terremoto' }] },
  warrantyCompliance: { summary: 'ok' },
  legalOpinion: [
    {
      coverageName: 'Incendio',
      riskScenario: 'x',
      clauseInterpretation: 'y',
      recommendation: 'z',
      citations: [],
      confidence: 80,
      negotiationPoints: [{ point: 'Negociar sublímite' }],
    },
  ],
} as unknown as QuoteAnalysis;

const baseReport = {
  quotes: [advancedQuote],
  recommendation: 'Recomendación de prueba',
  timestamp: new Date().toISOString(),
  analysisVersion: '2.0-rag',
} as unknown as ReportType;

describe('report component split (ARCH-1)', () => {
  it('ComparisonReport shell composes the extracted report modules', () => {
    const shellSource = readFileSync(
      join(__dirname, '../../../components/ComparisonReport.tsx'),
      'utf8'
    );
    expect(shellSource).toContain("from './report/AdvancedAnalysisTab'");
    expect(shellSource).toContain("from './report/ExportModal'");
    expect(shellSource).toContain("from '../hooks/useReportCorrections'");
    expect(shellSource).toContain("from './report/SummaryTab'");

    // Charts and score cards are composed by SummaryTab, not the shell.
    const summaryTabSource = readFileSync(
      join(__dirname, '../../../components/report/SummaryTab.tsx'),
      'utf8'
    );
    expect(summaryTabSource).toContain("from './ReportCharts'");
    expect(summaryTabSource).toContain("from './QuoteScoreCard'");
  });

  it('keeps the ComparisonReport shell under 250 LOC', () => {
    const shellSource = readFileSync(
      join(__dirname, '../../../components/ComparisonReport.tsx'),
      'utf8'
    );
    expect(shellSource.split('\n').length).toBeLessThan(250);
  });

  it('ExportModal renders in isolation with the same fixture shape', () => {
    render(
      <ExportModal
        report={baseReport}
        pdfOptions={{ title: 'Reporte Ejecutivo de Seguros', color: [79, 70, 229] }}
        onPdfOptionsChange={noop}
        cellNotes={{}}
        onClose={noop}
      />
    );
    expect(screen.getByText('Personalizar Reporte')).toBeTruthy();
    expect(screen.getByText('Generar PDF')).toBeTruthy();
  });

  it('AdvancedAnalysisTab renders every advanced section in isolation', () => {
    render(<AdvancedAnalysisTab quotes={baseReport.quotes} />);
    expect(screen.getByText('Validación de Coberturas')).toBeTruthy();
    expect(screen.getByText('Riesgo de Deducibles')).toBeTruthy();
    expect(screen.getByText('Riesgo Contextualizado')).toBeTruthy();
    expect(screen.getByText('Cumplimiento de Garantías')).toBeTruthy();
    expect(screen.getByText('Asesoría Legal')).toBeTruthy();
    expect(screen.getByText('Coberturas Omitidas')).toBeTruthy();
    expect(screen.getByText('Puntos de Negociación')).toBeTruthy();
  });

  it('AdvancedAnalysisTab renders nothing when no quote has advanced data', () => {
    const { container } = render(<AdvancedAnalysisTab quotes={[]} />);
    expect(container.textContent).toBe('');
  });

  it('onPdfOptionsChange is wired to the title input', () => {
    const onPdfOptionsChange = vi.fn();
    render(
      <ExportModal
        report={baseReport}
        pdfOptions={{ title: 'Reporte Ejecutivo de Seguros', color: [79, 70, 229] }}
        onPdfOptionsChange={onPdfOptionsChange}
        cellNotes={{}}
        onClose={noop}
      />
    );
    const input = screen.getByPlaceholderText('Ej: Informe Ejecutivo CSA');
    fireEventInput(input, 'Mi Informe');
    expect(onPdfOptionsChange).toHaveBeenCalled();
  });
});

const fireEventInput = (el: HTMLElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};
