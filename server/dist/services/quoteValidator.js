"use strict";
/**
 * Quote Validation Module
 * Pure validation functions for extracted quote data
 * All functions are deterministic and testable
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePremium = validatePremium;
exports.validateCoverageCompleteness = validateCoverageCompleteness;
exports.validateDeductibleFormat = validateDeductibleFormat;
exports.validateCoverageValues = validateCoverageValues;
exports.validateNumericParsing = validateNumericParsing;
exports.validateConsistency = validateConsistency;
exports.validateQuote = validateQuote;
exports.getValidationSummary = getValidationSummary;
// Expected PYME coverages
const EXPECTED_COVERAGES = [
    'Incendio (Edificio y Contenidos)',
    'Lucro Cesante',
    'Sustracción / Hurto',
    'Equipo Eléctrico y Electrónico',
    'Rotura de Maquinaria',
    'Responsabilidad Civil (RCE)',
    'Vidrios Planos',
    'Manejo Global / Infidelidad',
    'Transporte de Mercancías',
    'Transporte de Valores',
    'Asistencia PYME',
    'Asistencia Legal',
    'Huelga, Motín, Asonada (HMACC)',
    'Terremoto y Eventos Catastróficos'
];
// Validation constants
const PREMIUM_MIN = 100000;
const PREMIUM_MAX = 500000000;
const INSURED_AMOUNT_MAX = 10000000000;
const HIGH_DEDUCTIBLE_PERCENTAGE = 50;
/**
 * Validate premium amount is within reasonable range
 */
function validatePremium(quote) {
    if (!quote.priceAnnual || quote.priceAnnual === 0) {
        return {
            field: 'priceAnnual',
            severity: 'CRITICAL',
            message: 'Prima anual no especificada o es 0',
            code: 'PREMIUM_MISSING'
        };
    }
    if (quote.priceAnnual < PREMIUM_MIN) {
        return {
            field: 'priceAnnual',
            severity: 'WARNING',
            message: `Prima anual (${quote.priceAnnual}) está por debajo del mínimo esperado (${PREMIUM_MIN})`,
            code: 'PREMIUM_SUSPECT'
        };
    }
    if (quote.priceAnnual > PREMIUM_MAX) {
        return {
            field: 'priceAnnual',
            severity: 'WARNING',
            message: `Prima anual (${quote.priceAnnual}) excede el máximo esperado (${PREMIUM_MAX})`,
            code: 'PREMIUM_SUSPECT'
        };
    }
    return null;
}
/**
 * Validate coverage completeness
 * Uses expectedCoverages if available, otherwise falls back to coverages array
 */
function validateCoverageCompleteness(quote) {
    // Use expectedCoverages if available (from structured extraction)
    if (quote.expectedCoverages && Array.isArray(quote.expectedCoverages)) {
        const expectedCoverages = quote.expectedCoverages;
        const missingCount = expectedCoverages.filter((c) => c.status === 'missing').length;
        const excludedCount = expectedCoverages.filter((c) => c.status === 'excluded').length;
        const presentCount = expectedCoverages.filter((c) => c.status === 'present').length;
        if (missingCount > 0) {
            const missingNames = expectedCoverages
                .filter((c) => c.status === 'missing')
                .map((c) => c.name)
                .slice(0, 3);
            return {
                field: 'coverages',
                severity: 'WARNING',
                message: `Faltan ${missingCount} coberturas: ${missingNames.join(', ')}${missingCount > 3 ? '...' : ''}`,
                code: 'COVERAGES_INCOMPLETE'
            };
        }
        return null;
    }
    // Fallback to legacy validation using coverages array
    if (!quote.coverages || quote.coverages.length === 0) {
        return {
            field: 'coverages',
            severity: 'WARNING',
            message: `Faltan ${EXPECTED_COVERAGES.length} coberturas: ${EXPECTED_COVERAGES.slice(0, 3).join(', ')}...`,
            code: 'COVERAGES_INCOMPLETE'
        };
    }
    const coverageNames = quote.coverages.map(c => c.name);
    const missingCoverages = EXPECTED_COVERAGES.filter(expected => !coverageNames.some(name => name.toLowerCase().includes(expected.toLowerCase()) ||
        expected.toLowerCase().includes(name.toLowerCase())));
    if (missingCoverages.length > 0) {
        return {
            field: 'coverages',
            severity: 'WARNING',
            message: `Faltan ${missingCoverages.length} coberturas: ${missingCoverages.slice(0, 3).join(', ')}${missingCoverages.length > 3 ? '...' : ''}`,
            code: 'COVERAGES_INCOMPLETE'
        };
    }
    return null;
}
/**
 * Validate deductible format
 */
function validateDeductibleFormat(deductible) {
    if (!deductible || deductible === '') {
        return null; // Empty is acceptable
    }
    if (deductible.toLowerCase() === 'no aplica') {
        return null;
    }
    // Check for percentage format (e.g., "10%", "10% / Mín. 2 SMMLV")
    const percentageMatch = deductible.match(/(\d+(?:\.\d+)?)\s*%/);
    if (percentageMatch) {
        const percentage = parseFloat(percentageMatch[1]);
        if (percentage > HIGH_DEDUCTIBLE_PERCENTAGE) {
            return {
                field: 'deductible',
                severity: 'WARNING',
                message: `Deducible de ${percentage}% es inusualmente alto`,
                code: 'DEDUCTIBLE_HIGH_PERCENTAGE'
            };
        }
        return null;
    }
    // Check for SMMLV format (e.g., "5 SMMLV", "2 SM")
    const smmlvMatch = deductible.match(/(\d+)\s*(?:SMMLV|SM)/i);
    if (smmlvMatch) {
        return null;
    }
    // Check for fixed amount (e.g., "$500,000", "500000")
    const fixedMatch = deductible.match(/[$\s]*(\d+(?:[.,]\d+)*)/);
    if (fixedMatch) {
        return null;
    }
    // Unrecognized format
    return {
        field: 'deductible',
        severity: 'INFO',
        message: `Formato de deducible no reconocido: "${deductible}"`,
        code: 'DEDUCTIBLE_UNRECOGNIZED_FORMAT'
    };
}
/**
 * Validate all coverages have proper values
 */
function validateCoverageValues(quote) {
    const flags = [];
    for (const coverage of (quote.coverages || [])) {
        // Check for missing values
        if (!coverage.value || coverage.value === '') {
            flags.push({
                field: `coverage.${coverage.name}.value`,
                severity: 'WARNING',
                message: `Cobertura "${coverage.name}" no tiene valor especificado`,
                code: 'COVERAGE_VALUE_MISSING'
            });
            continue;
        }
        // Check if value looks like a monetary amount
        if (coverage.value !== 'NO ESPECIFICADO' && coverage.value !== 'EXCLUIDO') {
            const numericValue = parseFloat(coverage.value.replace(/[\$\s.,]/g, ''));
            if (!isNaN(numericValue) && numericValue > INSURED_AMOUNT_MAX) {
                flags.push({
                    field: `coverage.${coverage.name}.value`,
                    severity: 'WARNING',
                    message: `Valor asegurado ${coverage.value} excede el máximo esperado`,
                    code: 'COVERAGE_VALUE_TOO_HIGH'
                });
            }
        }
        // Validate deductible
        const deductibleFlag = validateDeductibleFormat(coverage.deductible);
        if (deductibleFlag) {
            flags.push(Object.assign(Object.assign({}, deductibleFlag), { field: `coverage.${coverage.name}.deductible` }));
        }
    }
    return flags;
}
/**
 * Check if a coverage value is valid (numeric or descriptive text)
 */
function isValidCoverageValue(value) {
    if (!value || value === 'NO ESPECIFICADO' || value === 'EXCLUIDO')
        return false;
    const trimmed = value.trim().toLowerCase();
    // Numeric values
    const cleaned = value.replace(/[\$\s.,]/g, '');
    if (!isNaN(parseFloat(cleaned)) && cleaned !== '')
        return true;
    // Common descriptive values that indicate valid coverage
    const validPatterns = [
        /^incluid[oa]/i,
        /^aplica/i,
        /^seguro\s+al/i,
        /^hasta\s+el/i,
        /^cobertura/i,
        /^amparo/i,
        /^garantía/i,
        /^sublímite/i,
        /^deducible/i,
        /^franquicia/i,
        /^\d+%/,
    ];
    return validPatterns.some(pattern => pattern.test(trimmed));
}
/**
 * Validate numeric fields parse correctly
 */
function validateNumericParsing(quote) {
    const hasInvalidNumeric = (quote.coverages || []).some(c => {
        if (c.value === 'NO ESPECIFICADO' || c.value === 'EXCLUIDO')
            return false;
        return !isValidCoverageValue(c.value);
    });
    if (hasInvalidNumeric) {
        return {
            field: 'coverages',
            severity: 'WARNING',
            message: 'Algunos valores numéricos no pudieron ser parseados correctamente',
            code: 'NUMERIC_PARSE_ERROR'
        };
    }
    return null;
}
/**
 * Validate cross-field consistency
 */
function validateConsistency(quote) {
    const flags = [];
    // Check currency consistency
    if (quote.currency === 'COP' && quote.coverages && quote.coverages.length > 0) {
        const hasUSDFormat = quote.coverages.some(c => c.value.includes('$') && !c.value.includes('.'));
        if (hasUSDFormat) {
            flags.push({
                field: 'currency',
                severity: 'INFO',
                message: 'Moneda es COP pero algunos valores usan formato USD',
                code: 'CURRENCY_FORMAT_MISMATCH'
            });
        }
    }
    // Check if total coverage values are reasonable compared to premium
    const coverageValues = (quote.coverages || [])
        .map(c => {
        if (c.value === 'NO ESPECIFICADO' || c.value === 'EXCLUIDO')
            return 0;
        return parseFloat(c.value.replace(/[\$\s.,]/g, '')) || 0;
    })
        .filter(v => v > 0);
    if (coverageValues.length > 0 && quote.priceAnnual > 0) {
        const totalCoverage = coverageValues.reduce((a, b) => a + b, 0);
        if (totalCoverage < quote.priceAnnual * 10) {
            flags.push({
                field: 'coverages',
                severity: 'INFO',
                message: 'Suma total de coberturas es baja en relación a la prima (posible subaseguro)',
                code: 'PREMIUM_COVERAGE_RATIO'
            });
        }
    }
    return flags;
}
/**
 * Main validation function - runs all validators
 */
function validateQuote(quote) {
    var _a;
    const flags = [];
    // Run all validators
    const premiumFlag = validatePremium(quote);
    if (premiumFlag)
        flags.push(premiumFlag);
    const completenessFlag = validateCoverageCompleteness(quote);
    if (completenessFlag)
        flags.push(completenessFlag);
    const valueFlags = validateCoverageValues(quote);
    flags.push(...valueFlags);
    const numericFlag = validateNumericParsing(quote);
    if (numericFlag)
        flags.push(numericFlag);
    const consistencyFlags = validateConsistency(quote);
    flags.push(...consistencyFlags);
    // Determine overall validity
    const criticalCount = flags.filter(f => f.severity === 'CRITICAL').length;
    const hasCriticalErrors = criticalCount > 0;
    return {
        isValid: !hasCriticalErrors,
        flags,
        coverageCount: ((_a = quote.coverages) === null || _a === void 0 ? void 0 : _a.length) || 0,
        expectedCoverageCount: EXPECTED_COVERAGES.length,
        numericParseSuccess: !numericFlag,
        premiumSource: quote.premiumSource || 'unknown'
    };
}
/**
 * Get validation summary for display
 */
function getValidationSummary(result) {
    const critical = result.flags.filter(f => f.severity === 'CRITICAL').length;
    const warnings = result.flags.filter(f => f.severity === 'WARNING').length;
    const info = result.flags.filter(f => f.severity === 'INFO').length;
    return `${result.coverageCount}/${result.expectedCoverageCount} coberturas | ${critical} críticas | ${warnings} advertencias | ${info} info`;
}
