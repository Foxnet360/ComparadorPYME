"use strict";
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
exports.sectionExtractor = void 0;
const generative_ai_1 = require("@google/generative-ai");
// Schema for section extraction response
const SECTION_SCHEMA = {
    type: generative_ai_1.SchemaType.OBJECT,
    properties: {
        exclusiones: {
            type: generative_ai_1.SchemaType.STRING,
            description: "Texto completo de la sección de exclusiones del seguro",
            nullable: true
        },
        deducibles: {
            type: generative_ai_1.SchemaType.STRING,
            description: "Texto completo de la sección de deducibles/franquicias",
            nullable: true
        },
        garantias: {
            type: generative_ai_1.SchemaType.STRING,
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
exports.sectionExtractor = {
    /**
     * Extract key sections from a clause document using Gemini AI
     */
    extractSections: (textoCompleto) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            console.error('❌ No Gemini API key found for section extraction');
            return {};
        }
        try {
            console.log('🔍 Extracting sections from clause document...');
            console.log(`📄 Document length: ${textoCompleto.length} chars (~${Math.ceil(textoCompleto.length / 4)} tokens)`);
            const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
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
            const result = yield model.generateContent(prompt);
            clearTimeout(timeoutId);
            const response = result.response;
            const text = response.text();
            const sections = JSON.parse(text);
            // Log success with section sizes
            console.log('✅ Sections extracted successfully:');
            console.log(`   - Exclusiones: ${((_a = sections.exclusiones) === null || _a === void 0 ? void 0 : _a.length) || 0} chars`);
            console.log(`   - Deducibles: ${((_b = sections.deducibles) === null || _b === void 0 ? void 0 : _b.length) || 0} chars`);
            console.log(`   - Garantías: ${((_c = sections.garantias) === null || _c === void 0 ? void 0 : _c.length) || 0} chars`);
            const totalSectionChars = (((_d = sections.exclusiones) === null || _d === void 0 ? void 0 : _d.length) || 0) +
                (((_e = sections.deducibles) === null || _e === void 0 ? void 0 : _e.length) || 0) +
                (((_f = sections.garantias) === null || _f === void 0 ? void 0 : _f.length) || 0);
            const reduction = ((textoCompleto.length - totalSectionChars) / textoCompleto.length * 100).toFixed(1);
            console.log(`📊 Size reduction: ${reduction}% (${textoCompleto.length} → ${totalSectionChars} chars)`);
            return sections;
        }
        catch (error) {
            console.error('❌ Section extraction failed:', error.message);
            // Graceful fallback - return empty sections
            // The clause can still be used with full text
            return {};
        }
    }),
    /**
     * Check if sections have been extracted
     */
    hasSections: (sections) => {
        return !!(sections.exclusiones || sections.deducibles || sections.garantias);
    },
    /**
     * Format sections for prompt inclusion
     */
    formatForPrompt: (sections, aseguradora, producto) => {
        const parts = [];
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
