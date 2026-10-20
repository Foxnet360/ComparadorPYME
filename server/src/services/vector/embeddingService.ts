import { GoogleGenAI } from '@google/genai';
import { env } from '../../config/env';

const EMBEDDING_MODEL_NAME = env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2';
const EMBEDDING_DIMENSIONS = 3072;
const MAX_CACHE_SIZE = 2000;

const embeddingLruCache = new Map<string, number[]>();
const inFlightEmbeddings = new Map<string, Promise<number[]>>();
let cacheHits = 0;
let cacheMisses = 0;

function buildCacheKey(truncatedText: string): string {
  return `${EMBEDDING_MODEL_NAME}:${EMBEDDING_DIMENSIONS}:${truncatedText}`;
}

function getFromCache(cacheKey: string): number[] | undefined {
  const existing = embeddingLruCache.get(cacheKey);
  if (existing !== undefined) {
    // Refresh LRU order
    embeddingLruCache.delete(cacheKey);
    embeddingLruCache.set(cacheKey, existing);
    cacheHits++;
    return existing;
  }
  cacheMisses++;
  return undefined;
}

function setInCache(cacheKey: string, embedding: number[]): void {
  if (embeddingLruCache.has(cacheKey)) {
    embeddingLruCache.delete(cacheKey);
  } else if (embeddingLruCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = embeddingLruCache.keys().next().value;
    if (oldestKey !== undefined) {
      embeddingLruCache.delete(oldestKey);
    }
  }
  embeddingLruCache.set(cacheKey, embedding);
}

export function clearEmbeddingCache(): void {
  embeddingLruCache.clear();
  inFlightEmbeddings.clear();
  cacheHits = 0;
  cacheMisses = 0;
}

export function getEmbeddingCacheStats(): {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  inFlight: number;
} {
  return {
    size: embeddingLruCache.size,
    maxSize: MAX_CACHE_SIZE,
    hits: cacheHits,
    misses: cacheMisses,
    inFlight: inFlightEmbeddings.size,
  };
}

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
  clearEmbeddingCache,
  getEmbeddingCacheStats,

  /**
   * Genera embedding para un texto usando Gemini Embedding API
   * Incluye cache LRU en memoria y deduplicación de promesas en vuelo (in-flight)
   */
  generateEmbedding: async (text: string, retries = 3): Promise<number[]> => {
    const truncatedText = text.slice(0, 8000);
    const cacheKey = buildCacheKey(truncatedText);

    const cached = getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    const existingPromise = inFlightEmbeddings.get(cacheKey);
    if (existingPromise) {
      cacheHits++;
      cacheMisses = Math.max(0, cacheMisses - 1);
      return existingPromise;
    }

    const workPromise = (async (): Promise<number[]> => {
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const ai = getGenAI();
          const result = await ai.models.embedContent({
            model: EMBEDDING_MODEL_NAME,
            contents: [{ parts: [{ text: truncatedText }] }],
            config: {
              outputDimensionality: EMBEDDING_DIMENSIONS,
            },
          });

          const embedding = result.embeddings?.[0]?.values;

          if (!embedding || embedding.length === 0) {
            throw new Error('No embedding returned from Gemini');
          }

          setInCache(cacheKey, embedding);
          return embedding;
        } catch (error) {
          lastError = error as Error;
          console.warn(
            `⚠️ [Embedding Service] Attempt ${attempt}/${retries} failed: ${lastError.message}`
          );

          if (attempt < retries) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      console.error('❌ [Embedding Service] All retry attempts failed:', lastError);
      throw new Error(
        `Failed to generate embedding after ${retries} attempts: ${lastError?.message}`
      );
    })();

    inFlightEmbeddings.set(cacheKey, workPromise);
    try {
      return await workPromise;
    } finally {
      inFlightEmbeddings.delete(cacheKey);
    }
  },

  /**
   * Genera embeddings en batch para múltiples textos usando una sola llamada a la API
   * Esto reduce significativamente el tiempo de procesamiento vs llamadas individuales
   */
  generateEmbeddingsBatch: async (texts: string[], retries = 3): Promise<EmbeddingResult[]> => {
    const BATCH_SIZE = 100; // Gemini soporta múltiples contenidos por llamada
    const orderedResults: (EmbeddingResult | undefined)[] = new Array(texts.length);
    const uncachedItems: Array<{ index: number; text: string; truncatedText: string; cacheKey: string }> = [];

    for (let i = 0; i < texts.length; i++) {
      const text = texts[i]!;
      const truncatedText = text.slice(0, 8000);
      const cacheKey = buildCacheKey(truncatedText);
      const cached = getFromCache(cacheKey);
      if (cached) {
        orderedResults[i] = {
          embedding: cached,
          text,
          model: EMBEDDING_MODEL_NAME,
        };
      } else {
        uncachedItems.push({ index: i, text, truncatedText, cacheKey });
      }
    }

    for (let i = 0; i < uncachedItems.length; i += BATCH_SIZE) {
      const batch = uncachedItems.slice(i, i + BATCH_SIZE);
      let lastError: Error | null = null;
      let success = false;

      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          // Preparar contenidos para batch
          const contents = batch.map((item) => ({
            parts: [{ text: item.truncatedText }],
          }));

          const ai = getGenAI();
          const response = await ai.models.embedContent({
            model: EMBEDDING_MODEL_NAME,
            contents,
            config: {
              outputDimensionality: EMBEDDING_DIMENSIONS,
            },
          });

          // Procesar resultados
          if (response.embeddings && response.embeddings.length > 0) {
            for (let j = 0; j < response.embeddings.length && j < batch.length; j++) {
              const embedding = response.embeddings[j]!.values;
              const item = batch[j]!;

              if (!embedding || embedding.length === 0) {
                console.warn(`⚠️ [Embedding Service] Empty embedding for text ${item.index}`);
                continue;
              }

              setInCache(item.cacheKey, embedding);
              orderedResults[item.index] = {
                embedding,
                text: item.text,
                model: EMBEDDING_MODEL_NAME,
              };
            }
            success = true;
            break;
          } else {
            throw new Error('No embeddings returned from Gemini batch call');
          }
        } catch (error) {
          lastError = error as Error;
          console.warn(
            `⚠️ [Embedding Service] Batch attempt ${attempt}/${retries} failed: ${lastError.message}`
          );

          if (attempt < retries) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      if (!success) {
        console.error(
          `❌ [Embedding Service] All batch attempts failed for batch ${i}:`,
          lastError
        );
        // Retry individual items as fallback
        for (let j = 0; j < batch.length; j++) {
          const item = batch[j]!;
          try {
            const embedding = await embeddingService.generateEmbedding(item.text);
            orderedResults[item.index] = {
              embedding,
              text: item.text,
              model: EMBEDDING_MODEL_NAME,
            };
          } catch (error) {
            console.error(
              `❌ [Embedding Service] Individual fallback failed for text ${item.index}:`,
              error
            );
          }
        }
      }

      // Pequeña pausa entre batches para no sobrecargar la API
      if (i + BATCH_SIZE < uncachedItems.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return orderedResults.filter((r): r is EmbeddingResult => r !== undefined);
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
      dotProduct += vecA[i]! * vecB[i]!;
      normA += vecA[i]! * vecA[i]!;
      normB += vecB[i]! * vecB[i]!;
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

console.log(
  `🔢 [Embedding Service] Initialized with model: ${EMBEDDING_MODEL_NAME} (${EMBEDDING_DIMENSIONS} dims)`
);
