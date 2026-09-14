/**
 * GapDeltaPanel (renovacion-polizas PR-5, task 1.23)
 *
 * R2.3: gap analysis per candidate vs the incumbent baseline (coverages
 * lost/gained, deductible worsening, new exclusions).
 * R2.4: premium delta vs baseline with direction.
 * R2.5: per-ramo switching-friction notes.
 * Pure presentational component over the v3 renewalAnalytics payload.
 */

import React from 'react';
import type { CandidateRenewalAnalytics } from '../types';

interface GapDeltaPanelProps {
  analytics: CandidateRenewalAnalytics;
}

const GapList: React.FC<{ title: string; items: string[] }> = ({ title, items }) => {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
      <ul className="list-disc list-inside text-sm text-slate-600">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
};

const PremiumDeltaSummary: React.FC<{ delta: CandidateRenewalAnalytics['premiumDelta'] }> = ({
  delta,
}) => {
  if (delta.direction === 'unknown' || delta.percentage === null) {
    return <p className="text-sm text-slate-500">Delta de prima no disponible.</p>;
  }
  const magnitude = Math.abs(delta.percentage);
  const label =
    delta.direction === 'increase'
      ? 'Incremento'
      : delta.direction === 'decrease'
        ? 'Ahorro'
        : 'Sin cambio';
  return (
    <p className="text-sm text-slate-700">
      {label} de prima: {magnitude}% vs póliza actual
      {delta.absolute !== null && ` (${Math.abs(delta.absolute)})`}
    </p>
  );
};

export const GapDeltaPanel: React.FC<GapDeltaPanelProps> = ({ analytics }) => (
  <article
    aria-label={`Análisis de brechas — ${analytics.insurer}`}
    className="border border-slate-200 rounded-lg p-4 space-y-3"
  >
    <h3 className="text-base font-bold text-slate-800">{analytics.insurer}</h3>

    <PremiumDeltaSummary delta={analytics.premiumDelta} />

    <GapList title="Coberturas perdidas" items={analytics.gaps.coveragesLost} />
    <GapList title="Coberturas ganadas" items={analytics.gaps.coveragesGained} />
    <GapList title="Deducibles desmejorados" items={analytics.gaps.deductibleWorsening} />
    <GapList title="Nuevas exclusiones" items={analytics.gaps.newExclusions} />

    {analytics.friction.length > 0 && (
      <div>
        <h4 className="text-sm font-semibold text-slate-700">Fricción de cambio</h4>
        <ul className="list-disc list-inside text-sm text-slate-600">
          {analytics.friction.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>
    )}
  </article>
);

export default GapDeltaPanel;
