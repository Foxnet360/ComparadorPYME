/**
 * Format Family Service
 * Replaces insurer-specific profiles with format-family-based detection
 * Provides specialized prompts based on document layout instead of insurer name
 *
 * @deprecated Use formatDetector.ts and promptBuilder.ts directly
 * This service maintains backward compatibility during migration
 */

import {
  detectFormatFamily,
  FormatFamily,
  FormatDetectionResult,
  getFormatFamilyDescription,
} from './formatDetector';
import { buildPromptForFamily, getSupportedFormatFamilies } from './promptBuilder';

// Re-export types for backward compatibility
export type { FormatFamily, FormatDetectionResult };

/**
 * Detect format family from PDF text (replaces insurer detection)
 * @deprecated Use detectFormatFamily() from formatDetector.ts directly
 */
export function detectFormat(text: string): FormatDetectionResult {
  return detectFormatFamily(text);
}

/**
 * Get prompt for detected format family
 * @deprecated Use buildPromptForFamily() from promptBuilder.ts directly
 */
export function getPromptForFormat(
  formatResult: FormatDetectionResult,
  context?: { pageCount?: number; hasTables?: boolean }
): string {
  return buildPromptForFamily(formatResult.family, context);
}

/**
 * Get all supported format families
 * @deprecated Use getSupportedFormatFamilies() from promptBuilder.ts directly
 */
export function getSupportedFormats(): FormatFamily[] {
  return getSupportedFormatFamilies();
}

/**
 * Check if format family is supported
 * @deprecated Use isFormatFamilySupported() from promptBuilder.ts directly
 */
export function isFormatSupported(family: FormatFamily): boolean {
  return getSupportedFormatFamilies().includes(family);
}

/**
 * Get human-readable description of format family
 * @deprecated Use getFormatFamilyDescription() from formatDetector.ts directly
 */
export function getFormatDescription(family: FormatFamily): string {
  return getFormatFamilyDescription(family);
}

// Legacy insurer profile exports (maintained for backward compatibility)
// These will be removed in a future version
export { insurerProfileService } from './insurerProfileService';

export default {
  detectFormat,
  getPromptForFormat,
  getSupportedFormats,
  isFormatSupported,
  getFormatDescription,
};
