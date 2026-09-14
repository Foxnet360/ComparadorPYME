import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ComparisonReport from '../../../components/ComparisonReport';

// jsdom never performs layout, so DeferredChart would keep charts unmounted
// (zero-size container). Replace it with a passthrough for these tests.
vi.mock('../../../components/DeferredChart', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { ComparisonReport as ReportType } from '../../../types';
import { AnalysisProvider } from '../../../contexts/AnalysisContext';

vi.mock('../../../components/ExecutiveSummary', () => ({
  ExecutiveSummary: () => <div data-testid="executive-summary">Executive Summary</div>,
}));

vi.mock('../../../components/DeductiblesComparisonTable', () => ({
  DeductiblesComparisonTable: () => <div>Deductibles Table</div>,
}));

vi.mock('../../../components/DeductibleSummaryTable', () => ({
  DeductibleSummaryTable: () => <div>Deductible Summary</div>,
}));

vi.mock('../../../components/AuditSection', () => ({
  AuditSection: () => <div>Audit Section</div>,
}));

vi.mock('../../../components/UnifiedCoverageMatrix', () => ({
  UnifiedCoverageMatrix: () => <div>Coverage Matrix</div>,
}));

vi.mock('../../../config/features', () => ({
  isAdvancedAnalysisEnabled: () => false,
}));

vi.mock('../../../components/CoverageValidationMatrix', () => ({
  CoverageValidationMatrix: () => <div data-testid="coverage-validation">Coverage Validation</div>,
}));

vi.mock('../../../components/DeductibleRiskGauge', () => ({
  DeductibleRiskGauge: () => <div data-testid="deductible-risk">Deductible Risk</div>,
}));

vi.mock('../../../components/ContextualExclusionCard', () => ({
  ContextualExclusionCard: () => <div data-testid="contextual-risk">Contextual Risk</div>,
}));

vi.mock('../../../components/WarrantyComplianceDashboard', () => ({
  WarrantyComplianceDashboard: () => (
    <div data-testid="warranty-compliance">Warranty Compliance</div>
  ),
}));

vi.mock('../../../components/LegalOpinionCard', () => ({
  LegalOpinionCard: () => <div data-testid="legal-opinion">Legal Opinion</div>,
}));

vi.mock('../../../components/NegotiationPointsList', () => ({
  NegotiationPointsList: () => <div data-testid="negotiation-points">Negotiation Points</div>,
}));

vi.mock('../../../components/InverseCoverageAlert', () => ({
  InverseCoverageAlert: () => <div data-testid="inverse-coverage">Inverse Coverage</div>,
}));

const baseQuote = {
  insurerName: 'Seguros Bolívar',
  policyName: 'Empresarial Plus',
  priceAnnual: 8500000,
  currency: 'COP',
  coverages: [{ name: 'Responsabilidad Civil', value: '100M', deductible: '5 SMMLV' }],
  score: 85,
  parseConfidence: 95,
  specialConditions: [],
  clientAnalysis: '',
  technicalAnalysis: '',
  keyFindings: [],
  alerts: [],
  extractionConfidence: 95,
  needsReview: false,
  validationFlags: [],
};

const buildReport = (overrides: Partial<ReportType>): ReportType => ({
  quotes: [baseQuote],
  recommendation: 'Test recommendation',
  marketAnalysis: 'Test market analysis',
  deductibleComparison: [],
  ...overrides,
});

const renderWithProvider = (ui: React.ReactElement) =>
  render(<AnalysisProvider>{ui}</AnalysisProvider>);

describe('ComparisonReport renewal mode gating (task 1.24, XC-3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render renewal sections for a v2 report (default-path regression)', () => {
    renderWithProvider(<ComparisonReport report={buildReport({ schemaVersion: 2 })} />);

    expect(screen.getByText('Dashboard Resumen')).toBeTruthy();
    expect(screen.queryByText('Póliza Actual')).toBeNull();
    expect(screen.queryByLabelText('Análisis de renovación')).toBeNull();
  });

  it('does not render renewal sections when schemaVersion is missing (legacy v1)', () => {
    renderWithProvider(<ComparisonReport report={buildReport({})} />);

    expect(screen.queryByText('Póliza Actual')).toBeNull();
    expect(screen.queryByLabelText('Análisis de renovación')).toBeNull();
  });

  it('renders baseline badge and gap/delta panels for a v3 renewal report', async () => {
    const renewalReport = buildReport({
      schemaVersion: 3,
      baseline: {
        insurerName: 'Seguros Bolívar',
        priceAnnual: 8500000,
        coverages: [],
      },
      renewalAnalytics: [
        {
          insurer: 'Allianz',
          gaps: {
            coveragesLost: ['RC Familiar'],
            coveragesGained: [],
            deductibleWorsening: [],
            newExclusions: [],
          },
          premiumDelta: { absolute: -500000, percentage: -5.9, direction: 'decrease' },
          friction: [],
        },
      ],
    });

    renderWithProvider(<ComparisonReport report={renewalReport} />);

    // Lazy-mounted section resolves asynchronously.
    expect(await screen.findByLabelText('Análisis de renovación')).toBeTruthy();
    expect(screen.getByText('Póliza Actual')).toBeTruthy();
    expect(screen.getByLabelText('Análisis de brechas — Allianz')).toBeTruthy();
  });
});
