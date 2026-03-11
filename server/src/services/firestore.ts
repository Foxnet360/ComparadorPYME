import * as admin from 'firebase-admin';
import { ComparisonReport, HistoryEntry, QuoteStatus } from '../types';

let db: admin.firestore.Firestore | null = null;

// Only initialize Firestore if we have credentials (production) or explicitly enabled
const initFirestore = () => {
    if (db) return db;

    try {
        if (admin.apps.length === 0) {
            admin.initializeApp({
                // Cloud Run detects credentials automatically via GOOGLE_APPLICATION_CREDENTIALS
            });
        }
        db = admin.firestore();
        console.log("✅ Firestore initialized.");
        return db;
    } catch (error) {
        console.warn("⚠️ Firestore initialization skipped (no credentials). Running in Mock Mode.");
        return null;
    }
};

// Lazy initialization - don't crash on import
if (process.env.NODE_ENV === 'production' || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    initFirestore();
} else {
    console.log("📋 Development mode: Firestore disabled (use GOOGLE_APPLICATION_CREDENTIALS to enable)");
}

const COLLECTION_HISTORY = 'analysis_history';

export const firestoreService = {
    saveAnalysis: async (userId: string, clientName: string, report: ComparisonReport): Promise<string> => {
        if (!db) {
            console.log("[MOCK] Saving analysis to Firestore:", clientName);
            return `mock-id-${Date.now()}`;
        }

        try {
            const bestQuote = report.quotes.reduce((prev, curr) =>
                ((prev?.score || 0) > (curr?.score || 0)) ? prev : curr,
                report.quotes[0]
            );

            const insurers = report.quotes.map(q => q.insurerName || 'Desconocido');

            const entry: HistoryEntry = {
                id: '', // Will be set by Firestore
                userId,
                date: new Date().toISOString(),
                clientName: clientName || 'Cliente Desconocido',
                insurers,
                bestOption: bestQuote?.insurerName || 'N/A',
                premiumValue: bestQuote?.priceAnnual || 0,
                status: 'SENT', // Initial status
                fullReport: report
            };

            const docRef = await db.collection(COLLECTION_HISTORY).add(entry);
            // Update with ID
            await docRef.update({ id: docRef.id });

            console.log(`Report saved to Firestore with ID: ${docRef.id}`);
            return docRef.id;
        } catch (error) {
            console.error("Error saving to Firestore:", error);
            throw error;
        }
    },

    getHistoryByUser: async (userId: string): Promise<HistoryEntry[]> => {
        if (!db) {
            console.log("[MOCK] Fetching history for user:", userId);
            return [];
        }

        try {
            const snapshot = await db.collection(COLLECTION_HISTORY)
                .where('userId', '==', userId)
                .orderBy('date', 'desc')
                .get();

            if (snapshot.empty) {
                return [];
            }

            return snapshot.docs.map(doc => doc.data() as HistoryEntry);
        } catch (error) {
            console.error("Error fetching history:", error);
            // Fallback or rethrow? 
            // If index is missing, it throws.
            return [];
        }
    }
};
