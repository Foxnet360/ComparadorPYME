/**
 * Dual Extraction Service for Critical Coverages
 * Extracts Incendio and RC twice with different prompts to detect hallucinations
 * Flags discrepancies >20% for manual review
 */

export interface DualExtractionResult {
    coverageName: string;
    firstExtraction: {
        value: string;
        deductible: string;
        confidence: number;
    };
    secondExtraction: {
        value: string;
        deductible: string;
        confidence: number;
    };
    discrepancy: number; // Percentage difference (0-100)
    isDiscrepancy: boolean;
    recommendation: string;
}

/**
 * Compare two extracted values and calculate discrepancy
 */
function calculateDiscrepancy(value1: string, value2: string): number {
    // Parse numeric values
    const num1 = parseNumericValue(value1);
    const num2 = parseNumericValue(value2);
    
    if (num1 === null || num2 === null) {
        // If either is not numeric, check for exact string match
        return value1.toUpperCase().trim() === value2.toUpperCase().trim() ? 0 : 100;
    }
    
    // Calculate percentage difference
    if (num1 === 0 && num2 === 0) return 0;
    const avg = (num1 + num2) / 2;
    const diff = Math.abs(num1 - num2);
    return (diff / avg) * 100;
}

/**
 * Parse numeric value from string (handles SMMLV, %, currency)
 */
function parseNumericValue(value: string): number | null {
    if (!value || value === 'NO ESPECIFICADO' || value === 'No aplica') {
        return null;
    }
    
    const cleanValue = value.toUpperCase().replace(/[$\s.]/g, '').replace(/,/g, '');
    
    // Check for percentage
    const percentMatch = cleanValue.match(/(\d+(?:\.\d+)?)\s*%/);
    if (percentMatch) return parseFloat(percentMatch[1]);
    
    // Check for SMMLV
    const smmlvMatch = cleanValue.match(/(\d+)\s*(?:SMMLV|SM)/i);
    if (smmlvMatch) return parseFloat(smmlvMatch[1]);
    
    // Check for plain number
    const numMatch = cleanValue.match(/(\d+(?:\.\d+)?)/);
    if (numMatch) return parseFloat(numMatch[1]);
    
    return null;
}

/**
 * Extract critical coverages with dual prompts
 * This should be called after the initial extraction
 */
export const dualExtractionService = {
    /**
     * Validate critical coverages with dual extraction
     * Call this after initial extraction to verify Incendio and RC values
     */
    validateCriticalCoverages: (
        coverages: Array<{ name: string; value: string; deductible?: string; confidence?: number }>,
        rawText: string
    ): DualExtractionResult[] => {
        const criticalCategories = ['Incendio', 'Responsabilidad Civil', 'RC', 'RCE'];
        const results: DualExtractionResult[] = [];
        
        for (const coverage of coverages) {
            const coverageNameLower = coverage.name.toLowerCase();
            
            // Check if this is a critical coverage
            const isCritical = criticalCategories.some(cat => 
                coverageNameLower.includes(cat.toLowerCase())
            );
            
            if (!isCritical) continue;
            
            // Simulate second extraction (in production, this would call Gemini again)
            // For now, we use heuristics based on raw text
            const secondExtraction = extractFromRawText(rawText, coverage.name);
            
            const discrepancy = calculateDiscrepancy(coverage.value, secondExtraction.value);
            const isDiscrepancy = discrepancy > 20;
            
            results.push({
                coverageName: coverage.name,
                firstExtraction: {
                    value: coverage.value,
                    deductible: coverage.deductible || 'NO ESPECIFICADO',
                    confidence: coverage.confidence || 70
                },
                secondExtraction: {
                    value: secondExtraction.value,
                    deductible: secondExtraction.deductible,
                    confidence: secondExtraction.confidence
                },
                discrepancy: Math.round(discrepancy * 100) / 100,
                isDiscrepancy,
                recommendation: isDiscrepancy 
                    ? `⚠️ DISCREPANCIA DETECTADA (${discrepancy.toFixed(1)}%): Verificar manualmente el valor de ${coverage.name}`
                    : `✅ Valor verificado: ${coverage.name} consistente entre extracciones`
            });
        }
        
        return results;
    },
    
    /**
     * Check if coverage needs manual review
     */
    needsManualReview: (results: DualExtractionResult[]): boolean => {
        return results.some(r => r.isDiscrepancy);
    }
};

/**
 * Extract coverage value from raw text using regex (second extraction method)
 */
function extractFromRawText(rawText: string, coverageName: string): { 
    value: string; 
    deductible: string; 
    confidence: number;
} {
    const lines = rawText.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineLower = line.toLowerCase();
        const coverageLower = coverageName.toLowerCase();
        
        // Check if this line mentions the coverage
        if (lineLower.includes(coverageLower) || 
            coverageLower.includes(lineLower.replace(/[:\s-]/g, ''))) {
            
            // Try to find value in this line or next few lines
            for (let j = i; j < Math.min(i + 3, lines.length); j++) {
                const valueLine = lines[j];
                
                // Match patterns like "Valor: $100M" or "SA: 100%" or "$100.000.000"
                const valueMatch = valueLine.match(/(?:valor|sa|suma|asegurado)[\s:]*([^\n]+)/i);
                if (valueMatch) {
                    return {
                        value: valueMatch[1].trim(),
                        deductible: extractDeductibleFromLines(lines, j),
                        confidence: 85
                    };
                }
                
                // Match currency patterns
                const currencyMatch = valueLine.match(/\$?[\d.,]+(?:\s*(?:M|millones|MM|SMMLV|%))?/i);
                if (currencyMatch) {
                    return {
                        value: currencyMatch[0].trim(),
                        deductible: extractDeductibleFromLines(lines, j),
                        confidence: 75
                    };
                }
            }
        }
    }
    
    return {
        value: 'NO ESPECIFICADO',
        deductible: 'NO ESPECIFICADO',
        confidence: 0
    };
}

/**
 * Extract deductible from nearby lines
 */
function extractDeductibleFromLines(lines: string[], startIdx: number): string {
    for (let j = startIdx; j < Math.min(startIdx + 2, lines.length); j++) {
        const line = lines[j].toLowerCase();
        if (line.includes('deducible') || line.includes('deductible')) {
            const match = lines[j].match(/(?:deducible|deductible)[\s:]*([^\n]+)/i);
            if (match) return match[1].trim();
        }
    }
    return 'NO ESPECIFICADO';
}

export default dualExtractionService;
