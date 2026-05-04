/**
 * Diff Highlighting Utility
 * Calculates differences between insurers for highlighting
 */

export interface DiffResult {
    average: number;
    max: number;
    min: number;
    deviations: Array<{
        value: number;
        deviation: number; // percentage from average
        isAbove: boolean;
        isSignificant: boolean;
    }>;
}

/**
 * Parse monetary value to number
 */
const parseValue = (value: string | number | undefined): number => {
    if (typeof value === 'number') return value;
    if (!value || typeof value !== 'string') return 0;
    
    const upperValue = value.trim().toUpperCase();
    if (['EXCLUIDO', 'NO CUBRE', 'NO APLICA', 'NO ESPECIFICADO'].includes(upperValue)) {
        return 0;
    }
    
    // Handle "500M" format
    const millionMatch = value.match(/^(\d+(?:[.,]\d+)?)\s*M$/i);
    if (millionMatch) {
        const num = parseFloat(millionMatch[1].replace(/\./g, '').replace(',', '.'));
        return !isNaN(num) ? num * 1000000 : 0;
    }
    
    // Handle values with $ sign or plain numbers
    const numMatch = value.match(/^\$?\s*([\d.,]+)\s*(.*)$/);
    if (numMatch) {
        const numStr = numMatch[1].replace(/\./g, '').replace(',', '.');
        const num = parseFloat(numStr);
        return !isNaN(num) && num > 0 ? num : 0;
    }
    
    return 0;
};

/**
 * Calculate differences between values
 * Returns deviation from average for each value
 */
export const calculateDifferences = (values: (string | number | undefined)[]): DiffResult => {
    const numericValues = values.map(parseValue).filter(v => v > 0);
    
    if (numericValues.length < 2) {
        return {
            average: numericValues[0] || 0,
            max: numericValues[0] || 0,
            min: numericValues[0] || 0,
            deviations: values.map(() => ({ value: 0, deviation: 0, isAbove: false, isSignificant: false }))
        };
    }
    
    const sum = numericValues.reduce((a, b) => a + b, 0);
    const average = sum / numericValues.length;
    const max = Math.max(...numericValues);
    const min = Math.min(...numericValues);
    
    const deviations = values.map(value => {
        const num = parseValue(value);
        if (num <= 0) {
            return { value: num, deviation: 0, isAbove: false, isSignificant: false };
        }
        
        const deviation = ((num - average) / average) * 100;
        const isSignificant = Math.abs(deviation) >= 30; // 30% threshold
        
        return {
            value: num,
            deviation: Math.round(deviation * 10) / 10,
            isAbove: deviation > 0,
            isSignificant
        };
    });
    
    return { average, max, min, deviations };
};

/**
 * Get CSS class for diff highlighting
 */
export const getDiffClass = (deviation: number, isSignificant: boolean): string => {
    if (!isSignificant) return '';
    
    if (deviation <= -30) {
        return 'bg-red-50 border-red-200'; // Significantly below average
    }
    if (deviation >= 30) {
        return 'bg-green-50 border-green-200'; // Significantly above average
    }
    
    return '';
};

/**
 * Format deviation as string
 */
export const formatDeviation = (deviation: number): string => {
    const sign = deviation > 0 ? '+' : '';
    return `${sign}${deviation.toFixed(0)}%`;
};
