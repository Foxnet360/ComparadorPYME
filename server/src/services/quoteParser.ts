/**
 * Deterministic parser for insurance quote extraction
 * Converts Gemini text output into structured data using regex
 */

import { thesaurusService } from './normalization/thesaurusService';

export interface ParsedCoverage {
    name: string;           // Raw name from document
    canonicalName: string;  // Normalized name from thesaurus
    value: string;
    deductible: string;
    confidence: number;
}

export interface ParsedQuote {
    insurerName: string;
    policyName: string;
    priceAnnual: number;
    currency: string;
    coverages: ParsedCoverage[];
    validityPeriod?: string;
    specialConditions: string[];
    rawText: string;
    parseConfidence: number;
}

export const quoteParser = {
    /**
     * Main entry point: parse Gemini text output into structured quote data
     */
    parse: (rawText: string): ParsedQuote => {
        console.log('🔍 [quoteParser] Parsing Gemini output...');
        
        const insurerName = extractField(rawText, 'ASEGURADORA:', 'PÓLIZA:');
        const policyName = extractField(rawText, 'PÓLIZA:', 'PRIMA');
        const priceText = extractField(rawText, 'PRIMA ANUAL:', 'MONEDA:');
        const currency = extractField(rawText, 'MONEDA:', 'VIGENCIA:');
        const validity = extractField(rawText, 'VIGENCIA:', 'COBERTURAS:');
        
        const coverages = extractCoverages(rawText);
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
     */
    parseMultiple: (combinedText: string): ParsedQuote[] => {
        // Split by quote delimiters if present
        const quoteRegex = /=== INICIO COTIZACI[ÓO]N: (.+?) ===([\s\S]*?)=== FIN COTIZACI[ÓO]N ===/g;
        const matches = [...combinedText.matchAll(quoteRegex)];
        
        if (matches.length === 0) {
            // No delimiters found, try to parse as single quote
            return [quoteParser.parse(combinedText)];
        }
        
        return matches.map(match => quoteParser.parse(match[0]));
    }
};

// Helper functions
function extractField(text: string, startMarker: string, endMarker: string): string {
    const regex = new RegExp(`${startMarker}\\s*([^\\n]+?)(?=\\n|${endMarker}|$)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
}

function extractCoverages(text: string): ParsedCoverage[] {
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
        
        coverages.push({
            name: rawName,
            canonicalName,
            value: match[2].trim(),
            deductible: match[3].trim(),
            confidence: canonicalName !== rawName ? 95 : 70
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