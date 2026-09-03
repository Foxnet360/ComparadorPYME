/// <reference types="vite/client" />
import {
  HistoryEntry,
  DashboardStats,
  UserProfile,
  QuoteStatus,
  ComparisonReport,
  Client,
  QuoteAnalysis,
} from '../types';
import { dbService } from './db';
import { apiClient } from './apiClient';
import { authService } from './authService';

/**
 * ERR-4: legacy local auth keys that used to persist session/profile data in
 * localStorage. They are deleted on app boot by cleanupLegacyAuthStorage.
 */
const LEGACY_AUTH_KEYS = ['seguro_app_user', 'seguro_app_token', 'authToken', 'auth_token', 'user'];

// Mock Data for initial load (fallback only)
const MOCK_CLIENTS: Client[] = [
  {
    id: 'c1',
    name: 'Transportes Rápidos S.A.',
    nit: '900.123.456-1',
    contactPerson: 'Juan Pérez',
    industry: 'Logística',
    email: 'gerencia@transportesrapidos.com',
  },
  {
    id: 'c2',
    name: 'Inmobiliaria El Porvenir',
    nit: '800.987.654-2',
    contactPerson: 'María Gómez',
    industry: 'Real Estate',
    email: 'admin@elporvenir.co',
  },
];

export const storageService = {
  // --- AUTHENTICATION (ERR-4) ---
  // The local register/login flow and the localStorage/IndexedDB copies were
  // removed: the Supabase client owns the session and no auth data is kept
  // in local or IndexedDB storage.

  getCurrentUser: (): Promise<UserProfile | null> => authService.getCurrentUser(),

  logout: (): Promise<void> => authService.signOut(),

  updateProfile: (updatedUser: UserProfile): Promise<UserProfile> =>
    authService.updateProfile(updatedUser),

  /** ERR-4: on app boot, wipe any auth data persisted by legacy versions. */
  cleanupLegacyAuthStorage: async (): Promise<void> => {
    for (const key of LEGACY_AUTH_KEYS) {
      localStorage.removeItem(key);
    }
    await dbService.clearLegacyUsersStore();
  },

  // --- CLIENTS ---
  getClients: async (): Promise<Client[]> => {
    const currentUser = await storageService.getCurrentUser();
    if (currentUser) {
      try {
        const response = await apiClient.fetch('/clients');
        const rawData = await response.json();
        const cloudClients: Client[] = Array.isArray(rawData)
          ? rawData
          : Array.isArray(rawData?.data)
            ? rawData.data
            : [];

        // Sync and cache cloud clients to local IndexedDB
        for (const client of cloudClients) {
          if (client && client.id) {
            await dbService.put('clients', client);
          }
        }

        return cloudClients;
      } catch (error) {
        console.warn(
          '⚠️ Failed to fetch clients from backend, falling back to local IndexedDB',
          error
        );
      }
    }

    const clients = await dbService.getAll('clients');
    if (clients.length === 0) {
      for (const client of MOCK_CLIENTS) {
        await dbService.put('clients', client);
      }
      return MOCK_CLIENTS;
    }
    return clients;
  },

  addClient: async (client: Client): Promise<Client[]> => {
    // Put into local IndexedDB for responsiveness and offline usage
    await dbService.put('clients', client);

    // Sync with cloud backend database if authenticated
    try {
      const currentUser = await storageService.getCurrentUser();
      if (currentUser) {
        await apiClient.fetch('/clients', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(client),
        });
        console.log('✅ Client successfully synchronized to backend');
      }
    } catch (error) {
      console.warn(
        '⚠️ Syncing client to backend failed. Will keep in local IndexedDB only.',
        error
      );
    }

    return await storageService.getClients();
  },

  updateClient: async (client: Client): Promise<Client[]> => {
    await dbService.put('clients', client);
    try {
      const currentUser = await storageService.getCurrentUser();
      if (currentUser && client.id) {
        await apiClient.fetch(`/clients/${client.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(client),
        });
      }
    } catch (error) {
      console.warn('⚠️ Updating client in backend failed. Updated in local IndexedDB.', error);
    }
    return await storageService.getClients();
  },

  deleteClient: async (clientId: string): Promise<Client[]> => {
    await dbService.delete('clients', clientId);
    try {
      const currentUser = await storageService.getCurrentUser();
      if (currentUser) {
        await apiClient.fetch(`/clients/${clientId}`, { method: 'DELETE' });
      }
    } catch (error) {
      console.warn('⚠️ Deleting client from backend failed. Deleted from local IndexedDB.', error);
    }
    return await storageService.getClients();
  },

  // --- HISTORY & STATS ---
  getHistory: async (): Promise<HistoryEntry[]> => {
    let cloudTransformed: HistoryEntry[] = [];
    let backendReachable = false;
    try {
      // AUTH-2: the backend derives user_id from the Bearer token; sending
      // ?userId= is a spoofing vector and is rejected with 400.
      const response = await apiClient.fetch('/history');
      if (response.ok !== false) {
        backendReachable = true;
        const rawData = await response.json();
        const cloudHistory: Array<{
          id: string;
          user_id?: string;
          client_id?: string;
          created_at?: string;
          client_name?: string;
          analysis_result?: { quotes?: QuoteAnalysis[] };
        }> = Array.isArray(rawData) ? rawData : Array.isArray(rawData?.data) ? rawData.data : [];

        // Transform backend data (snake_case) to frontend format (camelCase)
        cloudTransformed = cloudHistory.map((item) => {
          const analysisResult = item.analysis_result || {};
          const quotes = analysisResult.quotes || [];
          const bestQuote =
            quotes.length > 0
              ? quotes.reduce((prev, curr) => (prev.score > curr.score ? prev : curr))
              : null;

          return {
            id: item.id,
            userId: item.user_id,
            clientId: item.client_id,
            date: item.created_at
              ? item.created_at.split('T')[0]!
              : new Date().toISOString().split('T')[0]!,
            clientName: item.client_name || 'Cliente Sin Nombre',
            insurers: quotes.map((q) => q.insurerName || 'Desconocido'),
            bestOption: bestQuote?.insurerName || 'N/A',
            premiumValue: bestQuote?.priceAnnual || 0,
            status: 'SENT', // Default status - could be stored in DB in future
            fullReport: analysisResult as ComparisonReport,
          };
        });
      }
    } catch (e) {
      console.warn('Backend history unreachable, falling back to local storage', e);
    }

    if (backendReachable) {
      // Backend is authoritative. Sync local IndexedDB storage to clear old deleted entries.
      try {
        await dbService.clear('history');
        for (const item of cloudTransformed) {
          await dbService.put('history', item);
        }
      } catch (err) {
        console.warn('Failed to sync IndexedDB history cache', err);
      }
      return cloudTransformed.sort((a, b) => (b.date > a.date ? 1 : -1));
    }

    // Fallback to local IndexedDB storage when backend is unreachable
    const rawLocal = await dbService.getAll('history');
    const localHistory = Array.isArray(rawLocal) ? rawLocal : [];
    return localHistory.sort((a, b) => (b.date > a.date ? 1 : -1));
  },

  getHistoryByClient: async (clientId: string, clientName?: string): Promise<HistoryEntry[]> => {
    const allHistory = await storageService.getHistory();
    return allHistory.filter(
      (entry) =>
        entry.clientId === clientId ||
        (clientName && entry.clientName.toLowerCase() === clientName.toLowerCase())
    );
  },

  saveAnalysis: async (
    clientName: string,
    report: ComparisonReport,
    clientId?: string
  ): Promise<string | undefined> => {
    const currentUser = await storageService.getCurrentUser();
    const effectiveUserId = currentUser?.id || 'guest';

    if (!report || !report.quotes || !Array.isArray(report.quotes) || report.quotes.length === 0) {
      console.warn('Cannot save analysis: Invalid report structure', report);
      return undefined;
    }

    // Backend already saves the analysis, we just need to update local cache
    const bestQuote = report.quotes.reduce((prev, curr) => (prev.score > curr.score ? prev : curr));
    const insurers = report.quotes.map((q) => q.insurerName || 'Desconocido');

    // Use backend-generated UUID if available, otherwise generate a valid UUID
    const id = report.id || crypto.randomUUID();

    const newEntry: HistoryEntry = {
      id,
      userId: effectiveUserId,
      clientId,
      date: new Date().toISOString().split('T')[0]!,
      clientName: clientName || 'Cliente Sin Nombre',
      insurers: insurers,
      bestOption: bestQuote?.insurerName || 'N/A',
      premiumValue: bestQuote?.priceAnnual || 0,
      status: 'SENT',
      fullReport: report,
    };

    await dbService.put('history', newEntry);
    return newEntry.id;
  },

  updateStatus: async (id: string, newStatus: QuoteStatus) => {
    // Update local storage
    const entry = await dbService.get('history', id);
    if (entry) {
      const updated = { ...entry, status: newStatus };
      await dbService.put('history', updated);
    }

    // Note: Backend doesn't have an endpoint to update status yet
    // This would need to be implemented in the backend if we want persistence
  },

  getStats: async (): Promise<DashboardStats> => {
    const history = await storageService.getHistory();
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthNames = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
    ];

    const monthHistory = history.filter((h) => {
      const d = new Date(h.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const totalQuotes = monthHistory.length;
    const sold = monthHistory.filter((h) => h.status === 'SOLD');
    const active = monthHistory.filter((h) => h.status === 'SENT' || h.status === 'DRAFT');

    const conversionRate = totalQuotes > 0 ? Math.round((sold.length / totalQuotes) * 100) : 0;
    const totalPremiumSold = sold.reduce((sum, item) => sum + (item.premiumValue || 0), 0);

    return {
      totalQuotes,
      conversionRate,
      totalPremiumSold,
      activeProspects: active.length,
      monthName: `${monthNames[currentMonth]} ${currentYear}`,
    };
  },
};
