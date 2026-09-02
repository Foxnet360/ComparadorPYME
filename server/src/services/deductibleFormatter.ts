import { DeductibleStructure } from '../schemas/extractionSchemas';

const AMOUNT_TOLERANCE = 0.0001;

/**
 * Format a DeductibleStructure into a short, human-readable string.
 *
 * Examples:
 *   - [{na,0}]              → "No aplica"
 *   - [{percentage,10}]     → "10%"
 *   - [{smmlv,5}]           → "5 SMMLV"
 *   - [{fixed,500000}]      → "$500000"
 *   - compound              → raw text is preserved when available
 */
export function formatDeductibleForDisplay(structure: DeductibleStructure): string {
  if (
    structure.isZero ||
    structure.components.length === 0 ||
    (structure.components.length === 1 && structure.components[0]?.type === 'na')
  ) {
    return 'No aplica';
  }

  if (structure.components.some((c) => c.type === 'unknown')) {
    return structure.rawText.trim() || 'No especificado';
  }

  // For compound structures, prefer the raw text when it exists so that
  // context (e.g. "aplica sobre pérdida") is preserved.
  if (structure.isComposite && structure.rawText) {
    return structure.rawText.trim();
  }

  const only = structure.components[0]!;
  switch (only.type) {
    case 'percentage':
      return `${only.value}%`;
    case 'smmlv':
      return `${only.value} SMMLV`;
    case 'uvt':
      return `${only.value} UVT`;
    case 'fixed':
      return `$${only.value}`;
    case 'minimum':
      return `mín. ${only.value}${only.currency ? ` ${only.currency}` : ''}`;
    case 'maximum':
      return `máx. ${only.value}${only.currency ? ` ${only.currency}` : ''}`;
    default:
      return structure.rawText.trim() || 'No especificado';
  }
}

/**
 * Extract the contextual part of a deductible string that follows the leading
 * percentage. This is a thin display helper for consumers that need to keep
 * the original surrounding text (e.g. "aplica sobre pérdida").
 */
export function extractDeductibleContext(rawText: string): string | undefined {
  const match = rawText.match(/^\s*\d+(?:[.,]\d+)?\s*%\s*(.*)$/);
  if (match?.[1]?.trim()) {
    return match[1].trim();
  }
  return undefined;
}

/**
 * Extract a deductible snippet from a larger clause chunk. This is the only
 * place outside the canonical parser where a deductible-related regex lives,
 * and it is intentionally kept as a thin extraction wrapper.
 */
export function extractDeductibleFromClauseText(text: string): string | undefined {
  const match = text.match(/deducible[\s:]+(\d+%?[^\n.]*)/i);
  return match?.[1]?.trim();
}

function currencyKey(currency?: string | null): string {
  return (currency || '').toUpperCase().trim();
}

function numbersEqual(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (a === 0 && b === 0) return true;
  const diff = Math.abs(a - b);
  if (diff <= AMOUNT_TOLERANCE) return true;
  const max = Math.max(Math.abs(a), Math.abs(b));
  return diff / max <= AMOUNT_TOLERANCE;
}

function componentsEqual(
  a: DeductibleStructure['components'],
  b: DeductibleStructure['components']
): boolean {
  if (a.length !== b.length) return false;

  const normalise = (list: DeductibleStructure['components']) =>
    [...list]
      .map((c) => ({
        type: c.type,
        value: c.value,
        currency: currencyKey(c.currency),
      }))
      .sort((x, y) => {
        if (x.type !== y.type) return x.type.localeCompare(y.type);
        if (x.value !== y.value) return x.value - y.value;
        return x.currency.localeCompare(y.currency);
      });

  const left = normalise(a);
  const right = normalise(b);

  for (let i = 0; i < left.length; i++) {
    if (left[i]!.type !== right[i]!.type) return false;
    if (!numbersEqual(left[i]!.value, right[i]!.value)) return false;
    if (left[i]!.currency !== right[i]!.currency) return false;
  }

  return true;
}

/**
 * Compare two DeductibleStructure objects for semantic equality.
 *
 * Unknown deductibles are never considered equal to anything (including other
 * unknowns) so that callers can surface them as needing review.
 */
export function deductibleEquals(a: DeductibleStructure, b: DeductibleStructure): boolean {
  const aUnknown = a.components.some((c) => c.type === 'unknown');
  const bUnknown = b.components.some((c) => c.type === 'unknown');
  if (aUnknown || bUnknown) return false;

  if (a.isZero && b.isZero) return true;
  if (a.isZero !== b.isZero) return false;

  if (a.compoundOperator !== b.compoundOperator) {
    // Treat 'none' and 'and' as equivalent when neither side is composite.
    if (!a.isComposite && !b.isComposite) {
      const aOp = a.compoundOperator === 'and' ? 'none' : a.compoundOperator;
      const bOp = b.compoundOperator === 'and' ? 'none' : b.compoundOperator;
      if (aOp !== bOp) return false;
    } else {
      return false;
    }
  }

  if (!componentsEqual(a.components, b.components)) return false;

  return true;
}
