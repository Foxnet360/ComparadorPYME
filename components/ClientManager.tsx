import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Navigation,
  Loader2,
  ExternalLink,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { Client, HistoryEntry, ComparisonReport } from '../types';
import { storageService } from '../services/storageService';
import { formatCOP } from '../utils/formatCurrency';
import {
  COLOMBIA_DEPARTMENTS,
  getMunicipalitiesByDepartment,
  findGeoByCity,
  searchMunicipalities,
  getAllDepartments,
  SeismicZone,
} from '../src/data/colombiaGeo';
import { geocodeClientAddress } from '../src/services/geocodingService';

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

  // Retroactive link audit state
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [availableAuditsToLink, setAvailableAuditsToLink] = useState<HistoryEntry[]>([]);
  const [selectedAuditIdToLink, setSelectedAuditIdToLink] = useState<string>('');
  const [linkingAudit, setLinkingAudit] = useState(false);

  const handleOpenLinkModal = async () => {
    if (!selectedClient) return;
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
  };

  const handleLinkAudit = async () => {
    if (!selectedClient || !selectedAuditIdToLink) return;
    setLinkingAudit(true);
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
    } finally {
      setLinkingAudit(false);
    }
  };

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

  // City Search & Geocoding States
  const [citySearchTerm, setCitySearchTerm] = useState('');
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geoStatus, setGeoStatus] = useState<{
    source: 'address_precise' | 'municipality_fallback' | 'manual';
    message: string;
  } | null>(null);

  const geocodeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cityDropdownRef = useRef<HTMLDivElement>(null);

  const allDepartments = useMemo(() => getAllDepartments(), []);

  // Filtrado optimizado de municipios con búsqueda predictiva
  const displayedMunicipalities = useMemo(() => {
    const currentDept = clientForm.department || 'Bogotá D.C.';
    if (!citySearchTerm.trim()) {
      return getMunicipalitiesByDepartment(currentDept).map((m) => ({
        ...m,
        department: currentDept,
      }));
    }

    // Buscar primero dentro del departamento
    const inDept = searchMunicipalities(citySearchTerm, currentDept, 25);
    if (inDept.length > 0) return inDept;

    // Si no hay resultados en el departamento actual, buscar en todo Colombia
    return searchMunicipalities(citySearchTerm, undefined, 25);
  }, [clientForm.department, citySearchTerm]);

  // Click outside listener para cerrar dropdown de municipios
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(e.target as Node)) {
        setIsCityDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const runAddressGeocode = async (addressToGeocode: string, city?: string, department?: string) => {
    if (!addressToGeocode || addressToGeocode.trim().length < 5) return;
    setIsGeocoding(true);
    try {
      const res = await geocodeClientAddress({
        address: addressToGeocode,
        city: city || clientForm.city,
        department: department || clientForm.department,
      });

      setClientForm((prev) => ({
        ...prev,
        latitude: res.latitude,
        longitude: res.longitude,
      }));

      setGeoStatus({
        source: res.source,
        message:
          res.message ||
          (res.source === 'address_precise'
            ? 'Georreferenciación exacta por dirección'
            : 'Coordenadas centroide del municipio'),
      });
    } catch {
      // mantener coordenadas actuales
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleAddressChange = (newAddress: string) => {
    setClientForm((prev) => ({ ...prev, address: newAddress }));

    if (geocodeDebounceRef.current) {
      clearTimeout(geocodeDebounceRef.current);
    }

    if (newAddress.trim().length >= 6) {
      geocodeDebounceRef.current = setTimeout(() => {
        runAddressGeocode(newAddress, clientForm.city, clientForm.department);
      }, 850);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingClient(null);
    const initialCity = 'Bogotá D.C.';
    const initialDept = 'Bogotá D.C.';
    const initialGeo = findGeoByCity(initialCity, initialDept);

    setClientForm({
      name: '',
      nit: '',
      contactPerson: '',
      email: '',
      phone: '',
      industry: 'Copropiedad Horizontal',
      address: '',
      city: initialCity,
      department: initialDept,
      latitude: initialGeo?.lat || 4.6097,
      longitude: initialGeo?.lng || -74.0817,
      seismicZone: initialGeo?.zone || 'Intermedia',
      buildingType: 'Residencial',
      towersCount: 1,
      unitsCount: 20,
      floorsCount: 5,
      constructionYear: 2020,
      hasElevators: true,
      hasPowerPlant: false,
    });
    setCitySearchTerm(initialCity);
    setIsCityDropdownOpen(false);
    setGeoStatus({
      source: 'municipality_fallback',
      message: `Coordenadas oficiales de ${initialCity}`,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (client: Client) => {
    setEditingClient(client);
    setClientForm({ ...client });
    setCitySearchTerm(client.city || '');
    setIsCityDropdownOpen(false);
    setGeoStatus({
      source: 'manual',
      message: client.latitude && client.longitude ? 'Coordenadas del cliente' : 'Sin coordenadas',
    });
    setIsModalOpen(true);
  };

  const handleDepartmentChange = (deptName: string) => {
    const municipalities = getMunicipalitiesByDepartment(deptName);
    const firstCity = municipalities[0];
    if (firstCity) {
      setClientForm((prev) => ({
        ...prev,
        department: deptName,
        city: firstCity.name,
        seismicZone: firstCity.zone,
        latitude: firstCity.lat,
        longitude: firstCity.lng,
      }));
      setCitySearchTerm(firstCity.name);
      setGeoStatus({
        source: 'municipality_fallback',
        message: `Coordenadas base de ${firstCity.name} (${deptName})`,
      });
      if (clientForm.address && clientForm.address.trim().length >= 6) {
        runAddressGeocode(clientForm.address, firstCity.name, deptName);
      }
    } else {
      setClientForm((prev) => ({ ...prev, department: deptName }));
    }
  };

  const handleSelectMunicipality = (m: {
    name: string;
    department: string;
    zone: SeismicZone;
    lat: number;
    lng: number;
  }) => {
    setClientForm((prev) => ({
      ...prev,
      city: m.name,
      department: m.department,
      seismicZone: m.zone,
      latitude: m.lat,
      longitude: m.lng,
    }));
    setCitySearchTerm(m.name);
    setIsCityDropdownOpen(false);
    setGeoStatus({
      source: 'municipality_fallback',
      message: `Coordenadas oficiales de ${m.name} (${m.department})`,
    });

    if (clientForm.address && clientForm.address.trim().length >= 6) {
      runAddressGeocode(clientForm.address, m.name, m.department);
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
            Administra copropiedades, georreferenciación y el historial completo de auditorías
            comparativas de cotizaciones.
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
              <div className="p-8 text-center text-xs text-slate-400">No se encontraron clientes</div>
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
            }))}
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
                      Iniciá un nuevo análisis comparativo para vincular automáticamente los
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

      {/* Modal: Create / Edit Client */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto py-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-in zoom-in-95 duration-200 my-auto">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800">
                {editingClient
                  ? 'Editar Cliente / Copropiedad'
                  : 'Registrar Nuevo Cliente / Copropiedad'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSaveClient}
              className="p-6 space-y-5 max-h-[80vh] overflow-y-auto scrollbar-thin"
            >
              <div>
                <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-3">
                  Información General
                </h4>
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
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                      Administrador / Contacto
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      value={clientForm.contactPerson}
                      onChange={(e) =>
                        setClientForm({ ...clientForm, contactPerson: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                      Correo Electrónico
                    </label>
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
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin size={14} className="text-indigo-600" />
                    Ubicación Georreferenciada (DIVIPOLA / NSR-10)
                  </h4>
                  {geoStatus && (
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        geoStatus.source === 'address_precise'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : geoStatus.source === 'municipality_fallback'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {geoStatus.source === 'address_precise' ? (
                        <CheckCircle2 size={12} className="text-emerald-600" />
                      ) : (
                        <MapPin size={12} className="text-blue-600" />
                      )}
                      {geoStatus.message}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                  {/* Selector de Departamento */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                      Departamento ({allDepartments.length})
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={clientForm.department || 'Bogotá D.C.'}
                      onChange={(e) => handleDepartmentChange(e.target.value)}
                    >
                      {COLOMBIA_DEPARTMENTS.map((d) => (
                        <option key={d.code} value={d.name}>
                          {d.name} ({d.municipalities.length})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Selector Inteligente y Searchable de Municipio */}
                  <div className="relative" ref={cityDropdownRef}>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                      Ciudad / Municipio (1.122 en Colombia)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                        <Search size={14} />
                      </div>
                      <input
                        type="text"
                        className="w-full pl-8 pr-8 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Buscar municipio..."
                        value={citySearchTerm}
                        onFocus={() => setIsCityDropdownOpen(true)}
                        onChange={(e) => {
                          setCitySearchTerm(e.target.value);
                          setIsCityDropdownOpen(true);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>

                    {/* Dropdown de opciones filtradas */}
                    {isCityDropdownOpen && (
                      <div className="absolute z-40 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
                        {displayedMunicipalities.length > 0 ? (
                          displayedMunicipalities.map((m, idx) => (
                            <button
                              key={`${m.department}-${m.name}-${idx}`}
                              type="button"
                              onClick={() => handleSelectMunicipality(m)}
                              className={`w-full text-left px-3 py-2 text-xs hover:bg-indigo-50/80 transition-colors flex items-center justify-between ${
                                clientForm.city === m.name ? 'bg-indigo-50 text-indigo-900 font-bold' : 'text-slate-700'
                              }`}
                            >
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-900">{m.name}</span>
                                <span className="text-[10px] text-slate-500">{m.department}</span>
                              </div>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                  m.zone === 'Alta'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : m.zone === 'Intermedia'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {m.zone}
                              </span>
                            </button>
                          ))
                        ) : (
                          <div className="p-3 text-xs text-slate-400 text-center">
                            No se encontraron municipios coincidentes.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Zona Sísmica NSR-10 */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                      Zona Sísmica (NSR-10)
                    </label>
                    <select
                      className={`w-full px-3 py-2 border rounded-lg text-sm bg-white font-semibold ${
                        clientForm.seismicZone === 'Alta'
                          ? 'border-rose-300 text-rose-700 bg-rose-50/30'
                          : clientForm.seismicZone === 'Intermedia'
                          ? 'border-amber-300 text-amber-700 bg-amber-50/30'
                          : 'border-emerald-300 text-emerald-700 bg-emerald-50/30'
                      }`}
                      value={clientForm.seismicZone}
                      onChange={(e) =>
                        setClientForm({ ...clientForm, seismicZone: e.target.value as SeismicZone })
                      }
                    >
                      <option value="Alta">Zona Alta (Amenaza Sísmica Severa)</option>
                      <option value="Intermedia">Zona Intermedia (Amenaza Moderada)</option>
                      <option value="Baja">Zona Baja (Amenaza Reducida)</option>
                    </select>
                  </div>
                </div>

                {/* Dirección y Coordenadas GPS Automáticas */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-600 uppercase">
                        Dirección Completa
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          runAddressGeocode(clientForm.address || '', clientForm.city, clientForm.department)
                        }
                        disabled={isGeocoding || !clientForm.address}
                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 disabled:opacity-40 transition-colors"
                      >
                        {isGeocoding ? (
                          <>
                            <Loader2 size={12} className="animate-spin text-indigo-600" />
                            <span>Buscando GPS...</span>
                          </>
                        ) : (
                          <>
                            <Navigation size={12} />
                            <span>Georreferenciar dirección</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Ej: Calle 72 # 10-07, Edificio Los Rosales"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        value={clientForm.address || ''}
                        onChange={(e) => handleAddressChange(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Latitud GPS
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        className="w-full px-2 py-2 border border-slate-300 rounded-lg text-xs font-mono bg-slate-50/70"
                        value={clientForm.latitude ?? 4.6097}
                        onChange={(e) => {
                          setClientForm({ ...clientForm, latitude: parseFloat(e.target.value) });
                          setGeoStatus({ source: 'manual', message: 'Latitud editada manualmente' });
                        }}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">
                          Longitud GPS
                        </label>
                        {clientForm.latitude && clientForm.longitude ? (
                          <a
                            href={`https://www.google.com/maps?q=${clientForm.latitude},${clientForm.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-indigo-500 hover:text-indigo-700 flex items-center gap-0.5"
                            title="Ver en Google Maps"
                          >
                            <ExternalLink size={10} />
                          </a>
                        ) : null}
                      </div>
                      <input
                        type="number"
                        step="0.0001"
                        className="w-full px-2 py-2 border border-slate-300 rounded-lg text-xs font-mono bg-slate-50/70"
                        value={clientForm.longitude ?? -74.0817}
                        onChange={(e) => {
                          setClientForm({ ...clientForm, longitude: parseFloat(e.target.value) });
                          setGeoStatus({ source: 'manual', message: 'Longitud editada manualmente' });
                        }}
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
                  <h3 className="font-bold text-slate-800 text-sm">Vincular Auditoría a {selectedClient.name}</h3>
                  <p className="text-xs text-slate-500">Asocia una comparativa huérfana o prospecto general</p>
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
                    Seleccioná la auditoría a transferir:
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
    </div>
  );
};

export default ClientManager;
