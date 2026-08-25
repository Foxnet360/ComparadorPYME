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

let dbInstance: IDBPDatabase<CSADB> | null = null;

async function getDb(): Promise<IDBPDatabase<CSADB>> {
  if (dbInstance) {
    try {
      if (dbInstance.name) return dbInstance;
    } catch {
      dbInstance = null;
    }
  }

  dbInstance = await openDB<CSADB>(DB_NAME, DB_VERSION, {
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
    terminated() {
      dbInstance = null;
    },
  });

  return dbInstance;
}

export const dbService = {
  // Generic Helpers
  async getAll<StoreName extends keyof CSADB>(
    storeName: StoreName
  ): Promise<CSADB[StoreName]['value'][]> {
    try {
      const db = await getDb();
      return await db.getAll(storeName);
    } catch (err) {
      console.warn(`[IndexedDB] Retry getAll on store ${String(storeName)} due to connection reset`, err);
      dbInstance = null;
      const db = await getDb();
      return await db.getAll(storeName);
    }
  },

  async get<StoreName extends keyof CSADB>(
    storeName: StoreName,
    key: string
  ): Promise<CSADB[StoreName]['value'] | undefined> {
    try {
      const db = await getDb();
      return await db.get(storeName, key);
    } catch (err) {
      console.warn(`[IndexedDB] Retry get on store ${String(storeName)} due to connection reset`, err);
      dbInstance = null;
      const db = await getDb();
      return await db.get(storeName, key);
    }
  },

  async put<StoreName extends keyof CSADB>(
    storeName: StoreName,
    value: CSADB[StoreName]['value']
  ): Promise<string> {
    try {
      const db = await getDb();
      return await db.put(storeName, value);
    } catch (err) {
      console.warn(`[IndexedDB] Retry put on store ${String(storeName)} due to connection reset`, err);
      dbInstance = null;
      const db = await getDb();
      return await db.put(storeName, value);
    }
  },

  async clear<StoreName extends keyof CSADB>(storeName: StoreName): Promise<void> {
    try {
      const db = await getDb();
      return await db.clear(storeName);
    } catch (err) {
      console.warn(`[IndexedDB] Retry clear on store ${String(storeName)} due to connection reset`, err);
      dbInstance = null;
      const db = await getDb();
      return await db.clear(storeName);
    }
  },

  async delete<StoreName extends keyof CSADB>(storeName: StoreName, key: string): Promise<void> {
    try {
      const db = await getDb();
      return await db.delete(storeName, key);
    } catch (err) {
      console.warn(`[IndexedDB] Retry delete on store ${String(storeName)} due to connection reset`, err);
      dbInstance = null;
      const db = await getDb();
      return await db.delete(storeName, key);
    }
  },

  // Specific Logic for History by User
  async getHistoryByUser(userId: string): Promise<HistoryEntry[]> {
    try {
      const db = await getDb();
      return await db.getAllFromIndex('history', 'by-user', userId);
    } catch (err) {
      console.warn(`[IndexedDB] Retry getHistoryByUser due to connection reset`, err);
      dbInstance = null;
      const db = await getDb();
      return await db.getAllFromIndex('history', 'by-user', userId);
    }
  },
};
