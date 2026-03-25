import { vectorStore, ChunkMetadata, RetrievedChunk } from './vectorStore';
import { embeddingService } from './vector/embeddingService';

export interface RetrievalResult {
    chunks: RetrievedChunk[];
    query: string;
    insurerName?: string;
}

export const ragRetrieval = {
    /**
     * Recupera chunks relevantes para una consulta
     */
    retrieve: async (
        query: string,
        insurerName?: string,
        limit: number = 5
    ): Promise<RetrievalResult> => {
        const queryEmbedding = await embeddingService.generateQueryEmbedding(query);

        let results: RetrievedChunk[] = [];

        if (insurerName) {
            results = await vectorStore.search(insurerName, queryEmbedding, undefined, limit);
        } else {
            const documents = await vectorStore.listDocuments();
            
            for (const doc of documents) {
                const insurerResults = await vectorStore.search(
                    doc.insurerName,
                    queryEmbedding,
                    undefined,
                    limit
                );
                results.push(...insurerResults);
            }

            results.sort((a, b) => a.distance - b.distance);
            results = results.slice(0, limit);
        }

        return {
            chunks: results,
            query,
            insurerName,
        };
    },

    /**
     * Recupera chunks para múltiples términos de búsqueda
     */
    retrieveWithTerms: async (
        terms: string[],
        insurerName?: string,
        limitPerTerm: number = 3
    ): Promise<{ chunks: RetrievedChunk[]; citations: { chunk: string; metadata: ChunkMetadata }[] }> => {
        const allChunks: RetrievedChunk[] = [];
        
        for (const term of terms) {
            const results = await ragRetrieval.retrieve(term, insurerName, limitPerTerm);
            allChunks.push(...results.chunks);
        }

        const uniqueChunks = allChunks.reduce((acc, chunk) => {
            if (!acc.find(c => c.id === chunk.id)) {
                acc.push(chunk);
            }
            return acc;
        }, [] as RetrievedChunk[]);

        const citations = uniqueChunks.map(chunk => ({
            chunk: chunk.content,
            metadata: chunk.metadata,
        }));

        return {
            chunks: uniqueChunks,
            citations,
        };
    },

    /**
     * Recupera chunks para una cobertura específica
     */
    retrieveForCoverage: async (
        coverageName: string,
        insurerName?: string
    ): Promise<{ chunks: RetrievedChunk[]; citations: { chunk: string; metadata: ChunkMetadata }[] }> => {
        const terms = [
            coverageName,
            `${coverageName} exclusiones`,
            `${coverageName} limitaciones`,
            `${coverageName} condiciones`,
        ];

        return ragRetrieval.retrieveWithTerms(terms, insurerName, 3);
    },

    /**
     * Construye citation metadata para el análisis
     */
    buildCitations: (chunks: RetrievedChunk[]): { clauseId: string; section: string; page: number; excerpt: string }[] => {
        return chunks.map(chunk => ({
            clauseId: chunk.metadata.clauseId || chunk.id,
            section: chunk.metadata.section || chunk.metadata.chapter || 'General',
            page: chunk.metadata.pageStart,
            excerpt: chunk.content.substring(0, 200) + (chunk.content.length > 200 ? '...' : ''),
        }));
    },
};
