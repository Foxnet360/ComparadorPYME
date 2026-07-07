/**
 * Deductible Resolver Service
 * Resolves deductibles using coverage type + general deductibles
 */

// Coverage types that typically have no deductible
const NO_DEDUCTIBLE_COVERAGES = [
  'Asistencia PYME',
  'Asistencia Legal',
  'Asistencia Domiciliaria',
  'Servicio de Asistencia',
  'Ciberlex',
  'Asesoría Legal',
  'Asesoría Tributaria',
  'Asesoría Integral',
  'Servicio de Grua',
  'Asistencia Informática',
  'Servicio PYME',
  'Asistencia',
  'Servicio',
];

/**
 * Determine if a coverage is a service-type coverage (no deductible)
 */
export function isServiceCoverage(coverageName: string): boolean {
  return NO_DEDUCTIBLE_COVERAGES.some((service) =>
    coverageName.toLowerCase().includes(service.toLowerCase())
  );
}

/**
 * Find matching general deductible for a coverage
 */
export function findGeneralDeductible(
  coverageName: string,
  generalDeductibles?: Array<{ appliesTo: string; deductibleText: string }>
): string | null {
  if (!generalDeductibles || generalDeductibles.length === 0) {
    return null;
  }

  const matchingGeneral = generalDeductibles.find((gd) => {
    const appliesTo = gd.appliesTo.toLowerCase();
    const coverage = coverageName.toLowerCase();

    // Check for direct match or partial match
    return (
      coverage.includes(appliesTo) ||
      appliesTo.includes(coverage) ||
      // Common mappings
      (appliesTo.includes('amparos basicos') && coverage.includes('incendio')) ||
      (appliesTo.includes('daños materiales') && coverage.includes('incendio')) ||
      (appliesTo.includes('responsabilidad civil') && coverage.includes('rc')) ||
      (appliesTo.includes('responsabilidad civil') && coverage.includes('rce'))
    );
  });

  return matchingGeneral ? matchingGeneral.deductibleText : null;
}

/**
 * Get intelligent deductible fallback based on coverage type and general deductibles
 */
export function getDeductibleFallback(
  coverageName: string,
  generalDeductibles?: Array<{ appliesTo: string; deductibleText: string }>
): string {
  // Service coverages typically have no deductible
  if (isServiceCoverage(coverageName)) {
    return 'No aplica';
  }

  // Try to find matching general deductible
  const generalDeductible = findGeneralDeductible(coverageName, generalDeductibles);
  if (generalDeductible) {
    return generalDeductible;
  }

  // Default fallback for material coverages
  return 'NO ESPECIFICADO';
}
