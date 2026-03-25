import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { UserProfile, Client, HistoryEntry } from '../types';

interface CSADB extends DBSchema {
    users: {
        key: string;
        value: UserProfile;
    };
    clients: {
        key: string;
        value: Client;
    };
    history: {
        key: string;
        value: HistoryEntry;
        indexes: { 'by-user': string };
    };
}

const DB_NAME = 'csa-comparator-db';
const DB_VERSION = 1;

export const dbService = {
    dbPromise: openDB<CSADB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains('users')) {
                db.createObjectStore('users', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('clients')) {
                db.createObjectStore('clients', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('history')) {
                const historyStore = db.createObjectStore('history', { keyPath: 'id' });
                historyStore.createIndex('by-user', 'userId');
            }
        },
    }),

    // Generic Helpers
    async getAll<StoreName extends keyof CSADB>(storeName: StoreName): Promise<CSADB[StoreName]['value'][]> {
        const db = await this.dbPromise;
        return db.getAll(storeName);
    },

    async get<StoreName extends keyof CSADB>(storeName: StoreName, key: string): Promise<CSADB[StoreName]['value'] | undefined> {
        const db = await this.dbPromise;
        return db.get(storeName, key);
    },

    async put<StoreName extends keyof CSADB>(storeName: StoreName, value: CSADB[StoreName]['value']): Promise<string> {
        const db = await this.dbPromise;
        return db.put(storeName, value);
    },

    async delete<StoreName extends keyof CSADB>(storeName: StoreName, key: string): Promise<void> {
        const db = await this.dbPromise;
        return db.delete(storeName, key);
    },

    // Specific Logic for History by User
    async getHistoryByUser(userId: string): Promise<HistoryEntry[]> {
        const db = await this.dbPromise;
        return db.getAllFromIndex('history', 'by-user', userId);
    }
};
