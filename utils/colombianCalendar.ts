export type ContractDurationUnit = 'DIAS_HABILES' | 'DIAS_CALENDARIO' | 'MESES' | 'ANIOS';

export const COLOMBIA_SMMLV_2026 = 1_750_905;

export const COLOMBIA_HOLIDAYS_2026: ReadonlySet<string> = new Set([
  '2026-01-01',
  '2026-01-12',
  '2026-03-23',
  '2026-04-02',
  '2026-04-03',
  '2026-05-01',
  '2026-05-18',
  '2026-06-08',
  '2026-06-15',
  '2026-06-29',
  '2026-07-13',
  '2026-07-20',
  '2026-08-07',
  '2026-08-17',
  '2026-10-12',
  '2026-11-02',
  '2026-11-16',
  '2026-12-08',
  '2026-12-25',
]);

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatIsoDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

export function parseIsoDate(raw?: string | null): Date | null {
  if (!raw) return null;
  const match = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = parseInt(match[1]!, 10);
  const month = parseInt(match[2]!, 10) - 1;
  const day = parseInt(match[3]!, 10);
  const dt = new Date(Date.UTC(year, month, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month || dt.getUTCDate() !== day) {
    return null;
  }
  return dt;
}

function addDaysUtc(date: Date, days: number): Date {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function moveToNextMonday(date: Date): Date {
  const dow = date.getUTCDay();
  if (dow === 1) return date;
  const delta = dow === 0 ? 1 : 8 - dow;
  return addDaysUtc(date, delta);
}

function getEasterSundayUtc(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month, day));
}

const holidayCache = new Map<number, ReadonlySet<string>>();

export function getColombianHolidays(year: number): ReadonlySet<string> {
  if (year === 2026) return COLOMBIA_HOLIDAYS_2026;
  const cached = holidayCache.get(year);
  if (cached) return cached;

  const easter = getEasterSundayUtc(year);
  const fixed = [
    new Date(Date.UTC(year, 0, 1)),
    new Date(Date.UTC(year, 4, 1)),
    new Date(Date.UTC(year, 6, 20)),
    new Date(Date.UTC(year, 7, 7)),
    new Date(Date.UTC(year, 11, 8)),
    new Date(Date.UTC(year, 11, 25)),
  ];
  const emiliani = [
    moveToNextMonday(new Date(Date.UTC(year, 0, 6))),
    moveToNextMonday(new Date(Date.UTC(year, 2, 19))),
    moveToNextMonday(new Date(Date.UTC(year, 5, 29))),
    moveToNextMonday(new Date(Date.UTC(year, 7, 15))),
    moveToNextMonday(new Date(Date.UTC(year, 9, 12))),
    moveToNextMonday(new Date(Date.UTC(year, 10, 1))),
    moveToNextMonday(new Date(Date.UTC(year, 10, 11))),
  ];
  const easterBased = [
    addDaysUtc(easter, -3),
    addDaysUtc(easter, -2),
    moveToNextMonday(addDaysUtc(easter, 39)),
    moveToNextMonday(addDaysUtc(easter, 60)),
    moveToNextMonday(addDaysUtc(easter, 68)),
  ];

  const set = new Set([...fixed, ...emiliani, ...easterBased].map(formatIsoDate));
  holidayCache.set(year, set);
  return set;
}

export function isColombianBusinessDay(date: Date, includeSaturdays = false): boolean {
  const dow = date.getUTCDay();
  if (dow === 0) return false;
  if (dow === 6 && !includeSaturdays) return false;
  const holidays = getColombianHolidays(date.getUTCFullYear());
  return !holidays.has(formatIsoDate(date));
}

export function addContractTerm(
  startIso: string,
  value: number,
  unit: ContractDurationUnit,
  includeSaturdays = false
): string {
  const start = parseIsoDate(startIso);
  if (!start || !Number.isFinite(value) || value <= 0) {
    return startIso;
  }

  if (unit === 'DIAS_CALENDARIO') {
    return formatIsoDate(addDaysUtc(start, Math.round(value)));
  }

  if (unit === 'MESES') {
    const dt = new Date(start.getTime());
    dt.setUTCMonth(dt.getUTCMonth() + Math.round(value));
    return formatIsoDate(dt);
  }

  if (unit === 'ANIOS') {
    const dt = new Date(start.getTime());
    dt.setUTCFullYear(dt.getUTCFullYear() + Math.round(value));
    return formatIsoDate(dt);
  }

  let remaining = Math.round(value);
  let cursor = new Date(start.getTime());
  while (remaining > 0) {
    cursor = addDaysUtc(cursor, 1);
    if (isColombianBusinessDay(cursor, includeSaturdays)) {
      remaining--;
    }
  }
  return formatIsoDate(cursor);
}

function parseAdditionalTermFromRule(rule?: string | null): {
  value: number;
  unit: ContractDurationUnit;
} | null {
  if (!rule) return null;
  const years = rule.match(/(\d+)\s*a[ñn]o/i);
  if (years) return { value: parseInt(years[1]!, 10), unit: 'ANIOS' };
  const months = rule.match(/(\d+)\s*mes/i);
  if (months) return { value: parseInt(months[1]!, 10), unit: 'MESES' };
  const days = rule.match(/(\d+)\s*d[ií]a/i);
  if (days) {
    const isBusiness = /h[áa]bil/i.test(rule);
    return {
      value: parseInt(days[1]!, 10),
      unit: isBusiness ? 'DIAS_HABILES' : 'DIAS_CALENDARIO',
    };
  }
  return null;
}

export function computeCoverageValidityDates(
  contractStartIso: string,
  contractEndIso: string,
  cov: {
    phase?: string | null;
    additionalTermValue?: number | null;
    additionalTermUnit?: ContractDurationUnit | null;
    validityRule?: string | null;
  },
  includeSaturdays = false
): { startDate: string; endDate: string } {
  const startBase = cov.phase === 'POST_CONTRACTUAL' ? contractEndIso : contractStartIso;
  let endDate = contractEndIso;

  if (cov.additionalTermValue && cov.additionalTermUnit) {
    endDate = addContractTerm(
      contractEndIso,
      cov.additionalTermValue,
      cov.additionalTermUnit,
      includeSaturdays
    );
  } else if (cov.validityRule) {
    const parsed = parseAdditionalTermFromRule(cov.validityRule);
    if (parsed) {
      endDate = addContractTerm(contractEndIso, parsed.value, parsed.unit, includeSaturdays);
    }
  }

  return { startDate: startBase, endDate };
}
