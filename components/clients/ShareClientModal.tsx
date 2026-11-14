import React, { useEffect, useState } from 'react';
import { Share2, Trash2, UserPlus, X, Loader2 } from 'lucide-react';
import {
  clientDelegationService,
  type ClientShare,
  type OrgMemberSummary,
} from '../../services/clientDelegationService';

interface ShareClientModalProps {
  clientId: string;
  clientName: string;
  orgId: string;
  currentUserId?: string;
  onClose: () => void;
  onUpdated?: () => void;
}

export const ShareClientModal: React.FC<ShareClientModalProps> = ({
  clientId,
  clientName,
  orgId,
  currentUserId,
  onClose,
  onUpdated,
}) => {
  const [members, setMembers] = useState<OrgMemberSummary[]>([]);
  const [shares, setShares] = useState<ClientShare[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [m, s] = await Promise.all([
        clientDelegationService.listOrgMembers(orgId),
        clientDelegationService.listClientShares(clientId),
      ]);
      setMembers(m.filter((item) => item.user_id !== currentUserId));
      setShares(s);
    } catch {
      setError('No se pudo cargar la lista de Técnicos Analistas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [clientId, orgId]);

  const sharedSet = new Set(shares.map((s) => s.shared_with_user_id));
  const availableMembers = members.filter((m) => !sharedSet.has(m.user_id));

  const getMemberLabel = (userId: string) => {
    const found = members.find((m) => m.user_id === userId);
    return found?.full_name || found?.name || found?.email || userId;
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    setSubmitting(true);
    setError(null);
    try {
      await clientDelegationService.shareClient(clientId, selectedUserId, 'edit');
      setSelectedUserId('');
      await loadData();
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al compartir cliente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnshare = async (targetUserId: string) => {
    setSubmitting(true);
    try {
      await clientDelegationService.unshareClient(clientId, targetUserId);
      await loadData();
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al revocar acceso.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <Share2 size={18} className="text-indigo-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Compartir Cliente</h3>
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

        <div className="p-5 space-y-4">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="animate-spin text-indigo-600" size={22} />
            </div>
          ) : (
            <>
              <form onSubmit={handleShare} className="flex gap-2">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white"
                  disabled={submitting || availableMembers.length === 0}
                >
                  <option value="">
                    {availableMembers.length === 0
                      ? 'Sin otros Técnicos Analistas disponibles'
                      : 'Seleccionar Técnico Analista...'}
                  </option>
                  {availableMembers.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.full_name || m.name || m.email || m.user_id}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={!selectedUserId || submitting}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  <UserPlus size={15} />
                  Compartir
                </button>
              </form>

              <div>
                <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                  Técnicos Analistas con acceso ({shares.length})
                </h4>
                {shares.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    Este cliente aún no está compartido con otros Técnicos Analistas.
                  </p>
                ) : (
                  <ul className="space-y-2 max-h-48 overflow-y-auto">
                    {shares.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                      >
                        <span className="font-medium text-slate-800">
                          {getMemberLabel(s.shared_with_user_id)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUnshare(s.shared_with_user_id)}
                          disabled={submitting}
                          className="text-slate-400 hover:text-red-600"
                          title="Revocar acceso"
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          {error && <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg">{error}</p>}
        </div>
      </div>
    </div>
  );
};
