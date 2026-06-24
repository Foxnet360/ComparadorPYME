/**
 * Single source of truth for Colombian insurance domain constants.
 *
 * Runtime values come from environment variables (SMMLV_VALUE / UVT_VALUE).
 * The canonical coverage list and offline documentation come from
 * data/domains/{domain}/taxonomy.json.
 */

import { env } from './env';
import { loadDomainJson } from '../services/domainBundleLoader';

export interface DomainConstants {
  smmlv: number;
  uvt: number;
  currency: 'COP';
  canonicalCoverageNames: readonly string[];
  premiumRange: { min: number; max: number };
}

interface TaxonomyCategory {
  id: number;
  name: string;
  aliases?: string[];
}

interface TaxonomyJson {
  version: string;
  domain: string;
  metadata: {
    region: string;
    currency: string;
    salaryReference?: string;
    salaryValue2024?: number;
    uvtValue2024?: number;
    source?: string;
  };
  categories: TaxonomyCategory[];
}

const DEFAULT_PREMIUM_RANGE = { min: 100_000, max: 500_000_000 };
const cache = new Map<string, DomainConstants>();

export function getDomainConstants(domain: string = 'pyme'): DomainConstants {
  const cached = cache.get(domain);
  if (cached) return cached;

  const taxonomy = loadDomainJson<TaxonomyJson>(domain, 'taxonomy.json');
  const canonicalCoverageNames = taxonomy.categories.map((c) => c.name);

  const constants: DomainConstants = {
    smmlv: env.SMMLV_VALUE,
    uvt: env.UVT_VALUE,
    currency: (env.CURRENCY as 'COP') || 'COP',
    canonicalCoverageNames,
    premiumRange: DEFAULT_PREMIUM_RANGE,
  };

  cache.set(domain, constants);
  return constants;
}

export function getCanonicalCoverageNames(domain: string = 'pyme'): readonly string[] {
  return getDomainConstants(domain).canonicalCoverageNames;
}

export function getCanonicalCoverageName(domain: string = 'pyme', index: number): string {
  const names = getCanonicalCoverageNames(domain);
  if (index < 0 || index >= names.length) {
    throw new Error(
      `Canonical coverage index ${index} is out of range for domain "${domain}" (count: ${names.length})`
    );
  }
  return names[index];
}

export function resolveValueToCOP(
  value: number,
  unit?: 'SMMLV' | 'UVT' | 'COP' | null,
  constants?: DomainConstants
): number {
  const effective = constants ?? getDomainConstants();

  if (!unit) return value;

  const u = unit.toUpperCase().trim();
  if (u === 'SMMLV' || u === 'SM') return value * effective.smmlv;
  if (u === 'UVT') return value * effective.uvt;
  return value;
}

export function getPremiumRange(domain: string = 'pyme'): { min: number; max: number } {
  return getDomainConstants(domain).premiumRange;
}
