/**
 * Coverage Value Range Validation
 * Prevents absurd values like "25 pesos" for RC or Incendio
 */

export interface CoverageRange {
  min: number;
  max: number;
  unit: 'COP' | 'SMMLV' | 'percentage';
}

// Minimum values in COP for PYME coverages (based on market standards)
const MIN_VALUES: Record<string, number> = {
  'Incendio (Edificio y Contenidos)': 100_000_000, // 100M COP
  'Responsabilidad Civil (RCE)': 100_000_000, // 100M COP
  'Sustracción / Hurto': 50_000_000, // 50M COP
  'Equipo Eléctrico y Electrónico': 30_000_000, // 30M COP
  'Rotura de Maquinaria': 30_000_000, // 30M COP
  'Transporte de Mercancías': 20_000_000, // 20M COP
  'Transporte de Valores': 20_000_000, // 20M COP
  'Lucro Cesante': 20_000_000, // 20M COP
  'Terremoto y Eventos Catastróficos': 50_000_000, // 50M COP
  'Vidrios Planos': 5_000_000, // 5M COP
  'Huelga, Motín, Asonada (HMACC)': 20_000_000, // 20M COP
  'Manejo Global / Infidelidad': 10_000_000, // 10M COP
  'Asistencia PYME': 0, // Service coverage - no minimum
  'Asistencia Legal': 0, // Service coverage - no minimum
};

// Maximum reasonable values in COP
const MAX_VALUES: Record<string, number> = {
  'Incendio (Edificio y Contenidos)': 50_000_000_000, // 50B COP
  'Responsabilidad Civil (RCE)': 10_000_000_000, // 10B COP
  'Sustracción / Hurto': 5_000_000_000, // 5B COP
  'Equipo Eléctrico y Electrónico': 5_000_000_000, // 5B COP
  'Rotura de Maquinaria': 5_000_000_000, // 5B COP
  'Transporte de Mercancías': 2_000_000_000, // 2B COP
  'Transporte de Valores': 2_000_000_000, // 2B COP
  'Lucro Cesante': 5_000_000_000, // 5B COP
  'Terremoto y Eventos Catastróficos': 50_000_000_000, // 50B COP
  'Vidrios Planos': 500_000_000, // 500M COP
  'Huelga, Motín, Asonada (HMACC)': 5_000_000_000, // 5B COP
  'Manejo Global / Infidelidad': 2_000_000_000, // 2B COP
  'Asistencia PYME': 0, // Service coverage
  'Asistencia Legal': 0, // Service coverage
};

/**
 * Parse numeric value from coverage string
 * Handles: "500.000.000", "500M", "$500,000", "No aplica", "Incluido"
 */
export function parseCoverageValue(value: string): number | null {
  if (!value || value === 'NO ESPECIFICADO' || value === 'No aplica' || value === 'Incluido') {
    return null;
  }

  // Try to extract number
  const cleanValue = value.replace(/\$/g, '').replace(/\./g, '').replace(/,/g, '').trim();

  // Handle abbreviations like "500M", "1.5B"
  if (/^\d+\.?\d*\s*[MBKm]$/i.test(cleanValue)) {
    const num = parseFloat(cleanValue.replace(/[MBKm]/gi, '').trim());
    if (cleanValue.toLowerCase().includes('b')) return num * 1_000_000_000;
    if (cleanValue.toLowerCase().includes('m')) return num * 1_000_000;
    if (cleanValue.toLowerCase().includes('k')) return num * 1_000;
  }

  // Try direct number parse
  const num = parseFloat(cleanValue);
  if (!isNaN(num)) {
    return num;
  }

  return null;
}

/**
 * Validate coverage value against expected ranges
 * Returns validation result with flag if value is absurd
 */
export function validateCoverageValue(
  coverageName: string,
  value: string
): {
  isValid: boolean;
  parsedValue: number | null;
  issue?: 'too_small' | 'too_large' | 'invalid_format';
  message?: string;
} {
  const parsedValue = parseCoverageValue(value);

  if (parsedValue === null) {
    return { isValid: true, parsedValue: null }; // Non-numeric values are ok (Incluido, etc.)
  }

  // Find matching coverage (fuzzy match on canonical name)
  const canonicalName = Object.keys(MIN_VALUES).find(
    (key) =>
      coverageName.toLowerCase().includes(key.toLowerCase()) ||
      key.toLowerCase().includes(coverageName.toLowerCase())
  );

  if (!canonicalName) {
    return { isValid: true, parsedValue }; // Unknown coverage - pass through
  }

  const min = MIN_VALUES[canonicalName];
  const max = MAX_VALUES[canonicalName];

  if (min > 0 && parsedValue < min) {
    return {
      isValid: false,
      parsedValue,
      issue: 'too_small',
      message: `Valor ${parsedValue.toLocaleString()} COP parece muy bajo para ${canonicalName}. Mínimo esperado: ${min.toLocaleString()} COP`,
    };
  }

  if (max > 0 && parsedValue > max) {
    return {
      isValid: false,
      parsedValue,
      issue: 'too_large',
      message: `Valor ${parsedValue.toLocaleString()} COP parece muy alto para ${canonicalName}. Máximo esperado: ${max.toLocaleString()} COP`,
    };
  }

  return { isValid: true, parsedValue };
}

/**
 * Validate all coverages in a quote and return flags
 */
export function validateCoverageValues(coverages: Array<{ name: string; value: string }>): Array<{
  coverageName: string;
  value: string;
  isValid: boolean;
  issue?: string;
  message?: string;
}> {
  return coverages
    .map((c) => {
      const result = validateCoverageValue(c.name, c.value);
      return {
        coverageName: c.name,
        value: c.value,
        isValid: result.isValid,
        issue: result.issue,
        message: result.message,
      };
    })
    .filter((r) => !r.isValid);
}
