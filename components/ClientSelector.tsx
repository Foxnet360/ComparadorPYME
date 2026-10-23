import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Building2,
  MapPin,
  Building,
  Compass,
} from 'lucide-react';
import { Client } from '../types';
import { storageService } from '../services/storageService';
import { NewClientModal } from './clients/NewClientModal';

export interface ClientSelectorProps {
  selectedClient: Client | null;
  onSelectClient: (client: Client) => void;
  disabled?: boolean;
  activeDomain?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const ClientSelector: React.FC<ClientSelectorProps> = ({
  selectedClient,
  onSelectClient,
  disabled,
  activeDomain = 'pyme',
  isOpen: controlledIsOpen,
  onOpenChange,
}) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [internalOpen, setInternalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalOpen;
  const setIsOpen = (open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open);
    } else {
      setInternalOpen(open);
    }
  };

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

  return (
    <div className="w-full relative">
      <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center justify-between">
        <span>
          {activeDomain === 'copropiedades' ? 'Copropiedad / Edificio' : 'Cliente / Prospecto'}
        </span>
        {selectedClient && selectedClient.city && (
          <span className="text-xs font-normal text-indigo-600 flex items-center">
            <MapPin size={12} className="mr-1" /> {selectedClient.city}, {selectedClient.department}
          </span>
        )}
      </label>

      {/* Selector Trigger */}
      <div
        className={`bg-white border rounded-xl p-3 flex items-center justify-between cursor-pointer transition-all ${
          disabled
            ? 'opacity-60 cursor-not-allowed border-slate-200'
            : 'border-slate-300 hover:border-indigo-500 hover:shadow-sm'
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
              {selectedClient
                ? selectedClient.name
                : activeDomain === 'copropiedades'
                  ? 'Seleccionar Copropiedad...'
                  : 'Seleccionar Cliente...'}
            </span>
            {selectedClient && (
              <span className="text-xs text-slate-400">
                NIT: {selectedClient.nit}{' '}
                {selectedClient.address ? `• ${selectedClient.address}` : ''}
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
              <span>
                • Tipo: <strong className="text-slate-800">{selectedClient.buildingType}</strong>
              </span>
            )}
            {selectedClient.towersCount !== undefined && (
              <span>
                • Torres: <strong className="text-slate-800">{selectedClient.towersCount}</strong>
              </span>
            )}
            {selectedClient.unitsCount !== undefined && (
              <span>
                • Unidades: <strong className="text-slate-800">{selectedClient.unitsCount}</strong>
              </span>
            )}
            {selectedClient.floorsCount !== undefined && (
              <span>
                • Pisos: <strong className="text-slate-800">{selectedClient.floorsCount}</strong>
              </span>
            )}
          </div>

          {selectedClient.domainDetails && (
            <div className="pt-1.5 border-t border-slate-200/60 flex flex-wrap gap-1.5 text-[11px] font-semibold text-slate-700">
              {selectedClient.domainDetails.commercialAssetsValue && (
                <span className="bg-indigo-100/70 text-indigo-800 px-2 py-0.5 rounded-md">
                  Activos Fijos: $
                  {selectedClient.domainDetails.commercialAssetsValue.toLocaleString()} COP
                </span>
              )}
              {selectedClient.domainDetails.employeeCount && (
                <span className="bg-slate-200/80 text-slate-800 px-2 py-0.5 rounded-md">
                  Empleados: {selectedClient.domainDetails.employeeCount}
                </span>
              )}
              {selectedClient.domainDetails.transitCargoType && (
                <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md">
                  Carga: {selectedClient.domainDetails.transitCargoType}
                </span>
              )}
              {selectedClient.domainDetails.fireProtectionSystem && (
                <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                  Incendio: {selectedClient.domainDetails.fireProtectionSystem}
                </span>
              )}
              {selectedClient.domainDetails.machineryReplacementValue && (
                <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md">
                  Maquinaria: $
                  {selectedClient.domainDetails.machineryReplacementValue.toLocaleString()} COP
                </span>
              )}
            </div>
          )}
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
      <NewClientModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        activeDomain={activeDomain}
        onClientCreated={(client) => {
          setClients((prev) => [...prev.filter((c) => c.id !== client.id), client]);
          onSelectClient(client);
        }}
      />
    </div>
  );
};

export default ClientSelector;
