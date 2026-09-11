/**
 * Portfolio Page (renovacion-polizas PR-5, task 1.21)
 *
 * Client/policy list & CRUD UX over PortfolioContext. Lazy-loaded from
 * App.tsx so the NEW-comparison bundle stays untouched (XC-3).
 */

import React, { useState } from 'react';
import { usePortfolio } from '../contexts/PortfolioContext';
import type { PortfolioClient, PortfolioRenewal } from '../types';

interface PortfolioProps {
  onOpenRenewal?: (renewalId: string) => void;
}

const Portfolio: React.FC<PortfolioProps> = ({ onOpenRenewal }) => {
  const {
    clients,
    policies,
    renewals,
    loading,
    error,
    addClient,
    removeClient,
    addPolicy,
    removePolicy,
  } = usePortfolio();

  const [newClientName, setNewClientName] = useState('');
  const [newClientTaxId, setNewClientTaxId] = useState('');
  const [policyDrafts, setPolicyDrafts] = useState<
    Record<string, { insurer: string; ramo: string; premium: string; endDate: string }>
  >({});
  const [actionError, setActionError] = useState<string | null>(null);

  const renewalByPolicy = new Map<string, PortfolioRenewal>(
    renewals.map((r) => [r.policy_id, r])
  );

  const draftFor = (clientId: string) =>
    policyDrafts[clientId] ?? { insurer: '', ramo: '', premium: '', endDate: '' };

  const setDraft = (clientId: string, patch: Partial<(typeof policyDrafts)[string]>) => {
    setPolicyDrafts((prev) => ({ ...prev, [clientId]: { ...draftFor(clientId), ...patch } }));
  };

  const runAction = async (action: () => Promise<void>) => {
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCreateClient = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newClientName.trim();
    if (!name) return;
    await runAction(async () => {
      await addClient({ name, tax_id: newClientTaxId.trim() || null });
      setNewClientName('');
      setNewClientTaxId('');
    });
  };

  const handleCreatePolicy = async (clientId: string, event: React.FormEvent) => {
    event.preventDefault();
    const draft = draftFor(clientId);
    if (!draft.insurer.trim() || !draft.ramo.trim()) return;
    await runAction(async () => {
      await addPolicy({
        client_id: clientId,
        insurer: draft.insurer.trim(),
        ramo: draft.ramo.trim(),
        premium: draft.premium ? Number(draft.premium) : null,
        end_date: draft.endDate || null,
        provenance: 'manual',
      });
      setPolicyDrafts((prev) => ({
        ...prev,
        [clientId]: { insurer: '', ramo: '', premium: '', endDate: '' },
      }));
    });
  };

  const handleDeleteClient = (client: PortfolioClient) => {
    if (!window.confirm(`¿Eliminar el cliente ${client.name} y sus pólizas?`)) return;
    void runAction(() => removeClient(client.id));
  };

  if (loading) {
    return <p role="status">Cargando portafolio…</p>;
  }

  return (
    <section aria-label="Portafolio de clientes" className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Portafolio</h1>

      {error && <p role="alert">Error al cargar el portafolio: {error}</p>}
      {actionError && <p role="alert">{actionError}</p>}

      <form onSubmit={handleCreateClient} className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="new-client-name" className="block text-sm font-medium text-slate-700">
            Nombre del cliente
          </label>
          <input
            id="new-client-name"
            value={newClientName}
            onChange={(e) => setNewClientName(e.target.value)}
            className="border border-slate-300 rounded px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="new-client-tax-id" className="block text-sm font-medium text-slate-700">
            NIT (opcional)
          </label>
          <input
            id="new-client-tax-id"
            value={newClientTaxId}
            onChange={(e) => setNewClientTaxId(e.target.value)}
            className="border border-slate-300 rounded px-3 py-2"
          />
        </div>
        <button
          type="submit"
          className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700"
        >
          Crear cliente
        </button>
      </form>

      {clients.length === 0 && <p>Sin clientes todavía. Crea el primero para empezar.</p>}

      {clients.map((client) => {
        const clientPolicies = policies.filter((p) => p.client_id === client.id);
        const draft = draftFor(client.id);
        return (
          <article key={client.id} className="border border-slate-200 rounded-lg p-4 space-y-4">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">{client.name}</h2>
                {client.tax_id && <p className="text-sm text-slate-500">NIT {client.tax_id}</p>}
              </div>
              <button
                type="button"
                aria-label={`Eliminar cliente ${client.name}`}
                onClick={() => handleDeleteClient(client)}
                className="text-red-600 hover:text-red-800 text-sm"
              >
                Eliminar
              </button>
            </header>

            {clientPolicies.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {clientPolicies.map((policy) => {
                  const renewal = renewalByPolicy.get(policy.id);
                  return (
                    <li key={policy.id} className="py-2 flex flex-wrap items-center gap-3">
                      <span className="font-medium text-slate-700">{policy.insurer}</span>
                      <span className="text-sm text-slate-500">{policy.ramo}</span>
                      {policy.policy_number && (
                        <span className="text-sm text-slate-500">#{policy.policy_number}</span>
                      )}
                      {policy.end_date && (
                        <span className="text-sm text-slate-500">vence {policy.end_date}</span>
                      )}
                      {renewal && (
                        <>
                          <span className="text-xs bg-amber-100 text-amber-800 rounded px-2 py-1">
                            {renewal.state}
                          </span>
                          {onOpenRenewal && (
                            <button
                              type="button"
                              onClick={() => onOpenRenewal(renewal.id)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Ver renovación
                            </button>
                          )}
                        </>
                      )}
                      <button
                        type="button"
                        aria-label={`Eliminar póliza ${policy.policy_number ?? policy.id}`}
                        onClick={() =>
                          window.confirm('¿Eliminar esta póliza?') &&
                          void runAction(() => removePolicy(policy.id))
                        }
                        className="text-red-600 hover:text-red-800 text-sm ml-auto"
                      >
                        Eliminar
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Sin pólizas registradas.</p>
            )}

            <form
              onSubmit={(e) => handleCreatePolicy(client.id, e)}
              className="flex flex-wrap items-end gap-3"
            >
              <div>
                <label
                  htmlFor={`insurer-${client.id}`}
                  className="block text-sm font-medium text-slate-700"
                >
                  Aseguradora
                </label>
                <input
                  id={`insurer-${client.id}`}
                  value={draft.insurer}
                  onChange={(e) => setDraft(client.id, { insurer: e.target.value })}
                  className="border border-slate-300 rounded px-3 py-2"
                />
              </div>
              <div>
                <label
                  htmlFor={`ramo-${client.id}`}
                  className="block text-sm font-medium text-slate-700"
                >
                  Ramo
                </label>
                <input
                  id={`ramo-${client.id}`}
                  value={draft.ramo}
                  onChange={(e) => setDraft(client.id, { ramo: e.target.value })}
                  className="border border-slate-300 rounded px-3 py-2"
                />
              </div>
              <div>
                <label
                  htmlFor={`premium-${client.id}`}
                  className="block text-sm font-medium text-slate-700"
                >
                  Prima anual (opcional)
                </label>
                <input
                  id={`premium-${client.id}`}
                  type="number"
                  min="0"
                  value={draft.premium}
                  onChange={(e) => setDraft(client.id, { premium: e.target.value })}
                  className="border border-slate-300 rounded px-3 py-2"
                />
              </div>
              <div>
                <label
                  htmlFor={`end-date-${client.id}`}
                  className="block text-sm font-medium text-slate-700"
                >
                  Fecha de vencimiento (opcional)
                </label>
                <input
                  id={`end-date-${client.id}`}
                  type="date"
                  value={draft.endDate}
                  onChange={(e) => setDraft(client.id, { endDate: e.target.value })}
                  className="border border-slate-300 rounded px-3 py-2"
                />
              </div>
              <button
                type="submit"
                className="bg-slate-700 text-white rounded px-4 py-2 hover:bg-slate-800"
              >
                Agregar póliza
              </button>
            </form>
          </article>
        );
      })}
    </section>
  );
};

export default Portfolio;
