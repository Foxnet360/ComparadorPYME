/**
 * Utility functions for formatting Colombian Peso (COP) currency
 * Backend version
 *
 * CONVENTION: All monetary values displayed in the UI MUST use these utilities.
 * Do NOT use inline toLocaleString(), Number.prototype.toFixed(), or string
 * concatenation for currency formatting.
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
 * Formats a value as percentage with Colombian decimal format
 * @param value - The value to format (e.g., 0.1234 for 12.34% or 12.34 for 12.34%)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted string like "12,5%" or "0%"
 */
export function formatPercentage(
  value: number | undefined | null,
  decimals: number = 1
): string {
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
