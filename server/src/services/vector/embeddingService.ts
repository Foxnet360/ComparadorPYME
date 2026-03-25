import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
if (!GEMINI_API_KEY) {
  console.error('❌ [Embedding Service] GEMINI_API_KEY not configured');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
// embedding-001 produce vectores de 768 dimensiones (compatible con pgvector ivfflat)
const embeddingModel = genAI.getGenerativeModel({ model: 'embedding-001' });

export interface EmbeddingResult {
  embedding: number[];
  text: string;
  model: string;
}

export const embeddingService = {
  /**
   * Genera embedding para un texto usando Gemini Embedding API con retry
   */
  generateEmbedding: async (text: string, retries = 3): Promise<number[]> => {
    // Truncar texto si es muy largo (límite de tokens)
    const truncatedText = text.slice(0, 8000);
    
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await embeddingModel.embedContent(truncatedText);
        const embedding = result.embedding.values;
        
        if (!embedding || embedding.length === 0) {
          throw new Error('No embedding returned from Gemini');
        }
        
        return embedding;
      } catch (error) {
        lastError = error as Error;
        console.warn(`⚠️ [Embedding Service] Attempt ${attempt}/${retries} failed: ${lastError.message}`);
        
        if (attempt < retries) {
          // Esperar antes de reintentar (backoff exponencial)
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
    
    // Procesar en paralelo con límite de concurrencia
    const batchSize = 5;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchPromises = batch.map(async (text, index) => {
        try {
          const embedding = await embeddingService.generateEmbedding(text);
          return {
            embedding,
            text,
            model: 'embedding-001',
          };
        } catch (error) {
          console.error(`❌ [Embedding Service] Failed to generate embedding for text ${i + index}:`, error);
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter((r): r is EmbeddingResult => r !== null));
      
      // Pequeña pausa para evitar rate limits
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
    // Para queries, podemos expandir con términos relacionados si es necesario
    const enhancedQuery = query; // Aquí se podría integrar con el tesauro
    return embeddingService.generateEmbedding(enhancedQuery);
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

console.log('🔢 [Embedding Service] Initialized with model: embedding-001 (768 dims)');
