"use strict";
/**
 * Thesaurus Mapper Module
 * Maps extracted coverage names to canonical terms using fuzzy matching
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadThesaurus = loadThesaurus;
exports.mapCoverageName = mapCoverageName;
exports.normalizeDeductible = normalizeDeductible;
exports.normalizeCoverages = normalizeCoverages;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// In-memory cache
let thesaurusCache = null;
/**
 * Load thesaurus from file
 * Parses the markdown thesaurus file into structured format
 */
function loadThesaurus() {
    if (thesaurusCache)
        return thesaurusCache;
    const thesaurusPath = path_1.default.join(process.cwd(), '..', 'tesauro(pyme).md');
    const extensionsPath = path_1.default.join(process.cwd(), '..', 'tesauro-extensiones.md');
    let entries = [];
    // Load main thesaurus
    if (!fs_1.default.existsSync(thesaurusPath)) {
        console.warn('Thesaurus file not found, using built-in thesaurus');
        entries = getBuiltInThesaurus();
    }
    else {
        try {
            const content = fs_1.default.readFileSync(thesaurusPath, 'utf-8');
            entries = parseThesaurusMarkdown(content);
        }
        catch (error) {
            console.warn('Failed to load thesaurus, using built-in:', error);
            entries = getBuiltInThesaurus();
        }
    }
    // Load extensions if available
    if (fs_1.default.existsSync(extensionsPath)) {
        try {
            const extContent = fs_1.default.readFileSync(extensionsPath, 'utf-8');
            const extEntries = parseExtensionMarkdown(extContent);
            entries = [...entries, ...extEntries];
            console.log(`📚 [Thesaurus] Loaded ${extEntries.length} extension entries`);
        }
        catch (error) {
            console.warn('Failed to load thesaurus extensions:', error);
        }
    }
    thesaurusCache = entries;
    return thesaurusCache;
}
/**
 * Parse thesaurus markdown content
 */
function parseThesaurusMarkdown(content) {
    const entries = [];
    const lines = content.split('\n');
    let currentCategory = '';
    for (const line of lines) {
        // Detect category headers
        const categoryMatch = line.match(/##\s*\d+\.\s*(.+)/);
        if (categoryMatch) {
            currentCategory = categoryMatch[1].trim();
            continue;
        }
        // Parse table rows with coverage mappings
        const tableMatch = line.match(/\|\s*\*\*(.+?)\*\*\s*\|\s*(.+?)\s*\|/);
        if (tableMatch) {
            const canonicalName = tableMatch[1].trim();
            const variantsText = tableMatch[2].trim();
            // Split variants by comma
            const variants = variantsText
                .split(/[,，]/)
                .map(v => v.trim())
                .filter(v => v.length > 0 && v !== '...');
            entries.push({
                canonicalName,
                variants,
                category: currentCategory,
            });
        }
    }
    return entries;
}
/**
 * Parse extension thesaurus markdown content
 * Handles the companion file with sub-limits and riders
 */
function parseExtensionMarkdown(content) {
    const entries = [];
    const lines = content.split('\n');
    let currentCategory = '';
    let defaultType = 'sub-limit';
    for (const line of lines) {
        // Detect category headers (## 1. Sub-límites de Incendio...)
        const categoryMatch = line.match(/##\s*\d+\.\s*(.+)/);
        if (categoryMatch) {
            currentCategory = categoryMatch[1].trim();
            // Set default type based on category name
            if (currentCategory.toLowerCase().includes('rider')) {
                defaultType = 'rider';
            }
            else if (currentCategory.toLowerCase().includes('gasto')) {
                defaultType = 'gastos';
            }
            else {
                defaultType = 'sub-limit';
            }
            continue;
        }
        // Skip header rows and separator rows
        if (line.includes('|---|') || line.includes('Concepto Padre') || line.includes('Sub-límite / Amparo') || line.includes('Tipo')) {
            continue;
        }
        // Parse table rows with 4 columns (Format: | Parent | Type | Name | Variants |)
        const tableMatch4 = line.match(/^\|\s*\*\*([^*]+)\*\*\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/);
        if (tableMatch4) {
            const parent = tableMatch4[1].trim();
            const typeStr = tableMatch4[2].trim().toLowerCase();
            const name = tableMatch4[3].trim();
            const variantsText = tableMatch4[4].trim();
            const type = (typeStr.includes('rider') ? 'rider' :
                typeStr.includes('sub') ? 'sub-limit' :
                    typeStr.includes('gasto') ? 'gastos' :
                        typeStr.includes('extens') ? 'extension' : defaultType);
            const variants = variantsText
                .split(/[,，]/)
                .map(v => v.trim())
                .filter(v => v.length > 0 && v !== '...');
            entries.push({
                canonicalName: name,
                variants,
                category: currentCategory,
                type,
                parentCoverage: parent,
            });
            continue;
        }
        // Parse table rows with 3 columns (Format: | **Parent** | Name | Variants |)
        const tableMatch3 = line.match(/^\|\s*\*\*([^*]+)\*\*\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/);
        if (tableMatch3) {
            const parent = tableMatch3[1].trim();
            const name = tableMatch3[2].trim();
            const variantsText = tableMatch3[3].trim();
            const variants = variantsText
                .split(/[,，]/)
                .map(v => v.trim())
                .filter(v => v.length > 0 && v !== '...');
            entries.push({
                canonicalName: name,
                variants,
                category: currentCategory,
                type: defaultType,
                parentCoverage: parent,
            });
        }
    }
    return entries;
}
/**
 * Built-in thesaurus for PYME coverages
 * Used when file is not available
 */
function getBuiltInThesaurus() {
    return [
        {
            canonicalName: "Incendio (Edificio y Contenidos)",
            variants: [
                "Amparo Básico (Incendio)",
                "Incendio y Rayo",
                "Amparos Aliados",
                "Actos de la Naturaleza",
                "Daños Materiales Básicos",
                "Incendio",
                "Fuego",
                "Combustión",
                "Rayo",
                "Explosión",
            ],
            category: "Patrimoniales",
        },
        {
            canonicalName: "Terremoto y Eventos Catastróficos",
            variants: [
                "Eventos Catastróficos",
                "Amparo de TTEV",
                "Terremoto",
                "Eventos de la Naturaleza (Catastróficos)",
                "Temblor",
                "Erupción",
            ],
            category: "Patrimoniales",
        },
        {
            canonicalName: "Sustracción / Hurto",
            variants: [
                "Sustracción",
                "Amparo de Hurto",
                "Hurto Calificado y Atraco",
                "Robo con Violencia",
                "Sustracción de Contenidos",
                "Hurto",
                "Robo",
                "Atraco",
                "Asalto",
                "AMIT",
                "All Risk",
            ],
            category: "Patrimoniales",
        },
        {
            canonicalName: "Huelga, Motín, Asonada (HMACC)",
            variants: [
                "AMIT",
                "Terrorismo",
                "Huelga, Motín, Asonada (HMA)",
                "Vandalismo",
                "Daños por Huelga",
                "Actos Malintencionados",
            ],
            category: "Patrimoniales",
        },
        {
            canonicalName: "Lucro Cesante",
            variants: [
                "Pérdida de Beneficios",
                "Interrupción de Negocios",
                "Business Interruption (BI)",
                "Pérdida de Utilidad Bruta",
                "Gastos Fijos y Utilidad Neta",
                "Pérdida de Renta",
            ],
            category: "Patrimoniales",
        },
        {
            canonicalName: "Equipo Eléctrico y Electrónico",
            variants: [
                "Daño Interno de Equipos",
                "Amparo de Equipo Electrónico",
                "EE Fijos y Móviles",
                "Corto Circuito y Sobretensión",
                "Equipo Electrónico",
                "Computadores",
                "Servidores",
            ],
            category: "Patrimoniales",
        },
        {
            canonicalName: "Rotura de Maquinaria",
            variants: [
                "Daño Interno de Maquinaria",
                "RM",
                "Daño Súbito e Imprevisto (Maquinaria)",
            ],
            category: "Patrimoniales",
        },
        {
            canonicalName: "Transporte de Mercancías",
            variants: [
                "Transporte de Valores",
                "Transporte Propia Mercancía",
                "Amparo de Transporte",
                "Daños a la Mercancía en Tránsito",
            ],
            category: "Patrimoniales",
        },
        {
            canonicalName: "Manejo Global / Infidelidad",
            variants: [
                "Infidelidad de Empleados",
                "Deshonestidad",
                "Póliza de Manejo",
                "Fraude de Empleados",
                "Apropiación Indebida",
            ],
            category: "Patrimoniales",
        },
        {
            canonicalName: "Responsabilidad Civil (RCE)",
            variants: [
                "RCE Predios, Labores y Operaciones",
                "Daños a Terceros (RCE)",
                "Amparo Básico de RC",
                "RC General",
                "RC Básica",
                "Responsabilidad Civil Extracontractual",
            ],
            category: "Responsabilidad Civil",
        },
        {
            canonicalName: "Vidrios Planos",
            variants: ["Vidrios", "Cristales", "Placas de Vidrio"],
            category: "Patrimoniales",
        },
        {
            canonicalName: "Asistencia PYME",
            variants: ["Asistencia", "Servicios de Asistencia"],
            category: "Patrimoniales",
        },
        {
            canonicalName: "Asistencia Legal",
            variants: ["Asesoría Legal", "Defensa Legal"],
            category: "Patrimoniales",
        },
        {
            canonicalName: "Transporte de Valores",
            variants: ["Valores en Tránsito", "Transporte de Dinero"],
            category: "Patrimoniales",
        },
    ];
}
/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str1.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= str2.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= str1.length; i++) {
        for (let j = 1; j <= str2.length; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
        }
    }
    return matrix[str1.length][str2.length];
}
/**
 * Calculate similarity score between two strings (0-1)
 */
function calculateSimilarity(str1, str2) {
    const normalized1 = str1.toLowerCase().trim();
    const normalized2 = str2.toLowerCase().trim();
    // Exact match
    if (normalized1 === normalized2)
        return 1.0;
    // Contains match
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
        const ratio = Math.min(normalized1.length, normalized2.length) / Math.max(normalized1.length, normalized2.length);
        return 0.7 + (ratio * 0.2); // 0.7-0.9 based on length ratio
    }
    // Levenshtein distance
    const maxLength = Math.max(normalized1.length, normalized2.length);
    if (maxLength === 0)
        return 1.0;
    const distance = levenshteinDistance(normalized1, normalized2);
    return 1 - (distance / maxLength);
}
/**
 * Map extracted coverage name to canonical term
 */
function mapCoverageName(extractedName, threshold = 0.7) {
    const thesaurus = loadThesaurus();
    let bestMatch = null;
    for (const entry of thesaurus) {
        // Check canonical name
        const canonicalScore = calculateSimilarity(extractedName, entry.canonicalName);
        if (canonicalScore > ((bestMatch === null || bestMatch === void 0 ? void 0 : bestMatch.score) || 0)) {
            bestMatch = { entry, variant: entry.canonicalName, score: canonicalScore };
        }
        // Check all variants
        for (const variant of entry.variants) {
            const variantScore = calculateSimilarity(extractedName, variant);
            if (variantScore > ((bestMatch === null || bestMatch === void 0 ? void 0 : bestMatch.score) || 0)) {
                bestMatch = { entry, variant, score: variantScore };
            }
        }
    }
    if (!bestMatch) {
        return {
            canonicalName: extractedName,
            confidence: 0,
            matchedVariant: '',
            needsReview: true,
        };
    }
    // Use type-specific threshold: 0.6 for sub-limits/riders, 0.7 for main
    const entryType = bestMatch.entry.type || 'main';
    const effectiveThreshold = entryType === 'main' ? threshold : 0.6;
    return {
        canonicalName: bestMatch.entry.canonicalName,
        confidence: bestMatch.score,
        matchedVariant: bestMatch.variant,
        needsReview: bestMatch.score < effectiveThreshold,
        type: entryType,
        parentCoverage: bestMatch.entry.parentCoverage,
    };
}
/**
 * Normalize deductible format
 */
function normalizeDeductible(deductible) {
    const trimmed = deductible.trim();
    // Handle empty
    if (!trimmed || trimmed === '') {
        return { normalized: 'No aplica', needsReview: false };
    }
    // Handle "No aplica" variants
    if (/^no\s*aplica/i.test(trimmed)) {
        return { normalized: 'No aplica', needsReview: false };
    }
    // Handle "No aplica Deducible" → extract "No aplica"
    const noAplicaMatch = trimmed.match(/^(no\s*aplica)\s*(?:deducible)?/i);
    if (noAplicaMatch) {
        return { normalized: 'No aplica', needsReview: false };
    }
    // Handle "APLICA" or "SI APLICA" → means there IS a deductible
    if (/^(?:si\s+)?aplica/i.test(trimmed)) {
        return { normalized: 'Aplica', needsReview: false };
    }
    // Handle "INCLUIDA" or "INCLUIDO" → included in coverage, no separate deductible
    if (/^incluid[oa]/i.test(trimmed)) {
        return { normalized: 'Incluido', needsReview: false };
    }
    // Handle percentage with context: "10% / Mín. 2 SMMLV (aplica sobre pérdida)"
    const percentWithContext = trimmed.match(/(\d+%)\s*(?:\/\s*.*)?/);
    if (percentWithContext) {
        const context = trimmed.replace(percentWithContext[1], '').trim();
        // Include context in normalized string for frontend severity parsing
        const normalizedWithContext = context
            ? `${percentWithContext[1]} ${context}`
            : percentWithContext[1];
        return {
            normalized: normalizedWithContext,
            context: context || undefined,
            needsReview: false,
        };
    }
    // Handle SMMLV: "5 SMMLV" or "5 SM"
    const smmlvMatch = trimmed.match(/(\d+)\s*(?:SMMLV|SM)/i);
    if (smmlvMatch) {
        return { normalized: `${smmlvMatch[1]} SMMLV`, needsReview: false };
    }
    // Handle fixed amount: "$500,000" or "500000"
    const fixedMatch = trimmed.match(/(?:\$\s*)?(\d{1,3}(?:,\d{3})*|\d+)/);
    if (fixedMatch) {
        return { normalized: `$${fixedMatch[1].replace(/,/g, '.')}`, needsReview: false };
    }
    // Unknown format
    return { normalized: trimmed, needsReview: true };
}
/**
 * Normalize all coverages in a quote using thesaurus
 */
function normalizeCoverages(coverages) {
    const normalized = coverages.map(coverage => {
        const mapping = mapCoverageName(coverage.name);
        const deductibleNorm = normalizeDeductible(coverage.deductible);
        return {
            name: mapping.canonicalName,
            value: coverage.value,
            deductible: deductibleNorm.normalized,
            originalName: coverage.name,
            confidence: mapping.confidence,
            type: mapping.type,
            parentCoverage: mapping.parentCoverage,
        };
    });
    // Use type-specific threshold for review: 0.6 for sub-limits, 0.7 for main
    const needsReview = normalized.some(c => {
        const threshold = c.type === 'main' ? 0.7 : 0.6;
        return c.confidence < threshold;
    });
    return { normalized, needsReview };
}
