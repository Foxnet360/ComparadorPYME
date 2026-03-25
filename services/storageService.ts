/// <reference types="vite/client" />
import { HistoryEntry, DashboardStats, UserProfile, QuoteStatus, ComparisonReport, Client } from "../types";
import { dbService } from "./db";

const USER_KEY = 'seguro_app_user';

// Mock Data for initial load
const MOCK_HISTORY: HistoryEntry[] = [
  { id: '1', userId: 'admin_001', date: '2023-10-15', clientName: 'Transportes Rápidos S.A.', insurers: ['Allianz', 'Chubb', 'Mapfre'], bestOption: 'Allianz', premiumValue: 45000000, status: 'SOLD' },
  { id: '2', userId: 'admin_001', date: '2023-10-20', clientName: 'Inmobiliaria El Porvenir', insurers: ['Sura', 'Bolívar', 'Zurich'], bestOption: 'Sura', premiumValue: 12500000, status: 'LOST' },
  { id: '3', userId: 'admin_001', date: '2023-11-05', clientName: 'Tecnología Global Solutions', insurers: ['AXA Colpatria', 'Chubb', 'Mapfre'], bestOption: 'Chubb', premiumValue: 28000000, status: 'SENT' },
  { id: '4', userId: 'admin_001', date: '2023-11-12', clientName: 'Constructora Metro', insurers: ['Seguros del Estado', 'Solidaria', 'Mapfre'], bestOption: 'Mapfre', premiumValue: 156000000, status: 'DRAFT' },
  { id: '5', userId: 'admin_001', date: '2023-11-18', clientName: 'Cadena de Restaurantes La Nonna', insurers: ['Bolívar', 'Sura', 'AXA'], bestOption: 'Bolívar', premiumValue: 8900000, status: 'SENT' },
];

const MOCK_CLIENTS: Client[] = [
  { id: 'c1', name: 'Transportes Rápidos S.A.', nit: '900.123.456-1', contactPerson: 'Juan Pérez', industry: 'Logística', email: 'gerencia@transportesrapidos.com' },
  { id: 'c2', name: 'Inmobiliaria El Porvenir', nit: '800.987.654-2', contactPerson: 'María Gómez', industry: 'Real Estate', email: 'admin@elporvenir.co' },
  { id: 'c3', name: 'Tecnología Global Solutions', nit: '901.555.333-3', contactPerson: 'Pedro Tech', industry: 'Tecnología', email: 'cto@globaltech.com' },
  { id: 'c4', name: 'Constructora Metro', nit: '890.111.222-4', contactPerson: 'Ing. Carlos Ruiz', industry: 'Construcción', email: 'cruiz@metroc.com' },
  { id: 'c5', name: 'Cadena de Restaurantes La Nonna', nit: '900.555.888-9', contactPerson: 'Luisa Fernanda', industry: 'Alimentos', email: 'compras@lanonna.com' },
  { id: 'c6', name: 'Clínica Santa Fe', nit: '860.000.111-1', contactPerson: 'Dr. Roberto', industry: 'Salud', email: 'director@clinicasantafe.com' },
];

export const storageService = {
  // --- AUTHENTICATION ---

  register: async (user: UserProfile): Promise<UserProfile> => {
    // Check if email already exists
    const users = await dbService.getAll("users");
    if (users.find(u => u.email === user.email)) {
      throw new Error('El correo electrónico ya está registrado.');
    }

    const newUser = { ...user, id: Date.now().toString() };
    await dbService.put("users", newUser);

    // Auto login
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    return newUser;
  },

  login: async (email: string, password: string): Promise<UserProfile> => {
    // 1. Check Admin Hardcoded (Legacy/Backdoor)
    if (email === 'admin@seguros.com' && password === 'admin123') {
      const adminUser: UserProfile = {
        id: 'admin_001',
        name: 'Administrador',
        email: email,
        role: 'ADMIN',
        avatarUrl: 'https://ui-avatars.com/api/?name=Admin&background=4f46e5&color=fff',
        intermediaryName: 'Seguros Admin HQ'
      };
      localStorage.setItem(USER_KEY, JSON.stringify(adminUser));
      return adminUser;
    }

    // 2. Check Registered Users in DB
    const users = await dbService.getAll("users");
    const foundUser = users.find(u => u.email === email && u.password === password);

    if (foundUser) {
      localStorage.setItem(USER_KEY, JSON.stringify(foundUser));
      return foundUser;
    } else {
      throw new Error('Credenciales inválidas');
    }
  },

  updateProfile: async (updatedUser: UserProfile): Promise<UserProfile> => {
    await dbService.put("users", updatedUser);

    // Update current session if it matches
    const currentUser = storageService.getCurrentUser();
    if (currentUser && currentUser.id === updatedUser.id) {
      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
    }
    return updatedUser;
  },

  logout: () => {
    localStorage.removeItem(USER_KEY);
  },

  getCurrentUser: (): UserProfile | null => {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  },

  // --- CLIENTS ---
  getClients: async (): Promise<Client[]> => {
    const clients = await dbService.getAll("clients");
    if (clients.length === 0) {
      // Seed initial data
      for (const client of MOCK_CLIENTS) {
        await dbService.put("clients", client);
      }
      return MOCK_CLIENTS;
    }
    return clients;
  },

  addClient: async (client: Client): Promise<Client[]> => {
    await dbService.put("clients", client);
    return await storageService.getClients();
  },

  // --- HISTORY & STATS ---
  getHistory: async (): Promise<HistoryEntry[]> => {
    const currentUser = storageService.getCurrentUser();
    if (!currentUser || !currentUser.id) return [];

    try {
      // 1. Try fetching from Cloud Backend
      // We assume API is available at /api or http://localhost:8080/api (needs config)
      // geminiService has API_BASE_URL, we should likely export it or centralized config.
      // For now, hardcode or valid relative path if proxied.
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

      const response = await fetch(`${API_URL}/history?userId=${currentUser.id}`);
      if (response.ok) {
        const cloudHistory = await response.json();
        // Return cloud history immediately
        return cloudHistory;
      }
    } catch (e) {
      console.warn("Backend Unreachable, falling back to local storage", e);
    }

    // Fallback: Local Storage (IndexedDB)
    let allHistory = await dbService.getAll("history");

    // Seed mock data if empty (for demo)
    if (allHistory.length === 0 && currentUser.role === 'ADMIN') {
      // Original Mock Data Logic preserved for fallback
      // ... (We could restore mock logic here but it's cleaner to return what we have)
    }

    if (currentUser.role === 'ADMIN') return allHistory;
    return allHistory.filter(entry => entry.userId === currentUser.id);
  },

  saveAnalysis: async (clientName: string, report: ComparisonReport) => {
    const currentUser = storageService.getCurrentUser();
    if (!currentUser) return;

    // Safety check
    if (!report || !report.quotes || !Array.isArray(report.quotes) || report.quotes.length === 0) {
      console.warn("Cannot save analysis: Invalid report structure", report);
      return;
    }

    // Extract details
    const bestQuote = report.quotes.reduce((prev: any, curr: any) => ((prev?.score || 0) > (curr?.score || 0)) ? prev : curr, report.quotes[0]);
    const insurers = report.quotes.map((q: any) => q.insurerName || 'Desconocido');

    const newEntry: HistoryEntry = {
      id: Date.now().toString(),
      userId: currentUser.id,
      date: new Date().toISOString().split('T')[0],
      clientName: clientName || 'Cliente Sin Nombre',
      insurers: insurers,
      bestOption: bestQuote?.insurerName || 'N/A',
      premiumValue: bestQuote?.priceAnnual || 0,
      status: 'SENT',
      fullReport: report
    };

    await dbService.put("history", newEntry);
  },

  updateStatus: async (id: string, newStatus: QuoteStatus) => {
    const entry = await dbService.get("history", id);
    if (entry) {
      const updated = { ...entry, status: newStatus };
      await dbService.put("history", updated);
    }
  },

  getStats: async (): Promise<DashboardStats> => {
    const history = await storageService.getHistory();
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    const monthHistory = history.filter(h => {
      const d = new Date(h.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const totalQuotes = monthHistory.length;
    const sold = monthHistory.filter(h => h.status === 'SOLD');
    const active = monthHistory.filter(h => h.status === 'SENT' || h.status === 'DRAFT');

    const conversionRate = totalQuotes > 0 ? Math.round((sold.length / totalQuotes) * 100) : 0;
    const totalPremiumSold = sold.reduce((sum, item) => sum + (item.premiumValue || 0), 0);

    return {
      totalQuotes,
      conversionRate,
      totalPremiumSold,
      activeProspects: active.length,
      monthName: `${monthNames[currentMonth]} ${currentYear}`
    };
  }
};