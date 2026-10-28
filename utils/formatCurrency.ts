/**
 * Utility functions for formatting Colombian Peso (COP) currency
 *
 * Format: $12.345.678,90
 * - Thousands separator: dot (.)
 * - Decimal separator: comma (,)
 */

/**
 * Formats a number as Colombian Peso currency
 * @param amount - The amount to format
 * @param options - Formatting options
 * @returns Formatted string like "$12.345.678" or "$12.345.678,90"
 */
export function formatCOP(
  amount: number | undefined | null,
  options: { decimals?: number; showSymbol?: boolean } = {}
): string {
  const { decimals = 0, showSymbol = true } = options;

  if (amount === undefined || amount === null || isNaN(amount)) {
    return showSymbol ? '$0' : '0';
  }

  const formatted = amount.toLocaleString('es-CO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return showSymbol ? `$${formatted}` : formatted;
}

/**
 * Formats a number as millions with COP symbol
 * @param amount - The amount to format
 * @returns Formatted string like "$12,35M" or "$0,00M"
 */
export function formatCOPMillions(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '$0,00M';
  }

  const millions = amount / 1000000;
  return `$${millions.toLocaleString('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}M`;
}

/**
 * Formats a number with thousands separators (no currency symbol)
 * @param value - The number to format
 * @param decimals - Number of decimal places (optional)
 * @returns Formatted string like "12.345.678" or "12.345,67"
 */
export function formatNumber(value: number | undefined | null, decimals?: number): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '0';
  }

  const options: Intl.NumberFormatOptions = {};
  if (decimals !== undefined) {
    options.minimumFractionDigits = decimals;
    options.maximumFractionDigits = decimals;
  }

  return value.toLocaleString('es-CO', options);
}

/**
 * Formats a value as percentage with Colombian decimal format
 * @param value - The value to format (e.g., 0.1234 for 12.34% or 12.34 for 12.34%)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted string like "12,5%" or "0%"
 */
export function formatPercentage(value: number | undefined | null, decimals: number = 1): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '0%';
  }

  // If value is less than 1, assume it's a decimal (0.1234 = 12.34%)
  // If value is 1 or greater, assume it's already a percentage (12.34 = 12.34%)
  const percentage = value < 1 && value > -1 && value !== 0 ? value * 100 : value;

  const formatted = percentage.toLocaleString('es-CO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return `${formatted}%`;
}

/**
 * Parses Colombian and International currency/number strings to Javascript numbers.
 */
export function parseColombianCurrency(valueStr: string | null | undefined): number | null {
  if (valueStr === null || valueStr === undefined) {
    return null;
  }

  const trimmed = valueStr.trim();
  if (trimmed === '') {
    return null;
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
      const normalized = cleanStr.replace(/,/g, '');
      parsed = parseFloat(normalized);
    } else {
      if (/,(\d{1,2})$/.test(cleanStr)) {
        const normalized = cleanStr.replace(/,/g, '.');
        parsed = parseFloat(normalized);
      } else {
        const normalized = cleanStr.replace(/,/g, '');
        parsed = parseFloat(normalized);
      }
    }
  } else if (hasDot) {
    // Only dot(s) present
    const dotsCount = (cleanStr.match(/\./g) || []).length;
    if (dotsCount > 1) {
      const normalized = cleanStr.replace(/\./g, '');
      parsed = parseFloat(normalized);
    } else {
      if (/\.\d{3}$/.test(cleanStr)) {
        const normalized = cleanStr.replace(/\./g, '');
        parsed = parseFloat(normalized);
      } else {
        parsed = parseFloat(cleanStr);
      }
    }
  } else {
    parsed = parseFloat(cleanStr);
  }

  if (isNaN(parsed)) {
    return null;
  }

  return parsed;
}
