import React, { useState } from 'react';
import {
  X,
  Building2,
  Building,
  Mail,
  MapPin,
  Compass,
  Phone,
  ShieldAlert,
  FileText,
} from 'lucide-react';
import { Client } from '../../types';
import { storageService } from '../../services/storageService';
import {
  COLOMBIA_DEPARTMENTS,
  getMunicipalitiesByDepartment,
  findGeoByCity,
} from '../../src/data/colombiaGeo';

export interface NewClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDomain?: string;
  onClientCreated: (client: Client) => void;
}

export const NewClientModal: React.FC<NewClientModalProps> = ({
  isOpen,
  onClose,
  activeDomain = 'pyme',
  onClientCreated,
}) => {
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

  if (!isOpen) return null;

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
    } else {
      setNewClient((prev) => ({ ...prev, department: deptName }));
    }
  };

  const handleCityChange = (cityName: string) => {
    const geo = findGeoByCity(cityName, newClient.department);
    if (geo) {
      setNewClient((prev) => ({
        ...prev,
        city: cityName,
        department: geo.dept,
        seismicZone: geo.zone,
        latitude: geo.lat,
        longitude: geo.lng,
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
      industry:
        newClient.industry ||
        (activeDomain === 'copropiedades' ? 'Copropiedad Horizontal' : 'Comercial'),
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

    storageService.addClient(client).then((_updatedList) => {
      onClientCreated(client);
      onClose();
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto py-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-in zoom-in-95 duration-200 my-auto">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-lg text-slate-800">
              {activeDomain === 'copropiedades'
                ? 'Registrar Datos de Copropiedad y Georreferenciación'
                : 'Registrar Nuevo Cliente'}
            </h3>
            <p className="text-xs text-slate-500">
              Ingresá la información del cliente, geolocalización y datos físicos del inmueble.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={handleCreateClient}
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
            <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-3 flex items-center">
              <MapPin size={15} className="mr-1.5 text-indigo-600" />
              Ubicación Georreferenciada & Riesgo Sísmico (NSR-10)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Dirección del Predio / Riesgo
                </label>
                <input
                  type="text"
                  placeholder="Ej. Calle 72 # 10 - 34"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  value={newClient.address}
                  onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Departamento (Colombia)
                </label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white"
                  value={newClient.department}
                  onChange={(e) => handleDepartmentChange(e.target.value)}
                >
                  {COLOMBIA_DEPARTMENTS.map((dept) => (
                    <option key={dept.name} value={dept.name}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Ciudad / Municipio
                </label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white"
                  value={newClient.city}
                  onChange={(e) => handleCityChange(e.target.value)}
                >
                  {getMunicipalitiesByDepartment(newClient.department || 'Cundinamarca').map(
                    (mun) => (
                      <option key={mun.name} value={mun.name}>
                        {mun.name}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Zona Sísmica (NSR-10)
                </label>
                <div className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm font-semibold">
                  <ShieldAlert
                    size={16}
                    className={
                      newClient.seismicZone === 'Alta'
                        ? 'text-red-500'
                        : newClient.seismicZone === 'Intermedia'
                          ? 'text-amber-500'
                          : 'text-green-500'
                    }
                  />
                  <span>{newClient.seismicZone || 'Calculando...'}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Latitud
                </label>
                <input
                  type="number"
                  step="any"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-slate-50"
                  value={newClient.latitude}
                  onChange={(e) => setNewClient({ ...newClient, latitude: Number(e.target.value) })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Longitud
                </label>
                <input
                  type="number"
                  step="any"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-slate-50"
                  value={newClient.longitude}
                  onChange={(e) =>
                    setNewClient({ ...newClient, longitude: Number(e.target.value) })
                  }
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Validación Geográfica
                </label>
                <div className="flex items-center text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">
                  <Compass size={14} className="mr-1.5" />
                  <span>Coordenadas autorizadas</span>
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
                  onChange={(e) =>
                    setNewClient({ ...newClient, hasPowerPlant: e.target.checked })
                  }
                  className="w-4 h-4 text-indigo-600 rounded-sm"
                />
                <label htmlFor="hasPowerPlant" className="text-xs font-semibold text-slate-700">
                  Planta Eléctrica
                </label>
              </div>
            </div>
          </div>

          {/* Formulario Condicional por Ramo Activo */}
          {activeDomain === 'maquinaria' && (
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
                  <select className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs bg-white">
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
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Número de Serie / Chasis
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. CAT0320DABC12345"
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Horómetro Actual
                  </label>
                  <input
                    type="number"
                    placeholder="Ej. 4.500 hrs"
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Valor de Reposición a Nuevo
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. $450.000.000 COP"
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Zona de Operación
                  </label>
                  <select className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs bg-white">
                    <option value="urbana">Urbana Pavimentada</option>
                    <option value="rural">Rural / Obra Civil</option>
                    <option value="minera">Minera / Socavón</option>
                    <option value="fluvial">Fluvial / Costera</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeDomain === 'embarcaciones' && (
            <div className="pt-2 border-t border-slate-100">
              <h4 className="text-xs font-bold text-cyan-700 uppercase tracking-wider mb-3 flex items-center">
                <FileText size={15} className="mr-1.5 text-cyan-600" />
                Datos Técnicos del Casco / Embarcación
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Nombre de la Embarcación
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Nao Victoria"
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Matrícula DIMAR
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. CP-05-1234-A"
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Tipo de Embarcación
                  </label>
                  <select className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs bg-white">
                    <option value="lancha">Lancha Rápida / Bote Motor</option>
                    <option value="velero">Velero de Recreo</option>
                    <option value="yate">Yate de Placer</option>
                    <option value="remolcador">Remolcador de Puerto</option>
                    <option value="barcaza">Barcaza Fluvial</option>
                    <option value="pesquero">Barco Pesquero</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Zona de Navegación
                  </label>
                  <select className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs bg-white">
                    <option value="aguas_interiores">Aguas Interiores / Represas</option>
                    <option value="costanera">Navegación Costanera (hasta 12 NM)</option>
                    <option value="mar_abierto">Mar Abierto / Alta Mar</option>
                    <option value="fluvial">Ríos Navegables (Magdalena/Cauca)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Tonelaje Bruto (TRB)
                  </label>
                  <input
                    type="number"
                    placeholder="Ej. 180 TRB"
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Material del Casco
                  </label>
                  <select className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs bg-white">
                    <option value="acero">Acero Naval</option>
                    <option value="fibra">Fibra de Vidrio</option>
                    <option value="aluminio">Aluminio</option>
                    <option value="madera">Madera / Compuesto</option>
                  </select>
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
              Guardar Copropiedad / Cliente
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
