/**
 * RenewalTimeline (renovacion-polizas PR-5, task 1.22)
 *
 * R3.1: auditable transitions rendered oldest-first — who/when/from→to.
 * Pure presentational component; data comes from GET /api/renewals/:id/events.
 */

import React from 'react';
import type { RenewalEvent } from '../types';

interface RenewalTimelineProps {
  events: RenewalEvent[];
}

const formatTimestamp = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString('es-CO');
};

export const RenewalTimeline: React.FC<RenewalTimelineProps> = ({ events }) => {
  if (events.length === 0) {
    return <p className="text-sm text-slate-500">Sin eventos registrados.</p>;
  }

  return (
    <ol aria-label="Historial de la renovación" className="space-y-2">
      {events.map((event) => (
        <li key={event.id} className="border-l-2 border-blue-200 pl-3 py-1">
          <p className="text-sm font-medium text-slate-700">
            {event.from_state === null ? (
              <>Renovación creada en estado {event.to_state}</>
            ) : (
              <>
                {event.from_state} → {event.to_state}
              </>
            )}
          </p>
          <p className="text-xs text-slate-500">
            {event.actor_id ?? 'system'} · {formatTimestamp(event.created_at)}
          </p>
        </li>
      ))}
    </ol>
  );
};

export default RenewalTimeline;
