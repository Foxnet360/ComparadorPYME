import React, { useEffect, useState } from 'react';
import { ClipboardList, X, Loader2 } from 'lucide-react';
import {
  clientDelegationService,
  type DelegationAuditEntry,
  type OrgMemberSummary,
} from '../../services/clientDelegationService';
import type { Client } from '../../types';

interface DelegationAuditPanelProps {
  orgId: string;
  clients: Client[];
  onClose: () => void;
}

const ACTION_LABELS: Record<DelegationAuditEntry['action'], string> = {
  delegated: 'Delegado',
  reassigned: 'Reasignado',
  shared: 'Compartido',
  unshared: 'Acceso revocado',
  status_changed: 'Cambio de estado',
};

export const DelegationAuditPanel: React.FC<DelegationAuditPanelProps> = ({
  orgId,
  clients,
  onClose,
}) => {
  const [entries, setEntries] = useState<DelegationAuditEntry[]>([]);
  const [members, setMembers] = useState<OrgMemberSummary[]>([]);
  const [advisorFilter, setAdvisorFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const loadAudit = async (advisorId?: string) => {
    setLoading(true);
    try {
      const [auditData, memberData] = await Promise.all([
        clientDelegationService.getDelegationAudit(advisorId ? { advisorId } : undefined),
        clientDelegationService.listOrgMembers(orgId),
      ]);
      setEntries(auditData);
      setMembers(memberData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAudit(advisorFilter || undefined);
  }, [orgId, advisorFilter]);

  const memberName = (id: string | null) => {
    if (!id) return '—';
    const found = members.find((m) => m.user_id === id);
    return found?.full_name || found?.name || found?.email || id.slice(0, 8);
  };

  const clientName = (id: string) => {
    return clients.find((c) => c.id === id)?.name || id.slice(0, 8);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <ClipboardList size={20} className="text-indigo-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Auditoría de Delegaciones y Evolución de Leads
              </h3>
              <p className="text-xs text-slate-500">
                Seguimiento completo de asignaciones, comparticiones y avances por Técnico Analista.
              </p>
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

        <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600">Filtrar por Técnico Analista:</label>
            <select
              value={advisorFilter}
              onChange={(e) => setAdvisorFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
            >
              <option value="">Todos</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.full_name || m.name || m.email || m.user_id}
                </option>
              ))}
            </select>
          </div>
          <span className="text-xs text-slate-500">{entries.length} eventos registrados</span>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-indigo-600" size={24} />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-center text-sm text-slate-500 py-8">
              No hay eventos de delegación registrados aún.
            </p>
          ) : (
            <div className="space-y-2.5">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="border border-slate-200 rounded-xl p-3 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                        {ACTION_LABELS[entry.action]}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">
                        {clientName(entry.client_id)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Por: <strong>{memberName(entry.actor_user_id)}</strong>
                      {entry.to_user_id && (
                        <>
                          {' '}
                          → Asignado/Compartido a: <strong>{memberName(entry.to_user_id)}</strong>
                        </>
                      )}
                      {entry.new_status && (
                        <>
                          {' '}
                          · Estado: <strong>{entry.previous_status || 'nuevo'}</strong> →{' '}
                          <strong>{entry.new_status}</strong>
                        </>
                      )}
                    </p>
                    {entry.notes && (
                      <p className="text-xs text-slate-500 italic">“{entry.notes}”</p>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0">
                    {new Date(entry.created_at).toLocaleString('es-CO')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
