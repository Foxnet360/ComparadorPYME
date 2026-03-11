import { pipeline } from '@xenova/transformers';

let embeddingPipeline: any = null;

export interface EmbeddingResult {
    embedding: number[];
    text: string;
}

export const embeddingService = {
    /**
     * Inicializa el pipeline de embeddings (descarga modelo si es necesario)
     */
    initialize: async (): Promise<void> => {
        if (!embeddingPipeline) {
            console.log('📦 [Embedding] Loading model all-MiniLM-L6-v2...');
            embeddingPipeline = await pipeline(
                'feature-extraction',
                'Xenova/all-MiniLM-L6-v2'
            );
            console.log('✅ [Embedding] Model loaded');
        }
    },

    /**
     * Genera embedding para un texto
     */
    generateEmbedding: async (text: string): Promise<number[]> => {
        await embeddingService.initialize();
        
        const result = await embeddingPipeline(text, {
            pooling: 'mean',
            normalize: true,
        });
        
        return Array.from(result.data);
    },

    /**
     * Genera embeddings para múltiples textos (batch)
     */
    generateBatchEmbeddings: async (texts: string[]): Promise<number[][]> => {
        await embeddingService.initialize();
        
        const embeddings: number[][] = [];
        
        for (const text of texts) {
            const embedding = await embeddingService.generateEmbedding(text);
            embeddings.push(embedding);
        }
        
        return embeddings;
    },

    /**
     * Genera embedding para búsqueda
     */
    generateQueryEmbedding: async (query: string): Promise<number[]> => {
        const processedQuery = query.toLowerCase().trim();
        return embeddingService.generateEmbedding(processedQuery);
    },
};
