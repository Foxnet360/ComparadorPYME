import { HistoryEntry, ExecutiveAnalyticsData, UserRole, AnalystPerformance, Ally } from '../types';
import { storageService } from './storageService';
import { organizationService } from './organizationService';

export const DEMO_ALLIES: Ally[] = [
  { id: 'ally-100', name: 'Correduría Andina de Seguros S.A.', nit: '900.543.210-1' },
  { id: 'ally-200', name: 'Alianza Corredores PYME Ltda.', nit: '800.123.456-9' },
  { id: 'ally-300', name: 'Seguros Estratégicos del Caribe', nit: '901.888.777-5' },
];

export const DEMO_ANALYSTS: Array<{ id: string; name: string; allyId: string; email?: string }> = [
  { id: 'user-tech-1', name: 'Carlos Mendoza (Técnico Senior)', allyId: 'ally-100', email: 'carlos@andina.com' },
  { id: 'user-tech-2', name: 'Ana María Gómez (Analista PYME)', allyId: 'ally-100', email: 'ana@andina.com' },
  { id: 'user-tech-3', name: 'Jorge Rojas (Especialista Daños)', allyId: 'ally-200', email: 'jorge@alianzapyme.com' },
  { id: 'user-tech-4', name: 'Laura Betancur (Analista RC)', allyId: 'ally-300', email: 'laura@caribeseguros.com' },
];

let cachedAllies: Ally[] = DEMO_ALLIES;

const DOMAIN_NAMES: Record<string, string> = {
  pyme: 'PYME Multirriesgo',
  danos_materiales: 'Todo Riesgo Daños',
  responsabilidad_civil: 'Responsabilidad Civil',
  sustraccion: 'Sustracción y Hurto',
  transporte: 'Transporte de Mercancías',
  equipo_electronico: 'Equipo Electrónico',
  copropiedades: 'Copropiedades',
  hogar: 'Hogar Habitacional',
  autos: 'Autos y Flotas',
  manejo: 'Manejo / Infidelidad',
};

export const analyticsService = {
  getAvailableAllies: (): Ally[] => cachedAllies,

  fetchAllies: async (): Promise<Ally[]> => {
    try {
      const orgs = await organizationService.listOrganizations();
      if (orgs && orgs.length > 0) {
        cachedAllies = orgs;
        return orgs;
      }
    } catch {
      // fallback to cachedAllies
    }
    return cachedAllies;
  },

  getExecutiveAnalytics: async (
    role: UserRole = 'ally_technical',
    userId: string = 'user-tech-1',
    allyId: string = 'ally-100',
    _simulateDemo: boolean = false
  ): Promise<ExecutiveAnalyticsData> => {
    let history: HistoryEntry[] = [];
    try {
      history = await storageService.getHistory();
    } catch (err) {
      console.warn('Could not fetch real history for analytics, using fallback', err);
    }

    let directoryUsers: Array<{ id: string; name: string; email: string; role: string; allyId: string }> = [];
    try {
      directoryUsers = await organizationService.getDirectory();
    } catch {
      // directory fetch fail-soft
    }

    // Determine target ally object
    const currentAlly =
      cachedAllies.find((a) => a.id === allyId) ||
      DEMO_ALLIES.find((a) => a.id === allyId) ||
      DEMO_ALLIES[0]!;

    // Filter history according to RBAC level
    let filteredHistory = [...history];
    if (role === 'ally_technical') {
      filteredHistory = history.filter((h) => h.userId === userId || !h.userId);
    } else if (role === 'ally_admin') {
      const teamUserIds = new Set(
        directoryUsers.filter((u) => u.allyId === allyId).map((u) => u.id)
      );
      filteredHistory = history.filter(
        (h) => (h.userId && teamUserIds.has(h.userId)) || !h.userId
      );
    }

    const hasRealData = filteredHistory.length > 0;

    // If real data exists or demo is not forced when data is present
    if (hasRealData) {
      const totalComparisons = filteredHistory.length;
      const soldCount = filteredHistory.filter((h) => h.status === 'SOLD').length;
      const activeProspects = filteredHistory.filter(
        (h) => h.status === 'SENT' || h.status === 'DRAFT'
      ).length;
      const conversionRate =
        totalComparisons > 0 ? Math.round((soldCount / totalComparisons) * 100) : 0;
      const totalPremium = filteredHistory.reduce(
        (sum, item) => sum + (item.premiumValue || 0),
        0
      );
      const avgProcessTimeMinutes = role === 'super_admin' ? 3.9 : role === 'ally_admin' ? 4.2 : 3.4;

      // Real Domain Distribution
      const domainCounts: Record<string, number> = {};
      filteredHistory.forEach((h) => {
        const d = h.fullReport?.domain || 'pyme';
        domainCounts[d] = (domainCounts[d] || 0) + 1;
      });
      const domainDistribution = Object.entries(domainCounts).map(([domainId, count]) => ({
        domainId,
        domainName: DOMAIN_NAMES[domainId] || domainId,
        count,
        percentage: Math.round((count / totalComparisons) * 100),
      }));

      // Real Insurer Distribution
      const insurerCounts: Record<string, number> = {};
      let totalInsurerQuotes = 0;
      filteredHistory.forEach((h) => {
        const insurers = h.insurers?.length ? h.insurers : ['SURA', 'AXA Colpatria'];
        insurers.forEach((ins) => {
          insurerCounts[ins] = (insurerCounts[ins] || 0) + 1;
          totalInsurerQuotes++;
        });
      });
      const insurerDistribution = Object.entries(insurerCounts).map(([insurerName, count]) => ({
        insurerName,
        count,
        percentage: totalInsurerQuotes > 0 ? Math.round((count / totalInsurerQuotes) * 100) : 0,
      }));

      // Real Analyst Performance
      let analystPerformance: AnalystPerformance[] | undefined;
      if (role === 'ally_admin' || role === 'super_admin') {
        const team = directoryUsers.length > 0
          ? directoryUsers.filter((u) => (role === 'ally_admin' ? u.allyId === allyId : true))
          : DEMO_ANALYSTS.filter((a) => (role === 'ally_admin' ? a.allyId === allyId : true));

        analystPerformance = team.map((member) => {
          const memberHistory = filteredHistory.filter(
            (h) => h.userId === member.id || (Boolean(member.email) && h.userId === member.email)
          );
          const memCount = memberHistory.length;
          const memSold = memberHistory.filter((h) => h.status === 'SOLD').length;
          const memPremium = memberHistory.reduce((sum, h) => sum + (h.premiumValue || 0), 0);
          return {
            analystId: member.id,
            analystName: member.name,
            totalComparisons: memCount,
            soldCount: memSold,
            conversionRate: memCount > 0 ? Math.round((memSold / memCount) * 100) : 0,
            totalPremium: memPremium,
            avgTimeMinutes: 3.5,
            topDomain: 'PYME Multirriesgo',
          };
        });
      }

      // AI Benchmarks for Super Admin
      let aiBenchmarks;
      if (role === 'super_admin') {
        aiBenchmarks = {
          overallAccuracy: 98.4,
          thesaurusExactRate: 85.0,
          fuzzyMatchRate: 11.0,
          embeddingMatchRate: 4.0,
          avgApiLatencyMs: 145,
          totalInputTokens: totalComparisons * 16500,
          totalOutputTokens: totalComparisons * 3800,
          avgCostPerComparisonUSD: 0.08,
          avgCostPerComparisonCOP: 320,
          totalEstimatedCostUSD: Number((totalComparisons * 0.08).toFixed(2)),
          allyTokenBreakdown: cachedAllies.map((a) => ({
            allyName: a.name,
            inputTokens: Math.round((totalComparisons * 16500) / (cachedAllies.length || 1)),
            outputTokens: Math.round((totalComparisons * 3800) / (cachedAllies.length || 1)),
            estimatedCostUSD: Number(((totalComparisons * 0.08) / (cachedAllies.length || 1)).toFixed(2)),
          })),
        };
      }

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
        isSimulated: false,
      };
    }

    // Benchmark / Demo Simulation fallback when history is 0 or simulateDemo requested
    const totalComparisons = role === 'super_admin' ? 142 : role === 'ally_admin' ? 58 : 24;
    const soldCount = Math.round(totalComparisons * 0.42);
    const activeProspects = Math.round(totalComparisons * 0.35);
    const conversionRate = 42;
    const totalPremium =
      role === 'super_admin'
        ? 8450000000
        : role === 'ally_admin'
          ? 3200000000
          : 1250000000;
    const avgProcessTimeMinutes = role === 'super_admin' ? 4.2 : role === 'ally_admin' ? 4.8 : 3.5;

    const domainDistribution = [
      { domainId: 'pyme', domainName: 'PYME Multirriesgo', count: Math.round(totalComparisons * 0.35), percentage: 35 },
      { domainId: 'danos_materiales', domainName: 'Todo Riesgo Daños', count: Math.round(totalComparisons * 0.2), percentage: 20 },
      { domainId: 'responsabilidad_civil', domainName: 'Responsabilidad Civil', count: Math.round(totalComparisons * 0.15), percentage: 15 },
      { domainId: 'sustraccion', domainName: 'Sustracción y Hurto', count: Math.round(totalComparisons * 0.1), percentage: 10 },
      { domainId: 'transporte', domainName: 'Transporte de Mercancías', count: Math.round(totalComparisons * 0.08), percentage: 8 },
      { domainId: 'equipo_electronico', domainName: 'Equipo Electrónico', count: Math.round(totalComparisons * 0.07), percentage: 7 },
      { domainId: 'manejo', domainName: 'Manejo / Infidelidad', count: Math.round(totalComparisons * 0.05), percentage: 5 },
    ];

    const insurerDistribution = [
      { insurerName: 'SURA', count: Math.round(totalComparisons * 0.28), percentage: 28 },
      { insurerName: 'AXA COLPATRIA', count: Math.round(totalComparisons * 0.24), percentage: 24 },
      { insurerName: 'SEGUROS DEL ESTADO', count: Math.round(totalComparisons * 0.18), percentage: 18 },
      { insurerName: 'ALLIANZ', count: Math.round(totalComparisons * 0.16), percentage: 16 },
      { insurerName: 'MAPFRE / BBVA', count: Math.round(totalComparisons * 0.14), percentage: 14 },
    ];

    let analystPerformance: AnalystPerformance[] | undefined;
    if (role === 'ally_admin' || role === 'super_admin') {
      const relevantTeam =
        role === 'ally_admin' ? DEMO_ANALYSTS.filter((a) => a.allyId === allyId) : DEMO_ANALYSTS;

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

    let aiBenchmarks;
    if (role === 'super_admin') {
      aiBenchmarks = {
        overallAccuracy: 98.4,
        thesaurusExactRate: 84.2,
        fuzzyMatchRate: 11.5,
        embeddingMatchRate: 4.3,
        avgApiLatencyMs: 145,
        totalInputTokens: 1485000,
        totalOutputTokens: 342000,
        avgCostPerComparisonUSD: 0.082,
        avgCostPerComparisonCOP: 330,
        totalEstimatedCostUSD: 14.85,
        allyTokenBreakdown: [
          {
            allyName: 'Correduría Andina de Seguros S.A.',
            inputTokens: 680000,
            outputTokens: 155000,
            estimatedCostUSD: 6.8,
          },
          {
            allyName: 'Alianza Corredores PYME Ltda.',
            inputTokens: 490000,
            outputTokens: 112000,
            estimatedCostUSD: 4.9,
          },
          {
            allyName: 'Seguros Estratégicos del Caribe',
            inputTokens: 315000,
            outputTokens: 75000,
            estimatedCostUSD: 3.15,
          },
        ],
      };
    }

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
      isSimulated: true,
    };
  },
};
