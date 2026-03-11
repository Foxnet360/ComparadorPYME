import React, { useState, useEffect } from 'react';
import { User, Plus, Search, X, Building2, FileText, Mail } from 'lucide-react';
import { Client } from '../types';
import { storageService } from '../services/storageService';

interface ClientSelectorProps {
  selectedClient: Client | null;
  onSelectClient: (client: Client) => void;
  disabled?: boolean;
}

const ClientSelector: React.FC<ClientSelectorProps> = ({ selectedClient, onSelectClient, disabled }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [newClient, setNewClient] = useState<Partial<Client>>({ name: '', nit: '', contactPerson: '', industry: '' });

  useEffect(() => {
    const fetchClients = async () => {
      const data = await storageService.getClients();
      setClients(data);
    };
    fetchClients();
  }, []);

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.nit.includes(searchTerm)
  );

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.name || !newClient.nit) return;

    const client: Client = {
      id: Date.now().toString(),
      name: newClient.name,
      nit: newClient.nit,
      contactPerson: newClient.contactPerson,
      industry: newClient.industry,
      email: newClient.email
    };

    storageService.addClient(client).then(updatedList => {
      setClients(updatedList);
      onSelectClient(client);
      setShowModal(false);
      setNewClient({ name: '', nit: '', contactPerson: '', industry: '' });
    });
  };

  return (
    <div className="w-full relative">
      <label className="block text-sm font-bold text-slate-700 mb-2">Cliente / Prospecto</label>

      {/* Selector Trigger */}
      <div
        className={`bg-white border rounded-xl p-3 flex items-center justify-between cursor-pointer transition-all ${disabled ? 'opacity-60 cursor-not-allowed border-slate-200' : 'border-slate-300 hover:border-indigo-500 hover:shadow-sm'}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className={`p-2 rounded-lg ${selectedClient ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}>
            <Building2 size={20} />
          </div>
          <div className="flex flex-col truncate">
            <span className={`font-medium truncate ${selectedClient ? 'text-slate-800' : 'text-slate-500'}`}>
              {selectedClient ? selectedClient.name : "Seleccionar Cliente..."}
            </span>
            {selectedClient && <span className="text-xs text-slate-400">NIT: {selectedClient.nit}</span>}
          </div>
        </div>
        {!disabled && <Search size={16} className="text-slate-400 ml-2 flex-shrink-0" />}
      </div>

      {/* Dropdown List */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="p-3 border-b border-slate-100 bg-slate-50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                autoFocus
                type="text"
                placeholder="Buscar..."
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto scrollbar-thin">
            {filteredClients.map(client => (
              <div
                key={client.id}
                className="px-4 py-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between group"
                onClick={() => {
                  onSelectClient(client);
                  setIsOpen(false);
                }}
              >
                <div>
                  <div className="text-sm font-medium text-slate-800 group-hover:text-indigo-700">{client.name}</div>
                  <div className="text-xs text-slate-500">{client.nit}</div>
                </div>
                {client.id === selectedClient?.id && <div className="w-2 h-2 rounded-full bg-indigo-600"></div>}
              </div>
            ))}
            {filteredClients.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-400">No se encontraron clientes.</div>
            )}
          </div>

          <div
            className="p-3 bg-indigo-50 border-t border-indigo-100 text-indigo-700 text-sm font-medium flex items-center justify-center cursor-pointer hover:bg-indigo-100 transition-colors"
            onClick={() => {
              setIsOpen(false);
              setShowModal(true);
            }}
          >
            <Plus size={16} className="mr-2" /> Crear Nuevo Cliente
          </div>
        </div>
      )}

      {/* Backdrop for dropdown */}
      {isOpen && <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsOpen(false)}></div>}

      {/* Create Client Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800">Registrar Nuevo Cliente</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            <form onSubmit={handleCreateClient} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Razón Social <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    required
                    type="text"
                    placeholder="Ej. Distribuidora Los Andes S.A.S."
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newClient.name}
                    onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">NIT / RUT <span className="text-red-500">*</span></label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    required
                    type="text"
                    placeholder="Ej. 900.123.456-7"
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newClient.nit}
                    onChange={(e) => setNewClient({ ...newClient, nit: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contacto</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      placeholder="Nombre"
                      className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      value={newClient.contactPerson}
                      onChange={(e) => setNewClient({ ...newClient, contactPerson: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sector</label>
                  <input
                    type="text"
                    placeholder="Ej. Transporte"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    value={newClient.industry}
                    onChange={(e) => setNewClient({ ...newClient, industry: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Correo Electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="email"
                    placeholder="contacto@empresa.com"
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md font-medium">Crear Cliente</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientSelector;