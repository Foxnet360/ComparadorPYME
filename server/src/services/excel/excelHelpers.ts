import sharp from 'sharp';
import { MatrixRow } from '../../types';
import { buildInsurerSvgDataUri } from '../../shared/colombianInsurersCatalog';
import {
  DEDUCTIBLE_SECTION_ID,
  FINANCIAL_SECTION_ID,
} from '../unifiedComparison/matrixTransformer';

export async function getInsurerLogoPngBuffer(insurerName: string): Promise<Buffer | null> {
  try {
    const uri = buildInsurerSvgDataUri(insurerName);
    const svgStr = decodeURIComponent(uri.replace('data:image/svg+xml;utf8,', ''));
    return await sharp(Buffer.from(svgStr)).resize(64, 64).png().toBuffer();
  } catch {
    return null;
  }
}

export function isDeductibleMatrixRow(row: MatrixRow): boolean {
  if (row.sectionId === DEDUCTIBLE_SECTION_ID) return true;
  const idLower = (row.id || '').toLowerCase();
  if (idLower.includes('deductible') || idLower.includes('deducible')) return true;
  const labelLower = (row.label || '').toLowerCase();
  return labelLower.includes('deducible') && !labelLower.includes('cobertura');
}

export function isFinancialMatrixRow(row: MatrixRow): boolean {
  return row.sectionId === FINANCIAL_SECTION_ID;
}

/**
 * Remove section header rows that have no data rows before the next header (or end of list),
 * as well as redundant leading/trailing/consecutive spacer rows.
 */
export function pruneOrphanedSectionRows(rows: MatrixRow[]): MatrixRow[] {
  const result: MatrixRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.type === 'header') {
      let hasDataRow = false;
      for (let j = i + 1; j < rows.length; j++) {
        if (rows[j]!.type === 'header') break;
        if (rows[j]!.type === 'data') {
          hasDataRow = true;
          break;
        }
      }
      if (hasDataRow) {
        result.push(row);
      }
    } else if (row.type === 'spacer') {
      if (result.some((r) => r.type === 'data') && result[result.length - 1]?.type !== 'spacer') {
        result.push(row);
      }
    } else {
      result.push(row);
    }
  }
  while (result.length > 0 && result[result.length - 1]?.type === 'spacer') {
    result.pop();
  }
  return result;
}

/**
 * Compute row height dynamically based on wrapped text lines and explicit line breaks.
 */
export function calculateDynamicRowHeight(texts: string[], minHeight: number = 24): number {
  let maxLines = 1;
  for (const text of texts) {
    if (!text) continue;
    const explicitLines = String(text).split('\n');
    let lineCount = 0;
    for (const line of explicitLines) {
      lineCount += Math.max(1, Math.ceil(line.length / 35));
    }
    if (lineCount > maxLines) {
      maxLines = lineCount;
    }
  }
  return Math.max(minHeight, Math.min(96, maxLines * 16 + 8));
}

export function formatRatioCell(val: string | number): { value: string | number; numFmt?: string } {
  if (typeof val === 'string') {
    const pct = parseFloat(val.replace(/[^0-9,.]/g, '').replace(',', '.')) / 100;
    if (!isNaN(pct)) {
      return { value: pct, numFmt: '0.00%' };
    } else {
      return { value: val };
    }
  } else {
    return { value: val };
  }
}
