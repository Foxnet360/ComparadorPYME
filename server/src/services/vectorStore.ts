import { ChromaClient, Collection } from 'chromadb';

const CHROMA_HOST = process.env.CHROMA_HOST || '';
const CHROMA_PORT = process.env.CHROMA_PORT || '8000';

let chromaClient: ChromaClient | null = null;
let useMockMode = false;

// Mock storage for development without ChromaDB
interface MockChunk {
    id: string;
    content: string;
    metadata: ChunkMetadata;
    embedding: number[];
}

const mockCollections: Map<string, MockChunk[]> = new Map();

const getChromaUrl = (): string => {
    if (CHROMA_HOST && CHROMA_HOST !== 'localhost') {
        return `http://${CHROMA_HOST}:${CHROMA_PORT}`;
    }
    return 'http://localhost:8000';
};

// Calculate cosine similarity between two vectors
const cosineSimilarity = (a: number[], b: number[]): number => {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

export interface ChunkMetadata {
    insurerName: string;
    documentName: string;
    documentType: string;
    chapter?: string;
    section?: string;
    clauseId?: string;
    pageStart: number;
    pageEnd: number;
}

export interface RetrievedChunk {
    id: string;
    content: string;
    metadata: ChunkMetadata;
    distance: number;
}

export const vectorStore = {
    /**
     * Inicializa el cliente de ChromaDB o modo mock si no está disponible
     */
    initialize: async (): Promise<void> => {
        if (useMockMode || mockCollections.size > 0) {
            console.log('📦 [VectorStore] Using MOCK mode (no ChromaDB)');
            return;
        }

        if (!chromaClient) {
            const chromaUrl = getChromaUrl();
            try {
                // Test connection before creating client
                const testClient = new ChromaClient({ path: chromaUrl });
                await testClient.heartbeat();
                
                chromaClient = testClient;
                console.log(`📦 [VectorStore] ChromaDB client initialized at ${chromaUrl}`);
            } catch (error) {
                console.warn(`⚠️ [VectorStore] ChromaDB not available at ${chromaUrl}, switching to MOCK mode`);
                console.warn(`   To use ChromaDB, run: docker run -p 8000:8000 chromadb/chroma:latest`);
                useMockMode = true;
            }
        }
    },

    /**
     * Agrega chunks a la colección
     */
    addChunks: async (
        insurerName: string,
        chunks: { id: string; content: string; metadata: ChunkMetadata; embedding: number[] }[]
    ): Promise<void> => {
        await vectorStore.initialize();
        
        const collectionName = insurerName.toLowerCase().replace(/\s+/g, '_');
        
        if (useMockMode) {
            // Store in mock collection
            if (!mockCollections.has(collectionName)) {
                mockCollections.set(collectionName, []);
            }
            const existingChunks = mockCollections.get(collectionName)!;
            
            // Add new chunks (avoid duplicates by id)
            for (const chunk of chunks) {
                const existingIndex = existingChunks.findIndex(c => c.id === chunk.id);
                if (existingIndex >= 0) {
                    existingChunks[existingIndex] = chunk;
                } else {
                    existingChunks.push(chunk);
                }
            }
            
            console.log(`✅ [VectorStore] Added ${chunks.length} chunks for ${insurerName} (MOCK mode)`);
            return;
        }

        try {
            const collection = await chromaClient!.getOrCreateCollection({ name: collectionName } as any);
            
            await collection.add({
                ids: chunks.map(c => c.id),
                embeddings: chunks.map(c => c.embedding),
                metadatas: chunks.map(c => c.metadata as any),
                documents: chunks.map(c => c.content),
            });

            console.log(`✅ [VectorStore] Added ${chunks.length} chunks for ${insurerName}`);
        } catch (error) {
            console.error(`Failed to add chunks:`, error);
            throw error;
        }
    },

    /**
     * Busca chunks similares
     */
    search: async (
        insurerName: string,
        queryEmbedding: number[],
        filter?: { clauseId?: string; section?: string },
        limit: number = 5
    ): Promise<RetrievedChunk[]> => {
        await vectorStore.initialize();
        
        const collectionName = insurerName.toLowerCase().replace(/\s+/g, '_');
        
        if (useMockMode) {
            const chunks = mockCollections.get(collectionName) || [];
            
            // Filter chunks
            let filteredChunks = chunks;
            if (filter?.clauseId) {
                filteredChunks = filteredChunks.filter(c => c.metadata.clauseId === filter.clauseId);
            }
            if (filter?.section) {
                filteredChunks = filteredChunks.filter(c => c.metadata.section === filter.section);
            }
            
            // Calculate similarities and sort
            const scoredChunks = filteredChunks.map(chunk => ({
                ...chunk,
                distance: 1 - cosineSimilarity(queryEmbedding, chunk.embedding)
            }));
            
            scoredChunks.sort((a, b) => a.distance - b.distance);
            
            return scoredChunks.slice(0, limit).map(c => ({
                id: c.id,
                content: c.content,
                metadata: c.metadata,
                distance: c.distance
            }));
        }

        try {
            const collection = await chromaClient!.getCollection(collectionName);

            const results = await collection.query({
                queryEmbeddings: [queryEmbedding],
                nResults: limit,
                where: filter,
            });

            const chunks: RetrievedChunk[] = [];
            
            if (results.ids && results.ids[0]) {
                for (let i = 0; i < results.ids[0].length; i++) {
                    chunks.push({
                        id: results.ids[0][i],
                        content: results.documents?.[0]?.[i] || '',
                        metadata: results.metadatas?.[0]?.[i] as any as ChunkMetadata,
                        distance: results.distances?.[0]?.[i] || 0,
                    });
                }
            }

            return chunks;
        } catch (error) {
            console.error(`Search failed:`, error);
            return [];
        }
    },

    /**
     * Elimina todos los chunks de un documento
     */
    deleteDocument: async (insurerName: string, documentName: string): Promise<void> => {
        await vectorStore.initialize();
        
        const collectionName = insurerName.toLowerCase().replace(/\s+/g, '_');
        
        if (useMockMode) {
            const chunks = mockCollections.get(collectionName) || [];
            const filtered = chunks.filter(c => c.metadata.documentName !== documentName);
            mockCollections.set(collectionName, filtered);
            console.log(`✅ [VectorStore] Deleted chunks for ${documentName} (MOCK mode)`);
            return;
        }

        try {
            const collection = await chromaClient!.getCollection(collectionName);

            const results = await collection.get({
                where: { documentName },
            });

            if (results.ids && results.ids.length > 0) {
                await collection.delete({
                    ids: results.ids,
                });
                console.log(`✅ [VectorStore] Deleted ${results.ids.length} chunks for ${documentName}`);
            }
        } catch (error) {
            console.error(`Delete failed:`, error);
        }
    },

    /**
     * Lista todos los documentos indexados
     */
    listDocuments: async (insurerName?: string): Promise<{ insurerName: string; documentName: string; chunkCount: number }[]> => {
        await vectorStore.initialize();
        
        const documents: { insurerName: string; documentName: string; chunkCount: number }[] = [];
        
        if (useMockMode) {
            for (const [collectionName, chunks] of mockCollections.entries()) {
                const insurer = collectionName.replace(/_/g, ' ').toUpperCase();
                
                if (insurerName && insurer !== insurerName.toUpperCase()) {
                    continue;
                }

                const documentNames = new Map<string, number>();
                for (const chunk of chunks) {
                    const name = chunk.metadata.documentName;
                    documentNames.set(name, (documentNames.get(name) || 0) + 1);
                }

                for (const [docName, count] of documentNames) {
                    documents.push({
                        insurerName: insurer,
                        documentName: docName,
                        chunkCount: count
                    });
                }
            }
            
            return documents;
        }

        try {
            const collections = await chromaClient!.listCollections() as any[];

            for (const coll of collections) {
                const insurer = coll.name.replace(/_/g, ' ').toUpperCase();
                
                if (insurerName && insurer !== insurerName.toUpperCase()) {
                    continue;
                }

                try {
                    const collection = await chromaClient!.getCollection(coll.name);
                    const results = await collection.get();
                    
                    const documentNames = new Map<string, number>();
                    if (results.metadatas) {
                        for (const meta of results.metadatas as any[]) {
                            if (meta.documentName) {
                                documentNames.set(meta.documentName, (documentNames.get(meta.documentName) || 0) + 1);
                            }
                        }
                    }

                    for (const [docName, count] of documentNames) {
                        documents.push({
                            insurerName: insurer,
                            documentName: docName,
                            chunkCount: count
                        });
                    }
                } catch (e) {
                    console.warn(`Failed to list documents for ${coll.name}:`, e);
                }
            }
        } catch (error) {
            console.error('Failed to list collections:', error);
        }

        return documents;
    }
};
