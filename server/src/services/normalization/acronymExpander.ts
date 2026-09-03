/**
 * Colombian Insurance Acronym Expander
 * Normalizes common acronyms, abbreviations, and shorthand codes
 * used across policy quotes and coverage descriptions in Colombia.
 */

const ACRONYM_DICTIONARY: Record<string, string> = {
  // General & Patrimoniales / PYME
  'HMACC-AMIT': 'Huelga, Motín, Asonada, Conmoción Civil y Actos Malintencionados de Terceros',
  HMACC: 'Huelga, Motín, Asonada y Conmoción Civil',
  AMIT: 'Actos Malintencionados de Terceros',
  HMA: 'Huelga, Motín y Asonada',
  RCE: 'Responsabilidad Civil Extracontractual',
  RC: 'Responsabilidad Civil',
  PL: 'Predios, Labores y Operaciones',
  PLO: 'Predios, Labores y Operaciones',

  // Copropiedades
  'RCE PROCESO CIVIL':
    'Responsabilidad Civil Extracontractual en Proceso Civil y Gastos de Defensa',
  'RC PROCESO CIVIL': 'Responsabilidad Civil en Proceso Civil',
  'RCE PARQUEADEROS': 'Responsabilidad Civil Extracontractual Vehículos en Parqueaderos',
  'RC PARQUEADEROS': 'Responsabilidad Civil Vehículos en Parqueaderos',
  'LUCRO CESANTE':
    'Lucro Cesante / Pérdida de Cánones de Arrendamiento y Gastos Adicionales de Alojamiento',

  // Autos
  SOAT: 'Seguro Obligatorio de Accidentes de Tránsito',
  'PT DAÑOS': 'Pérdida Total por Daños Materiales',
  'PP DAÑOS': 'Pérdida Parcial por Daños Materiales',
  'PT HURTO': 'Pérdida Total por Hurto / Sustracción',
  'PP HURTO': 'Pérdida Parcial por Hurto / Sustracción',
  'RCE VEHICULOS': 'Responsabilidad Civil Extracontractual Vehículos',

  // Cumplimiento
  BMA: 'Buen Manejo y Correcta Inversión del Anticipo',
  ANTICIPO: 'Buen Manejo y Correcta Inversión del Anticipo',
  CUMPLIMIENTO: 'Cumplimiento del Contrato',
  SPS: 'Salarios, Prestaciones Sociales e Indemnizaciones',
  'SALARIOS Y PRESTACIONES': 'Salarios, Prestaciones Sociales e Indemnizaciones',
  'CALIDAD SERVICIO': 'Calidad del Servicio Prestado',

  // Transporte
  ST: 'Seguro de Transporte de Mercancías',
  TN: 'Trayecto Nacional',
  TI: 'Trayecto Internacional',
  URBANO: 'Trayecto Urbano y Metropolitano',

  // Salud & Vida
  IPTP: 'Incapacidad Total y Permanente',
  MA: 'Muerte Accidental y Desmembración',
  AMP: 'Anexo Maternidad y Parto',
  EGM: 'Enfermedades Graves Mayores',
};

/**
 * Expands known insurance acronyms in a raw coverage name.
 * If an exact match or key acronym phrase is present, returns the expanded string.
 */
export function expandAcronyms(coverageName: string): string {
  if (!coverageName || coverageName.trim().length === 0) return coverageName;

  const trimmed = coverageName.trim();
  const upper = trimmed.toUpperCase();

  // 1. Direct exact lookup
  if (ACRONYM_DICTIONARY[upper]) {
    return ACRONYM_DICTIONARY[upper];
  }

  // 2. Token / phrase replacement
  let expanded = trimmed;
  for (const [acronym, fullMeaning] of Object.entries(ACRONYM_DICTIONARY)) {
    // Only replace standalone acronym words (using word boundaries)
    const regex = new RegExp(`\\b${acronym}\\b`, 'gi');
    if (regex.test(expanded) && acronym.length > 2) {
      expanded = expanded.replace(regex, fullMeaning);
    }
  }

  return expanded;
}

export const acronymExpander = {
  expand: expandAcronyms,
};
