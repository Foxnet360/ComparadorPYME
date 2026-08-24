/**
 * Domain-aware insurance taxonomy types for the multiramo platform.
 *
 * `pyme` remains the default domain everywhere for 100% backward compatibility.
 * `autos` is the first additional domain and is opt-in via the analyze contract.
 */

export const INSURANCE_DOMAINS = [
  'pyme',
  'autos',
  'copropiedades',
  'vida_grupo',
  'salud',
  'cumplimiento',
  'transporte',
  'hogar',
] as const;

export type InsuranceDomain = (typeof INSURANCE_DOMAINS)[number];

export interface CoverageCategory {
  /** Numeric or string identifier. Existing PYME taxonomy uses numeric ids. */
  id: number | string;
  name: string;
  section?: string;
  isRequired?: boolean;
  /** Preferred synonym list for new taxonomies (e.g. autos, copropiedades, vida_grupo). */
  synonyms?: string[];
  /** Legacy alias list used by the existing PYME taxonomy. */
  aliases?: string[];
}

export interface DomainTaxonomyMetadata {
  region: string;
  currency: string;
  salaryReference?: string;
  salaryValue2024?: number;
  uvtValue2024?: number;
  source?: string;
}

export interface DomainTaxonomy {
  version: string;
  domain: InsuranceDomain;
  metadata: DomainTaxonomyMetadata;
  categories: CoverageCategory[];
}

export interface DomainTaxonomyRegistry {
  getTaxonomy(domain: InsuranceDomain): DomainTaxonomy;
  getCanonicalNames(domain: InsuranceDomain): readonly string[];
}

export function isInsuranceDomain(value: unknown): value is InsuranceDomain {
  return (
    value === 'pyme' ||
    value === 'autos' ||
    value === 'copropiedades' ||
    value === 'vida_grupo' ||
    value === 'salud' ||
    value === 'cumplimiento' ||
    value === 'transporte' ||
    value === 'hogar'
  );
}
