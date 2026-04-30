"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.thesaurusService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function resolveThesaurusPath() {
    const candidates = [
        path_1.default.join(__dirname, '../../data/thesaurus.json'),
        path_1.default.join(__dirname, '../data/thesaurus.json'),
        path_1.default.join(process.cwd(), 'src/data/thesaurus.json'),
        path_1.default.join(process.cwd(), 'server/src/data/thesaurus.json'),
    ];
    for (const candidate of candidates) {
        if (fs_1.default.existsSync(candidate)) {
            return candidate;
        }
    }
    return candidates[0];
}
// Cargar tesauro al iniciar
const thesaurusPath = resolveThesaurusPath();
let thesaurusCache = null;
function loadThesaurus() {
    if (thesaurusCache) {
        return thesaurusCache;
    }
    try {
        const data = fs_1.default.readFileSync(thesaurusPath, 'utf-8');
        thesaurusCache = JSON.parse(data);
        console.log('📚 [Thesaurus Service] Loaded version:', thesaurusCache === null || thesaurusCache === void 0 ? void 0 : thesaurusCache.version);
        return thesaurusCache;
    }
    catch (error) {
        console.error('❌ [Thesaurus Service] Failed to load thesaurus:', error);
        throw new Error('Failed to load thesaurus data');
    }
}
exports.thesaurusService = {
    /**
     * Obtiene el tesauro completo
     */
    getThesaurus: () => {
        return loadThesaurus();
    },
    /**
     * Obtiene la definición de una cobertura de la plantilla
     */
    getCoberturaDefinition: (nombrePlantilla) => {
        const thesaurus = loadThesaurus();
        return thesaurus.coberturas_plantilla[nombrePlantilla] || null;
    },
    /**
     * Lista todas las coberturas de la plantilla PYME
     */
    listCoberturas: () => {
        const thesaurus = loadThesaurus();
        return Object.keys(thesaurus.coberturas_plantilla);
    },
    /**
     * Normaliza un término usando el tesauro
     */
    normalizeTerm: (term) => {
        const normalized = term
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
        return normalized;
    },
    /**
     * Obtiene sinónimos para un término estándar
     */
    getSynonyms: (standardTerm) => {
        const definition = exports.thesaurusService.getCoberturaDefinition(standardTerm);
        if (definition) {
            return definition.sinonimos;
        }
        return [];
    },
    /**
     * Expande una query con términos relacionados del tesauro
     */
    expandQuery: (query, coberturaNombre) => {
        const terms = [query];
        const normalizedQuery = exports.thesaurusService.normalizeTerm(query);
        // Si se especifica una cobertura de plantilla, usar sus términos de búsqueda
        if (coberturaNombre) {
            const definition = exports.thesaurusService.getCoberturaDefinition(coberturaNombre);
            if (definition) {
                terms.push(...definition.terminos_busqueda);
            }
        }
        // Buscar en todas las coberturas si el query coincide con algún sinónimo
        const thesaurus = loadThesaurus();
        for (const [nombre, definicion] of Object.entries(thesaurus.coberturas_plantilla)) {
            const sinonimosNormalizados = definicion.sinonimos.map(s => exports.thesaurusService.normalizeTerm(s));
            if (sinonimosNormalizados.includes(normalizedQuery) ||
                exports.thesaurusService.normalizeTerm(nombre).includes(normalizedQuery)) {
                terms.push(nombre);
                terms.push(...definicion.terminos_busqueda);
            }
        }
        // Eliminar duplicados
        return [...new Set(terms)];
    },
    /**
     * Encuentra la cobertura de plantilla que mejor coincida con un término
     */
    matchCobertura: (term) => {
        const normalizedTerm = exports.thesaurusService.normalizeTerm(term);
        const thesaurus = loadThesaurus();
        let bestMatch = null;
        for (const [nombre, definicion] of Object.entries(thesaurus.coberturas_plantilla)) {
            // Coincidencia exacta con nombre
            if (exports.thesaurusService.normalizeTerm(nombre) === normalizedTerm) {
                return { nombre, definicion, confidence: 1.0 };
            }
            // Coincidencia con sinónimos
            const sinonimosNormalizados = definicion.sinonimos.map(s => exports.thesaurusService.normalizeTerm(s));
            if (sinonimosNormalizados.includes(normalizedTerm)) {
                return { nombre, definicion, confidence: 0.9 };
            }
            // Coincidencia parcial
            const partialMatch = sinonimosNormalizados.some(s => s.includes(normalizedTerm) || normalizedTerm.includes(s));
            if (partialMatch && (!bestMatch || bestMatch.confidence < 0.7)) {
                bestMatch = { nombre, definicion, confidence: 0.7 };
            }
        }
        return bestMatch;
    },
    /**
     * Obtiene los patrones de regex para parsing de deducibles
     */
    getDeductiblePatterns: () => {
        const thesaurus = loadThesaurus();
        return thesaurus.deducibles.formatos;
    },
    /**
     * Obtiene los tipos de aplicación de deducibles
     */
    getDeductibleTypes: () => {
        const thesaurus = loadThesaurus();
        return thesaurus.deducibles.tipo_aplicacion;
    },
    /**
     * Obtiene SMMLV y UVT actuales
     */
    getSalaryValues: () => {
        const thesaurus = loadThesaurus();
        return {
            smmlv: thesaurus.metadata.salary_value_2024,
            uvt: thesaurus.metadata.uvt_value_2024,
        };
    },
    /**
     * Obtiene definición de una alerta por ID
     */
    getAlertDefinition: (alertId) => {
        const thesaurus = loadThesaurus();
        const allAlerts = [
            ...thesaurus.alertas_auditores.criticas,
            ...thesaurus.alertas_auditores.atencion,
            ...thesaurus.alertas_auditores.destacadas,
        ];
        return allAlerts.find(a => a.id === alertId) || null;
    },
    /**
     * Lista todas las alertas de auditoría
     */
    listAllAlerts: () => {
        const thesaurus = loadThesaurus();
        return thesaurus.alertas_auditores;
    },
    /**
     * Detecta términos legales en un texto
     */
    detectLegalTerms: (text) => {
        const thesaurus = loadThesaurus();
        const detected = [];
        const normalizedText = exports.thesaurusService.normalizeTerm(text);
        for (const [tipo, definicion] of Object.entries(thesaurus.terminos_legales)) {
            for (const termino of definicion.terminos) {
                if (normalizedText.includes(exports.thesaurusService.normalizeTerm(termino))) {
                    detected.push({
                        term: termino,
                        type: tipo,
                        description: definicion.descripcion,
                    });
                }
            }
        }
        return detected;
    },
    /**
     * Recarga el tesauro (útil para hot-reload en desarrollo)
     */
    reload: () => {
        thesaurusCache = null;
        loadThesaurus();
        console.log('🔄 [Thesaurus Service] Reloaded');
    },
};
console.log('📚 [Thesaurus Service] Initialized');
