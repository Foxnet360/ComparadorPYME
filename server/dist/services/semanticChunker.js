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
exports.semanticChunker = void 0;
const thesaurusService_1 = require("./normalization/thesaurusService");
// Patrones para detectar tipo de sección
const SECTION_PATTERNS = {
    COBERTURA: [
        /cobertura/i,
        /garant[ií]a/i,
        /amparo/i,
        /secci[oó]n.*cobertura/i,
        /cl[aá]usula.*cobertura/i,
    ],
    EXCLUSION: [
        /exclusi[oó]n/i,
        /no.cubre/i,
        /excluido/i,
        /limitaci[oó]n/i,
    ],
    DEDUCIBLE: [
        /deducible/i,
        /franquicia/i,
        /participaci[oó]n/i,
        /prorrata/i,
    ],
    CONDICION: [
        /condici[oó]n/i,
        /requisito/i,
        /obligaci[oó]n/i,
        /garant[ií]a.*cumplimiento/i,
    ],
    GENERAL: [
        /disposici[oó]n.general/i,
        /definici[oó]n/i,
        /vigencia/i,
        /prima/i,
    ],
};
exports.semanticChunker = {
    /**
     * Normaliza texto (sin tildes, minúsculas)
     */
    normalizeText: (text) => {
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    },
    /**
     * Detecta coberturas en el texto usando el tesauro
     */
    detectCoverages: (text) => {
        const normalizedText = exports.semanticChunker.normalizeText(text);
        const detectedCoverages = [];
        const coberturas = thesaurusService_1.thesaurusService.listCoberturas();
        for (const cobertura of coberturas) {
            const definition = thesaurusService_1.thesaurusService.getCoberturaDefinition(cobertura);
            if (!definition)
                continue;
            // Verificar sinónimos
            const sinonimos = definition.sinonimos.map(s => exports.semanticChunker.normalizeText(s));
            // Verificar términos de búsqueda
            const terminosBusqueda = definition.terminos_busqueda.map(t => exports.semanticChunker.normalizeText(t));
            // Combinar todos los términos
            const allTerms = [...sinonimos, ...terminosBusqueda];
            // Verificar si algún término aparece en el texto
            const found = allTerms.some(term => normalizedText.includes(term));
            if (found) {
                detectedCoverages.push(cobertura);
            }
        }
        return [...new Set(detectedCoverages)]; // Eliminar duplicados
    },
    /**
     * Detecta el tipo de sección basado en patrones
     */
    detectSectionType: (text) => {
        const normalizedText = exports.semanticChunker.normalizeText(text);
        const scores = {
            COBERTURA: 0,
            EXCLUSION: 0,
            DEDUCIBLE: 0,
            CONDICION: 0,
            GENERAL: 0,
        };
        // Contar coincidencias por tipo
        for (const [type, patterns] of Object.entries(SECTION_PATTERNS)) {
            for (const pattern of patterns) {
                const matches = normalizedText.match(pattern);
                if (matches) {
                    scores[type] += matches.length;
                }
            }
        }
        // Encontrar el tipo con mayor score
        let maxScore = 0;
        let detectedType = 'GENERAL';
        for (const [type, score] of Object.entries(scores)) {
            if (score > maxScore) {
                maxScore = score;
                detectedType = type;
            }
        }
        return detectedType;
    },
    /**
     * Detecta la estructura jerárquica del documento usando regex
     */
    detectStructure: (text) => {
        const sections = [];
        const patterns = [
            { regex: /CAP[IÍ]TULO\s+([IVXLCDM]+|[0-9]+)/gi, type: 'chapter', level: 1 },
            { regex: /SECCI[OÓ]N\s+([IVXLCDM]+|[0-9]+)/gi, type: 'section', level: 2 },
            { regex: /^\s*(\d+\.\d+)\.?\s+/gm, type: 'clause', level: 3 },
            { regex: /ART[IÍ]CULO\s+(\d+|[IVXLCDM]+)/gi, type: 'clause', level: 3 },
            { regex: /^\s*(\d+)\.\s+/gm, type: 'clause', level: 3 },
        ];
        for (const pattern of patterns) {
            let match;
            const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
            while ((match = regex.exec(text)) !== null) {
                sections.push({
                    type: pattern.type,
                    title: match[0].trim(),
                    level: pattern.level,
                    startIndex: match.index,
                });
            }
        }
        sections.sort((a, b) => a.startIndex - b.startIndex);
        return sections;
    },
    /**
     * Crea chunks a partir de páginas con análisis semántico
     */
    createChunksFromPages: (pages, metadata) => {
        const chunks = [];
        // Combinar texto de páginas consecutivas para crear chunks más grandes
        const targetChunkSize = 800; // caracteres objetivo
        let currentChunkText = '';
        let currentChunkPages = [];
        let chunkCounter = 0;
        for (const page of pages) {
            if (!page.hasContent)
                continue;
            // Si agregar esta página excede el tamaño objetivo y ya tenemos contenido
            if (currentChunkText.length > 0 &&
                currentChunkText.length + page.text.length > targetChunkSize * 1.5) {
                // Guardar chunk actual
                const chunk = exports.semanticChunker.createChunk(currentChunkText, currentChunkPages, metadata, `chunk-${++chunkCounter}`);
                chunks.push(chunk);
                // Reiniciar
                currentChunkText = page.text;
                currentChunkPages = [page.pageNumber];
            }
            else {
                // Agregar al chunk actual
                if (currentChunkText.length > 0) {
                    currentChunkText += '\n\n';
                }
                currentChunkText += page.text;
                currentChunkPages.push(page.pageNumber);
            }
        }
        // Guardar último chunk si tiene contenido
        if (currentChunkText.length > 0) {
            const chunk = exports.semanticChunker.createChunk(currentChunkText, currentChunkPages, metadata, `chunk-${++chunkCounter}`);
            chunks.push(chunk);
        }
        return chunks;
    },
    /**
     * Crea un chunk individual con análisis completo
     */
    createChunk: (text, pageNumbers, metadata, chunkId) => {
        const normalizedText = exports.semanticChunker.normalizeText(text);
        const coverageTags = exports.semanticChunker.detectCoverages(text);
        const sectionType = exports.semanticChunker.detectSectionType(text);
        // Extraer clauseId si existe
        const clauseMatch = text.match(/^(\d+\.\d+)/);
        const clauseId = clauseMatch ? clauseMatch[1] : undefined;
        return {
            id: chunkId,
            content: text.substring(0, 3000), // Limitar tamaño
            contentNormalized: normalizedText.substring(0, 3000),
            metadata: Object.assign({ pageStart: Math.min(...pageNumbers), pageEnd: Math.max(...pageNumbers), clauseId }, metadata),
            coverageTags,
            sectionType,
        };
    },
    /**
     * Crea chunks a partir de la estructura detectada (método legacy)
     */
    createChunks: (text, metadata, pageBoundaries) => {
        const chunks = [];
        const structure = exports.semanticChunker.detectStructure(text);
        if (structure.length === 0) {
            // Sin estructura, crear un solo chunk
            const coverageTags = exports.semanticChunker.detectCoverages(text);
            const sectionType = exports.semanticChunker.detectSectionType(text);
            return [{
                    id: 'full-doc',
                    content: text.substring(0, 3000),
                    contentNormalized: exports.semanticChunker.normalizeText(text).substring(0, 3000),
                    metadata: Object.assign({ pageStart: 1, pageEnd: pageBoundaries.length || 1 }, metadata),
                    coverageTags,
                    sectionType,
                }];
        }
        let currentChapter = '';
        let currentSection = '';
        for (let i = 0; i < structure.length; i++) {
            const section = structure[i];
            const nextSection = structure[i + 1];
            const endIndex = nextSection ? nextSection.startIndex : text.length;
            if (section.type === 'chapter') {
                currentChapter = section.title;
            }
            else if (section.type === 'section') {
                currentSection = section.title;
            }
            if (section.type === 'clause') {
                const content = text.substring(section.startIndex, endIndex).trim();
                if (content.length < 50)
                    continue;
                const pageStart = exports.semanticChunker.getPageForCharIndex(section.startIndex, pageBoundaries);
                const pageEnd = exports.semanticChunker.getPageForCharIndex(endIndex, pageBoundaries);
                const clauseMatch = content.match(/^(\d+\.\d+)/);
                const clauseId = clauseMatch ? clauseMatch[1] : undefined;
                const coverageTags = exports.semanticChunker.detectCoverages(content);
                const sectionType = exports.semanticChunker.detectSectionType(content);
                chunks.push({
                    id: `chunk-${chunks.length + 1}`,
                    content: content.substring(0, 3000),
                    contentNormalized: exports.semanticChunker.normalizeText(content).substring(0, 3000),
                    metadata: Object.assign({ chapter: currentChapter, section: currentSection, clauseId,
                        pageStart,
                        pageEnd }, metadata),
                    coverageTags,
                    sectionType,
                });
            }
        }
        return chunks;
    },
    /**
     * Obtiene el número de página para un índice de carácter
     */
    getPageForCharIndex: (charIndex, pageBoundaries) => {
        if (!pageBoundaries.length)
            return 1;
        for (let i = pageBoundaries.length - 1; i >= 0; i--) {
            if (charIndex >= pageBoundaries[i].charIndex) {
                return pageBoundaries[i].pageNumber;
            }
        }
        return 1;
    },
    /**
     * Calcula los límites de página a partir del texto extraído por página
     */
    calculatePageBoundaries: (pages) => {
        const boundaries = [];
        let charIndex = 0;
        for (let i = 0; i < pages.length; i++) {
            boundaries.push({
                pageNumber: i + 1,
                charIndex,
            });
            charIndex += pages[i].length + 2;
        }
        return boundaries;
    },
    /**
     * Crea chunks con fallback para documentos sin estructura
     */
    createChunksWithFallback: (pages, metadata) => __awaiter(void 0, void 0, void 0, function* () {
        // Usar el nuevo método basado en páginas
        return exports.semanticChunker.createChunksFromPages(pages, metadata);
    }),
};
