"use strict";
/**
 * Narrative Generation Service
 * Uses Gemini to generate human-readable analysis summaries
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.narrativeService = void 0;
const gemini_1 = require("./gemini");
const NARRATIVE_PROMPT = `Eres un analista senior de seguros PYME. Genera un resumen ejecutivo de la cotización analizada.

CONTEXTO DE LA COTIZACIÓN:
- Aseguradora: {insurerName}
- Producto: {policyName}
- Prima anual: {priceAnnual} {currency}
- Coberturas incluidas: {coverageCount}

RESULTADOS DEL ANÁLISIS:
- Score total: {totalScore}/100
- Completitud de coberturas: {coverageScore}/100
- Favorabilidad de deducibles: {deductibleScore}/100
- Riesgo de exclusiones: {exclusionScore}/100
- Relación precio/valor: {priceScore}/100
- Impacto de sub-límites: {subLimitScore}/100
- Facilidad de garantías: {warrantyScore}/100

ALERTAS ENCONTRADAS:
{alerts}

INSTRUCCIONES:
1. Genera un párrafo conciso (máximo 1500 caracteres) para el cliente
2. Destaca las fortalezas principales de la cotización
3. Menciona riesgos o limitaciones importantes
4. Sé objetivo y profesional
5. NO uses listas numeradas, solo párrafos
6. NO repitas información obvia
7. Enfócate en diferenciadores vs el mercado

FORMATO DE SALIDA:
=== ANÁLISIS CLIENTE ===
[texto para el cliente, máx 1500 caracteres]

=== ANÁLISIS TÉCNICO ===
[notas técnicas para el corredor, máx 800 caracteres]

=== HALLAZGOS CLAVE ===
- [hallazgo 1]
- [hallazgo 2]
- [hallazgo 3]`;
exports.narrativeService = {
    /**
     * Generate narrative analysis for a quote
     */
    generateNarrative: (quote, scoringResult, crossRefResults) => __awaiter(void 0, void 0, void 0, function* () {
        console.log(`📝 [narrative] Generating narrative for ${quote.insurerName}...`);
        try {
            const prompt = buildNarrativePrompt(quote, scoringResult, crossRefResults);
            const response = yield gemini_1.geminiService.extractText(prompt, '');
            const narrative = parseNarrativeResponse(response);
            console.log(`✅ [narrative] Generated narrative (${narrative.clientAnalysis.length} chars)`);
            return narrative;
        }
        catch (error) {
            console.error('❌ [narrative] Error generating narrative:', error);
            return generateFallbackNarrative(quote, scoringResult);
        }
    })
};
function buildNarrativePrompt(quote, scoring, crossRefs) {
    // Build alerts summary
    const alerts = crossRefs.flatMap(r => r.alerts);
    const criticalAlerts = alerts.filter(a => a.level === 'CRITICAL');
    const warningAlerts = alerts.filter(a => a.level === 'WARNING');
    let alertsText = '';
    if (criticalAlerts.length > 0) {
        alertsText += `CRÍTICAS (${criticalAlerts.length}):\n`;
        criticalAlerts.slice(0, 3).forEach(a => {
            alertsText += `- ${a.title}: ${a.description}\n`;
        });
    }
    if (warningAlerts.length > 0) {
        alertsText += `ADVERTENCIAS (${warningAlerts.length}):\n`;
        warningAlerts.slice(0, 3).forEach(a => {
            alertsText += `- ${a.title}: ${a.description}\n`;
        });
    }
    if (alertsText === '') {
        alertsText = 'No se encontraron alertas significativas.';
    }
    return NARRATIVE_PROMPT
        .replace('{insurerName}', quote.insurerName)
        .replace('{policyName}', quote.policyName)
        .replace('{priceAnnual}', quote.priceAnnual.toLocaleString())
        .replace('{currency}', quote.currency)
        .replace('{coverageCount}', quote.coverages.length.toString())
        .replace('{totalScore}', scoring.totalScore.toString())
        .replace('{coverageScore}', scoring.breakdown.coverage.toString())
        .replace('{deductibleScore}', scoring.breakdown.deductibles.toString())
        .replace('{exclusionScore}', scoring.breakdown.exclusions.toString())
        .replace('{priceScore}', scoring.breakdown.priceRatio.toString())
        .replace('{subLimitScore}', scoring.breakdown.sublimits.toString())
        .replace('{warrantyScore}', scoring.breakdown.warranties.toString())
        .replace('{alerts}', alertsText);
}
function parseNarrativeResponse(response) {
    const clientMatch = response.match(/=== ANÁLISIS CLIENTE ===\n?([\s\S]*?)(?=\n=== ANÁLISIS TÉCNICO ===|$)/);
    const technicalMatch = response.match(/=== ANÁLISIS TÉCNICO ===\n?([\s\S]*?)(?=\n=== HALLAZGOS CLAVE ===|$)/);
    const findingsMatch = response.match(/=== HALLAZGOS CLAVE ===\n?([\s\S]*?)$/);
    let clientAnalysis = clientMatch ? clientMatch[1].trim() : '';
    let technicalAnalysis = technicalMatch ? technicalMatch[1].trim() : '';
    // Enforce character limits
    if (clientAnalysis.length > 1500) {
        clientAnalysis = clientAnalysis.substring(0, 1497) + '...';
    }
    if (technicalAnalysis.length > 800) {
        technicalAnalysis = technicalAnalysis.substring(0, 797) + '...';
    }
    // Extract key findings
    const keyFindings = [];
    if (findingsMatch) {
        const lines = findingsMatch[1].split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
                keyFindings.push(trimmed.substring(1).trim());
            }
        }
    }
    // If parsing failed, use fallback
    if (!clientAnalysis) {
        return generateFallbackNarrativeFromData({ insurerName: '', policyName: '', priceAnnual: 0, currency: 'COP', coverages: [], specialConditions: [], rawText: '', parseConfidence: 0 }, { totalScore: 0, breakdown: { coverage: 0, deductibles: 0, exclusions: 0, priceRatio: 0, sublimits: 0, warranties: 0 }, weights: { coverage: 0.25, deductibles: 0.2, exclusions: 0.2, priceRatio: 0.15, sublimits: 0.1, warranties: 0.1 }, quotePriceRank: 0, marketPriceAverage: 0, coverageCount: 0, expectedCoverageCount: 0, criticalAlerts: 0, warningAlerts: 0, infoAlerts: 0 });
    }
    return {
        clientAnalysis,
        technicalAnalysis,
        keyFindings
    };
}
function generateFallbackNarrative(quote, scoring) {
    return generateFallbackNarrativeFromData(quote, scoring);
}
function generateFallbackNarrativeFromData(quote, scoring) {
    const clientAnalysis = `La cotización de ${quote.insurerName} para ${quote.policyName} presenta un score general de ${scoring.totalScore}/100. Incluye ${quote.coverages.length} coberturas con una prima anual de $${quote.priceAnnual.toLocaleString()} ${quote.currency}. ${scoring.totalScore >= 70 ? 'Es una opción competitiva en el mercado.' : 'Requiere revisión de ciertos aspectos antes de recomendar.'}`;
    const technicalAnalysis = `Score: ${scoring.totalScore}/100. Coberturas: ${scoring.breakdown.coverage}/100. Deducibles: ${scoring.breakdown.deductibles}/100. Exclusiones: ${scoring.breakdown.exclusions}/100.`;
    const keyFindings = [
        scoring.breakdown.coverage >= 80 ? 'Buena cobertura de riesgos' : 'Cobertura limitada',
        scoring.breakdown.deductibles >= 70 ? 'Deducibles favorables' : 'Deducibles altos',
        scoring.breakdown.exclusions >= 70 ? 'Bajo riesgo de exclusiones' : 'Revisar exclusiones'
    ];
    return {
        clientAnalysis: clientAnalysis.substring(0, 1500),
        technicalAnalysis: technicalAnalysis.substring(0, 800),
        keyFindings
    };
}
