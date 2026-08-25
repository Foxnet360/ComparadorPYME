import { describe, it, expect } from 'vitest';
import { analyticsService } from '../../../services/analyticsService';

describe('analyticsService', () => {
  it('returns available demo allies', () => {
    const allies = analyticsService.getAvailableAllies();
    expect(allies).toHaveLength(3);
    expect(allies[0].name).toContain('Correduría Andina');
  });

  it('calculates executive analytics for super_admin role', async () => {
    const data = await analyticsService.getExecutiveAnalytics('super_admin', 'user-1', 'ally-100');
    expect(data.role).toBe('super_admin');
    expect(data.totalComparisons).toBeGreaterThan(0);
    expect(data.conversionRate).toBeGreaterThan(0);
    expect(data.aiBenchmarks).toBeDefined();
    expect(data.aiBenchmarks?.overallAccuracy).toBe(98.4);
    expect(data.analystPerformance).toBeDefined();
  });

  it('calculates executive analytics for ally_admin role', async () => {
    const data = await analyticsService.getExecutiveAnalytics('ally_admin', 'user-1', 'ally-100');
    expect(data.role).toBe('ally_admin');
    expect(data.allyId).toBe('ally-100');
    expect(data.analystPerformance).toBeDefined();
    expect(data.aiBenchmarks).toBeUndefined();
  });

  it('calculates executive analytics for ally_technical role', async () => {
    const data = await analyticsService.getExecutiveAnalytics('ally_technical', 'user-tech-1', 'ally-100');
    expect(data.role).toBe('ally_technical');
    expect(data.analystPerformance).toBeUndefined();
    expect(data.aiBenchmarks).toBeUndefined();
  });
});
