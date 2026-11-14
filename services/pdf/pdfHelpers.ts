import type jsPDF from 'jspdf';
import { formatCOP, parseColombianCurrency } from '../../utils/formatCurrency';
import type { DocWithAutoTable, TableMargins } from './types';

export const TABLE_MARGINS: TableMargins = { top: 38, bottom: 22, left: 14, right: 14 };
export const DEFAULT_PRIMARY_COLOR: [number, number, number] = [79, 70, 229]; // Default Indigo
export const DEFAULT_LIGHT_GRAY: [number, number, number] = [241, 245, 249]; // Slate 100

export function hexToRgb(hex?: string): [number, number, number] {
  if (!hex) return [30, 41, 59];
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean, 16);
  if (isNaN(bigint)) return [30, 41, 59];
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

export function getLastAutoTableFinalY(doc: jsPDF, fallback: number = 0): number {
  return (doc as unknown as DocWithAutoTable).lastAutoTable?.finalY ?? fallback;
}

/**
 * Format coverage value for PDF with exact Web/Excel numeric coherence.
 */
export const formatCoverageValuePDF = (value: string | undefined | null): string => {
  if (!value || typeof value !== 'string') return 'NO ESPECIFICADO';

  const trimmed = value.trim();
  const upperValue = trimmed.toUpperCase();

  // Special text values - return as-is
  if (
    [
      'EXCLUIDO',
      'NO CUBRE',
      'NO APLICA',
      'NO ESPECIFICADO',
      'INCLUIDO',
      'NO COTIZADO',
      'NO INCLUIDA',
      'NO CONTRATADO',
    ].includes(upperValue)
  ) {
    return trimmed;
  }

  // Exact parity with Web & Excel via parseColombianCurrency (recognizes millions, M, $, decimals)
  const parsed = parseColombianCurrency(trimmed);
  if (parsed !== null && parsed > 0) {
    return formatCOP(parsed);
  }

  // If nothing matched, return original value
  return trimmed;
};
