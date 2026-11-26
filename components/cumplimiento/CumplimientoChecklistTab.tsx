import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, MinusCircle } from 'lucide-react';
import type { CumplimientoChecklistItem, CumplimientoChecklistStatus } from '../../types';

interface CumplimientoChecklistTabProps {
  items: CumplimientoChecklistItem[];
  onChange: (nextItems: CumplimientoChecklistItem[]) => void;
}

const STATUS_OPTIONS: Array<{ value: CumplimientoChecklistStatus; label: string }> = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'received', label: 'Recibido' },
  { value: 'verified', label: 'Verificado' },
  { value: 'na', label: 'No aplica' },
];

function computeExpiryWarning(item: CumplimientoChecklistItem): string | null {
  if (!item.maxAgeDays || !item.issueDate) return null;
  const issued = new Date(item.issueDate);
  if (Number.isNaN(issued.getTime())) return null;
  const ageDays = Math.floor((Date.now() - issued.getTime()) / (1000 * 60 * 60 * 24));
  if (ageDays > item.maxAgeDays) {
    return `Documento con ${ageDays} días de expedición (máximo permitido: ${item.maxAgeDays} días).`;
  }
  return null;
}

export const CumplimientoChecklistTab: React.FC<CumplimientoChecklistTabProps> = ({
  items,
  onChange,
}) => {
  const requiredItems = items.filter((i) => i.required && i.status !== 'na');
  const completedCount = requiredItems.filter(
    (i) => i.status === 'verified' || i.status === 'received'
  ).length;
  const percent =
    requiredItems.length > 0 ? Math.round((completedCount / requiredItems.length) * 100) : 100;

  const updateItem = (id: string, patch: Partial<CumplimientoChecklistItem>) => {
    onChange(
      items.map((item) => {
        if (item.id !== id) return item;
        const merged = { ...item, ...patch };
        merged.expiryWarning = computeExpiryWarning(merged);
        return merged;
      })
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-slate-900">
            Checklist de Vinculación, Cupo y SARLAFT
          </h4>
          <p className="text-xs text-slate-500">
            Control documental según proceso técnico y políticas de suscripción en Colombia.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-36 h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-600 transition-all" style={{ width: `${percent}%` }} />
          </div>
          <span className="text-xs font-bold text-indigo-700">
            {completedCount}/{requiredItems.length} ({percent}%)
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const warning = item.expiryWarning || computeExpiryWarning(item);
          return (
            <div
              key={item.id}
              className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col gap-2"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  {item.status === 'verified' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  ) : item.status === 'na' ? (
                    <MinusCircle className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-900">{item.label}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {item.category}
                      </span>
                      {item.required && (
                        <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                          Obligatorio
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {item.maxAgeDays && (
                    <label className="flex items-center gap-1 text-[11px] text-slate-600">
                      <span>Expedición:</span>
                      <input
                        type="date"
                        value={item.issueDate || ''}
                        onChange={(e) => updateItem(item.id, { issueDate: e.target.value })}
                        className="px-2 py-1 text-xs border border-slate-200 rounded-lg"
                      />
                    </label>
                  )}
                  <select
                    value={item.status}
                    onChange={(e) =>
                      updateItem(item.id, { status: e.target.value as CumplimientoChecklistStatus })
                    }
                    className="px-2.5 py-1 text-xs font-semibold border border-slate-200 rounded-lg bg-slate-50"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {warning && (
                <div className="flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{warning}</span>
                </div>
              )}

              <input
                type="text"
                placeholder="Observaciones o radicado..."
                value={item.notes || ''}
                onChange={(e) => updateItem(item.id, { notes: e.target.value })}
                className="w-full px-2.5 py-1 text-xs border border-slate-100 bg-slate-50 rounded-lg text-slate-700"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
