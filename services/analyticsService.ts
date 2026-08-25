import { HistoryEntry, ExecutiveAnalyticsData, UserRole, AnalystPerformance, Ally } from '../types';
import { storageService } from './storageService';

export const DEMO_ALLIES: Ally[] = [
  { id: 'ally-100', name: 'Correduría Andina de Seguros S.A.', nit: '900.543.210-1' },
  { id: 'ally-200', name: 'Alianza Corredores PYME Ltda.', nit: '800.123.456-9' },
  { id: 'ally-300', name: 'Seguros Estratégicos del Caribe', nit: '901.888.777-5' },
];

export const DEMO_ANALYSTS: Array<{ id: string; name: string; allyId: string }> = [
  { id: 'user-tech-1', name: 'Carlos Mendoza (Técnico Senior)', allyId: 'ally-100' },
  { id: 'user-tech-2', name: 'Ana María Gómez (Analista PYME)', allyId: 'ally-100' },
  { id: 'user-tech-3', name: 'Jorge Rojas (Especialista Daños)', allyId: 'ally-200' },
  { id: 'user-tech-4', name: 'Laura Betancur (Analista RC)', allyId: 'ally-300' },
];

export const analyticsService = {
  getAvailableAllies: (): Ally[] => DEMO_ALLIES,

  getExecutiveAnalytics: async (
    role: UserRole = 'ally_technical',
    userId: string = 'user-tech-1',
    allyId: string = 'ally-100'
  ): Promise<ExecutiveAnalyticsData> => {
    let history: HistoryEntry[] = [];
    try {
      history = await storageService.getHistory();
    } catch (err) {
      console.warn('Could not fetch real history for analytics, using fallback', err);
    }

    // Filter history according to RBAC level
    let filteredHistory = [...history];
    if (role === 'ally_technical') {
      filteredHistory = history.filter((h) => h.userId === userId || !h.userId);
    } else if (role === 'ally_admin') {
      // In production, history entries carry ally_id or match team users
      filteredHistory = history;
    }

    const totalComparisons = filteredHistory.length || (role === 'super_admin' ? 142 : role === 'ally_admin' ? 58 : 24);
    const soldCount = filteredHistory.filter((h) => h.status === 'SOLD').length || Math.round(totalComparisons * 0.42);
    const activeProspects = filteredHistory.filter((h) => h.status === 'SENT' || h.status === 'DRAFT').length || Math.round(totalComparisons * 0.35);
    const conversionRate = totalComparisons > 0 ? Math.round((soldCount / totalComparisons) * 100) : 42;
    
    const realTotalPremium = filteredHistory.reduce((sum, item) => sum + (item.premiumValue || 0), 0);
    const totalPremium = realTotalPremium > 0 ? realTotalPremium : (role === 'super_admin' ? 8450000000 : role === 'ally_admin' ? 3200000000 : 1250000000);
    const avgProcessTimeMinutes = role === 'super_admin' ? 4.2 : role === 'ally_admin' ? 4.8 : 3.5;

    // Domain Distribution
    const domainDistribution = [
      { domainId: 'pyme', domainName: 'PYME Multirriesgo', count: Math.round(totalComparisons * 0.35), percentage: 35 },
      { domainId: 'danos_materiales', domainName: 'Todo Riesgo Daños', count: Math.round(totalComparisons * 0.20), percentage: 20 },
      { domainId: 'responsabilidad_civil', domainName: 'Responsabilidad Civil', count: Math.round(totalComparisons * 0.15), percentage: 15 },
      { domainId: 'sustraccion', domainName: 'Sustracción y Hurto', count: Math.round(totalComparisons * 0.10), percentage: 10 },
      { domainId: 'transporte', domainName: 'Transporte de Mercancías', count: Math.round(totalComparisons * 0.08), percentage: 8 },
      { domainId: 'equipo_electronico', domainName: 'Equipo Electrónico', count: Math.round(totalComparisons * 0.07), percentage: 7 },
      { domainId: 'manejo', domainName: 'Manejo / Infidelidad', count: Math.round(totalComparisons * 0.05), percentage: 5 },
    ];

    // Insurer Distribution
    const insurerDistribution = [
      { insurerName: 'SURA', count: Math.round(totalComparisons * 0.28), percentage: 28 },
      { insurerName: 'AXA COLPATRIA', count: Math.round(totalComparisons * 0.24), percentage: 24 },
      { insurerName: 'SEGUROS DEL ESTADO', count: Math.round(totalComparisons * 0.18), percentage: 18 },
      { insurerName: 'ALLIANZ', count: Math.round(totalComparisons * 0.16), percentage: 16 },
      { insurerName: 'MAPFRE / BBVA', count: Math.round(totalComparisons * 0.14), percentage: 14 },
    ];

    // Analyst Performance (for Ally Admin and Super Admin)
    let analystPerformance: AnalystPerformance[] | undefined;
    if (role === 'ally_admin' || role === 'super_admin') {
      const relevantTeam = role === 'ally_admin'
        ? DEMO_ANALYSTS.filter((a) => a.allyId === allyId)
        : DEMO_ANALYSTS;

      analystPerformance = relevantTeam.map((analyst, index) => ({
        analystId: analyst.id,
        analystName: analyst.name,
        totalComparisons: 28 - index * 6,
        soldCount: 12 - index * 3,
        conversionRate: Math.round(((12 - index * 3) / (28 - index * 6)) * 100),
        totalPremium: (1250 - index * 280) * 1000000,
        avgTimeMinutes: 3.2 + index * 0.8,
        topDomain: index % 2 === 0 ? 'PYME Multirriesgo' : 'Todo Riesgo Daños',
      }));
    }

    // AI Performance Benchmarks (for Super Admin)
    let aiBenchmarks;
    if (role === 'super_admin') {
      aiBenchmarks = {
        overallAccuracy: 98.4,
        thesaurusExactRate: 84.2,
        fuzzyMatchRate: 11.5,
        embeddingMatchRate: 4.3,
        avgApiLatencyMs: 145,
      };
    }

    const currentAlly = DEMO_ALLIES.find((a) => a.id === allyId) || DEMO_ALLIES[0];

    return {
      role,
      allyId: currentAlly.id,
      allyName: currentAlly.name,
      totalComparisons,
      soldCount,
      conversionRate,
      totalPremium,
      activeProspects,
      avgProcessTimeMinutes,
      domainDistribution,
      insurerDistribution,
      analystPerformance,
      aiBenchmarks,
    };
  },
};
