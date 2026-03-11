import * as admin from 'firebase-admin';
import crypto from 'crypto';
import { ClauseDocument, ClauseSections, InsurerSummary } from '../types';
import { pdfExtractor } from './pdfExtractor';
import { sectionExtractor } from './sectionExtractor';

const COLLECTION = 'clausulados';

// Get Firestore instance (lazy, may be null in dev mode)
const getDb = (): admin.firestore.Firestore | null => {
    try {
        return admin.firestore();
    } catch {
        return null;
    }
};

// In-memory store for development without Firestore
const mockStore: Map<string, ClauseDocument> = new Map();

export const clauseLibrary = {
    /**
     * Create a new clause document from a PDF file
     * Automatically extracts sections after saving
     */
    createClause: async (
        filePath: string,
        originalName: string,
        metadata: { aseguradora: string; producto: string; version: string }
    ): Promise<ClauseDocument> => {
        const db = getDb();

        // Extract text from PDF
        const textoCompleto = await pdfExtractor.extractTextFromPdf(filePath);

        // Generate hash for duplicate detection
        const hash = crypto.createHash('sha256').update(textoCompleto).digest('hex');

        // Estimate tokens (~4 chars per token)
        const tokensEstimados = Math.ceil(textoCompleto.length / 4);

        const now = new Date();
        const doc: Omit<ClauseDocument, 'id'> = {
            aseguradora: metadata.aseguradora,
            producto: metadata.producto,
            version: metadata.version,
            hash,
            textoCompleto,
            secciones: {}, // Will be populated below
            tokensEstimados,
            fechaCreacion: now,
            fechaActualizacion: now,
            activo: true
        };

        if (!db) {
            // Mock mode for development - still try section extraction
            console.log('[MOCK] Creating clause:', metadata.aseguradora, metadata.producto);

            // Try section extraction even in mock mode
            const secciones = await sectionExtractor.extractSections(textoCompleto);
            const mockDoc: ClauseDocument = { id: `mock-${Date.now()}`, ...doc, secciones };

            // Store in memory
            mockStore.set(mockDoc.id, mockDoc);
            console.log(`[MOCK] Stored clause: ${mockDoc.id} (total: ${mockStore.size})`);

            return mockDoc;
        }

        // Check for duplicate by hash
        const existing = await db.collection(COLLECTION).where('hash', '==', hash).get();
        if (!existing.empty) {
            const existingDoc = existing.docs[0];
            console.log(`Clause with same content already exists: ${existingDoc.id}`);
            return { id: existingDoc.id, ...existingDoc.data() } as ClauseDocument;
        }

        // Create new document (without sections initially)
        const docRef = await db.collection(COLLECTION).add(doc);
        await docRef.update({ id: docRef.id });
        console.log(`✅ Created clause: ${docRef.id} (${metadata.aseguradora} - ${metadata.producto})`);

        // Extract sections asynchronously (don't block the response)
        // This runs in background and updates the document
        sectionExtractor.extractSections(textoCompleto)
            .then(async (secciones) => {
                if (sectionExtractor.hasSections(secciones)) {
                    await clauseLibrary.updateSections(docRef.id, secciones);
                }
            })
            .catch((err) => {
                console.error(`Section extraction failed for ${docRef.id}:`, err.message);
            });

        return { id: docRef.id, ...doc };
    },

    /**
     * Re-extract sections for an existing clause
     */
    reExtractSections: async (id: string): Promise<ClauseSections> => {
        const clause = await clauseLibrary.getClauseById(id);
        if (!clause) {
            throw new Error('Clause not found');
        }

        console.log(`🔄 Re-extracting sections for: ${id}`);
        const secciones = await sectionExtractor.extractSections(clause.textoCompleto);

        if (sectionExtractor.hasSections(secciones)) {
            await clauseLibrary.updateSections(id, secciones);
        }

        return secciones;
    },

    /**
     * Get all clauses for a specific insurer
     */
    getClausesByInsurer: async (aseguradora: string): Promise<ClauseDocument[]> => {
        const db = getDb();

        if (!db) {
            console.log('[MOCK] Getting clauses for:', aseguradora);
            return [];
        }

        const snapshot = await db.collection(COLLECTION)
            .where('aseguradora', '==', aseguradora)
            .where('activo', '==', true)
            .get();

        return snapshot.docs.map(doc => doc.data() as ClauseDocument);
    },

    /**
     * Get all clauses (with optional insurer filter)
     */
    getAllClauses: async (aseguradora?: string): Promise<ClauseDocument[]> => {
        const db = getDb();

        if (!db) {
            console.log(`[MOCK] Getting all clauses (store size: ${mockStore.size})`);
            const all = Array.from(mockStore.values()).filter(c => c.activo);
            if (aseguradora) {
                return all.filter(c => c.aseguradora === aseguradora);
            }
            return all;
        }

        let query: admin.firestore.Query = db.collection(COLLECTION).where('activo', '==', true);

        if (aseguradora) {
            query = query.where('aseguradora', '==', aseguradora);
        }

        const snapshot = await query.get();
        return snapshot.docs.map(doc => doc.data() as ClauseDocument);
    },

    /**
     * Get a specific clause by ID
     */
    getClauseById: async (id: string): Promise<ClauseDocument | null> => {
        const db = getDb();

        if (!db) {
            console.log(`[MOCK] Getting clause: ${id}`);
            return mockStore.get(id) || null;
        }

        const doc = await db.collection(COLLECTION).doc(id).get();
        if (!doc.exists) {
            return null;
        }
        return doc.data() as ClauseDocument;
    },

    /**
     * List all insurers with clause counts
     */
    listInsurers: async (): Promise<InsurerSummary[]> => {
        const db = getDb();

        if (!db) {
            console.log('[MOCK] Listing insurers');
            return [];
        }

        const snapshot = await db.collection(COLLECTION)
            .where('activo', '==', true)
            .get();

        // Group by insurer
        const counts: Record<string, number> = {};
        snapshot.docs.forEach(doc => {
            const aseg = doc.data().aseguradora;
            counts[aseg] = (counts[aseg] || 0) + 1;
        });

        return Object.entries(counts).map(([aseguradora, count]) => ({
            aseguradora,
            count
        }));
    },

    /**
     * Update sections for a clause (used by section-extraction)
     */
    updateSections: async (id: string, secciones: ClauseSections): Promise<void> => {
        const db = getDb();

        if (!db) {
            console.log('[MOCK] Updating sections for:', id);
            return;
        }

        await db.collection(COLLECTION).doc(id).update({
            secciones,
            fechaActualizacion: new Date()
        });
        console.log(`✅ Updated sections for clause: ${id}`);
    },

    /**
     * Deactivate a clause (soft delete)
     */
    deactivateClause: async (id: string): Promise<void> => {
        const db = getDb();

        if (!db) {
            console.log('[MOCK] Deactivating clause:', id);
            return;
        }

        await db.collection(COLLECTION).doc(id).update({
            activo: false,
            fechaActualizacion: new Date()
        });
    }
};
