/**
 * Parse Colombian and International currency/number strings to Javascript numbers.
 * Accurately handles both es-CO dot/comma formats and US/International comma/dot formats.
 *
 * Examples:
 *   "$ 15.000.000,00" -> 15000000.00
 *   "$ 15,000,000.00" -> 15000000.00 (US format)
 *   "$ 1.134.400"     -> 1134400.00
 *   "15.000"          -> 15000.00
 *   "15,000"          -> 15000.00
 *   "10.5%"           -> 10.50
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

  // 0. Detect magnitude expressions (e.g. "100 millones", "1.5 millones", "$ 100M", "100 MM", "100 mdp")
  const millionExpr = trimmed.match(
    /(?:^|\$\s*|\b)(\d+(?:[.,]\d+)?)\s*(?:millones?|mill[oó]n|mill\.|mdp|mm|m(?!\w))/i
  );
  if (millionExpr && millionExpr[1]) {
    const rawVal = millionExpr[1];
    let baseNum: number;
    if (rawVal.includes(',')) {
      baseNum = parseFloat(rawVal.replace(/\./g, '').replace(',', '.'));
    } else if (rawVal.includes('.')) {
      const parts = rawVal.split('.');
      if (parts.length === 2 && parts[1]!.length <= 2) {
        baseNum = parseFloat(rawVal);
      } else {
        baseNum = parseFloat(rawVal.replace(/\./g, ''));
      }
    } else {
      baseNum = parseFloat(rawVal);
    }
    if (!isNaN(baseNum) && baseNum > 0) {
      return Math.round(baseNum * 1000000);
    }
  }

  // 0.1 Detect thousands expressions (e.g. "500 mil", "500 miles", "500k")
  const thousandExpr = trimmed.match(
    /(?:^|\$\s*|\b)(\d+(?:[.,]\d+)?)\s*(?:miles?|mil|k(?!\w))/i
  );
  if (thousandExpr && thousandExpr[1]) {
    const rawVal = thousandExpr[1];
    let baseNum: number;
    if (rawVal.includes(',')) {
      baseNum = parseFloat(rawVal.replace(/\./g, '').replace(',', '.'));
    } else {
      baseNum = parseFloat(rawVal);
    }
    if (!isNaN(baseNum) && baseNum > 0) {
      return Math.round(baseNum * 1000);
    }
  }

  // Remove currency symbols, COP, USD, %, and whitespace
  let cleanStr = trimmed
    .replace(/^\$+/, '')
    .replace(/COP/gi, '')
    .replace(/USD/gi, '')
    .replace(/%/g, '')
    .replace(/'/g, '')
    .trim();

  if (cleanStr === '') {
    return null;
  }

  // If there are invalid characters (excluding numbers, dot, comma, minus), try embedded extraction
  if (/[^\d.,\s-]/.test(cleanStr)) {
    // 1. Attempt to extract an explicit dollar-prefixed amount: e.g. "$1.750.905" or "$ 1.750.905"
    const explicitDollarMatch = trimmed.match(/\$\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+)/);
    if (explicitDollarMatch && explicitDollarMatch[1]) {
      const parsedNested = parseColombianCurrency(explicitDollarMatch[1]);
      if (parsedNested !== null && parsedNested > 0) {
        return parsedNested;
      }
    }

    // 2. Attempt to extract a formatted thousands number: e.g. "1.750.905" in descriptive text
    const formattedNumMatch = trimmed.match(
      /\b(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?)\b/
    );
    if (formattedNumMatch && formattedNumMatch[1]) {
      const parsedNested = parseColombianCurrency(formattedNumMatch[1]);
      if (parsedNested !== null && parsedNested > 0) {
        return parsedNested;
      }
    }

    return null;
  }

  const hasComma = cleanStr.includes(',');
  const hasDot = cleanStr.includes('.');

  let parsed: number;

  if (hasComma && hasDot) {
    const lastCommaIndex = cleanStr.lastIndexOf(',');
    const lastDotIndex = cleanStr.lastIndexOf('.');

    if (lastCommaIndex > lastDotIndex) {
      // LatAm / es-CO format: dots are thousands, last comma is decimal (e.g. 15.000.000,50)
      const normalized = cleanStr.replace(/\./g, '').replace(/,/g, '.');
      parsed = parseFloat(normalized);
    } else {
      // US / International format: commas are thousands, last dot is decimal (e.g. 15,000,000.50)
      const normalized = cleanStr.replace(/,/g, '');
      parsed = parseFloat(normalized);
    }
  } else if (hasComma) {
    // Only comma(s) present
    const commasCount = (cleanStr.match(/,/g) || []).length;
    if (commasCount > 1) {
      // Multiple commas (e.g. 15,000,000)
      const normalized = cleanStr.replace(/,/g, '');
      parsed = parseFloat(normalized);
    } else {
      // Exactly 1 comma
      if (/,(\d{1,2})$/.test(cleanStr)) {
        // Decimal comma (e.g. 15000,50 or 15000,5)
        const normalized = cleanStr.replace(/,/g, '.');
        parsed = parseFloat(normalized);
      } else {
        // Thousands comma (e.g. 15,000)
        const normalized = cleanStr.replace(/,/g, '');
        parsed = parseFloat(normalized);
      }
    }
  } else if (hasDot) {
    // Only dot(s) present
    const dotsCount = (cleanStr.match(/\./g) || []).length;
    if (dotsCount > 1) {
      // Multiple dots (e.g. 15.000.000)
      const normalized = cleanStr.replace(/\./g, '');
      parsed = parseFloat(normalized);
    } else {
      // Exactly 1 dot
      if (/\.\d{3}$/.test(cleanStr)) {
        // Thousands dot (e.g. 15.000 or 1.500)
        const normalized = cleanStr.replace(/\./g, '');
        parsed = parseFloat(normalized);
      } else {
        // Decimal dot (e.g. 15000.50)
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
