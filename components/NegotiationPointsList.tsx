import React from 'react';
import { Target, ArrowRight, AlertCircle } from 'lucide-react';

interface NegotiationPoint {
  point: string;
  rationale: string;
  expectedOutcome: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface NegotiationPointsListProps {
  points: NegotiationPoint[];
}

const getPriorityConfig = (priority: string) => {
  switch (priority) {
    case 'HIGH':
      return {
        badge: 'bg-red-100 text-red-800 border-red-200',
        label: 'ALTA'
      };
    case 'MEDIUM':
      return {
        badge: 'bg-amber-100 text-amber-800 border-amber-200',
        label: 'MEDIA'
      };
    case 'LOW':
      return {
        badge: 'bg-blue-100 text-blue-800 border-blue-200',
        label: 'BAJA'
      };
    default:
      return {
        badge: 'bg-slate-100 text-slate-800 border-slate-200',
        label: priority
      };
  }
};

export const NegotiationPointsList: React.FC<NegotiationPointsListProps> = ({
  points
}) => {
  if (!points || points.length === 0) {
    return (
      <div className="text-sm text-slate-500 p-4">
        No hay puntos de negociación identificados.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Target className="text-indigo-600" size={18} />
        <h3 className="font-bold text-slate-800">Puntos de Negociación</h3>
        <span className="text-sm text-slate-500">({points.length})</span>
      </div>

      {points.map((point, idx) => {
        const config = getPriorityConfig(point.priority);

        return (
          <div
            key={idx}
            className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-slate-500">
                    #{idx + 1}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded border ${config.badge}`}>
                    {config.label}
                  </span>
                </div>

                <h4 className="text-sm font-medium text-slate-800 mb-2">
                  {point.point}
                </h4>

                <p className="text-sm text-slate-600 mb-2">
                  {point.rationale}
                </p>

                <div className="flex items-center gap-2 text-sm text-green-700">
                  <ArrowRight size={14} />
                  <span>{point.expectedOutcome}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default NegotiationPointsList;
