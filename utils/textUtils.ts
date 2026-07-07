/**
 * Text normalization utilities
 * Shared across backend and frontend
 */

/**
 * Normalize text for comparison
 * - Converts to lowercase
 * - Removes accents/diacritics
 * - Optionally strips non-alphanumeric characters (keeping spaces)
 * - Trims whitespace
 */
export function normalizeText(
  text: string | undefined | null,
  stripNonAlphanumeric = false
): string {
  if (!text || typeof text !== 'string') return '';
  let result = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (stripNonAlphanumeric) {
    result = result.replace(/[^a-z0-9\s]/g, '');
  }
  return result.trim();
}

/**
 * Normalize text preserving undefined/null
 * Useful when you need to distinguish between empty string and null
 */
export function normalizeTextNullable(text: string | undefined | null): string | null {
  if (!text || typeof text !== 'string') return null;
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Check if two texts are similar (case-insensitive, accent-insensitive)
 */
export function areTextsSimilar(
  text1: string | undefined | null,
  text2: string | undefined | null
): boolean {
  return normalizeText(text1) === normalizeText(text2);
}
