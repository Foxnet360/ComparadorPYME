import { describe, it, expect } from 'vitest';
import { auditPremiumEquation } from '../premiumAuditor';

describe('auditPremiumEquation', () => {
  it('should validate exact breakdown matching total payable', () => {
    const premium = {
      netPremium: 10000000,
      fees: 100000,
      taxes: 1919000, // 19% of (10M + 100k)
      totalPayable: 12019000,
    };

    const result = auditPremiumEquation(premium, 'Seguros del Estado');
    expect(result.isValid).toBe(true);
    expect(result.discrepancy).toBe(0);
    expect(result.alert).toBeUndefined();
  });

  it('should accept slight rounding differences within tolerance', () => {
    const premium = {
      netPremium: 5000000,
      fees: 50000,
      taxes: 959500,
      totalPayable: 6009550, // Diff of 50 COP (cents rounding)
    };

    const result = auditPremiumEquation(premium, 'SURA', { toleranceCOP: 100 });
    expect(result.isValid).toBe(true);
    expect(result.discrepancy).toBe(50);
    expect(result.alert).toBeUndefined();
  });

  it('should flag discrepancy and generate warning when difference exceeds tolerance', () => {
    const premium = {
      netPremium: 10000000,
      fees: 100000,
      taxes: 1919000,
      totalPayable: 12150000, // 131.000 COP higher (e.g. estampilla pro-cultura)
    };

    const result = auditPremiumEquation(premium, 'Bolívar');
    expect(result.isValid).toBe(false);
    expect(result.discrepancy).toBe(131000);
    expect(result.alert).toBeDefined();
    expect(result.alert?.level).toBe('WARNING');
    expect(result.alert?.title).toContain('Bolívar');
    expect(result.alert?.description).toContain('estampillas departamentales');
  });

  it('should handle missing or zero total gracefully without crashing', () => {
    const result = auditPremiumEquation(null, 'Chubb');
    expect(result.isValid).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.discrepancy).toBe(0);
  });
});
