import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ExecutiveAnalytics } from '../../../components/ExecutiveAnalytics';
import { analyticsService } from '../../../services/analyticsService';
import type { ExecutiveAnalyticsData } from '../../../types';

vi.mock('../../../services/analyticsService', () => ({
  analyticsService: {
    getAvailableAllies: vi.fn().mockReturnValue([
      { id: 'ally-100', name: 'Correduría Andina S.A.', nit: '900.543.210-1' },
    ]),
    fetchAllies: vi.fn().mockResolvedValue([
      { id: 'ally-100', name: 'Correduría Andina S.A.', nit: '900.543.210-1' },
    ]),
    getExecutiveAnalytics: vi.fn(),
  },
}));

const mockSuperAdminData: ExecutiveAnalyticsData = {
  role: 'super_admin',
  allyId: 'ally-100',
  allyName: 'Correduría Andina S.A.',
  totalComparisons: 150,
  soldCount: 45,
  conversionRate: 30,
  totalPremium: 750000000,
  activeProspects: 105,
  avgProcessTimeMinutes: 8,
  domainDistribution: [
    { domainId: 'pyme', domainName: 'PYME Multirriesgo', count: 90, percentage: 60 },
    { domainId: 'autos', domainName: 'Autos y Flotas', count: 60, percentage: 40 },
  ],
  insurerDistribution: [
    { insurerName: 'SURA', count: 60, percentage: 40 },
    { insurerName: 'AXA Colpatria', count: 50, percentage: 33 },
  ],
  analystPerformance: [
    {
      analystId: 'user-tech-1',
      analystName: 'Carlos Mendoza',
      totalComparisons: 20,
      soldCount: 8,
      conversionRate: 40,
      totalPremium: 100000000,
      avgTimeMinutes: 10,
      topDomain: 'PYME',
    },
  ],
  daasMetrics: {
    totalSnapshots: 420,
    activeDomains: 8,
    activeInsurers: 12,
    monthlyIngestionRate: 65,
    avgMarketScore: 88,
  },
  marketBenchmark: {
    domain: 'pyme',
    sampleSize: 120,
    avgPremiumAnnual: 4800000,
    medianPremiumAnnual: 4500000,
    percentile25: 3800000,
    percentile75: 5600000,
    topInsurers: [
      { insurerName: 'SURA', quoteCount: 45, avgPrice: 4600000 },
    ],
  },
  aiBenchmarks: {
    overallAccuracy: 98.4,
    thesaurusExactRate: 99.1,
    fuzzyMatchRate: 96.8,
    embeddingMatchRate: 99.3,
    avgApiLatencyMs: 412,
  },
  isSimulated: false,
};

const mockTechnicalData: ExecutiveAnalyticsData = {
  role: 'ally_technical',
  allyId: 'ally-100',
  allyName: 'Correduría Andina S.A.',
  totalComparisons: 12,
  soldCount: 4,
  conversionRate: 33,
  totalPremium: 60000000,
  activeProspects: 8,
  avgProcessTimeMinutes: 10,
  domainDistribution: [
    { domainId: 'pyme', domainName: 'PYME Multirriesgo', count: 12, percentage: 100 },
  ],
  insurerDistribution: [
    { insurerName: 'SURA', count: 12, percentage: 100 },
  ],
  isSimulated: false,
};

describe('ExecutiveAnalytics Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders executive analytics header with DaaS Ready badge', async () => {
    vi.mocked(analyticsService.getExecutiveAnalytics).mockResolvedValue(mockSuperAdminData);

    render(<ExecutiveAnalytics currentUserRole="super_admin" />);

    await waitFor(() => {
      expect(screen.getByText('Módulo de Analítica Ejecutiva')).toBeTruthy();
      expect(screen.getByText('DaaS Ready')).toBeTruthy();
      expect(screen.getByText('RBAC Multi-Tenant')).toBeTruthy();
    });
  });

  it('allows super_admin to view interactive role switcher tabs and DaaS governance', async () => {
    vi.mocked(analyticsService.getExecutiveAnalytics).mockResolvedValue(mockSuperAdminData);

    render(<ExecutiveAnalytics currentUserRole="super_admin" />);

    await waitFor(() => {
      expect(screen.getByText('Gobernanza de Activos de Datos DaaS (Data as a Service)')).toBeTruthy();
    });

    // Check role switcher buttons exist for audit simulation
    expect(screen.getByRole('button', { name: /super admin/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /admin aliado/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /técnico analista/i })).toBeTruthy();

    // Check DaaS telemetry metrics rendered
    expect(screen.getByText('Cotizaciones Despersonalizadas')).toBeTruthy();
    expect(screen.getByText('420')).toBeTruthy();
  });

  it('locks role and hides role switcher for ally_technical user', async () => {
    vi.mocked(analyticsService.getExecutiveAnalytics).mockResolvedValue(mockTechnicalData);

    render(<ExecutiveAnalytics currentUserRole="ally_technical" />);

    await waitFor(() => {
      expect(screen.getByText('Perfil: Técnico Analista')).toBeTruthy();
    });

    // Role switcher buttons must NOT be present for technical analyst
    expect(screen.queryByRole('button', { name: /^super admin$/i })).toBeNull();
    // DaaS Governance panel must NOT be visible for technical analyst
    expect(screen.queryByText(/Gobernanza de Activos de Datos DaaS/i)).toBeNull();
  });

  it('renders Market Benchmark panel for ally_admin user', async () => {
    const allyAdminData: ExecutiveAnalyticsData = {
      ...mockSuperAdminData,
      role: 'ally_admin',
      aiBenchmarks: undefined,
    };
    vi.mocked(analyticsService.getExecutiveAnalytics).mockResolvedValue(allyAdminData);

    render(<ExecutiveAnalytics currentUserRole="ally_admin" />);

    await waitFor(() => {
      expect(screen.getByText('Perfil: Director de Correduría')).toBeTruthy();
    });

    // Market Benchmark panel is rendered for ally_admin
    expect(screen.getByText(/Benchmark de Mercado DaaS/i)).toBeTruthy();
    expect(screen.getByText('Percentil 25 (Tarifa Competitiva)')).toBeTruthy();
    expect(screen.getByText('Mediana de Mercado (P50)')).toBeTruthy();

    // AI benchmarks are hidden for ally_admin
    expect(screen.queryByText(/Benchmarks Globales del Motor IA Gemini/i)).toBeNull();
  });
});
