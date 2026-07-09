/**
 * Parse Colombian currency strings (COP) to numbers.
 * Handles es-CO dot/comma formats accurately.
 * E.g., "$1.134.400,00" -> 1134400.00
 *       "$1.134.400"    -> 1134400.00
 *       "1134400.00"    -> 1134400.00
 *       "1.134.400"     -> 1134400.00
 *
 * Returns null for unparseable or empty values instead of garbage numbers.
 */
export function parseColombianCurrency(valueStr: string | null | undefined): number | null {
  if (valueStr === null || valueStr === undefined) {
    return null;
  }

  const trimmed = valueStr.trim();
  if (trimmed === '') {
    return null;
  }

  // Remove currency symbol, "COP", "USD", and whitespace
  let cleanStr = trimmed.replace(/^\$+/, '').replace(/COP/gi, '').replace(/USD/gi, '').trim();

  if (cleanStr === '') {
    return null;
  }

  // If there are letters or invalid characters (excluding numbers, dot, comma, minus), it's unparseable
  if (/[^\d.,\s-]/.test(cleanStr)) {
    return null;
  }

  const hasComma = cleanStr.includes(',');
  const hasDot = cleanStr.includes('.');

  let parsed: number;

  if (hasComma && hasDot) {
    // Standard Colombian/es-CO format: thousands separated by dots, decimals by commas
    const normalized = cleanStr.replace(/\./g, '').replace(/,/g, '.');
    parsed = parseFloat(normalized);
  } else if (hasComma) {
    // Only comma(s) present
    const commasCount = (cleanStr.match(/,/g) || []).length;
    if (commasCount > 1) {
      const normalized = cleanStr.replace(/,/g, '');
      parsed = parseFloat(normalized);
    } else {
      const normalized = cleanStr.replace(/,/g, '.');
      parsed = parseFloat(normalized);
    }
  } else if (hasDot) {
    // Only dot(s) present
    const dotsCount = (cleanStr.match(/\./g) || []).length;
    if (dotsCount > 1) {
      const normalized = cleanStr.replace(/\./g, '');
      parsed = parseFloat(normalized);
    } else {
      // Exactly one dot
      if (/\.\d{3}$/.test(cleanStr)) {
        const normalized = cleanStr.replace(/\./g, '');
        parsed = parseFloat(normalized);
      } else {
        parsed = parseFloat(cleanStr);
      }
    }
  } else {
    // No dots or commas
    parsed = parseFloat(cleanStr);
  }

  if (isNaN(parsed)) {
    return null;
  }

  return parsed;
}
