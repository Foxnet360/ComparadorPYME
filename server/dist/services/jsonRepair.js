"use strict";
/**
 * JSON Repair Module
 * Attempts to repair malformed JSON responses from Gemini
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJsonWithRepair = parseJsonWithRepair;
exports.isTruncated = isTruncated;
exports.sanitizeJsonText = sanitizeJsonText;
/**
 * Attempt to parse JSON, with automatic repair on failure
 */
function parseJsonWithRepair(jsonText) {
    // First, try standard parsing
    try {
        const data = JSON.parse(jsonText);
        return {
            success: true,
            data,
            wasRepaired: false,
        };
    }
    catch (initialError) {
        // Try various repair strategies
        const repairStrategies = [
            repairUnterminatedStrings,
            repairTrailingCommas,
            repairTruncatedJson,
            repairInvalidEscapes,
            repairMissingQuotes,
        ];
        for (const strategy of repairStrategies) {
            try {
                const repaired = strategy(jsonText);
                if (repaired !== jsonText) {
                    const data = JSON.parse(repaired);
                    return {
                        success: true,
                        data,
                        wasRepaired: true,
                        repairType: strategy.name,
                    };
                }
            }
            catch (_a) {
                // Continue to next strategy
            }
        }
        // All strategies failed, try partial extraction
        try {
            const partialData = extractPartialData(jsonText);
            if (partialData && Object.keys(partialData).length > 0) {
                return {
                    success: true,
                    data: partialData,
                    wasRepaired: true,
                    repairType: 'partial_extraction',
                };
            }
        }
        catch (_b) {
            // Partial extraction also failed
        }
        return {
            success: false,
            data: null,
            wasRepaired: false,
            error: initialError.message,
        };
    }
}
/**
 * Repair unterminated strings by adding missing closing quotes
 */
function repairUnterminatedStrings(json) {
    let repaired = json;
    let inString = false;
    let escapeNext = false;
    const chars = json.split('');
    for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        if (escapeNext) {
            escapeNext = false;
            continue;
        }
        if (char === '\\') {
            escapeNext = true;
            continue;
        }
        if (char === '"') {
            inString = !inString;
        }
    }
    // If we're still in a string at the end, add closing quote
    if (inString) {
        repaired += '"';
    }
    return repaired;
}
/**
 * Remove trailing commas in objects and arrays
 */
function repairTrailingCommas(json) {
    // Remove trailing commas before closing brackets
    return json
        .replace(/,(\s*[}\]])/g, '$1')
        // Also handle multiple trailing commas
        .replace(/,+(\s*[}\]])/g, '$1');
}
/**
 * Repair truncated JSON by closing open brackets
 */
function repairTruncatedJson(json) {
    let repaired = json;
    const openBraces = (repaired.match(/\{/g) || []).length;
    const closeBraces = (repaired.match(/\}/g) || []).length;
    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/\]/g) || []).length;
    // Add missing closing braces
    for (let i = 0; i < openBraces - closeBraces; i++) {
        repaired += '}';
    }
    // Add missing closing brackets
    for (let i = 0; i < openBrackets - closeBrackets; i++) {
        repaired += ']';
    }
    return repaired;
}
/**
 * Remove or fix invalid escape sequences
 */
function repairInvalidEscapes(json) {
    // Replace invalid escapes with their literal equivalents
    return json
        .replace(/\\([^"\\\/bfnrtu])/g, '$1') // Remove invalid single char escapes
        .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}
/**
 * Add missing quotes around unquoted keys
 */
function repairMissingQuotes(json) {
    // Simple heuristic: add quotes around word characters followed by colon
    return json.replace(/(\w+):/g, '"$1":');
}
/**
 * Extract partial data from damaged JSON
 * Attempts to extract whatever valid key-value pairs are present
 */
function extractPartialData(json) {
    const result = {};
    // Try to extract string values for known keys
    const keyValuePattern = /"(insurerName|policyName|currency|validityPeriod)"\s*:\s*"([^"]*)"/g;
    let match;
    while ((match = keyValuePattern.exec(json)) !== null) {
        result[match[1]] = match[2];
    }
    // Try to extract numeric values
    const numericPattern = /"(priceAnnual)"\s*:\s*(\d+)/g;
    while ((match = numericPattern.exec(json)) !== null) {
        result[match[1]] = parseInt(match[2], 10);
    }
    // Try to extract coverages array
    const coveragesMatch = json.match(/"coverages"\s*:\s*(\[[\s\S]*?\])\s*[},]/);
    if (coveragesMatch) {
        try {
            result.coverages = JSON.parse(coveragesMatch[1]);
        }
        catch (_a) {
            // If array parse fails, try to extract individual coverage objects
            result.coverages = extractCoveragesFromText(json);
        }
    }
    return result;
}
/**
 * Extract coverage objects from damaged text using regex
 */
function extractCoveragesFromText(text) {
    const coverages = [];
    // Pattern to match coverage objects: { "name": "...", "value": "...", "deductible": "..." }
    const coveragePattern = /\{\s*"name"\s*:\s*"([^"]*)"\s*,\s*"value"\s*:\s*"([^"]*)"\s*,\s*"deductible"\s*:\s*"([^"]*)"\s*\}/g;
    let match;
    while ((match = coveragePattern.exec(text)) !== null) {
        coverages.push({
            name: match[1],
            value: match[2],
            deductible: match[3],
        });
    }
    return coverages;
}
/**
 * Check if JSON text appears to be truncated
 */
function isTruncated(json) {
    const trimmed = json.trim();
    // Check for unclosed structures
    if (trimmed.endsWith(',') || trimmed.endsWith(':') || trimmed.endsWith('"')) {
        return true;
    }
    const openBraces = (trimmed.match(/\{/g) || []).length;
    const closeBraces = (trimmed.match(/\}/g) || []).length;
    const openBrackets = (trimmed.match(/\[/g) || []).length;
    const closeBrackets = (trimmed.match(/\]/g) || []).length;
    return openBraces !== closeBraces || openBrackets !== closeBrackets;
}
/**
 * Sanitize JSON text by removing problematic characters
 */
function sanitizeJsonText(text) {
    return text
        // Remove control characters except tab, newline, carriage return
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        // Fix common Unicode issues
        .replace(/\uFFFD/g, '')
        // Normalize line endings
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');
}
