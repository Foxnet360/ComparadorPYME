import { describe, it, expect } from 'vitest';
import {
  COLOMBIA_HOLIDAYS_2026,
  COLOMBIA_SMMLV_2026,
  addContractTerm,
  computeCoverageValidityDates,
  isColombianBusinessDay,
  parseIsoDate,
  resolveContractStartDate,
} from '../colombianCalendar';

describe('colombianCalendar (2026)', () => {
  it('defines official 2026 SMMLV and all 19 official 2026 holidays', () => {
    expect(COLOMBIA_SMMLV_2026).toBe(1_750_905);
    expect(COLOMBIA_HOLIDAYS_2026.size).toBe(19);
    expect(COLOMBIA_HOLIDAYS_2026.has('2026-04-02')).toBe(true); // Jueves Santo
    expect(COLOMBIA_HOLIDAYS_2026.has('2026-04-03')).toBe(true); // Viernes Santo
    expect(COLOMBIA_HOLIDAYS_2026.has('2026-07-13')).toBe(true);
  });

  it('skips weekends and Colombian 2026 holidays for DIAS_HABILES (L-V default vs Saturdays)', () => {
    // 2026-04-01 (Wednesday) + 3 business days L-V skips Apr 2 (Thu), Apr 3 (Fri), Apr 4 (Sat), Apr 5 (Sun)
    // -> 1st=Apr 6 (Mon), 2nd=Apr 7 (Tue), 3rd=Apr 8 (Wed)
    expect(addContractTerm('2026-04-01', 3, 'DIAS_HABILES', false)).toBe('2026-04-08');

    // With Saturdays included: 1st=Apr 4 (Sat), 2nd=Apr 6 (Mon), 3rd=Apr 7 (Tue)
    expect(addContractTerm('2026-04-01', 3, 'DIAS_HABILES', true)).toBe('2026-04-07');
    expect(isColombianBusinessDay(parseIsoDate('2026-04-04')!, true)).toBe(true);
    expect(isColombianBusinessDay(parseIsoDate('2026-04-04')!, false)).toBe(false);
  });

  it('adds calendar days accurately without skipping holidays', () => {
    expect(addContractTerm('2026-04-01', 5, 'DIAS_CALENDARIO')).toBe('2026-04-06');
  });

  it('falls back to contract signature date when explicit start date is absent', () => {
    expect(resolveContractStartDate(null, '2026-03-10', '2026-11-26')).toEqual({
      date: '2026-03-10',
      source: 'FIRMA',
    });
    expect(resolveContractStartDate(null, null, '2026-11-26')).toEqual({
      date: '2026-11-26',
      source: 'HOY',
    });
  });

  it('computes POST_CONTRACTUAL quality validity starting from contractEndDate', () => {
    const dates = computeCoverageValidityDates('2026-02-01', '2026-08-01', {
      phase: 'POST_CONTRACTUAL',
      additionalTermValue: 1,
      additionalTermUnit: 'ANIOS',
    });
    expect(dates).toEqual({ startDate: '2026-08-01', endDate: '2027-08-01' });
  });
});
