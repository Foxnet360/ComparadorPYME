/**
 * String distance and similarity utilities
 */

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits needed
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str1.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str1.length; i++) {
    for (let j = 1; j <= str2.length; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[str1.length][str2.length];
}

/**
 * Calculate similarity score between two strings (0-1)
 * Uses Levenshtein distance normalized by max length
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const normalized1 = str1.toLowerCase().trim();
  const normalized2 = str2.toLowerCase().trim();

  // Exact match
  if (normalized1 === normalized2) return 1.0;

  // Contains match
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    const ratio = Math.min(normalized1.length, normalized2.length) / Math.max(normalized1.length, normalized2.length);
    return 0.7 + (ratio * 0.2); // 0.7-0.9 based on length ratio
  }

  // Levenshtein distance
  const maxLength = Math.max(normalized1.length, normalized2.length);
  if (maxLength === 0) return 1.0;

  const distance = levenshteinDistance(normalized1, normalized2);
  return 1 - (distance / maxLength);
}
