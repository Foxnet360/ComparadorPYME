/**
 * Deterministic parser for insurance quote extraction
 * Converts Gemini text output into structured data using regex
 * 
 * @deprecated This parser is deprecated in favor of multimodal extraction
 * Use coverageNormalizer.ts for post-processing of AI-extracted data
 * Kept as emergency fallback when Gemini File API is unavailable
 * @see extractFromPdfWithVision() in gemini.ts
 * @see buildCanonicalCoverages() in coverageNormalizer.ts
 */

import { thesaurusService } from './normalization/thesaurusService';
import { semanticMatcher } from './semanticMatcher';

export interface ParsedCoverage {
    name: string;           // Raw name from document
    canonicalName: string;  // Normalized name from thesaurus
    value: string;
    deductible: string;
    confidence: number;
    // Semantic matching fields
    categoryId?: number | null;
    matchConfidence?: number;
    matchMethod?: 'thesaurus' | 'fuzzy' | 'embedding' | 'llm' | null;
}

export interface ExpectedCoverage {
    name: string;
    status: 'present' | 'missing' | 'excluded';
    value: string | null;
    deductible: string | null;
}

export interface ParsedQuote {
    insurerName: string;
    policyName: string;
    priceAnnual: number;
    currency: string;
    coverages: ParsedCoverage[];
    uncategorizedCoverages?: ParsedCoverage[];
    validityPeriod?: string;
    specialConditions: string[];
    rawText: string;
    parseConfidence: number;
    expectedCoverages?: ExpectedCoverage[];
}

export const quoteParser = {
    /**
     * Main entry point: parse Gemini text output into structured quote data
     * @deprecated Use multimodal extraction with coverage normalization instead
     */
    parse: async (rawText: string): Promise<ParsedQuote> => {
        console.log('🔍 [quoteParser] Parsing Gemini output...');
        
        const insurerName = extractField(rawText, 'ASEGURADORA:', 'PÓLIZA:');
        const policyName = extractField(rawText, 'PÓLIZA:', 'PRIMA');
        const priceText = extractField(rawText, 'PRIMA ANUAL:', 'MONEDA:');
        const currency = extractField(rawText, 'MONEDA:', 'VIGENCIA:');
        const validity = extractField(rawText, 'VIGENCIA:', 'COBERTURAS:');
        
        const coverages = await extractCoverages(rawText);
        const specialConditions = extractSpecialConditions(rawText);
        
        // Calculate overall parse confidence
        const confidence = calculateConfidence(
            insurerName, policyName, priceText, coverages
        );
        
        const quote: ParsedQuote = {
            insurerName: insurerName || 'NO ESPECIFICADO',
            policyName: policyName || 'NO ESPECIFICADO',
            priceAnnual: parsePrice(priceText),
            currency: currency || 'COP',
            coverages,
            validityPeriod: validity || undefined,
            specialConditions,
            rawText,
            parseConfidence: confidence
        };
        
        console.log(`✅ [quoteParser] Parsed ${coverages.length} coverages, confidence: ${confidence}%`);
        
        return quote;
    },

    /**
     * Parse multiple quotes from combined text
     * @deprecated Use processQuoteMultimodal() or processQuoteLegacy() instead
     */
    parseMultiple: async (combinedText: string): Promise<ParsedQuote[]> => {
        // Split by quote delimiters if present
        const quoteRegex = /=== INICIO COTIZACI[ÓO]N: (.+?) ===([\s\S]*?)=== FIN COTIZACI[ÓO]N ===/g;
        const matches = [...combinedText.matchAll(quoteRegex)];
        
        if (matches.length === 0) {
            // No delimiters found, try to parse as single quote
            return [await quoteParser.parse(combinedText)];
        }
        
        const quotes: ParsedQuote[] = [];
        for (const match of matches) {
            quotes.push(await quoteParser.parse(match[0]));
        }
        return quotes;
    }
};

// Helper functions
function extractField(text: string, startMarker: string, endMarker: string): string {
    const regex = new RegExp(`${startMarker}\\s*([^\\n]+?)(?=\\n|${endMarker}|$)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
}

async function extractCoverages(text: string): Promise<ParsedCoverage[]> {
    const coverages: ParsedCoverage[] = [];
    
    // Look for coverage section
    const coverageSection = extractSection(text, 'COBERTURAS:', 'CONDICIONES');
    if (!coverageSection) return coverages;
    
    // Pattern: - Name: Value
    //   Deducible: X%
    const coverageRegex = /^-\s+([^:]+):\s*([^\n]+)\n\s*Deducible:\s*([^\n]+)/gm;
    let match;
    
    while ((match = coverageRegex.exec(coverageSection)) !== null) {
        const rawName = match[1].trim();
        const canonicalName = normalizeCoverageName(rawName);
        
        // Apply semantic matching
        const semanticMatch = await semanticMatcher.matchCoverage(rawName);
        
        coverages.push({
            name: rawName,
            canonicalName: semanticMatch.canonicalName || canonicalName || rawName,
            value: match[2].trim(),
            deductible: match[3].trim(),
            confidence: canonicalName !== rawName ? 95 : 70,
            categoryId: semanticMatch.categoryId,
            matchConfidence: semanticMatch.confidence,
            matchMethod: semanticMatch.method,
        });
    }
    
    return coverages;
}

function extractSpecialConditions(text: string): string[] {
    const conditions: string[] = [];
    const section = extractSection(text, 'CONDICIONES ESPECIALES:', '=== FIN');
    
    if (!section) return conditions;
    
    const lines = section.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('-')) {
            conditions.push(trimmed.substring(1).trim());
        }
    }
    
    return conditions;
}

function extractSection(text: string, startMarker: string, endMarker: string): string {
    const startIdx = text.indexOf(startMarker);
    if (startIdx === -1) return '';
    
    const endIdx = text.indexOf(endMarker, startIdx);
    if (endIdx === -1) return text.substring(startIdx + startMarker.length);
    
    return text.substring(startIdx + startMarker.length, endIdx);
}

function normalizeCoverageName(rawName: string): string {
    const normalized = rawName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Check thesaurus for matches
    const coberturas = thesaurusService.listCoberturas();
    
    for (const cobertura of coberturas) {
        const definition = thesaurusService.getCoberturaDefinition(cobertura);
        if (!definition) continue;
        
        // Check synonyms
        const sinonimos = definition.sinonimos.map(s => 
            s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        );
        
        // Check search terms
        const terminos = definition.terminos_busqueda.map(t =>
            t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        );
        
        const allTerms = [...sinonimos, ...terminos];
        
        // Check if any term is contained in the raw name or vice versa
        if (allTerms.some(term => normalized.includes(term) || term.includes(normalized))) {
            return cobertura;
        }
    }
    
    return rawName; // Return raw name if no match found
}

function parsePrice(priceText: string): number {
    if (!priceText) return 0;
    
    // Remove currency symbols and dots (thousand separators)
    const cleaned = priceText
        .replace(/[$\s.]/g, '')
        .replace(/,/g, ''); // Remove comma if used as thousand separator
    
    const match = cleaned.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
}

function calculateConfidence(
    insurer: string, 
    policy: string, 
    price: string, 
    coverages: ParsedCoverage[]
): number {
    let score = 0;
    
    if (insurer) score += 25;
    if (policy) score += 20;
    if (price && parsePrice(price) > 0) score += 25;
    if (coverages.length > 0) score += 30;
    
    return score;
}