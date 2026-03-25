import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { ClauseSections } from '../types';

// Schema for section extraction response
const SECTION_SCHEMA = {
    type: SchemaType.OBJECT as const,
    properties: {
        exclusiones: {
            type: SchemaType.STRING as const,
            description: "Texto completo de la sección de exclusiones del seguro",
            nullable: true
        },
        deducibles: {
            type: SchemaType.STRING as const,
            description: "Texto completo de la sección de deducibles/franquicias",
            nullable: true
        },
        garantias: {
            type: SchemaType.STRING as const,
            description: "Texto completo de la sección de garantías/obligaciones del asegurado",
            nullable: true
        }
    },
    required: ["exclusiones", "deducibles", "garantias"]
};

const EXTRACTION_PROMPT = `Eres un experto en seguros de Colombia. Del siguiente clausulado de seguro, extrae ÚNICAMENTE estas 3 secciones críticas:

1. **EXCLUSIONES**: Todo lo que el seguro NO cubre. Busca secciones tituladas:
   - "Exclusiones Generales"
   - "Riesgos No Cubiertos"
   - "No Ampara"
   - "Exclusiones Particulares"
   - Similar

2. **DEDUCIBLES**: Valores, porcentajes y condiciones de deducibles. Busca:
   - "Deducibles"
   - "Franquicias"
   - "Participación del Asegurado"
   - Tablas de deducibles por tipo de siniestro
   - Similar

3. **GARANTÍAS**: Obligaciones del asegurado para que el seguro sea válido. Busca:
   - "Garantías"
   - "Obligaciones del Asegurado"
   - "Condiciones de la Cobertura"
   - "Requisitos del Asegurado"
   - Similar

IMPORTANTE:
- Extrae el texto COMPLETO de cada sección, no resumas
- Si una sección no existe claramente, pon "No especificado en el documento"
- Mantén el formato original del texto (numeración, viñetas, etc.)

CLAUSULADO A ANALIZAR:
`;

export const sectionExtractor = {
    /**
     * Extract key sections from a clause document using Gemini AI
     */
    extractSections: async (textoCompleto: string): Promise<ClauseSections> => {
        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

        if (!apiKey) {
            console.error('❌ No Gemini API key found for section extraction');
            return {};
        }

        try {
            console.log('🔍 Extracting sections from clause document...');
            console.log(`📄 Document length: ${textoCompleto.length} chars (~${Math.ceil(textoCompleto.length / 4)} tokens)`);

            const genAI = new GoogleGenerativeAI(apiKey);

            // Use Flash model for cost efficiency
            const model = genAI.getGenerativeModel({
                model: 'models/gemini-2.5-flash',
                generationConfig: {
                    responseMimeType: 'application/json',
                    responseSchema: SECTION_SCHEMA,
                    temperature: 0, // Zero temperature for maximum consistency
                }
            });

            // Truncate if too long (Flash has 1M context but we want efficiency)
            const maxChars = 500000; // ~125k tokens
            const truncatedText = textoCompleto.length > maxChars
                ? textoCompleto.substring(0, maxChars) + '\n\n[DOCUMENTO TRUNCADO POR LONGITUD]'
                : textoCompleto;

            const prompt = EXTRACTION_PROMPT + truncatedText;

            // Set timeout for long documents
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

            const result = await model.generateContent(prompt);
            clearTimeout(timeoutId);

            const response = result.response;
            const text = response.text();

            const sections: ClauseSections = JSON.parse(text);

            // Log success with section sizes
            console.log('✅ Sections extracted successfully:');
            console.log(`   - Exclusiones: ${sections.exclusiones?.length || 0} chars`);
            console.log(`   - Deducibles: ${sections.deducibles?.length || 0} chars`);
            console.log(`   - Garantías: ${sections.garantias?.length || 0} chars`);

            const totalSectionChars = (sections.exclusiones?.length || 0) +
                (sections.deducibles?.length || 0) +
                (sections.garantias?.length || 0);
            const reduction = ((textoCompleto.length - totalSectionChars) / textoCompleto.length * 100).toFixed(1);
            console.log(`📊 Size reduction: ${reduction}% (${textoCompleto.length} → ${totalSectionChars} chars)`);

            return sections;

        } catch (error: any) {
            console.error('❌ Section extraction failed:', error.message);

            // Graceful fallback - return empty sections
            // The clause can still be used with full text
            return {};
        }
    },

    /**
     * Check if sections have been extracted
     */
    hasSections: (sections: ClauseSections): boolean => {
        return !!(sections.exclusiones || sections.deducibles || sections.garantias);
    },

    /**
     * Format sections for prompt inclusion
     */
    formatForPrompt: (sections: ClauseSections, aseguradora: string, producto: string): string => {
        const parts: string[] = [];

        parts.push(`=== ${aseguradora} - ${producto} ===`);

        if (sections.exclusiones) {
            parts.push('\n📛 EXCLUSIONES:');
            parts.push(sections.exclusiones);
        }

        if (sections.deducibles) {
            parts.push('\n💰 DEDUCIBLES:');
            parts.push(sections.deducibles);
        }

        if (sections.garantias) {
            parts.push('\n✅ GARANTÍAS:');
            parts.push(sections.garantias);
        }

        parts.push('===\n');

        return parts.join('\n');
    }
};
