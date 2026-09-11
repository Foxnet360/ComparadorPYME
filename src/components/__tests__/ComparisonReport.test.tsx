import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ComparisonReport from '../../../components/ComparisonReport';

// jsdom never performs layout, so DeferredChart would keep charts unmounted
// (zero-size container). Replace it with a passthrough for these tests.
vi.mock('../../../components/DeferredChart', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
import { ComparisonReport as ReportType } from '../../../types';
import { AnalysisProvider } from '../../../contexts/AnalysisContext';

// Helper to render with AnalysisProvider
const renderWithProvider = (ui: React.ReactElement) => {
  return render(<AnalysisProvider>{ui}</AnalysisProvider>);
};

// Mock child components that might crash or have complex dependencies
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
  isAdvancedAnalysisEnabled: () => true,
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

describe('ComparisonReport - Advanced Tab Visibility', () => {
  const baseReport: ReportType = {
    quotes: [
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
        alerts: [],
        crossReferenceSummary: {
          verifiedCoverages: 2,
          totalCoverages: 2,
          criticalAlerts: 0,
          warningAlerts: 0,
        },
        extractionConfidence: 95,
        needsReview: false,
        isCritical: false,
        validationFlags: [],
        validationSummary: '2/2 coberturas',
      },
    ],
    recommendation: 'Test recommendation',
    marketAnalysis: 'Test market analysis',
    deductibleComparison: [],
    timestamp: new Date().toISOString(),
    analysisVersion: '2.0-rag',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows advanced tab when data exists (feature flag enabled by default)', () => {
    const reportWithAdvancedData: ReportType = {
      ...baseReport,
      quotes: [
        {
          ...baseReport.quotes[0],
          clauseValidation: {
            hasClauseDocument: true,
            verifiedCount: 2,
            phantomCount: 0,
            mandatoryMissingCount: 0,
            optionalMissingCount: 0,
            scoreImpact: 0,
          },
        },
      ],
    };

    renderWithProvider(<ComparisonReport report={reportWithAdvancedData} />);

    expect(screen.getByText('Análisis Avanzado')).toBeTruthy();
  });

  it('hides advanced tab when no advanced data exists', () => {
    renderWithProvider(<ComparisonReport report={baseReport} />);

    expect(screen.queryByText('Análisis Avanzado')).toBeNull();
  });

  it('renders advanced analysis components when tab is active', () => {
    const reportWithAllAdvanced: ReportType = {
      ...baseReport,
      quotes: [
        {
          ...baseReport.quotes[0],
          clauseValidation: {
            hasClauseDocument: true,
            verifiedCount: 2,
            phantomCount: 0,
            mandatoryMissingCount: 0,
            optionalMissingCount: 0,
            scoreImpact: 0,
            results: [
              {
                coverageName: 'Incendio',
                status: 'VERIFIED',
                isMandatory: true,
                alertLevel: 'INFO',
              },
            ],
          },
          deductibleAnalysis: [
            {
              coverageName: 'Incendio',
              quoteDeductible: '10%',
              clauseDeductible: '10%',
              insuredAmount: 1000000000,
              deductibleAmount: 100000000,
              deductibleRatio: 0.1,
              hasCap: false,
              riskLevel: 'LOW',
              score: 65,
            },
          ],
          contextualRisk: {
            exclusions: [
              {
                exclusion: 'Robo',
                baseRiskLevel: 'HIGH',
                contextualRiskLevel: 'MEDIUM',
                explanation: 'Explicación del riesgo contextual',
                mitigationSuggestions: [],
              },
            ],
            criticalCount: 0,
            highCount: 0,
            mediumCount: 1,
            lowCount: 0,
            hasProfile: true,
          },
          warrantyCompliance: {
            totalConditions: 0,
            overallRisk: 'LOW',
            compliancePercentage: 100,
            byType: {
              documental: { count: 0, compliant: 0, risk: 'LOW' },
              operacional: { count: 0, compliant: 0, risk: 'LOW' },
              tecnico: { count: 0, compliant: 0, risk: 'LOW' },
              financiero: { count: 0, compliant: 0, risk: 'LOW' },
            },
            highRiskConditions: [],
          },
          legalOpinion: [
            {
              coverageName: 'Incendio',
              riskScenario: 'Escenario de riesgo',
              clauseInterpretation: 'Interpretación del clausulado',
              recommendation: 'Recomendación',
              negotiationPoints: [],
              citations: [],
              confidence: 90,
            },
          ],
        },
      ],
    };

    renderWithProvider(<ComparisonReport report={reportWithAllAdvanced} />);

    // Click on the advanced tab to activate it
    const advancedTab = screen.getByText('Análisis Avanzado');
    fireEvent.click(advancedTab);

    // The advanced tab content should be rendered
    expect(screen.getByTestId('coverage-validation')).toBeTruthy();
    expect(screen.getByTestId('deductible-risk')).toBeTruthy();
    expect(screen.getByTestId('contextual-risk')).toBeTruthy();
    expect(screen.getByTestId('warranty-compliance')).toBeTruthy();
    expect(screen.getByTestId('legal-opinion')).toBeTruthy();
  });

  it('always shows basic tabs regardless of advanced data', () => {
    renderWithProvider(<ComparisonReport report={baseReport} />);

    expect(screen.getByText('Dashboard Resumen')).toBeTruthy();
    expect(screen.getByText('Matriz de Coberturas')).toBeTruthy();
    expect(screen.getByText('Deducibles')).toBeTruthy();
    expect(screen.getByText('Evaluación de Riesgos')).toBeTruthy();
  });

  it('renders without errors when report has empty quotes', () => {
    const emptyReport: ReportType = {
      ...baseReport,
      quotes: [],
    };

    renderWithProvider(<ComparisonReport report={emptyReport} />);

    expect(
      screen.getByText('No se encontraron detalles de cotizaciones en el análisis.')
    ).toBeTruthy();
  });
});

describe('ComparisonReport - Feature Flag Integration', () => {
  const reportWithAdvancedData: ReportType = {
    quotes: [
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
        alerts: [],
        crossReferenceSummary: {
          verifiedCoverages: 2,
          totalCoverages: 2,
          criticalAlerts: 0,
          warningAlerts: 0,
        },
        extractionConfidence: 95,
        needsReview: false,
        isCritical: false,
        validationFlags: [],
        validationSummary: '2/2 coberturas',
        clauseValidation: {
          hasClauseDocument: true,
          verifiedCount: 2,
          phantomCount: 0,
          mandatoryMissingCount: 0,
          optionalMissingCount: 0,
          scoreImpact: 0,
        },
      },
    ],
    recommendation: 'Test recommendation',
    marketAnalysis: 'Test market analysis',
    deductibleComparison: [],
    timestamp: new Date().toISOString(),
    analysisVersion: '2.0-rag',
  };

  it('component checks for feature flag and data presence', () => {
    // This test verifies the integration point exists
    // The actual feature flag behavior is tested at the config level
    renderWithProvider(<ComparisonReport report={reportWithAdvancedData} />);

    // Should render without errors
    expect(screen.getByText('Dashboard Resumen')).toBeTruthy();
  });

  it('maintains backward compatibility with old report format', () => {
    const oldFormatReport: ReportType = {
      ...reportWithAdvancedData,
      quotes: reportWithAdvancedData.quotes.map((q) => ({
        ...q,
        // Remove all advanced fields
        clauseValidation: undefined,
        deductibleAnalysis: undefined,
        contextualRisk: undefined,
        warrantyCompliance: undefined,
        legalOpinion: undefined,
      })),
    };

    renderWithProvider(<ComparisonReport report={oldFormatReport} />);

    // Should not show advanced tab
    expect(screen.queryByText('Análisis Avanzado')).toBeNull();

    // But should show basic tabs
    expect(screen.getByText('Dashboard Resumen')).toBeTruthy();
  });
});
