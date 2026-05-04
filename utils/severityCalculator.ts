/**
 * Severity Calculator Utility
 * Calculates visual severity for deductibles
 */

export interface SeverityResult {
    level: 'low' | 'medium' | 'high' | 'critical';
    percentage: number;
    color: string;
    label: string;
}

/**
 * Calculate deductible severity
 */
export const calculateDeductibleSeverity = (
    deductibleText: string | undefined,
    insuredValue?: number
): SeverityResult => {
    if (!deductibleText || deductibleText === 'No aplica' || deductibleText === '') {
        return {
            level: 'low',
            percentage: 0,
            color: 'bg-slate-200',
            label: 'N/A'
        };
    }
    
    // Extract percentage
    const percentMatch = deductibleText.match(/(\d+(?:[.,]\d+)?)\s*%/);
    const percentage = percentMatch ? parseFloat(percentMatch[1].replace(',', '.')) : 0;
    
    // Check if applies to insured value (worse)
    const lowerText = deductibleText.toLowerCase();
    const appliesToValue = lowerText.includes('valor asegurado') || 
                           lowerText.includes('suma asegurada') || 
                           lowerText.includes('sobre el valor');
    
    // Base severity on percentage
    let level: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let color = 'bg-green-500';
    let label = 'Bajo';
    
    if (appliesToValue) {
        // Penalty for applying to insured value
        if (percentage > 10) {
            level = 'critical';
            color = 'bg-red-600';
            label = 'Crítico (sobre valor)';
        } else if (percentage > 5) {
            level = 'high';
            color = 'bg-red-500';
            label = 'Alto (sobre valor)';
        } else if (percentage > 0) {
            level = 'medium';
            color = 'bg-amber-500';
            label = 'Medio (sobre valor)';
        }
    } else {
        // Standard severity
        if (percentage > 15) {
            level = 'high';
            color = 'bg-red-500';
            label = 'Alto';
        } else if (percentage > 5) {
            level = 'medium';
            color = 'bg-amber-500';
            label = 'Medio';
        } else if (percentage > 0) {
            level = 'low';
            color = 'bg-green-500';
            label = 'Bajo';
        }
    }
    
    // Additional penalty if over insured value
    if (insuredValue && percentage > 0) {
        const deductibleAmount = (percentage / 100) * insuredValue;
        if (deductibleAmount > insuredValue * 0.2) {
            level = 'critical';
            color = 'bg-red-700';
            label = 'Crítico (>20% VA)';
        }
    }
    
    return {
        level,
        percentage,
        color,
        label
    };
};

/**
 * Get severity bar width (capped at 100%)
 */
export const getSeverityWidth = (percentage: number): string => {
    const capped = Math.min(percentage * 3, 100); // Scale so 33% fills the bar
    return `${capped}%`;
};
