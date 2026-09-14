/**
 * Portfolio Context (renovacion-polizas PR-5, task 1.21)
 *
 * Holds the broker's renewal portfolio (clients, policies, renewals) with
 * SWR-style fetching: a single initial load, then state updated in place by
 * each CRUD action. Additive surface — nothing here touches the existing
 * AnalysisContext flow (XC-3).
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as portfolioService from '../services/portfolioService';
import type {
  PortfolioClient,
  PortfolioPolicy,
  PortfolioRenewal,
  RenewalTransitionInput,
} from '../types';
import type { CreatePolicyInput } from '../services/portfolioService';

interface PortfolioContextType {
  clients: PortfolioClient[];
  policies: PortfolioPolicy[];
  renewals: PortfolioRenewal[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addClient: (input: Parameters<typeof portfolioService.createClient>[0]) => Promise<void>;
  editClient: (
    id: string,
    input: Parameters<typeof portfolioService.updateClient>[1]
  ) => Promise<void>;
  removeClient: (id: string) => Promise<void>;
  addPolicy: (input: CreatePolicyInput) => Promise<void>;
  editPolicy: (
    id: string,
    input: Parameters<typeof portfolioService.updatePolicy>[1]
  ) => Promise<void>;
  removePolicy: (id: string) => Promise<void>;
  applyRenewalTransition: (id: string, input: RenewalTransitionInput) => Promise<void>;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export const PortfolioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [clients, setClients] = useState<PortfolioClient[]>([]);
  const [policies, setPolicies] = useState<PortfolioPolicy[]>([]);
  const [renewals, setRenewals] = useState<PortfolioRenewal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Independent resources — fetch in parallel, never as a waterfall.
      const [clientRows, policyRows, renewalRows] = await Promise.all([
        portfolioService.listClients(),
        portfolioService.listPolicies(),
        portfolioService.listRenewals(),
      ]);
      setClients(clientRows);
      setPolicies(policyRows);
      setRenewals(renewalRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addClient = useCallback(
    async (input: Parameters<typeof portfolioService.createClient>[0]) => {
      const created = await portfolioService.createClient(input);
      setClients((prev) => [...prev, created]);
    },
    []
  );

  const editClient = useCallback(
    async (id: string, input: Parameters<typeof portfolioService.updateClient>[1]) => {
      const updated = await portfolioService.updateClient(id, input);
      setClients((prev) => prev.map((c) => (c.id === id ? updated : c)));
    },
    []
  );

  const removeClient = useCallback(async (id: string) => {
    await portfolioService.deleteClient(id);
    setClients((prev) => prev.filter((c) => c.id !== id));
    setPolicies((prev) => prev.filter((p) => p.client_id !== id));
  }, []);

  const addPolicy = useCallback(async (input: CreatePolicyInput) => {
    const created = await portfolioService.createPolicy(input);
    setPolicies((prev) => [...prev, created]);
  }, []);

  const editPolicy = useCallback(
    async (id: string, input: Parameters<typeof portfolioService.updatePolicy>[1]) => {
      const updated = await portfolioService.updatePolicy(id, input);
      setPolicies((prev) => prev.map((p) => (p.id === id ? updated : p)));
    },
    []
  );

  const removePolicy = useCallback(async (id: string) => {
    await portfolioService.deletePolicy(id);
    setPolicies((prev) => prev.filter((p) => p.id !== id));
    setRenewals((prev) => prev.filter((r) => r.policy_id !== id));
  }, []);

  const applyRenewalTransition = useCallback(async (id: string, input: RenewalTransitionInput) => {
    const updated = await portfolioService.transitionRenewal(id, input);
    setRenewals((prev) => prev.map((r) => (r.id === id ? updated : r)));
  }, []);

  return (
    <PortfolioContext.Provider
      value={{
        clients,
        policies,
        renewals,
        loading,
        error,
        refresh,
        addClient,
        editClient,
        removeClient,
        addPolicy,
        editPolicy,
        removePolicy,
        applyRenewalTransition,
      }}
    >
      {children}
    </PortfolioContext.Provider>
  );
};

export const usePortfolio = (): PortfolioContextType => {
  const context = useContext(PortfolioContext);
  if (!context) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
};
