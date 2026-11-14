import React, { useEffect, useState } from 'react';
import { UserCheck, X, Loader2 } from 'lucide-react';
import {
  clientDelegationService,
  type OrgMemberSummary,
} from '../../services/clientDelegationService';

interface DelegateLeadModalProps {
  clientId: string;
  clientName: string;
  orgId: string;
  currentAssignee?: string | null;
  onClose: () => void;
  onDelegated: () => void;
}

export const DelegateLeadModal: React.FC<DelegateLeadModalProps> = ({
  clientId,
  clientName,
  orgId,
  currentAssignee,
  onClose,
  onDelegated,
}) => {
  const [members, setMembers] = useState<OrgMemberSummary[]>([]);
  const [primaryAdvisorId, setPrimaryAdvisorId] = useState(currentAssignee || '');
  const [sharedAdvisorIds, setSharedAdvisorIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const list = await clientDelegationService.listOrgMembers(orgId);
        setMembers(list.filter((m) => m.status === 'active'));
      } catch {
        setError('No se pudieron cargar los Técnicos Analistas.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [orgId]);

  const toggleCoResponsible = (userId: string) => {
    setSharedAdvisorIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!primaryAdvisorId) return;
    setSubmitting(true);
    setError(null);
    try {
      await clientDelegationService.delegateClient(clientId, {
        primaryAdvisorId,
        sharedAdvisorIds,
        notes: notes.trim() || undefined,
      });
      onDelegated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al delegar cliente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <UserCheck size={18} className="text-emerald-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Delegar Lead / Cliente</h3>
              <p className="text-xs text-slate-500">{clientName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="animate-spin text-emerald-600" size={22} />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Técnico Analista Responsable Principal
                </label>
                <select
                  value={primaryAdvisorId}
                  onChange={(e) => setPrimaryAdvisorId(e.target.value)}
                  required
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white"
                >
                  <option value="">Seleccionar Técnico Analista...</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.full_name || m.name || m.email || m.user_id}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Co-responsables adicionales (opcional)
                </label>
                <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                  {members
                    .filter((m) => m.user_id !== primaryAdvisorId)
                    .map((m) => (
                      <label
                        key={m.user_id}
                        className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={sharedAdvisorIds.includes(m.user_id)}
                          onChange={() => toggleCoResponsible(m.user_id)}
                          className="rounded border-slate-300"
                        />
                        <span>{m.full_name || m.name || m.email || m.user_id}</span>
                      </label>
                    ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Instrucciones / Nota de delegación (auditoría)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Ej. Priorizar cotización Todo Riesgo PYME..."
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
            </>
          )}

          {error && <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!primaryAdvisorId || submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <UserCheck size={15} />}
              Confirmar delegación
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
