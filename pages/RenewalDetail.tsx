/**
 * RenewalDetail Page (renovacion-polizas PR-5, task 1.22)
 *
 * R3.1: renewal state + auditable event history (RenewalTimeline).
 * R3.2: close form enforces lost-requires-reason and final_premium for
 * renewed outcomes before submitting; the backend machine re-validates.
 * Transitions are strictly adjacent (PR-4 state machine): the only actions
 * offered are "advance to next" and, from quoted, "close".
 */

import React, { useEffect, useState } from 'react';
import {
  listRenewals,
  listRenewalEvents,
  transitionRenewal,
} from '../services/portfolioService';
import { RenewalTimeline } from '../components/RenewalTimeline';
import type {
  PortfolioRenewal,
  RenewalEvent,
  RenewalOutcome,
  RenewalState,
  RenewalTransitionInput,
} from '../types';

export interface RenewalDetailProps {
  renewalId: string;
  onBack?: () => void;
}

/** Strictly-adjacent chain defined by the PR-4 state machine. */
const NEXT_STATE: Record<Exclude<RenewalState, 'closed'>, RenewalState> = {
  detected: 'notified',
  notified: 'in_review',
  in_review: 'quoted',
  quoted: 'closed',
};

const RenewalDetail: React.FC<RenewalDetailProps> = ({ renewalId, onBack }) => {
  const [renewal, setRenewal] = useState<PortfolioRenewal | null>(null);
  const [events, setEvents] = useState<RenewalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closeFormOpen, setCloseFormOpen] = useState(false);
  const [outcome, setOutcome] = useState<RenewalOutcome>('renewed_same_insurer');
  const [finalPremium, setFinalPremium] = useState('');
  const [lossReason, setLossReason] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // Independent reads — fetch in parallel, never as a waterfall.
        const [renewalRows, eventRows] = await Promise.all([
          listRenewals(),
          listRenewalEvents(renewalId),
        ]);
        if (cancelled) return;
        const found = renewalRows.find((r) => r.id === renewalId) ?? null;
        if (!found) {
          setError('La renovación no existe o no pertenece a tu portafolio.');
        } else {
          setRenewal(found);
          setEvents(eventRows);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [renewalId]);

  const applyTransition = async (input: RenewalTransitionInput) => {
    setError(null);
    try {
      const updated = await transitionRenewal(renewalId, input);
      setRenewal(updated);
      setEvents(await listRenewalEvents(renewalId));
      setCloseFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (loading) {
    return <p role="status">Cargando renovación…</p>;
  }

  if (!renewal) {
    return (
      <section aria-label="Detalle de renovación">
        <p role="alert">{error ?? 'La renovación no existe o no pertenece a tu portafolio.'}</p>
        {onBack && (
          <button type="button" onClick={onBack}>
            Volver al portafolio
          </button>
        )}
      </section>
    );
  }

  const nextState = renewal.state === 'closed' ? null : NEXT_STATE[renewal.state];
  const trimmedReason = lossReason.trim();
  const trimmedPremium = finalPremium.trim();
  const closeValid =
    outcome === 'lost' ? trimmedReason.length > 0 : trimmedPremium.length > 0;

  const handleCloseSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!closeValid) return;
    await applyTransition({
      to: 'closed',
      outcome,
      ...(outcome === 'lost'
        ? { loss_reason: trimmedReason }
        : { final_premium: Number(trimmedPremium) }),
    });
  };

  return (
    <section aria-label="Detalle de renovación" className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Renovación</h1>
        {onBack && (
          <button type="button" onClick={onBack} className="text-blue-600 hover:text-blue-800">
            Volver al portafolio
          </button>
        )}
      </header>

      {error && <p role="alert">{error}</p>}

      <dl className="grid grid-cols-2 gap-4">
        <div>
          <dt className="text-sm text-slate-500">Estado</dt>
          <dd className="font-medium text-slate-800">{renewal.state}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">Inicio de ciclo</dt>
          <dd className="font-medium text-slate-800">{renewal.cycle_start}</dd>
        </div>
        {renewal.outcome && (
          <div>
            <dt className="text-sm text-slate-500">Resultado</dt>
            <dd className="font-medium text-slate-800">{renewal.outcome}</dd>
          </div>
        )}
        {renewal.final_premium != null && (
          <div>
            <dt className="text-sm text-slate-500">Prima final</dt>
            <dd className="font-medium text-slate-800">{renewal.final_premium}</dd>
          </div>
        )}
        {renewal.loss_reason && (
          <div>
            <dt className="text-sm text-slate-500">Motivo de pérdida</dt>
            <dd className="font-medium text-slate-800">{renewal.loss_reason}</dd>
          </div>
        )}
      </dl>

      {nextState && nextState !== 'closed' && (
        <button
          type="button"
          onClick={() => applyTransition({ to: nextState })}
          className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700"
        >
          Avanzar a {nextState}
        </button>
      )}

      {nextState === 'closed' && !closeFormOpen && (
        <button
          type="button"
          onClick={() => setCloseFormOpen(true)}
          className="bg-slate-700 text-white rounded px-4 py-2 hover:bg-slate-800"
        >
          Cerrar renovación
        </button>
      )}

      {closeFormOpen && (
        <form onSubmit={handleCloseSubmit} className="space-y-3 border border-slate-200 rounded p-4">
          <div>
            <label htmlFor="close-outcome" className="block text-sm font-medium text-slate-700">
              Resultado
            </label>
            <select
              id="close-outcome"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as RenewalOutcome)}
              className="border border-slate-300 rounded px-3 py-2"
            >
              <option value="renewed_same_insurer">renewed_same_insurer</option>
              <option value="renewed_competitor">renewed_competitor</option>
              <option value="lost">lost</option>
            </select>
          </div>

          {outcome === 'lost' ? (
            <div>
              <label htmlFor="loss-reason" className="block text-sm font-medium text-slate-700">
                Motivo de pérdida
              </label>
              <input
                id="loss-reason"
                value={lossReason}
                onChange={(e) => setLossReason(e.target.value)}
                className="border border-slate-300 rounded px-3 py-2 w-full"
              />
            </div>
          ) : (
            <div>
              <label htmlFor="final-premium" className="block text-sm font-medium text-slate-700">
                Prima final
              </label>
              <input
                id="final-premium"
                type="number"
                min="0"
                value={finalPremium}
                onChange={(e) => setFinalPremium(e.target.value)}
                className="border border-slate-300 rounded px-3 py-2"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={!closeValid}
            className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
          >
            Confirmar cierre
          </button>
        </form>
      )}

      <section aria-label="Historial" className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-800">Historial</h2>
        <RenewalTimeline events={events} />
      </section>
    </section>
  );
};

export default RenewalDetail;
