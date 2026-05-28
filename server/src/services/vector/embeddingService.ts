import { GoogleGenAI } from '@google/genai';
import { env } from '../../config/env';

const EMBEDDING_MODEL_NAME = env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2';
const EMBEDDING_DIMENSIONS = 3072;

let _genAI: GoogleGenAI | null = null;
const getGenAI = () => {
  if (!_genAI) {
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
      console.error('❌ [Embedding Service] GEMINI_API_KEY not configured');
      throw new Error('GEMINI_API_KEY is not set in environment');
    }
    _genAI = new GoogleGenAI({ apiKey });
  }
  return _genAI;
};

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
        const ai = getGenAI();
        const result = await ai.models.embedContent({
          model: EMBEDDING_MODEL_NAME,
          contents: [{ parts: [{ text: truncatedText }] }],
          config: {
            outputDimensionality: EMBEDDING_DIMENSIONS
          }
        });
        
        let embedding = result.embeddings?.[0]?.values;
        
        if (!embedding || embedding.length === 0) {
          throw new Error('No embedding returned from Gemini');
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
   * Genera embeddings en batch para múltiples textos usando una sola llamada a la API
   * Esto reduce significativamente el tiempo de procesamiento vs llamadas individuales
   */
  generateEmbeddingsBatch: async (texts: string[], retries = 3): Promise<EmbeddingResult[]> => {
    const BATCH_SIZE = 10; // Gemini soporta múltiples contenidos por llamada
    const results: EmbeddingResult[] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      let lastError: Error | null = null;
      let success = false;

      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          // Preparar contenidos para batch
          const contents = batch.map(text => ({
            parts: [{ text: text.slice(0, 8000) }]
          }));

          const ai = getGenAI();
          const response = await ai.models.embedContent({
            model: EMBEDDING_MODEL_NAME,
            contents,
            config: {
              outputDimensionality: EMBEDDING_DIMENSIONS
            }
          });

          // Procesar resultados
          if (response.embeddings && response.embeddings.length > 0) {
            for (let j = 0; j < response.embeddings.length && j < batch.length; j++) {
              let embedding = response.embeddings[j].values;

              if (!embedding || embedding.length === 0) {
                console.warn(`⚠️ [Embedding Service] Empty embedding for text ${i + j}`);
                continue;
              }

              results.push({
                embedding,
                text: batch[j],
                model: EMBEDDING_MODEL_NAME,
              });
            }
            success = true;
            break;
          } else {
            throw new Error('No embeddings returned from Gemini batch call');
          }
        } catch (error) {
          lastError = error as Error;
          console.warn(`⚠️ [Embedding Service] Batch attempt ${attempt}/${retries} failed: ${lastError.message}`);

          if (attempt < retries) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      if (!success) {
        console.error(`❌ [Embedding Service] All batch attempts failed for batch ${i}:`, lastError);
        // Retry individual items as fallback
        for (let j = 0; j < batch.length; j++) {
          try {
            const embedding = await embeddingService.generateEmbedding(batch[j]);
            results.push({
              embedding,
              text: batch[j],
              model: EMBEDDING_MODEL_NAME,
            });
          } catch (error) {
            console.error(`❌ [Embedding Service] Individual fallback failed for text ${i + j}:`, error);
          }
        }
      }

      // Pequeña pausa entre batches para no sobrecargar la API
      if (i + BATCH_SIZE < texts.length) {
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
