/**
 * Gemini File Search Store Service
 * Manages persistent vector stores for 100+ page policy clause PDFs using gemini-embedding-2
 */

import { GoogleGenAI } from '@google/genai';

let genAIClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY || '';
    genAIClient = new GoogleGenAI({ apiKey });
  }
  return genAIClient;
}

export interface FileSearchStoreConfig {
  displayName: string;
  embeddingModel?: string;
}

export interface FileSearchToolPayload {
  type: 'file_search';
  file_search_store_names: string[];
  metadata_filter?: string;
}

export interface FileSearchStoreRecord {
  name: string;
  displayName: string;
  createdAt?: string;
}

export const clauseSearchStoreService = {
  /**
   * Create a new persistent File Search store using gemini-embedding-2
   */
  createStore: async (
    displayName: string,
    embeddingModel = process.env.GEMINI_EMBEDDING_MODEL || 'models/gemini-embedding-2'
  ): Promise<FileSearchStoreRecord> => {
    const ai = getGenAI();
    try {
      const store = await (ai as any).fileSearchStores.create({
        config: {
          displayName,
          embeddingModel,
        },
      });
      console.log(`📁 [ClauseSearchStore] Created store '${displayName}': ${store.name}`);
      return {
        name: store.name,
        displayName: store.displayName || displayName,
      };
    } catch (error: unknown) {
      console.error(
        `❌ [ClauseSearchStore] Failed to create store '${displayName}':`,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  },

  /**
   * Directly upload and index a long policy clause PDF into a File Search store
   */
  uploadAndIndexClausePdf: async (
    filePath: string,
    storeName: string,
    displayName?: string
  ): Promise<boolean> => {
    const ai = getGenAI();
    try {
      console.log(`📤 [ClauseSearchStore] Indexing ${filePath} into store ${storeName}...`);
      let operation = await (ai as any).fileSearchStores.uploadToFileSearchStore({
        file: filePath,
        fileSearchStoreName: storeName,
        config: {
          displayName: displayName || filePath.split('/').pop() || 'clause.pdf',
        },
      });

      // Poll until indexing operation completes
      while (!operation.done) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        operation = await (ai as any).operations.get({ operation });
      }

      console.log(`✅ [ClauseSearchStore] Successfully indexed ${filePath} into ${storeName}`);
      return true;
    } catch (error: unknown) {
      console.error(
        `❌ [ClauseSearchStore] Failed to index ${filePath}:`,
        error instanceof Error ? error.message : String(error)
      );
      return false;
    }
  },

  /**
   * Build the tool configuration payload for Gemini API requests
   */
  buildToolConfig: (
    storeNames: string[],
    metadataFilter?: string
  ): FileSearchToolPayload | null => {
    if (!storeNames || storeNames.length === 0) return null;
    const payload: FileSearchToolPayload = {
      type: 'file_search',
      file_search_store_names: storeNames,
    };
    if (metadataFilter) {
      payload.metadata_filter = metadataFilter;
    }
    return payload;
  },
};
