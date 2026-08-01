/**
 * Domain taxonomy registry.
 *
 * Wraps the existing `loadDomainJson` / `getDomainConstants` infrastructure so
 * that domain bundles are discovered from `data/domains/{domain}/taxonomy.json`.
 * Unknown domains intentionally fall back to `pyme` with a warning to preserve
 * backward compatibility.
 */

import { loadDomainJson } from './domainBundleLoader';
import { InsuranceDomain, DomainTaxonomy, DomainTaxonomyRegistry } from '../types/domain';

function warnUnknownDomain(value: unknown): void {
  console.warn(`[DomainTaxonomyRegistry] Unknown domain "${value}", falling back to "pyme"`);
}

function resolveDomain(value: InsuranceDomain | string): InsuranceDomain {
  if (
    value === 'pyme' ||
    value === 'autos' ||
    value === 'copropiedades' ||
    value === 'vida_grupo' ||
    value === 'salud' ||
    value === 'cumplimiento' ||
    value === 'transporte'
  )
    return value;
  warnUnknownDomain(value);
  return 'pyme';
}

export const domainTaxonomyRegistry: DomainTaxonomyRegistry = {
  getTaxonomy(domain): DomainTaxonomy {
    const effective = resolveDomain(domain);
    return loadDomainJson<DomainTaxonomy>(effective, 'taxonomy.json');
  },

  getCanonicalNames(domain): readonly string[] {
    const effective = resolveDomain(domain);
    const taxonomy = loadDomainJson<DomainTaxonomy>(effective, 'taxonomy.json');
    return taxonomy.categories.map((category) => category.name);
  },
};

export function isInsuranceDomain(value: unknown): value is InsuranceDomain {
  return (
    value === 'pyme' ||
    value === 'autos' ||
    value === 'copropiedades' ||
    value === 'vida_grupo' ||
    value === 'salud' ||
    value === 'cumplimiento' ||
    value === 'transporte'
  );
}

export function resolveInsuranceDomain(value: unknown): InsuranceDomain {
  if (isInsuranceDomain(value)) return value;
  if (value === undefined || value === null || value === '') return 'pyme';
  warnUnknownDomain(value);
  return 'pyme';
}
