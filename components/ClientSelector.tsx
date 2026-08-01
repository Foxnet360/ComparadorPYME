import React, { useState, useEffect } from 'react';
import {
  User,
  Plus,
  Search,
  X,
  Building2,
  FileText,
  Mail,
  MapPin,
  Compass,
  Building,
  Phone,
  ShieldAlert,
} from 'lucide-react';
import { Client } from '../types';
import { storageService } from '../services/storageService';

interface ClientSelectorProps {
  selectedClient: Client | null;
  onSelectClient: (client: Client) => void;
  disabled?: boolean;
  activeDomain?: string;
}

// Preset Colombian cities with seismic risk zones according to NSR-10
const CITY_SEISMIC_ZONES: Record<string, { dept: string; zone: 'Alta' | 'Intermedia' | 'Baja'; lat: number; lng: number }> = {
  Bogotá: { dept: 'Cundinamarca', zone: 'Intermedia', lat: 4.6097, lng: -74.0817 },
  Medellín: { dept: 'Antioquia', zone: 'Alta', lat: 6.2442, lng: -75.5812 },
  Cali: { dept: 'Valle del Cauca', zone: 'Alta', lat: 3.4516, lng: -76.532 },
  Barranquilla: { dept: 'Atlántico', zone: 'Baja', lat: 10.9685, lng: -74.7813 },
  Bucaramanga: { dept: 'Santander', zone: 'Alta', lat: 7.1254, lng: -73.1198 },
  Cartagena: { dept: 'Bolívar', zone: 'Baja', lat: 10.3997, lng: -75.5144 },
  Pereira: { dept: 'Risaralda', zone: 'Alta', lat: 4.8133, lng: -75.6961 },
  Manizales: { dept: 'Caldas', zone: 'Alta', lat: 5.0689, lng: -75.5174 },
  Cúcuta: { dept: 'Norte de Santander', zone: 'Alta', lat: 7.8939, lng: -72.5078 },
  Ibagué: { dept: 'Tolima', zone: 'Alta', lat: 4.4389, lng: -75.2322 },
  Villavicencio: { dept: 'Meta', zone: 'Alta', lat: 4.142, lng: -73.6266 },
  SantaMarta: { dept: 'Magdalena', zone: 'Baja', lat: 11.2408, lng: -74.199 },
};

const ClientSelector: React.FC<ClientSelectorProps> = ({
  selectedClient,
  onSelectClient,
  disabled,
  activeDomain = 'pyme',
}) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State for new client / copropiedad
  const [showModal, setShowModal] = useState(false);
  const [newClient, setNewClient] = useState<Partial<Client>>({
    name: '',
    nit: '',
    contactPerson: '',
    email: '',
    phone: '',
    industry: activeDomain === 'copropiedades' ? 'Copropiedad Horizontal' : '',
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

  useEffect(() => {
    const fetchClients = async () => {
      const data = await storageService.getClients();
      setClients(data);
    };
    fetchClients();
  }, []);

  const filteredClients = clients.filter(
    (c) =>
      (c.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (c.nit || '').includes(searchTerm) ||
      (c.city?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const handleCityChange = (cityName: string) => {
    const cityData = CITY_SEISMIC_ZONES[cityName];
    if (cityData) {
      setNewClient((prev) => ({
        ...prev,
        city: cityName,
        department: cityData.dept,
        seismicZone: cityData.zone,
        latitude: cityData.lat,
        longitude: cityData.lng,
      }));
    } else {
      setNewClient((prev) => ({ ...prev, city: cityName }));
    }
  };

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.name || !newClient.nit) return;

    const client: Client = {
      id: Date.now().toString(),
      name: newClient.name,
      nit: newClient.nit,
      contactPerson: newClient.contactPerson,
      email: newClient.email,
      phone: newClient.phone,
      industry: newClient.industry || (activeDomain === 'copropiedades' ? 'Copropiedad Horizontal' : 'Comercial'),
      address: newClient.address,
      city: newClient.city,
      department: newClient.department,
      latitude: Number(newClient.latitude) || 4.6097,
      longitude: Number(newClient.longitude) || -74.0817,
      seismicZone: newClient.seismicZone || 'Intermedia',
      buildingType: newClient.buildingType || 'Residencial',
      towersCount: Number(newClient.towersCount) || 1,
      unitsCount: Number(newClient.unitsCount) || 1,
      floorsCount: Number(newClient.floorsCount) || 1,
      constructionYear: Number(newClient.constructionYear) || 2020,
      hasElevators: Boolean(newClient.hasElevators),
      hasPowerPlant: Boolean(newClient.hasPowerPlant),
    };

    storageService.addClient(client).then((updatedList) => {
      setClients(updatedList);
      onSelectClient(client);
      setShowModal(false);
      setNewClient({
        name: '',
        nit: '',
        contactPerson: '',
        email: '',
        phone: '',
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
      });
    });
  };

  return (
    <div className="w-full relative">
      <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center justify-between">
        <span>{activeDomain === 'copropiedades' ? 'Copropiedad / Edificio' : 'Cliente / Prospecto'}</span>
        {selectedClient && selectedClient.city && (
          <span className="text-xs font-normal text-indigo-600 flex items-center">
            <MapPin size={12} className="mr-1" /> {selectedClient.city}, {selectedClient.department}
          </span>
        )}
      </label>

      {/* Selector Trigger */}
      <div
        className={`bg-white border rounded-xl p-3 flex items-center justify-between cursor-pointer transition-all ${
          disabled ? 'opacity-60 cursor-not-allowed border-slate-200' : 'border-slate-300 hover:border-indigo-500 hover:shadow-sm'
        }`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="flex items-center space-x-3 overflow-hidden">
          <div
            className={`p-2 rounded-lg ${selectedClient ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}
          >
            {activeDomain === 'copropiedades' ? <Building size={20} /> : <Building2 size={20} />}
          </div>
          <div className="flex flex-col truncate">
            <span
              className={`font-medium truncate ${selectedClient ? 'text-slate-800' : 'text-slate-500'}`}
            >
              {selectedClient ? selectedClient.name : activeDomain === 'copropiedades' ? 'Seleccionar Copropiedad...' : 'Seleccionar Cliente...'}
            </span>
            {selectedClient && (
              <span className="text-xs text-slate-400">
                NIT: {selectedClient.nit} {selectedClient.address ? `• ${selectedClient.address}` : ''}
              </span>
            )}
          </div>
        </div>
        {!disabled && <Search size={16} className="text-slate-400 ml-2 flex-shrink-0" />}
      </div>

      {/* Selected Copropiedad Georeferenced Badge Card */}
      {selectedClient && (selectedClient.latitude || selectedClient.buildingType) && (
        <div className="mt-2.5 p-3 bg-gradient-to-r from-slate-50 to-indigo-50/50 border border-slate-200/80 rounded-xl text-xs text-slate-700 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between font-semibold">
            <span className="flex items-center text-slate-800">
              <MapPin size={13} className="text-indigo-600 mr-1" />
              {selectedClient.address || 'Ubicación'}{' '}
              {selectedClient.city ? `(${selectedClient.city})` : ''}
            </span>
            {selectedClient.seismicZone && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                  selectedClient.seismicZone === 'Alta'
                    ? 'bg-rose-100 text-rose-700 border border-rose-200'
                    : selectedClient.seismicZone === 'Intermedia'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
              >
                Riesgo Sísmico NSR-10: {selectedClient.seismicZone}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
            {selectedClient.latitude && selectedClient.longitude && (
              <span className="flex items-center text-slate-500 font-mono">
                <Compass size={12} className="mr-1 text-slate-400" />
                {selectedClient.latitude.toFixed(4)}°, {selectedClient.longitude.toFixed(4)}°
              </span>
            )}
            {selectedClient.buildingType && (
              <span>• Tipo: <strong className="text-slate-800">{selectedClient.buildingType}</strong></span>
            )}
            {selectedClient.towersCount !== undefined && (
              <span>• Torres: <strong className="text-slate-800">{selectedClient.towersCount}</strong></span>
            )}
            {selectedClient.unitsCount !== undefined && (
              <span>• Unidades: <strong className="text-slate-800">{selectedClient.unitsCount}</strong></span>
            )}
            {selectedClient.floorsCount !== undefined && (
              <span>• Pisos: <strong className="text-slate-800">{selectedClient.floorsCount}</strong></span>
            )}
          </div>
        </div>
      )}

      {/* Dropdown List */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="p-3 border-b border-slate-100 bg-slate-50">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={14}
              />
              <input
                autoFocus
                type="text"
                placeholder="Buscar por nombre, NIT o ciudad..."
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto scrollbar-thin">
            {filteredClients.map((client) => (
              <div
                key={client.id}
                className="px-4 py-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between group border-b border-slate-50 last:border-0"
                onClick={() => {
                  onSelectClient(client);
                  setIsOpen(false);
                }}
              >
                <div>
                  <div className="text-sm font-medium text-slate-800 group-hover:text-indigo-700">
                    {client.name}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                    <span>NIT: {client.nit}</span>
                    {client.city && <span>• {client.city}</span>}
                    {client.buildingType && (
                      <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded text-[10px]">
                        {client.buildingType}
                      </span>
                    )}
                  </div>
                </div>
                {client.id === selectedClient?.id && (
                  <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
                )}
              </div>
            ))}
            {filteredClients.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-400">
                No se encontraron registros.
              </div>
            )}
          </div>

          <div
            className="p-3 bg-indigo-50 border-t border-indigo-100 text-indigo-700 text-sm font-medium flex items-center justify-center cursor-pointer hover:bg-indigo-100 transition-colors"
            onClick={() => {
              setIsOpen(false);
              setShowModal(true);
            }}
          >
            <Plus size={16} className="mr-2" />
            {activeDomain === 'copropiedades' ? 'Crear Nueva Copropiedad' : 'Crear Nuevo Cliente'}
          </div>
        </div>
      )}

      {/* Backdrop for dropdown */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsOpen(false)}></div>
      )}

      {/* Create / Edit Client Modal with Georeferencing & Building Details */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto py-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-in zoom-in-95 duration-200 my-auto">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg text-slate-800">
                  {activeDomain === 'copropiedades' ? 'Registrar Datos de Copropiedad y Georreferenciación' : 'Registrar Nuevo Cliente'}
                </h3>
                <p className="text-xs text-slate-500">
                  Ingresá la información del cliente, geolocalización y datos físicos del inmueble.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto scrollbar-thin">
              {/* Sección 1: Datos Principales / Cliente */}
              <div>
                <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-3 flex items-center">
                  <Building2 size={15} className="mr-1.5 text-indigo-600" />
                  Información General y Contacto
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                      Nombre / Razón Social <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      placeholder={activeDomain === 'copropiedades' ? 'Ej. C.R. Torres del Parque' : 'Ej. Empresa S.A.S.'}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      value={newClient.name}
                      onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                      NIT / RUT <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="Ej. 900.123.456-7"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      value={newClient.nit}
                      onChange={(e) => setNewClient({ ...newClient, nit: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                      Administrador / Representante Legal
                    </label>
                    <input
                      type="text"
                      placeholder="Nombre del Administrador"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      value={newClient.contactPerson}
                      onChange={(e) => setNewClient({ ...newClient, contactPerson: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                      Correo Electrónico
                    </label>
                    <input
                      type="email"
                      placeholder="administracion@copropiedad.com"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      value={newClient.email}
                      onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Sección 2: Ubicación Georreferenciada & Riesgo Sísmico */}
              <div className="pt-3 border-t border-slate-100">
                <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-3 flex items-center">
                  <MapPin size={15} className="mr-1.5 text-indigo-600" />
                  Ubicación Georreferenciada (NSR-10)
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                      Ciudad / Municipio
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white"
                      value={newClient.city}
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
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                      Departamento
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-slate-50"
                      value={newClient.department}
                      onChange={(e) => setNewClient({ ...newClient, department: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                      Zona Sísmica (NSR-10)
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white font-semibold"
                      value={newClient.seismicZone}
                      onChange={(e) => setNewClient({ ...newClient, seismicZone: e.target.value as any })}
                    >
                      <option value="Alta">Alta (Riesgo elevado)</option>
                      <option value="Intermedia">Intermedia (Riesgo moderado)</option>
                      <option value="Baja">Baja (Riesgo bajo)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                      Dirección Completa del Inmueble
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Cra 15 # 100-20, Barrio Chicó"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      value={newClient.address}
                      onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Latitud</label>
                      <input
                        type="number"
                        step="0.0001"
                        className="w-full px-2 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                        value={newClient.latitude}
                        onChange={(e) => setNewClient({ ...newClient, latitude: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Longitud</label>
                      <input
                        type="number"
                        step="0.0001"
                        className="w-full px-2 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                        value={newClient.longitude}
                        onChange={(e) => setNewClient({ ...newClient, longitude: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sección 3: Datos Físicos de la Copropiedad */}
              <div className="pt-3 border-t border-slate-100">
                <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-3 flex items-center">
                  <Building size={15} className="mr-1.5 text-indigo-600" />
                  Datos Físicos e Infraestructura
                </h4>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Tipo Copropiedad</label>
                    <select
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                      value={newClient.buildingType}
                      onChange={(e) => setNewClient({ ...newClient, buildingType: e.target.value as any })}
                    >
                      <option value="Residencial">Residencial</option>
                      <option value="Comercial">Comercial</option>
                      <option value="Mixta">Mixta</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">No. Torres/Bloques</label>
                    <input
                      type="number"
                      min="1"
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
                      value={newClient.towersCount}
                      onChange={(e) => setNewClient({ ...newClient, towersCount: parseInt(e.target.value) || 1 })}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">No. Unidades / Aptos</label>
                    <input
                      type="number"
                      min="1"
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
                      value={newClient.unitsCount}
                      onChange={(e) => setNewClient({ ...newClient, unitsCount: parseInt(e.target.value) || 1 })}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Pisos por Torre</label>
                    <input
                      type="number"
                      min="1"
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
                      value={newClient.floorsCount}
                      onChange={(e) => setNewClient({ ...newClient, floorsCount: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Año Construcción</label>
                    <input
                      type="number"
                      placeholder="Ej. 2018"
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
                      value={newClient.constructionYear}
                      onChange={(e) => setNewClient({ ...newClient, constructionYear: parseInt(e.target.value) || 2020 })}
                    />
                  </div>

                  <div className="flex items-center space-x-2 pt-5">
                    <input
                      type="checkbox"
                      id="hasElevators"
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      checked={newClient.hasElevators}
                      onChange={(e) => setNewClient({ ...newClient, hasElevators: e.target.checked })}
                    />
                    <label htmlFor="hasElevators" className="text-xs font-semibold text-slate-700 cursor-pointer">
                      Tiene Ascensores
                    </label>
                  </div>

                  <div className="flex items-center space-x-2 pt-5">
                    <input
                      type="checkbox"
                      id="hasPowerPlant"
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      checked={newClient.hasPowerPlant}
                      onChange={(e) => setNewClient({ ...newClient, hasPowerPlant: e.target.checked })}
                    />
                    <label htmlFor="hasPowerPlant" className="text-xs font-semibold text-slate-700 cursor-pointer">
                      Tiene Planta Eléctrica
                    </label>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md font-medium text-sm"
                >
                  Guardar Copropiedad / Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientSelector;
