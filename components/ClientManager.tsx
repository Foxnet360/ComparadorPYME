import React, { useState, useEffect } from 'react';
import {
  Users,
  Building,
  Search,
  Plus,
  Edit2,
  Trash2,
  FileText,
  MapPin,
  ArrowRight,
  X,
  Link2,
  CheckCircle2,
  Share2,
  UserCheck,
  ClipboardList,
} from 'lucide-react';
import { Client, HistoryEntry, ComparisonReport, UserProfile } from '../types';
import { storageService } from '../services/storageService';
import { formatCOP } from '../utils/formatCurrency';
import { ConfirmModal } from './common/ConfirmModal';
import { ClientFormModal } from './clients/NewClientModal';
import { ShareClientModal } from './clients/ShareClientModal';
import { DelegateLeadModal } from './clients/DelegateLeadModal';
import { DelegationAuditPanel } from './clients/DelegationAuditPanel';

interface ClientManagerProps {
  onSelectClientForAudit?: (client: Client) => void;
  onViewReport?: (report: ComparisonReport) => void;
}

export const ClientManager: React.FC<ClientManagerProps> = ({
  onSelectClientForAudit,
  onViewReport,
}) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientAudits, setClientAudits] = useState<HistoryEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [clientError, setClientError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [shareModalClient, setShareModalClient] = useState<Client | null>(null);
  const [delegateModalClient, setDelegateModalClient] = useState<Client | null>(null);
  const [showAuditPanel, setShowAuditPanel] = useState(false);

  useEffect(() => {
    void storageService.getCurrentUser().then(setCurrentUser);
  }, []);

  const isAdmin =
    currentUser?.role === 'ally_admin' ||
    currentUser?.role === 'super_admin' ||
    currentUser?.role === 'ADMIN';
  const currentOrgId =
    currentUser?.allyId ||
    (currentUser as (UserProfile & { orgId?: string; org_id?: string }) | null)?.orgId ||
    (currentUser as (UserProfile & { org_id?: string }) | null)?.org_id ||
    '';

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Retroactive link audit state
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [availableAuditsToLink, setAvailableAuditsToLink] = useState<HistoryEntry[]>([]);
  const [selectedAuditIdToLink, setSelectedAuditIdToLink] = useState<string>('');
  const [linkingAudit, setLinkingAudit] = useState(false);

  const handleOpenLinkModal = async () => {
    if (!selectedClient) return;
    setClientError(null);
    try {
      const allHistory = await storageService.getHistory();
      const unlinked = allHistory.filter(
        (h) =>
          h.clientId !== selectedClient.id &&
          (!h.clientName || h.clientName.toLowerCase() !== selectedClient.name.toLowerCase())
      );
      setAvailableAuditsToLink(unlinked);
      if (unlinked.length > 0) {
        setSelectedAuditIdToLink(unlinked[0]!.id);
      }
      setIsLinkModalOpen(true);
    } catch (err) {
      setClientError(
        err instanceof Error ? err.message : 'No se pudo cargar el historial para vincular.'
      );
    }
  };

  const handleLinkAudit = async () => {
    if (!selectedClient || !selectedAuditIdToLink) return;
    setLinkingAudit(true);
    setClientError(null);
    try {
      await storageService.assignClientToAnalysis(
        selectedAuditIdToLink,
        selectedClient.id,
        selectedClient.name
      );
      const audits = await storageService.getHistoryByClient(
        selectedClient.id,
        selectedClient.name
      );
      setClientAudits(audits);
      setIsLinkModalOpen(false);
    } catch (err) {
      setClientError(
        err instanceof Error ? err.message : 'No se pudo vincular la auditoría al cliente.'
      );
    } finally {
      setLinkingAudit(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setClientError(null);
    try {
      const loadedClients = await storageService.getClients();
      setClients(loadedClients);

      if (loadedClients.length > 0 && !selectedClient) {
        await handleSelectClient(loadedClients[0]!);
      } else if (selectedClient) {
        await handleSelectClient(selectedClient);
      }
    } catch (err) {
      setClientError(err instanceof Error ? err.message : 'No se pudieron cargar los clientes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectClient = async (client: Client) => {
    setSelectedClient(client);
    try {
      const audits = await storageService.getHistoryByClient(client.id, client.name);
      setClientAudits(audits);
    } catch (err) {
      setClientAudits([]);
      setClientError(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar el historial del cliente seleccionado.'
      );
    }
  };

  const handleOpenCreateModal = () => {
    setEditingClient(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (client: Client) => {
    setEditingClient(client);
    setIsModalOpen(true);
  };

  const handleClientSaved = async (payload: Client, updatedList?: Client[]) => {
    if (updatedList) {
      setClients(updatedList);
    } else {
      const refreshed = await storageService.getClients();
      setClients(refreshed);
    }
    setSelectedClient(payload);
    const audits = await storageService.getHistoryByClient(payload.id, payload.name);
    setClientAudits(audits);
  };

  const [pendingDeleteClient, setPendingDeleteClient] = useState<Client | null>(null);

  const handleDeleteClient = (client: Client) => {
    setPendingDeleteClient(client);
  };

  const confirmDeleteClient = async () => {
    if (!pendingDeleteClient) return;
    const client = pendingDeleteClient;
    setPendingDeleteClient(null);
    setClientError(null);
    try {
      const updatedList = await storageService.deleteClient(client.id);
      setClients(updatedList);
      if (selectedClient?.id === client.id) {
        if (updatedList.length > 0) {
          await handleSelectClient(updatedList[0]!);
        } else {
          setSelectedClient(null);
          setClientAudits([]);
        }
      }
    } catch (err) {
      setClientError(err instanceof Error ? err.message : 'No se pudo eliminar el cliente.');
    }
  };

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.nit.includes(searchTerm) ||
      (c.city || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="text-indigo-600" size={28} />
            Gestión de Clientes y Auditorías Correlacionadas
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Administra copropiedades, georreferenciación y el historial completo de auditorías
            comparativas de cotizaciones.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isAdmin && currentOrgId && (
            <button
              type="button"
              onClick={() => setShowAuditPanel(true)}
              className="inline-flex items-center px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm rounded-xl shadow-md transition-all cursor-pointer"
            >
              <ClipboardList size={18} className="mr-2" />
              Auditar Delegaciones
            </button>
          )}
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-md transition-all cursor-pointer"
          >
            <Plus size={18} className="mr-2" />
            Registrar Nuevo Cliente / Copropiedad
          </button>
        </div>
      </div>

      {clientError && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center justify-between"
        >
          <span>{clientError}</span>
          <button
            type="button"
            onClick={() => setClientError(null)}
            className="text-red-500 hover:text-red-700 text-xs font-semibold ml-4"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Main Grid: Client List (Left) & Client Details + Correlated Audits (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Client List */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[700px]">
          <div className="p-4 border-b border-slate-100 bg-slate-50 space-y-3">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                type="text"
                placeholder="Buscar por cliente, NIT o ciudad..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
              <span>{filteredClients.length} Clientes registrados</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 scrollbar-thin">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">Cargando clientes...</div>
            ) : filteredClients.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No se encontraron clientes
              </div>
            ) : (
              filteredClients.map((client) => {
                const isSelected = selectedClient?.id === client.id;
                return (
                  <div
                    key={client.id}
                    onClick={() => handleSelectClient(client)}
                    className={`p-4 cursor-pointer transition-all hover:bg-indigo-50/50 flex flex-col space-y-2 ${
                      isSelected ? 'bg-indigo-50/90 border-l-4 border-indigo-600' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-800 truncate">
                        {client.name}
                      </span>
                      {client.seismicZone && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            client.seismicZone === 'Alta'
                              ? 'bg-rose-100 text-rose-700'
                              : client.seismicZone === 'Intermedia'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {client.seismicZone}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500 flex items-center justify-between">
                      <span>NIT: {client.nit}</span>
                      {client.city && (
                        <span className="flex items-center text-slate-400">
                          <MapPin size={12} className="mr-1" /> {client.city}
                        </span>
                      )}
                    </div>

                    {client.buildingType && (
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-medium">
                          {client.buildingType}
                        </span>
                        {client.unitsCount && <span>{client.unitsCount} Unidades</span>}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Detailed Client Profile + Correlated Audits */}
        <div className="lg:col-span-8 space-y-6">
          {selectedClient ? (
            <>
              {/* Selected Client Card & Georeferencing Details */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-indigo-100 text-indigo-700 rounded-xl">
                      <Building size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">{selectedClient.name}</h3>
                      <p className="text-xs text-slate-500">
                        NIT: {selectedClient.nit} • {selectedClient.industry || 'Copropiedad'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {currentOrgId && (
                      <button
                        type="button"
                        onClick={() => setShareModalClient(selectedClient)}
                        className="px-3 py-1.5 border border-indigo-200 hover:bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-lg flex items-center transition-colors cursor-pointer"
                      >
                        <Share2 size={14} className="mr-1.5" /> Compartir
                      </button>
                    )}
                    {isAdmin && currentOrgId && (
                      <button
                        type="button"
                        onClick={() => setDelegateModalClient(selectedClient)}
                        className="px-3 py-1.5 border border-emerald-200 hover:bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg flex items-center transition-colors cursor-pointer"
                      >
                        <UserCheck size={14} className="mr-1.5" /> Delegar Lead
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenEditModal(selectedClient)}
                      className="px-3 py-1.5 border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold rounded-lg flex items-center transition-colors cursor-pointer"
                    >
                      <Edit2 size={14} className="mr-1.5 text-slate-500" /> Editar
                    </button>
                    <button
                      onClick={() => handleDeleteClient(selectedClient)}
                      className="px-3 py-1.5 border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-semibold rounded-lg flex items-center transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} className="mr-1.5" /> Eliminar
                    </button>
                    {onSelectClientForAudit && (
                      <button
                        onClick={() => onSelectClientForAudit(selectedClient)}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center transition-colors cursor-pointer shadow-sm"
                      >
                        <Plus size={14} className="mr-1.5" /> Nueva Auditoría
                      </button>
                    )}
                  </div>
                </div>

                {/* Georeferencing & Physical Building Attributes Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl text-xs text-slate-700">
                  <div>
                    <span className="font-bold text-slate-500 uppercase block mb-1">Ubicación</span>
                    <span className="font-semibold text-slate-800 flex items-center">
                      <MapPin size={13} className="text-indigo-600 mr-1" />
                      {selectedClient.address || 'Sin dirección'}
                    </span>
                    <span className="text-slate-500 block mt-0.5">
                      {selectedClient.city}, {selectedClient.department}
                    </span>
                  </div>

                  <div>
                    <span className="font-bold text-slate-500 uppercase block mb-1">
                      Coordenadas / NSR-10
                    </span>
                    {selectedClient.latitude && selectedClient.longitude ? (
                      <span className="font-mono text-slate-800 font-semibold block">
                        {selectedClient.latitude.toFixed(4)}°, {selectedClient.longitude.toFixed(4)}
                        °
                      </span>
                    ) : (
                      <span className="text-slate-400">Sin coordenadas</span>
                    )}
                    {selectedClient.seismicZone && (
                      <span className="inline-block mt-1 font-bold text-indigo-700">
                        Riesgo Sísmico: {selectedClient.seismicZone}
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="font-bold text-slate-500 uppercase block mb-1">
                      Estructura del Inmueble
                    </span>
                    <span className="block">
                      Tipo:{' '}
                      <strong className="text-slate-800">
                        {selectedClient.buildingType || 'Residencial'}
                      </strong>
                    </span>
                    <span className="block mt-0.5">
                      Torres: <strong>{selectedClient.towersCount || 1}</strong> • Unidades:{' '}
                      <strong>{selectedClient.unitsCount || 1}</strong> • Pisos:{' '}
                      <strong>{selectedClient.floorsCount || 1}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Correlated Audits Section */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h4 className="font-bold text-base text-slate-800 flex items-center gap-2">
                    <FileText className="text-indigo-600" size={20} />
                    Auditorías y Comparaciones de Cotizaciones ({clientAudits.length})
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleOpenLinkModal}
                      className="text-xs text-slate-600 hover:text-indigo-700 bg-slate-100 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg font-semibold flex items-center transition-colors cursor-pointer"
                      title="Vincular auditorías huérfanas o prospectos generales a este cliente"
                    >
                      <Link2 size={13} className="mr-1" /> Vincular existente
                    </button>
                    {onSelectClientForAudit && (
                      <button
                        type="button"
                        onClick={() => onSelectClientForAudit(selectedClient)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center cursor-pointer"
                      >
                        <Plus size={14} className="mr-1" /> Iniciar nueva auditoría
                      </button>
                    )}
                  </div>
                </div>

                {clientAudits.length > 0 ? (
                  <div className="space-y-3">
                    {clientAudits.map((audit) => (
                      <div
                        key={audit.id}
                        className="p-4 border border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-slate-50/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-800 text-sm">
                              Auditoría del {audit.date}
                            </span>
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[11px] font-semibold">
                              {audit.insurers.length} Cotizaciones
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span>
                              Aseguradoras: <strong>{audit.insurers.join(', ')}</strong>
                            </span>
                            <span>
                              • Mejor opción:{' '}
                              <strong className="text-emerald-700">{audit.bestOption}</strong>
                            </span>
                            {audit.premiumValue > 0 && (
                              <span>
                                • Prima: <strong>{formatCOP(audit.premiumValue)}</strong>
                              </span>
                            )}
                          </div>
                        </div>

                        {audit.fullReport && onViewReport && (
                          <button
                            onClick={() => onViewReport(audit.fullReport!)}
                            className="inline-flex items-center px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-colors cursor-pointer self-start sm:self-center"
                          >
                            Ver Informe Completo <ArrowRight size={14} className="ml-1.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl space-y-3 bg-slate-50/50">
                    <FileText className="mx-auto text-slate-400" size={32} />
                    <div className="text-sm font-semibold text-slate-700">
                      No hay auditorías registradas para este cliente
                    </div>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Inicia un nuevo análisis comparativo para vincular automáticamente los
                      reportes y recomendaciones a esta copropiedad.
                    </p>
                    {onSelectClientForAudit && (
                      <button
                        onClick={() => onSelectClientForAudit(selectedClient)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-md inline-flex items-center"
                      >
                        <Plus size={14} className="mr-1.5" /> Crear Primera Auditoría
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 space-y-3 shadow-sm">
              <Building size={48} className="mx-auto text-slate-300" />
              <div className="text-base font-semibold text-slate-600">
                Selecciona o crea un cliente
              </div>
              <p className="text-xs text-slate-500">
                Selecciona un cliente de la lista para ver su perfil georreferenciado y las
                auditorías correlacionadas.
              </p>
            </div>
          )}
        </div>
      </div>

      <ClientFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        activeDomain="copropiedades"
        editingClient={editingClient}
        onClientCreated={handleClientSaved}
      />

      {/* Retroactive Link Modal */}
      {isLinkModalOpen && selectedClient && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Link2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">
                    Vincular Auditoría a {selectedClient.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Asocia una comparativa huérfana o prospecto general
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLinkModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {availableAuditsToLink.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  No hay auditorías no vinculadas disponibles en el historial local.
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Selecciona la auditoría a transferir:
                  </label>
                  <select
                    value={selectedAuditIdToLink}
                    onChange={(e) => setSelectedAuditIdToLink(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {availableAuditsToLink.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.date} — {a.clientName || 'Prospecto'} ({a.insurers.join(', ')})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={availableAuditsToLink.length === 0 || linkingAudit}
                  onClick={handleLinkAudit}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{linkingAudit ? 'Vinculando...' : 'Confirmar Vinculación'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={pendingDeleteClient !== null}
        title="Eliminar cliente"
        message={
          pendingDeleteClient
            ? `¿Estás seguro de eliminar el cliente "${pendingDeleteClient.name}"?`
            : ''
        }
        confirmLabel="Eliminar"
        onConfirm={confirmDeleteClient}
        onCancel={() => setPendingDeleteClient(null)}
      />

      {shareModalClient && currentOrgId && (
        <ShareClientModal
          clientId={shareModalClient.id}
          clientName={shareModalClient.name}
          orgId={currentOrgId}
          currentUserId={currentUser?.id}
          onClose={() => setShareModalClient(null)}
          onUpdated={() => {
            void loadData();
          }}
        />
      )}

      {delegateModalClient && currentOrgId && (
        <DelegateLeadModal
          clientId={delegateModalClient.id}
          clientName={delegateModalClient.name}
          orgId={currentOrgId}
          onClose={() => setDelegateModalClient(null)}
          onDelegated={() => {
            void loadData();
          }}
        />
      )}

      {showAuditPanel && currentOrgId && (
        <DelegationAuditPanel
          orgId={currentOrgId}
          clients={clients}
          onClose={() => setShowAuditPanel(false)}
        />
      )}
    </div>
  );
};

export default ClientManager;
