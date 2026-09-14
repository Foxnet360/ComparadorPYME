/**
 * BaselineColumnBadge (renovacion-polizas PR-5, task 1.23)
 *
 * R2.2: marks the "Póliza Actual" baseline column in a schemaVersion-3
 * (renewal) comparison matrix. Rendered only for cells/headers flagged
 * isBaseline — NEW-mode reports never render it (XC-3).
 */

import React from 'react';

interface BaselineColumnBadgeProps {
  insurerName?: string;
}

export const BaselineColumnBadge: React.FC<BaselineColumnBadgeProps> = ({ insurerName }) => (
  <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded px-2 py-0.5">
    <span>Póliza Actual</span>
    {insurerName && <span className="font-normal">· {insurerName}</span>}
  </span>
);

export default BaselineColumnBadge;
