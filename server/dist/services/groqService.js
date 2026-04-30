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
exports.groqService = void 0;
const groq_sdk_1 = require("groq-sdk");
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const DEFAULT_MODEL = 'llama-3.1-70b-versatile';
let groqClient = null;
exports.groqService = {
    /**
     * Crea u obtiene cliente Groq
     */
    getClient: () => {
        if (!GROQ_API_KEY) {
            throw new Error('GROQ_API_KEY not configured');
        }
        if (!groqClient) {
            groqClient = new groq_sdk_1.Groq({ apiKey: GROQ_API_KEY });
        }
        return groqClient;
    },
    /**
     * Analiza una cotización usando Groq con contexto RAG
     */
    analyzeQuote: (quoteText, ragContext) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        const client = exports.groqService.getClient();
        const contextSection = ragContext.chunks
            .map((chunk, i) => `--- Contexto ${i + 1} ---\n${chunk}`)
            .join('\n\n');
        const prompt = `Eres un experto analista de seguros. Analiza la siguiente cotización de seguro contra el contexto de las cláusulas proporcionado.

**COTIZACIÓN:**
${quoteText}

**CONTEXTO DE CLÁUSULAS (para referencias):**
${contextSection}

**INSTRUCCIONES:**
1. Extrae la información de la cotización (aseguradora, coberturas, prima, deducibles)
2. Analiza las coberturas comparándolas con las cláusulas proporcionadas
3. Identifica alertas (críticas, advertencias, buenas prácticas)
4. Genera un dictamen con recomendación
5. Incluye citas de las cláusulas relevantes

**FORMATO DE RESPUESTA (JSON):**
{
  "insurerName": "nombre de aseguradora",
  "policyName": "nombre de póliza",
  "priceAnnual": 1000000,
  "coverages": [
    {"name": "nombre", "limit": "valor", "premium": "valor", "included": true}
  ],
  "deductibles": [
    {"type": "tipo", "value": "valor", "percentage": "porcentaje"}
  ],
  "scoringBreakdown": {
    "coverageScore": 80,
    "deductibleScore": 70,
    "priceScore": 60,
    "finalScore": 70
  },
  "score": 70,
  "alerts": [
    {"type": "CRITICAL|WARNING|GOOD", "message": "mensaje", "clauseReference": "referencia"}
  ],
  "recommendation": "dictamen",
  "citations": [
    {"clauseId": "1.1", "section": "SECCIÓN I", "page": 5, "excerpt": "texto relevante"}
  ]
}

Responde solo con JSON válido, sin texto adicional.`;
        let lastError = null;
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const completion = yield client.chat.completions.create({
                    model: DEFAULT_MODEL,
                    messages: [
                        { role: 'system', content: 'Eres un experto analista de seguros. Respondes siempre en JSON válido.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0,
                    max_tokens: 4000,
                    response_format: { type: 'json_object' },
                });
                const responseText = ((_b = (_a = completion.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) || '{}';
                try {
                    const result = JSON.parse(responseText);
                    return result;
                }
                catch (parseError) {
                    console.warn('Failed to parse JSON, attempting extraction');
                    return exports.groqService.extractJsonFromResponse(responseText);
                }
            }
            catch (error) {
                lastError = error;
                console.error(`Groq attempt ${attempt} failed:`, error.message);
                if (error.status === 429) {
                    const delay = Math.pow(2, attempt) * 1000;
                    console.log(`Rate limited, waiting ${delay}ms...`);
                    yield new Promise(resolve => setTimeout(resolve, delay));
                }
                else if (attempt === maxRetries) {
                    throw error;
                }
            }
        }
        throw lastError || new Error('Max retries exceeded');
    }),
    /**
     * Extrae JSON de respuesta malformada
     */
    extractJsonFromResponse: (responseText) => {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            }
            catch (_a) {
                // Continue to fallback
            }
        }
        return {
            insurerName: 'Unknown',
            policyName: 'Unknown',
            priceAnnual: 0,
            coverages: [],
            deductibles: [],
            scoringBreakdown: {
                coverageScore: 0,
                deductibleScore: 0,
                priceScore: 0,
                finalScore: 0,
            },
            score: 0,
            alerts: [{ type: 'WARNING', message: 'Could not parse analysis result' }],
            recommendation: 'Error al analizar la cotización',
            citations: [],
        };
    },
    /**
     * Extrae coberturas de texto de cotización
     */
    extractCoverages: (quoteText) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        const client = exports.groqService.getClient();
        const prompt = `Extrae las coberturas de la siguiente cotización de seguro. 
Devuelve una lista de coberturas en JSON:

**COTIZACIÓN:**
${quoteText}

**FORMATO:**
[
  {"name": "nombre de cobertura", "limit": "límite", "premium": "prima", "included": true}
]`;
        try {
            const completion = yield client.chat.completions.create({
                model: 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
                max_tokens: 1000,
                response_format: { type: 'json_object' },
            });
            const responseText = ((_b = (_a = completion.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) || '[]';
            const coverages = JSON.parse(responseText);
            return coverages;
        }
        catch (error) {
            console.error('Failed to extract coverages:', error);
            return [];
        }
    }),
    /**
     * Identifica secciones usando LLM (para fallback de chunking)
     */
    identifySections: (text) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        const client = exports.groqService.getClient();
        const prompt = `Analiza el siguiente texto de un documento legal de seguro e identifica hasta 10 secciones principales.
Devuelve solo los títulos de las secciones, uno por línea, numerados:

**TEXTO:**
${text.substring(0, 5000)}

Ejemplo de formato:
1. DEFINICIONES
2. COBERTURAS
3. EXCLUSIONES
...`;
        try {
            const completion = yield client.chat.completions.create({
                model: 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
                max_tokens: 500,
            });
            const responseText = ((_b = (_a = completion.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) || '';
            const sections = responseText
                .split('\n')
                .filter((line) => /^\d+\./.test(line.trim()))
                .map((line) => line.replace(/^\d+\.\s*/, '').trim())
                .slice(0, 10);
            return sections;
        }
        catch (error) {
            console.error('Failed to identify sections:', error);
            return [];
        }
    }),
};
