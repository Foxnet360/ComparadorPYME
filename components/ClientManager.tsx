import React, { useState, useEffect } from 'react';
import {
  Users,
  Building2,
  Building,
  Search,
  Plus,
  Edit2,
  Trash2,
  FileText,
  MapPin,
  Compass,
  ArrowRight,
  ShieldCheck,
  Calendar,
  DollarSign,
  X,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { Client, HistoryEntry, ComparisonReport } from '../types';
import { storageService } from '../services/storageService';
import { formatCOP } from '../utils/formatCurrency';

interface ClientManagerProps {
  onSelectClientForAudit?: (client: Client) => void;
  onViewReport?: (report: ComparisonReport) => void;
}

const CITY_SEISMIC_ZONES: Record<string, { dept: string; zone: 'Alta' | 'Intermedia' | 'Baja'; lat: number; lng: number }> = {
  Bogotá: { dept: 'Cundinamarca', zone: 'Intermedia', lat: 4.6097, lng: -74.0817 },
  Medellín: { dept: 'Antioquia', zone: 'Alta', lat: 6.2442, lng: -75.5812 },
  Cali: { dept: 'Valle del Cauca', zone: 'Alta', lat: 3.4516, lng: -76.532 },
  Barranquilla: { dept: 'Atlántico', zone: 'Baja', lat: 10.9685, lng: -74.7813 },
  Bucaramanga: { dept: 'Santander', zone: 'Alta', lat: 7.1254, lng: -73.1198 },
  Cartagena: { dept: 'Bolívar', zone: 'Baja', lat: 10.3997, lng: -75.5144 },
  Pereira: { dept: 'Risaralda', zone: 'Alta', lat: 4.8133, lng: -75.6961 },
  Manizales: { dept: 'Caldas', zone: 'Alta', lat: 5.0689, lng: -75.5174 },
};

export const ClientManager: React.FC<ClientManagerProps> = ({
  onSelectClientForAudit,
  onViewReport,
}) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientAudits, setClientAudits] = useState<HistoryEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientForm, setClientForm] = useState<Partial<Client>>({
    name: '',
    nit: '',
    contactPerson: '',
    email: '',
    phone: '',
    industry: 'Copropiedad Horizontal',
    address: '',
    city: 'Bogotá',
    department: 'Cundinamarca',
    latitude: 4.6097,
    longitude: -74.0817,
    seismicZone: 'Intermedia',
    buildingType: 'Residencial',
    towersCount: 1,
    unitsCount: 20,
    floorsCount: 5,
    constructionYear: 2020,
    hasElevators: true,
    hasPowerPlant: false,
  });

  const loadData = async () => {
    setLoading(true);
    const loadedClients = await storageService.getClients();
    setClients(loadedClients);

    if (loadedClients.length > 0 && !selectedClient) {
      handleSelectClient(loadedClients[0]!);
    } else if (selectedClient) {
      handleSelectClient(selectedClient);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectClient = async (client: Client) => {
    setSelectedClient(client);
    const audits = await storageService.getHistoryByClient(client.id, client.name);
    setClientAudits(audits);
  };

  const handleOpenCreateModal = () => {
    setEditingClient(null);
    setClientForm({
      name: '',
      nit: '',
      contactPerson: '',
      email: '',
      phone: '',
      industry: 'Copropiedad Horizontal',
      address: '',
      city: 'Bogotá',
      department: 'Cundinamarca',
      latitude: 4.6097,
      longitude: -74.0817,
      seismicZone: 'Intermedia',
      buildingType: 'Residencial',
      towersCount: 1,
      unitsCount: 20,
      floorsCount: 5,
      constructionYear: 2020,
      hasElevators: true,
      hasPowerPlant: false,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (client: Client) => {
    setEditingClient(client);
    setClientForm({ ...client });
    setIsModalOpen(true);
  };

  const handleCityChange = (cityName: string) => {
    const cityData = CITY_SEISMIC_ZONES[cityName];
    if (cityData) {
      setClientForm((prev) => ({
        ...prev,
        city: cityName,
        department: cityData.dept,
        seismicZone: cityData.zone,
        latitude: cityData.lat,
        longitude: cityData.lng,
      }));
    } else {
      setClientForm((prev) => ({ ...prev, city: cityName }));
    }
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientForm.name || !clientForm.nit) return;

    const payload: Client = {
      id: editingClient ? editingClient.id : Date.now().toString(),
      name: clientForm.name,
      nit: clientForm.nit,
      contactPerson: clientForm.contactPerson || '',
      email: clientForm.email || '',
      phone: clientForm.phone || '',
      industry: clientForm.industry || 'Copropiedad Horizontal',
      address: clientForm.address || '',
      city: clientForm.city || 'Bogotá',
      department: clientForm.department || 'Cundinamarca',
      latitude: Number(clientForm.latitude) || 4.6097,
      longitude: Number(clientForm.longitude) || -74.0817,
      seismicZone: clientForm.seismicZone || 'Intermedia',
      buildingType: clientForm.buildingType || 'Residencial',
      towersCount: Number(clientForm.towersCount) || 1,
      unitsCount: Number(clientForm.unitsCount) || 1,
      floorsCount: Number(clientForm.floorsCount) || 1,
      constructionYear: Number(clientForm.constructionYear) || 2020,
      hasElevators: Boolean(clientForm.hasElevators),
      hasPowerPlant: Boolean(clientForm.hasPowerPlant),
    };

    let updatedList: Client[] = [];
    if (editingClient) {
      updatedList = await storageService.updateClient(payload);
    } else {
      updatedList = await storageService.addClient(payload);
    }

    setClients(updatedList);
    setSelectedClient(payload);
    const audits = await storageService.getHistoryByClient(payload.id, payload.name);
    setClientAudits(audits);
    setIsModalOpen(false);
  };

  const handleDeleteClient = async (client: Client) => {
    if (window.confirm(`¿Estás seguro de eliminar el cliente "${client.name}"?`)) {
      const updatedList = await storageService.deleteClient(client.id);
      setClients(updatedList);
      if (selectedClient?.id === client.id) {
        if (updatedList.length > 0) {
          handleSelectClient(updatedList[0]!);
        } else {
          setSelectedClient(null);
          setClientAudits([]);
        }
      }
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
            Administra copropiedades, georreferenciación y el historial completo de auditorías comparativas de cotizaciones.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-md transition-all cursor-pointer"
        >
          <Plus size={18} className="mr-2" />
          Registrar Nuevo Cliente / Copropiedad
        </button>
      </div>

      {/* Main Grid: Client List (Left) & Client Details + Correlated Audits (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Client List */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[700px]">
          <div className="p-4 border-b border-slate-100 bg-slate-50 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
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
            {filteredClients.map((client) => {
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
                    <span className="font-bold text-sm text-slate-800 truncate">{client.name}</span>
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
            })}

            {filteredClients.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-sm">
                No se encontraron clientes que coincidan con la búsqueda.
              </div>
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

                  <div className="flex items-center space-x-2">
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
                    <span className="font-bold text-slate-500 uppercase block mb-1">Coordenadas / NSR-10</span>
                    {selectedClient.latitude && selectedClient.longitude ? (
                      <span className="font-mono text-slate-800 font-semibold block">
                        {selectedClient.latitude.toFixed(4)}°, {selectedClient.longitude.toFixed(4)}°
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
                    <span className="font-bold text-slate-500 uppercase block mb-1">Estructura del Inmueble</span>
                    <span className="block">
                      Tipo: <strong className="text-slate-800">{selectedClient.buildingType || 'Residencial'}</strong>
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
                  {onSelectClientForAudit && (
                    <button
                      onClick={() => onSelectClientForAudit(selectedClient)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center"
                    >
                      <Plus size={14} className="mr-1" /> Iniciar nueva auditoría
                    </button>
                  )}
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
                            <span>Aseguradoras: <strong>{audit.insurers.join(', ')}</strong></span>
                            <span>• Mejor opción: <strong className="text-emerald-700">{audit.bestOption}</strong></span>
                            {audit.premiumValue > 0 && (
                              <span>• Prima: <strong>{formatCOP(audit.premiumValue)}</strong></span>
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
                      Iniciá un nuevo análisis comparativo para vincular automáticamente los reportes y recomendaciones a esta copropiedad.
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
              <div className="text-base font-semibold text-slate-600">Selecciona o crea un cliente</div>
              <p className="text-xs text-slate-500">
                Selecciona un cliente de la lista para ver su perfil georreferenciado y las auditorías correlacionadas.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create / Edit Client */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto py-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-in zoom-in-95 duration-200 my-auto">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800">
                {editingClient ? 'Editar Cliente / Copropiedad' : 'Registrar Nuevo Cliente / Copropiedad'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveClient} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto scrollbar-thin">
              <div>
                <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-3">Información General</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                      Nombre / Razón Social <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      value={clientForm.name}
                      onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                      NIT / RUT <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      value={clientForm.nit}
                      onChange={(e) => setClientForm({ ...clientForm, nit: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Administrador / Contacto</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      value={clientForm.contactPerson}
                      onChange={(e) => setClientForm({ ...clientForm, contactPerson: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Correo Electrónico</label>
                    <input
                      type="email"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      value={clientForm.email}
                      onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100">
                <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-3">Ubicación Georreferenciada</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Ciudad</label>
                    <select
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                      value={clientForm.city}
                      onChange={(e) => handleCityChange(e.target.value)}
                    >
                      {Object.keys(CITY_SEISMIC_ZONES).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Departamento</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50"
                      value={clientForm.department}
                      onChange={(e) => setClientForm({ ...clientForm, department: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Zona Sísmica (NSR-10)</label>
                    <select
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-semibold"
                      value={clientForm.seismicZone}
                      onChange={(e) => setClientForm({ ...clientForm, seismicZone: e.target.value as any })}
                    >
                      <option value="Alta">Alta</option>
                      <option value="Intermedia">Intermedia</option>
                      <option value="Baja">Baja</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Dirección Completa</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      value={clientForm.address}
                      onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Latitud</label>
                      <input
                        type="number"
                        step="0.0001"
                        className="w-full px-2 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                        value={clientForm.latitude}
                        onChange={(e) => setClientForm({ ...clientForm, latitude: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Longitud</label>
                      <input
                        type="number"
                        step="0.0001"
                        className="w-full px-2 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                        value={clientForm.longitude}
                        onChange={(e) => setClientForm({ ...clientForm, longitude: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md font-medium text-sm"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientManager;
