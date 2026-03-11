export interface Chunk {
    id: string;
    content: string;
    metadata: {
        chapter?: string;
        section?: string;
        clauseId?: string;
        pageStart: number;
        pageEnd: number;
        documentName?: string;
        insurerName?: string;
    };
}

export interface ParsedSection {
    type: 'chapter' | 'section' | 'clause' | 'content';
    title: string;
    level: number;
    startIndex: number;
    endIndex?: number;
    pageNumber?: number;
}

export const semanticChunker = {
    /**
     * Detecta la estructura jerárquica del documento usando regex
     */
    detectStructure: (text: string): ParsedSection[] => {
        const sections: ParsedSection[] = [];
        
        const patterns = [
            { regex: /CAPÍTULO\s+([IVXLCDM]+|[0-9]+)/gi, type: 'chapter' as const, level: 1 },
            { regex: /SECCIÓN\s+([IVXLCDM]+|[0-9]+)/gi, type: 'section' as const, level: 2 },
            { regex: /^(\d+\.\d+)\.?\s+/gm, type: 'clause' as const, level: 3 },
            { regex: /ARTÍCULO\s+(\d+|[IVXLCDM]+)/gi, type: 'clause' as const, level: 3 },
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
     * Crea chunks a partir de la estructura detectada
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
            return [{
                id: 'full-doc',
                content: text.substring(0, 5000),
                metadata: {
                    pageStart: 1,
                    pageEnd: pageBoundaries.length || 1,
                    ...metadata,
                },
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

                chunks.push({
                    id: `chunk-${chunks.length + 1}`,
                    content: content.substring(0, 3000),
                    metadata: {
                        chapter: currentChapter,
                        section: currentSection,
                        clauseId,
                        pageStart,
                        pageEnd,
                        ...metadata,
                    },
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
     * Crea chunks con fallback LLM para documentos sin estructura
     */
    createChunksWithFallback: async (
        text: string,
        metadata: {
            documentName?: string;
            insurerName?: string;
        },
        groqClient?: any
    ): Promise<Chunk[]> => {
        const hasStructure = semanticChunker.detectStructure(text).length > 0;

        if (hasStructure) {
            const pages = text.split('\n\n');
            const boundaries = semanticChunker.calculatePageBoundaries(pages);
            return semanticChunker.createChunks(text, metadata, boundaries);
        }

        if (groqClient) {
            return semanticChunker.createChunksWithLLM(text, metadata, groqClient);
        }

        const pages = text.split('\n\n');
        return [{
            id: 'full-doc',
            content: text.substring(0, 5000),
            metadata: {
                pageStart: 1,
                pageEnd: pages.length,
                ...metadata,
            },
        }];
    },

    /**
     * Usa LLM para identificar secciones en documentos sin estructura
     */
    createChunksWithLLM: async (
        text: string,
        metadata: {
            documentName?: string;
            insurerName?: string;
        },
        groqClient: any
    ): Promise<Chunk[]> => {
        const prompt = `Analiza el siguiente texto de un documento legal de seguro e identifica hasta 10 secciones principales. 
Devuelve solo una lista numerada con los títulos de cada sección.

Texto:
${text.substring(0, 5000)}

Devuelve el resultado en formato:
1. [Título de sección 1]
2. [Título de sección 2]
...`;

        try {
            const response = await groqClient.chat.completions.create({
                model: 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
            });

            const sectionText = response.choices[0]?.message?.content || '';
            const sectionLines = sectionText.split('\n').filter((line: string) => /^\d+\./.test(line.trim()));

            const chunks: Chunk[] = sectionLines.slice(0, 10).map((line: string, index: number) => ({
                id: `chunk-${index + 1}`,
                content: `Sección: ${line.replace(/^\d+\.\s*/, '')}\n\n${text.substring(0, 3000)}`,
                metadata: {
                    pageStart: 1,
                    pageEnd: 1,
                    ...metadata,
                },
            }));

            return chunks;
        } catch (error) {
            console.error('LLM fallback chunking failed:', error);
            return [{
                id: 'full-doc',
                content: text.substring(0, 5000),
                metadata: {
                    pageStart: 1,
                    pageEnd: 1,
                    ...metadata,
                },
            }];
        }
    },
};
