import { MatrixRow } from '../../types';
import taxonomyData from '../../data/domains/pyme/taxonomy.json';
import { parseColombianCurrency } from '../../utils/formatCurrency';

export interface CategoryConfig {
  id: number;
  canonicalName: string;
  headerLabel: string;
  rows: Array<{
    label: string;
    field: 'value' | 'deductible' | 'details';
  }>;
}

export const HEADER_LABEL_MAPPING: Record<number, string> = {
  1: 'AMPARO BÁSICO - TODO RIESGO DAÑO MATERIAL',
  14: 'TERREMOTO / TEMBLOR / ERUPCIÓN VOLCÁNICA',
  13: 'AMIT / HMACC (HUELGA, MOTÍN, ASONADA, CONMOCIÓN CIVIL)',
  4: 'DAÑO INTERNO - EQUIPO ELÉCTRICO Y ELECTRÓNICO',
  3: 'HURTO CALIFICADO / SUSTRACCIÓN CON VIOLENCIA',
  2: 'LUCRO CESANTE / PÉRDIDAS CONSECUENCIALES',
  8: 'INFIDELIDAD DE EMPLEADOS',
  6: 'RESPONSABILIDAD CIVIL EXTRACONTRACTUAL (RCE)',
  5: 'ROTURA DE MAQUINARIA',
  7: 'ROTURA ACCIDENTAL DE VIDRIOS',
  9: 'TRANSPORTE DE MERCANCÍAS',
  10: 'TRANSPORTE DE VALORES',
  11: 'ASISTENCIAS',
  12: 'ASISTENCIA LEGAL',
};

export const ROWS_MAPPING: Record<
  number,
  Array<{ label: string; field: 'value' | 'deductible' | 'details' }>
> = {
  1: [
    { label: 'Valor Asegurado', field: 'value' },
    { label: 'Deducible', field: 'deductible' },
    { label: 'Incluye', field: 'details' },
  ],
  6: [
    { label: 'Valor Asegurado', field: 'value' },
    { label: 'Deducible', field: 'deductible' },
    { label: 'Incluye', field: 'details' },
  ],
  5: [
    { label: 'Cobertura', field: 'value' },
    { label: 'Deducible', field: 'deductible' },
  ],
  7: [
    { label: 'Sublímite', field: 'value' },
    { label: 'Deducible', field: 'deductible' },
  ],
  11: [{ label: 'Incluida', field: 'details' }],
  12: [{ label: 'Incluida', field: 'details' }],
};

export const CATEGORY_CONFIGS: CategoryConfig[] = (taxonomyData.categories || []).map((cat) => {
  const id = cat.id;
  const canonicalName = cat.name;
  const headerLabel = HEADER_LABEL_MAPPING[id] || canonicalName.toUpperCase();
  const rows = ROWS_MAPPING[id] || [
    { label: 'Valor Asegurado', field: 'value' },
    { label: 'Deducible', field: 'deductible' },
  ];
  return {
    id,
    canonicalName,
    headerLabel,
    rows,
  };
});

export function isExcludedValue(val: string | undefined | null): boolean {
  if (!val) return true;
  const normalized = val.toLowerCase().trim();
  return (
    normalized === 'no incluida' ||
    normalized === 'no incluido' ||
    normalized === 'n.c.' ||
    normalized === 'nc' ||
    normalized === 'no aplica' ||
    normalized === 'no especificado' ||
    normalized === 'excluido' ||
    normalized === 'excluida' ||
    normalized === 'no contratado' ||
    normalized === ''
  );
}

export function isSublimitRow(row: MatrixRow): boolean {
  if (row.type !== 'data') return false;
  const label = (row.label || '').trim();
  if (
    label.startsWith('↳') ||
    label.startsWith('- ') ||
    label.startsWith('· ') ||
    label.startsWith('– ')
  ) {
    return true;
  }
  const lower = label.toLowerCase();
  return (
    lower.includes('sublímite') ||
    lower.includes('sub-límite') ||
    lower.includes('sublimite') ||
    lower.includes('rider') ||
    lower.includes('extensión') ||
    lower.includes('extension') ||
    lower.includes('(gastos)') ||
    lower.startsWith('sublímite:') ||
    lower.startsWith('sub-límite:') ||
    lower.startsWith('sublimite:')
  );
}

export function parseNumericValue(val: string | undefined | null): number {
  if (!val || isExcludedValue(val)) return 0;
  const cleaned = val.replace(/[^0-9]/g, '');
  if (!cleaned) return 0;
  return parseInt(cleaned, 10);
}

export function formatCurrency(num: number): string {
  if (num === 0) return 'No informado';
  return '$' + num.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function buildExportNotes(
  cellNotes: Record<string, { content?: string }>
): Record<string, string> {
  const exportNotes: Record<string, string> = {};
  Object.entries(cellNotes).forEach(([key, note]) => {
    if (note.content) {
      exportNotes[key] = note.content;
    }
  });
  return exportNotes;
}

export function formatMatrixValue(val: string | undefined | null): string {
  if (!val) return 'No informado';
  const trimmed = val.trim();
  if (
    trimmed === 'No incluida' ||
    trimmed === 'NO ESPECIFICADO' ||
    trimmed === 'No contratado' ||
    isExcludedValue(trimmed)
  ) {
    return trimmed;
  }
  if (trimmed === '0') return '0';

  // 1. Check if it's a simple currency / numeric string:
  // e.g. "$ 100.000.000,00", "$100.000.000", "100.000.000 COP", "COP 100.000.000", "$ 1.750.905", "100000000"
  if (/^(?:\$\s*)?[\d.,\s]+(?:\s*COP|\s*USD)?$/i.test(trimmed)) {
    if (/\d/.test(trimmed) && !trimmed.includes('%')) {
      const parsed = parseColombianCurrency(trimmed);
      if (parsed !== null && parsed > 0) {
        const hasFraction = parsed % 1 !== 0;
        return `$${parsed.toLocaleString('es-CO', {
          minimumFractionDigits: hasFraction ? 2 : 0,
          maximumFractionDigits: hasFraction ? 2 : 0,
        })}`;
      } else if (parsed === 0) {
        return '0';
      }
    }
  }

  // 2. Clean compound text: strip trailing redundant zero decimals (,00 or .00) and redundant COP mentions
  const cleanedText = trimmed
    .replace(/(\$\s*\d{1,3}(?:\.\d{3})+),00\b/g, '$1')
    .replace(/(\$\s*\d{1,3}(?:,\d{3})+)\.00\b/g, '$1')
    .replace(/\b(\d{1,3}(?:\.\d{3})+),00\s*COP\b/gi, '$$$1')
    .replace(/\b(\d{1,3}(?:\.\d{3})+)\s*COP\b/gi, '$$$1');

  return cleanedText;
}

export function simplifyHeaderLabel(label: string): string {
  const upper = label.toUpperCase();
  if (upper.includes('AMPARO BÁSICO')) return 'Cobertura Todo Riesgo Daño Material';
  if (upper.includes('AMIT / HMACC')) return 'Cobertura de Terrorismo, Huelga y Motín';
  if (upper.includes('DAÑO INTERNO')) return 'Equipo Eléctrico y Electrónico';
  if (upper.includes('HURTO CALIFICADO')) return 'Hurto y Sustracción con Violencia';
  if (upper.includes('LUCRO CESANTE')) return 'Lucro Cesante / Pérdida de Ingresos';
  if (upper.includes('RESPONSABILIDAD CIVIL')) return 'Responsabilidad Civil (Daños a Terceros)';
  if (upper.includes('AMPAROS EXCLUSIVOS')) return 'Beneficios y Ventajas Competitivas';
  if (upper.includes('COMPARATIVA DE PRIMAS')) return 'Resumen de Primas y Costos';
  return label;
}

export function isLowConfidence(confidence: number | undefined): boolean {
  return confidence !== undefined && confidence !== null && confidence <= 0.5;
}

export function getConfidenceBadgeColor(confidence: number | undefined): string {
  if (confidence === undefined || confidence === null)
    return 'bg-slate-100 text-slate-500 border-slate-200';
  if (confidence >= 0.8) return 'bg-green-100 text-green-700 border-green-300';
  if (confidence >= 0.5) return 'bg-yellow-100 text-yellow-700 border-yellow-300';
  return 'bg-red-100 text-red-700 border-red-300';
}

export function getConfidenceText(confidence: number | undefined): string {
  if (confidence === undefined || confidence === null) return 'Sin match';
  if (confidence >= 0.8) return 'Alta';
  if (confidence >= 0.5) return 'Media';
  return 'Baja';
}
