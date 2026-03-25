import { thesaurusService } from './normalization/thesaurusService';
import { PageData } from './pdfExtractor';

export type SectionType = 'COBERTURA' | 'EXCLUSION' | 'DEDUCIBLE' | 'CONDICION' | 'GENERAL';

export interface Chunk {
    id: string;
    content: string;
    contentNormalized: string;
    metadata: {
        chapter?: string;
        section?: string;
        clauseId?: string;
        pageStart: number;
        pageEnd: number;
        documentName?: string;
        insurerName?: string;
    };
    coverageTags: string[];
    sectionType: SectionType;
}

export interface ParsedSection {
    type: 'chapter' | 'section' | 'clause' | 'content';
    title: string;
    level: number;
    startIndex: number;
    endIndex?: number;
    pageNumber?: number;
}

// Patrones para detectar tipo de sección
const SECTION_PATTERNS: Record<SectionType, RegExp[]> = {
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

export const semanticChunker = {
    /**
     * Normaliza texto (sin tildes, minúsculas)
     */
    normalizeText: (text: string): string => {
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    },

    /**
     * Detecta coberturas en el texto usando el tesauro
     */
    detectCoverages: (text: string): string[] => {
        const normalizedText = semanticChunker.normalizeText(text);
        const detectedCoverages: string[] = [];
        
        const coberturas = thesaurusService.listCoberturas();
        
        for (const cobertura of coberturas) {
            const definition = thesaurusService.getCoberturaDefinition(cobertura);
            if (!definition) continue;
            
            // Verificar sinónimos
            const sinonimos = definition.sinonimos.map(s => 
                semanticChunker.normalizeText(s)
            );
            
            // Verificar términos de búsqueda
            const terminosBusqueda = definition.terminos_busqueda.map(t =>
                semanticChunker.normalizeText(t)
            );
            
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
    detectSectionType: (text: string): SectionType => {
        const normalizedText = semanticChunker.normalizeText(text);
        const scores: Record<SectionType, number> = {
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
                    scores[type as SectionType] += matches.length;
                }
            }
        }
        
        // Encontrar el tipo con mayor score
        let maxScore = 0;
        let detectedType: SectionType = 'GENERAL';
        
        for (const [type, score] of Object.entries(scores)) {
            if (score > maxScore) {
                maxScore = score;
                detectedType = type as SectionType;
            }
        }
        
        return detectedType;
    },

    /**
     * Detecta la estructura jerárquica del documento usando regex
     */
    detectStructure: (text: string): ParsedSection[] => {
        const sections: ParsedSection[] = [];
        
        const patterns = [
            { regex: /CAP[IÍ]TULO\s+([IVXLCDM]+|[0-9]+)/gi, type: 'chapter' as const, level: 1 },
            { regex: /SECCI[OÓ]N\s+([IVXLCDM]+|[0-9]+)/gi, type: 'section' as const, level: 2 },
            { regex: /^(\d+\.\d+)\.?\s+/gm, type: 'clause' as const, level: 3 },
            { regex: /ART[IÍ]CULO\s+(\d+|[IVXLCDM]+)/gi, type: 'clause' as const, level: 3 },
            { regex: /^(\d+)\.\s+/gm, type: 'clause' as const, level: 3 },
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
    createChunksFromPages: (
        pages: PageData[],
        metadata: {
            documentName?: string;
            insurerName?: string;
        }
    ): Chunk[] => {
        const chunks: Chunk[] = [];
        
        // Combinar texto de páginas consecutivas para crear chunks más grandes
        const targetChunkSize = 800; // caracteres objetivo
        let currentChunkText = '';
        let currentChunkPages: number[] = [];
        let chunkCounter = 0;
        
        for (const page of pages) {
            if (!page.hasContent) continue;
            
            // Si agregar esta página excede el tamaño objetivo y ya tenemos contenido
            if (currentChunkText.length > 0 && 
                currentChunkText.length + page.text.length > targetChunkSize * 1.5) {
                
                // Guardar chunk actual
                const chunk = semanticChunker.createChunk(
                    currentChunkText,
                    currentChunkPages,
                    metadata,
                    `chunk-${++chunkCounter}`
                );
                chunks.push(chunk);
                
                // Reiniciar
                currentChunkText = page.text;
                currentChunkPages = [page.pageNumber];
            } else {
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
            const chunk = semanticChunker.createChunk(
                currentChunkText,
                currentChunkPages,
                metadata,
                `chunk-${++chunkCounter}`
            );
            chunks.push(chunk);
        }
        
        return chunks;
    },

    /**
     * Crea un chunk individual con análisis completo
     */
    createChunk: (
        text: string,
        pageNumbers: number[],
        metadata: {
            documentName?: string;
            insurerName?: string;
        },
        chunkId: string
    ): Chunk => {
        const normalizedText = semanticChunker.normalizeText(text);
        const coverageTags = semanticChunker.detectCoverages(text);
        const sectionType = semanticChunker.detectSectionType(text);
        
        // Extraer clauseId si existe
        const clauseMatch = text.match(/^(\d+\.\d+)/);
        const clauseId = clauseMatch ? clauseMatch[1] : undefined;
        
        return {
            id: chunkId,
            content: text.substring(0, 3000), // Limitar tamaño
            contentNormalized: normalizedText.substring(0, 3000),
            metadata: {
                pageStart: Math.min(...pageNumbers),
                pageEnd: Math.max(...pageNumbers),
                clauseId,
                ...metadata,
            },
            coverageTags,
            sectionType,
        };
    },

    /**
     * Crea chunks a partir de la estructura detectada (método legacy)
     */
    createChunks: (
        text: string,
        metadata: {
            documentName?: string;
            insurerName?: string;
        },
        pageBoundaries: { pageNumber: number; charIndex: number }[]
    ): Chunk[] => {
        const chunks: Chunk[] = [];
        const structure = semanticChunker.detectStructure(text);

        if (structure.length === 0) {
            // Sin estructura, crear un solo chunk
            const coverageTags = semanticChunker.detectCoverages(text);
            const sectionType = semanticChunker.detectSectionType(text);
            
            return [{
                id: 'full-doc',
                content: text.substring(0, 3000),
                contentNormalized: semanticChunker.normalizeText(text).substring(0, 3000),
                metadata: {
                    pageStart: 1,
                    pageEnd: pageBoundaries.length || 1,
                    ...metadata,
                },
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
            } else if (section.type === 'section') {
                currentSection = section.title;
            }

            if (section.type === 'clause') {
                const content = text.substring(section.startIndex, endIndex).trim();
                
                if (content.length < 50) continue;

                const pageStart = semanticChunker.getPageForCharIndex(section.startIndex, pageBoundaries);
                const pageEnd = semanticChunker.getPageForCharIndex(endIndex, pageBoundaries);

                const clauseMatch = content.match(/^(\d+\.\d+)/);
                const clauseId = clauseMatch ? clauseMatch[1] : undefined;

                const coverageTags = semanticChunker.detectCoverages(content);
                const sectionType = semanticChunker.detectSectionType(content);

                chunks.push({
                    id: `chunk-${chunks.length + 1}`,
                    content: content.substring(0, 3000),
                    contentNormalized: semanticChunker.normalizeText(content).substring(0, 3000),
                    metadata: {
                        chapter: currentChapter,
                        section: currentSection,
                        clauseId,
                        pageStart,
                        pageEnd,
                        ...metadata,
                    },
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
    getPageForCharIndex: (
        charIndex: number,
        pageBoundaries: { pageNumber: number; charIndex: number }[]
    ): number => {
        if (!pageBoundaries.length) return 1;
        
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
    calculatePageBoundaries: (pages: string[]): { pageNumber: number; charIndex: number }[] => {
        const boundaries: { pageNumber: number; charIndex: number }[] = [];
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
    createChunksWithFallback: async (
        pages: PageData[],
        metadata: {
            documentName?: string;
            insurerName?: string;
        }
    ): Promise<Chunk[]> => {
        // Usar el nuevo método basado en páginas
        return semanticChunker.createChunksFromPages(pages, metadata);
    },
};
