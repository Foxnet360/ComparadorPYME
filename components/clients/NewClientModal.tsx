import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Building2,
  Building,
  Mail,
  MapPin,
  Phone,
  FileText,
  Search,
  ChevronDown,
  Navigation,
  Loader2,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { Client } from '../../types';
import { storageService } from '../../services/storageService';
import {
  COLOMBIA_DEPARTMENTS,
  getMunicipalitiesByDepartment,
  findGeoByCity,
  searchMunicipalities,
  getAllDepartments,
  SeismicZone,
} from '../../src/data/colombiaGeo';
import { geocodeClientAddress } from '../../src/services/geocodingService';

export interface NewClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDomain?: string;
  editingClient?: Client | null;
  onClientCreated: (client: Client, updatedList?: Client[]) => void;
}

const buildInitialClientState = (
  activeDomain: string,
  editingClient?: Client | null
): Partial<Client> => {
  if (editingClient) {
    return { ...editingClient, domainDetails: editingClient.domainDetails ?? {} };
  }
  const initialCity = 'Bogotá D.C.';
  const initialDept = 'Bogotá D.C.';
  const initialGeo = findGeoByCity(initialCity, initialDept);
  return {
    name: '',
    nit: '',
    contactPerson: '',
    email: '',
    phone: '',
    industry: activeDomain === 'copropiedades' ? 'Copropiedad Horizontal' : '',
    address: '',
    city: initialCity,
    department: initialDept,
    latitude: initialGeo?.lat ?? 4.6097,
    longitude: initialGeo?.lng ?? -74.0817,
    seismicZone: initialGeo?.zone ?? 'Intermedia',
    buildingType: 'Residencial',
    towersCount: 1,
    unitsCount: 20,
    floorsCount: 5,
    constructionYear: 2020,
    hasElevators: true,
    hasPowerPlant: false,
    domainDetails: {},
  };
};

export const NewClientModal: React.FC<NewClientModalProps> = ({
  isOpen,
  onClose,
  activeDomain = 'pyme',
  editingClient = null,
  onClientCreated,
}) => {
  const [newClient, setNewClient] = useState<Partial<Client>>(() =>
    buildInitialClientState(activeDomain, editingClient)
  );
  const [citySearchTerm, setCitySearchTerm] = useState(editingClient?.city || 'Bogotá D.C.');
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geoStatus, setGeoStatus] = useState<{
    source: 'address_precise' | 'municipality_fallback' | 'manual';
    message: string;
  } | null>(null);

  const geocodeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cityDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const initial = buildInitialClientState(activeDomain, editingClient);
    setNewClient(initial);
    setCitySearchTerm(initial.city || 'Bogotá D.C.');
    setIsCityDropdownOpen(false);
    setGeoStatus(
      editingClient
        ? {
            source: 'manual',
            message:
              editingClient.latitude && editingClient.longitude
                ? 'Coordenadas del cliente'
                : 'Sin coordenadas',
          }
        : {
            source: 'municipality_fallback',
            message: `Coordenadas oficiales de ${initial.city}`,
          }
    );
  }, [isOpen, editingClient, activeDomain]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(e.target as Node)) {
        setIsCityDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (geocodeDebounceRef.current) clearTimeout(geocodeDebounceRef.current);
    };
  }, []);

  const allDepartments = useMemo(() => getAllDepartments(), []);

  const displayedMunicipalities = useMemo(() => {
    const currentDept = newClient.department || 'Bogotá D.C.';
    if (!citySearchTerm.trim()) {
      return getMunicipalitiesByDepartment(currentDept).map((m) => ({
        ...m,
        department: currentDept,
      }));
    }
    const inDept = searchMunicipalities(citySearchTerm, currentDept, 25);
    if (inDept.length > 0) return inDept;
    return searchMunicipalities(citySearchTerm, undefined, 25);
  }, [newClient.department, citySearchTerm]);

  const updateDomainDetail = <K extends keyof NonNullable<Client['domainDetails']>>(
    key: K,
    value: NonNullable<Client['domainDetails']>[K]
  ) => {
    setNewClient((prev) => ({
      ...prev,
      domainDetails: {
        ...prev.domainDetails,
        [key]: value,
      },
    }));
  };

  if (!isOpen) return null;

  const runAddressGeocode = async (
    addressToGeocode: string,
    city?: string,
    department?: string
  ) => {
    if (!addressToGeocode || addressToGeocode.trim().length < 5) return;
    setIsGeocoding(true);
    try {
      const res = await geocodeClientAddress({
        address: addressToGeocode,
        city: city || newClient.city,
        department: department || newClient.department,
      });
      setNewClient((prev) => ({
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
      // Keep current coordinates on geocode failure
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleAddressChange = (newAddress: string) => {
    setNewClient((prev) => ({ ...prev, address: newAddress }));
    if (geocodeDebounceRef.current) {
      clearTimeout(geocodeDebounceRef.current);
    }
    if (newAddress.trim().length >= 6) {
      geocodeDebounceRef.current = setTimeout(() => {
        runAddressGeocode(newAddress, newClient.city, newClient.department);
      }, 850);
    }
  };

  const handleDepartmentChange = (deptName: string) => {
    const municipalities = getMunicipalitiesByDepartment(deptName);
    const firstCity = municipalities[0];
    if (firstCity) {
      setNewClient((prev) => ({
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
      if (newClient.address && newClient.address.trim().length >= 6) {
        runAddressGeocode(newClient.address, firstCity.name, deptName);
      }
    } else {
      setNewClient((prev) => ({ ...prev, department: deptName }));
    }
  };

  const handleSelectMunicipality = (m: {
    name: string;
    department: string;
    zone: SeismicZone;
    lat: number;
    lng: number;
  }) => {
    setNewClient((prev) => ({
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
    if (newClient.address && newClient.address.trim().length >= 6) {
      runAddressGeocode(newClient.address, m.name, m.department);
    }
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.name || !newClient.nit) return;

    const client: Client = {
      id: editingClient ? editingClient.id : Date.now().toString(),
      name: newClient.name,
      nit: newClient.nit,
      contactPerson: newClient.contactPerson || '',
      email: newClient.email || '',
      phone: newClient.phone || '',
      industry:
        newClient.industry ||
        (activeDomain === 'copropiedades' ? 'Copropiedad Horizontal' : 'Comercial'),
      address: newClient.address || '',
      city: newClient.city || 'Bogotá',
      department: newClient.department || 'Cundinamarca',
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
      domainDetails: newClient.domainDetails,
    };

    const updatedList = editingClient
      ? await storageService.updateClient(client)
      : await storageService.addClient(client);

    onClientCreated(client, updatedList);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto py-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-in zoom-in-95 duration-200 my-auto">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-lg text-slate-800">
              {editingClient
                ? 'Editar Cliente / Copropiedad'
                : activeDomain === 'copropiedades'
                  ? 'Registrar Datos de Copropiedad y Georreferenciación'
                  : 'Registrar Nuevo Cliente'}
            </h3>
            <p className="text-xs text-slate-500">
              Ingresá la información del cliente, geolocalización y datos físicos del inmueble.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={handleSaveClient}
          className="p-6 space-y-5 max-h-[80vh] overflow-y-auto scrollbar-thin"
        >
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
                  placeholder={
                    activeDomain === 'copropiedades'
                      ? 'Ej. C.R. Torres del Parque'
                      : 'Ej. Empresa S.A.S.'
                  }
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
                  {activeDomain === 'copropiedades'
                    ? 'Administrador / Representante'
                    : 'Persona de Contacto'}
                </label>
                <input
                  type="text"
                  placeholder="Ej. Carlos Mendoza"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  value={newClient.contactPerson}
                  onChange={(e) => setNewClient({ ...newClient, contactPerson: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="email"
                    placeholder="contacto@empresa.com"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Teléfono / Móvil
                </label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="300 123 4567"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Actividad Económica / Giro
                </label>
                <input
                  type="text"
                  placeholder="Ej. Comercio al por mayor / Servicios"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  value={newClient.industry}
                  onChange={(e) => setNewClient({ ...newClient, industry: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Sección 2: Georreferenciación & Zonificación Sísmica (NSR-10) */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center">
                <MapPin size={15} className="mr-1.5 text-indigo-600" />
                Ubicación Georreferenciada & Riesgo Sísmico (NSR-10)
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
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Departamento ({allDepartments.length})
                </label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={newClient.department || 'Bogotá D.C.'}
                  onChange={(e) => handleDepartmentChange(e.target.value)}
                >
                  {COLOMBIA_DEPARTMENTS.map((d) => (
                    <option key={d.code} value={d.name}>
                      {d.name} ({d.municipalities.length})
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative" ref={cityDropdownRef}>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Ciudad / Municipio
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

                {isCityDropdownOpen && (
                  <div className="absolute z-40 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
                    {displayedMunicipalities.length > 0 ? (
                      displayedMunicipalities.map((m, idx) => (
                        <button
                          key={`${m.department}-${m.name}-${idx}`}
                          type="button"
                          onClick={() => handleSelectMunicipality(m)}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-indigo-50/80 transition-colors flex items-center justify-between ${
                            newClient.city === m.name
                              ? 'bg-indigo-50 text-indigo-900 font-bold'
                              : 'text-slate-700'
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

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Zona Sísmica (NSR-10)
                </label>
                <select
                  className={`w-full px-3 py-2 border rounded-lg text-sm bg-white font-semibold ${
                    newClient.seismicZone === 'Alta'
                      ? 'border-rose-300 text-rose-700 bg-rose-50/30'
                      : newClient.seismicZone === 'Intermedia'
                        ? 'border-amber-300 text-amber-700 bg-amber-50/30'
                        : 'border-emerald-300 text-emerald-700 bg-emerald-50/30'
                  }`}
                  value={newClient.seismicZone}
                  onChange={(e) =>
                    setNewClient({ ...newClient, seismicZone: e.target.value as SeismicZone })
                  }
                >
                  <option value="Alta">Zona Alta (Amenaza Sísmica Severa)</option>
                  <option value="Intermedia">Zona Intermedia (Amenaza Moderada)</option>
                  <option value="Baja">Zona Baja (Amenaza Reducida)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase">
                    Dirección Completa
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      runAddressGeocode(
                        newClient.address || '',
                        newClient.city,
                        newClient.department
                      )
                    }
                    disabled={isGeocoding || !newClient.address}
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
                <input
                  type="text"
                  placeholder="Ej: Calle 72 # 10-07, Edificio Los Rosales"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={newClient.address || ''}
                  onChange={(e) => handleAddressChange(e.target.value)}
                />
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
                    value={newClient.latitude ?? 4.6097}
                    onChange={(e) => {
                      setNewClient({ ...newClient, latitude: parseFloat(e.target.value) });
                      setGeoStatus({ source: 'manual', message: 'Latitud editada manualmente' });
                    }}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">
                      Longitud GPS
                    </label>
                    {newClient.latitude && newClient.longitude ? (
                      <a
                        href={`https://www.google.com/maps?q=${newClient.latitude},${newClient.longitude}`}
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
                    value={newClient.longitude ?? -74.0817}
                    onChange={(e) => {
                      setNewClient({ ...newClient, longitude: parseFloat(e.target.value) });
                      setGeoStatus({ source: 'manual', message: 'Longitud editada manualmente' });
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sección 3: Datos Físicos de la Copropiedad / Inmueble */}
          <div className="pt-2 border-t border-slate-100">
            <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-3 flex items-center">
              <Building size={15} className="mr-1.5 text-indigo-600" />
              Características Físicas de la Edificación
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Destinación
                </label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white"
                  value={newClient.buildingType}
                  onChange={(e) =>
                    setNewClient({
                      ...newClient,
                      buildingType: e.target.value as 'Residencial' | 'Comercial' | 'Mixta',
                    })
                  }
                >
                  <option value="Residencial">Residencial</option>
                  <option value="Comercial">Comercial</option>
                  <option value="Mixta">Mixta</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  N° Torres / Bloques
                </label>
                <input
                  type="number"
                  min="1"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  value={newClient.towersCount}
                  onChange={(e) =>
                    setNewClient({ ...newClient, towersCount: Number(e.target.value) })
                  }
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  N° Unidades / Aptos
                </label>
                <input
                  type="number"
                  min="1"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  value={newClient.unitsCount}
                  onChange={(e) =>
                    setNewClient({ ...newClient, unitsCount: Number(e.target.value) })
                  }
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  N° Pisos / Altura
                </label>
                <input
                  type="number"
                  min="1"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  value={newClient.floorsCount}
                  onChange={(e) =>
                    setNewClient({ ...newClient, floorsCount: Number(e.target.value) })
                  }
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Año Construcción
                </label>
                <input
                  type="number"
                  placeholder="2015"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  value={newClient.constructionYear}
                  onChange={(e) =>
                    setNewClient({ ...newClient, constructionYear: Number(e.target.value) })
                  }
                />
              </div>

              <div className="flex items-center space-x-2 pt-6">
                <input
                  type="checkbox"
                  id="hasElevators"
                  checked={newClient.hasElevators}
                  onChange={(e) => setNewClient({ ...newClient, hasElevators: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded-sm"
                />
                <label htmlFor="hasElevators" className="text-xs font-semibold text-slate-700">
                  Ascensores
                </label>
              </div>

              <div className="flex items-center space-x-2 pt-6">
                <input
                  type="checkbox"
                  id="hasPowerPlant"
                  checked={newClient.hasPowerPlant}
                  onChange={(e) => setNewClient({ ...newClient, hasPowerPlant: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded-sm"
                />
                <label htmlFor="hasPowerPlant" className="text-xs font-semibold text-slate-700">
                  Planta Eléctrica
                </label>
              </div>
            </div>
          </div>

          {/* Formulario Condicional por Ramo Activo */}
          {(activeDomain === 'equipo_maquinaria' || activeDomain === 'maquinaria') && (
            <div className="pt-2 border-t border-slate-100">
              <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-3 flex items-center">
                <FileText size={15} className="mr-1.5 text-amber-600" />
                Datos Técnicos del Equipo / Maquinaria
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Tipo de Maquinaria
                  </label>
                  <select
                    value={newClient.domainDetails?.constructionType || ''}
                    onChange={(e) => updateDomainDetail('constructionType', e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    <option value="">Seleccionar tipo...</option>
                    <option value="amarilla">Línea Amarilla (Excavadora/Retro)</option>
                    <option value="industrial">Industrial Fija (Generador/Torno)</option>
                    <option value="agricola">Agrícola (Tractor/Cosechadora)</option>
                    <option value="construccion">Grúa / Montacargas</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Marca y Modelo
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Caterpillar 320D"
                    value={newClient.domainDetails?.activitySector || ''}
                    onChange={(e) => updateDomainDetail('activitySector', e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Valor de Reposición a Nuevo (COP)
                  </label>
                  <input
                    type="number"
                    placeholder="Ej. 450000000"
                    value={newClient.domainDetails?.machineryReplacementValue || ''}
                    onChange={(e) =>
                      updateDomainDetail('machineryReplacementValue', Number(e.target.value))
                    }
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {(activeDomain === 'casco_embarcacion' || activeDomain === 'embarcaciones') && (
            <div className="pt-2 border-t border-slate-100">
              <h4 className="text-xs font-bold text-cyan-700 uppercase tracking-wider mb-3 flex items-center">
                <FileText size={15} className="mr-1.5 text-cyan-600" />
                Datos Técnicos del Casco / Embarcación
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Tipo de Embarcación / Navegación
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Fluvial / Costera / Remolcador"
                    value={newClient.domainDetails?.transitCargoType || ''}
                    onChange={(e) => updateDomainDetail('transitCargoType', e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Rutas / Zonas Frecuentes
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Río Magdalena / Bahía Cartagena"
                    value={newClient.domainDetails?.frequentRoutes || ''}
                    onChange={(e) => updateDomainDetail('frequentRoutes', e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md font-medium text-sm"
            >
              {editingClient ? 'Guardar Cambios' : 'Guardar Copropiedad / Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const ClientFormModal = NewClientModal;
