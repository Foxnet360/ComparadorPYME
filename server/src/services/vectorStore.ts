import { ChromaClient, Collection } from 'chromadb';

const CHROMA_HOST = process.env.CHROMA_HOST || '';
const CHROMA_PORT = process.env.CHROMA_PORT || '8000';

let chromaClient: ChromaClient | null = null;

const getChromaUrl = (): string => {
    if (CHROMA_HOST && CHROMA_HOST !== 'localhost') {
        return `http://${CHROMA_HOST}:${CHROMA_PORT}`;
    }
    return 'http://localhost:8000';
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
     * Inicializa el cliente de ChromaDB
     */
    initialize: async (): Promise<void> => {
        if (!chromaClient) {
            const chromaUrl = getChromaUrl();
            chromaClient = new ChromaClient({
                path: chromaUrl,
            });
            console.log(`📦 [VectorStore] ChromaDB client initialized at ${chromaUrl}`);
        }
    },

    /**
     * Obtiene o crea una colección para una aseguradora
     */
    getCollection: async (insurerName: string): Promise<Collection> => {
        await vectorStore.initialize();
        
        const collectionName = insurerName.toLowerCase().replace(/\s+/g, '_');
        
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return await chromaClient!.getOrCreateCollection({ name: collectionName } as any);
        } catch (error) {
            console.error(`Failed to get collection ${collectionName}:`, error);
            throw error;
        }
    },

    /**
     * Agrega chunks a la colección
     */
    addChunks: async (
        insurerName: string,
        chunks: { id: string; content: string; metadata: ChunkMetadata; embedding: number[] }[]
    ): Promise<void> => {
        const collection = await vectorStore.getCollection(insurerName);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await collection.add({
            ids: chunks.map(c => c.id),
            embeddings: chunks.map(c => c.embedding),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            metadatas: chunks.map(c => c.metadata as any),
            documents: chunks.map(c => c.content),
        });

        console.log(`✅ [VectorStore] Added ${chunks.length} chunks for ${insurerName}`);
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
        const collection = await vectorStore.getCollection(insurerName);

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
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    metadata: results.metadatas?.[0]?.[i] as any as ChunkMetadata,
                    distance: results.distances?.[0]?.[i] || 0,
                });
            }
        }

        return chunks;
    },

    /**
     * Elimina todos los chunks de un documento
     */
    deleteDocument: async (insurerName: string, documentName: string): Promise<void> => {
        const collection = await vectorStore.getCollection(insurerName);

        const results = await collection.get({
            where: { documentName },
        });

        if (results.ids && results.ids.length > 0) {
            await collection.delete({
                ids: results.ids,
            });
            console.log(`✅ [VectorStore] Deleted ${results.ids.length} chunks for ${documentName}`);
        }
    },

    /**
     * Lista todos los documentos indexados
     */
    listDocuments: async (insurerName?: string): Promise<{ insurerName: string; documentName: string; chunkCount: number }[]> => {
        await vectorStore.initialize();
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const collections = await chromaClient!.listCollections() as any[];
        const documents: { insurerName: string; documentName: string; chunkCount: number }[] = [];

        for (const coll of collections) {
            const insurer = coll.name.replace(/_/g, ' ').toUpperCase();
            
            if (insurerName && insurer !== insurerName.toUpperCase()) {
                continue;
            }

            try {
                const collection = await chromaClient!.getCollection(coll.name);
                const results = await collection.get();
                
                const documentNames = new Set<string>();
                if (results.metadatas) {
                    for (const meta of results.metadatas as any[]) {
                        if (meta.documentName) {
                            documentNames.add(meta.documentName);
                        }
                    }
                }

                for (const docName of documentNames) {
                    documents.push({
                        insurerName: insurer,
                        documentName: docName,
                        chunkCount: results.ids.length,
                    });
                }
            } catch (error) {
                console.error(`Error getting collection ${coll.name}:`, error);
            }
        }

        return documents;
    },

    /**
     * Verifica si hay documentos para una aseguradora
     */
    hasDocuments: async (insurerName: string): Promise<boolean> => {
        const documents = await vectorStore.listDocuments(insurerName);
        return documents.length > 0;
    },
};
