import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
if (!GEMINI_API_KEY) {
  console.error('❌ [Embedding Service] GEMINI_API_KEY not configured');
}

const EMBEDDING_MODEL_NAME = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 3072;

const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

export interface EmbeddingResult {
  embedding: number[];
  text: string;
  model: string;
}

export const embeddingService = {
  /**
   * Genera embedding para un texto usando Gemini Embedding API
   */
  generateEmbedding: async (text: string, retries = 3): Promise<number[]> => {
    const truncatedText = text.slice(0, 8000);
    
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await genAI.models.embedContent({
          model: EMBEDDING_MODEL_NAME,
          contents: [{ parts: [{ text: truncatedText }] }],
        });
        
        let embedding = result.embeddings?.[0]?.values;
        
        if (!embedding || embedding.length === 0) {
          throw new Error('No embedding returned from Gemini');
        }
        
        // Truncar a 3072 dimensiones para compatibilidad con la base de datos
        if (embedding.length > EMBEDDING_DIMENSIONS) {
          console.log(`🔧 [Embedding Service] Truncating embedding from ${embedding.length} to ${EMBEDDING_DIMENSIONS} dims`);
          embedding = embedding.slice(0, EMBEDDING_DIMENSIONS);
        }
        
        return embedding;
      } catch (error) {
        lastError = error as Error;
        console.warn(`⚠️ [Embedding Service] Attempt ${attempt}/${retries} failed: ${lastError.message}`);
        
        if (attempt < retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    console.error('❌ [Embedding Service] All retry attempts failed:', lastError);
    throw new Error(`Failed to generate embedding after ${retries} attempts: ${lastError?.message}`);
  },

  /**
   * Genera embeddings en batch para múltiples textos
   */
  generateEmbeddingsBatch: async (texts: string[]): Promise<EmbeddingResult[]> => {
    const results: EmbeddingResult[] = [];
    
    const batchSize = 50;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchPromises = batch.map(async (text, index) => {
        try {
          const embedding = await embeddingService.generateEmbedding(text);
          return {
            embedding,
            text,
            model: EMBEDDING_MODEL_NAME,
          };
        } catch (error) {
          console.error(`❌ [Embedding Service] Failed to generate embedding for text ${i + index}:`, error);
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter((r): r is EmbeddingResult => r !== null));
      
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  },

  /**
   * Genera embedding para una consulta de búsqueda
   */
  generateQueryEmbedding: async (query: string): Promise<number[]> => {
    return embeddingService.generateEmbedding(query);
  },

  /**
   * Calcula similitud coseno entre dos vectores
   */
  cosineSimilarity: (vecA: number[], vecB: number[]): number => {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have same dimension');
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  },

  /**
   * Verifica que la API de Gemini esté funcionando
   */
  verifyConnection: async (): Promise<boolean> => {
    try {
      const testEmbedding = await embeddingService.generateEmbedding('test');
      return testEmbedding.length > 0;
    } catch (error) {
      console.error('❌ [Embedding Service] Connection verification failed:', error);
      return false;
    }
  },
};

console.log(`🔢 [Embedding Service] Initialized with model: ${EMBEDDING_MODEL_NAME} (${EMBEDDING_DIMENSIONS} dims)`);
