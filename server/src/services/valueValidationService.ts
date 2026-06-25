/**
 * Value Validation Service
 * Validates extracted coverage values against raw source text to detect hallucinations
 */

export type ValueSource = 'extracted' | 'calculated' | 'inferred';

export interface ValueValidationResult {
    isValid: boolean;
    source: ValueSource;
    reason: string;
}

/**
 * Check if a value appears in the raw text
 */
export function validateValueAgainstRawText(
    value: string,
    rawText: string,
    coverageName: string
): ValueValidationResult {
    if (!value || !rawText) {
        return { isValid: false, source: 'inferred', reason: 'Missing value or raw text' };
    }

    // Normalize the value for searching
    const normalizedValue = normalizeForSearch(value);
    const normalizedText = normalizeForSearch(rawText);

    // Direct match
    if (normalizedText.includes(normalizedValue)) {
        return { isValid: true, source: 'extracted', reason: 'Value found in raw text' };
    }

    // Check for common variations
    const variations = generateValueVariations(value);
    for (const variation of variations) {
        if (normalizedText.includes(variation)) {
            return { isValid: true, source: 'extracted', reason: `Value found as variation: ${variation}` };
        }
    }

    // Check if it's a calculation result (contains math indicators)
    if (isCalculatedValue(value, rawText, coverageName)) {
        return { isValid: true, source: 'calculated', reason: 'Value derived from calculation in text' };
    }

    // If value is suspicious (e.g., round numbers without context)
    if (isSuspiciousValue(value)) {
        return { isValid: false, source: 'inferred', reason: 'Suspicious value: may be hallucinated' };
    }

    return { isValid: true, source: 'inferred', reason: 'Value not found in text but not suspicious' };
}

/**
 * Normalize text for searching
 */
function normalizeForSearch(text: string): string {
    return text
        .toLowerCase()
        .replace(/[.,]/g, '') // Remove separators
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();
}

/**
 * Generate common variations of a value
 */
function generateValueVariations(value: string): string[] {
    const variations: string[] = [];
    
    // Remove currency symbols
    const withoutCurrency = value.replace(/[$\s]/g, '');
    variations.push(withoutCurrency);
    
    // Handle "M" suffix (millions)
    if (value.toLowerCase().includes('m')) {
        const num = value.replace(/[^\d.,]/g, '');
        variations.push(`${num}000000`);
        variations.push(`${num}.000.000`);
    }
    
    // Handle "K" suffix (thousands)
    if (value.toLowerCase().includes('k')) {
        const num = value.replace(/[^\d.,]/g, '');
        variations.push(`${num}000`);
    }
    
    // Handle SMMLV
    if (value.toLowerCase().includes('smmlv')) {
        const match = value.match(/(\d+)/);
        if (match) {
            variations.push(`${match[1]} smmlv`);
            variations.push(`${match[1]}smmlv`);
        }
    }
    
    return variations;
}

/**
 * Check if a value appears to be calculated from the text
 */
function isCalculatedValue(value: string, rawText: string, _coverageName: string): boolean {
    const lowerText = rawText.toLowerCase();
    
    // Check if text mentions percentage for this coverage
    if (value.includes('%')) {
        const percentMatch = value.match(/(\d+(?:\.\d+)?)/);
        if (percentMatch) {
            const percentPattern = new RegExp(`${percentMatch[1]}%`, 'i');
            return percentPattern.test(rawText);
        }
    }
    
    // Check if text mentions formula (e.g., "10% del valor asegurado")
    if (lowerText.includes('del valor asegurado') || lowerText.includes('sobre el valor')) {
        return true;
    }
    
    return false;
}

/**
 * Check if a value looks suspicious (potential hallucination)
 */
function isSuspiciousValue(value: string): boolean {
    // Very round numbers without context
    const roundNumberPattern = /^\$?[\d.]+,?000,?000$/;
    if (roundNumberPattern.test(value)) {
        // It's a round million, could be suspicious if not explicitly stated
        return true;
    }
    
    // Values that are too small for the coverage type
    const numericValue = parseFloat(value.replace(/[^\d.]/g, ''));
    if (!isNaN(numericValue) && numericValue < 1000 && !value.includes('%')) {
        return true; // Very small value, likely wrong
    }
    
    return false;
}

/**
 * Batch validate multiple coverage values
 */
export function validateValueSources(
    coverages: Array<{ name: string; value: string }>,
    rawText: string
): Array<{ coverageName: string; value: string; validation: ValueValidationResult }> {
    return coverages.map(coverage => ({
        coverageName: coverage.name,
        value: coverage.value,
        validation: validateValueAgainstRawText(coverage.value, rawText, coverage.name)
    }));
}

export default {
    validateValueAgainstRawText,
    validateValueSources
};
