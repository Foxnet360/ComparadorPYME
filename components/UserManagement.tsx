import React, { useState } from 'react';
import { UserRole, Ally } from '../types';
import { DEMO_ALLIES, DEMO_ANALYSTS } from '../services/analyticsService';
import {
  Users,
  Building2,
  UserPlus,
  ShieldCheck,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  X,
  Search,
  Building,
} from 'lucide-react';

interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  allyId: string;
  allyName: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

interface UserManagementProps {
  currentUserRole?: UserRole;
  currentAllyId?: string;
  onClose?: () => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({
  currentUserRole = 'super_admin',
  currentAllyId = 'ally-100',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'USERS' | 'ALLIES'>('USERS');
  const [searchQuery, setSearchQuery] = useState('');
  const [alliesList, setAlliesList] = useState<Ally[]>(DEMO_ALLIES);

  const [usersList, setUsersList] = useState<ManagedUser[]>([
    {
      id: 'user-tech-1',
      name: 'Carlos Mendoza',
      email: 'carlos.mendoza@andina.com',
      role: 'ally_technical',
      allyId: 'ally-100',
      allyName: 'Correduría Andina de Seguros S.A.',
      status: 'ACTIVE',
      createdAt: '2026-01-15',
    },
    {
      id: 'user-tech-2',
      name: 'Ana María Gómez',
      email: 'ana.gomez@andina.com',
      role: 'ally_technical',
      allyId: 'ally-100',
      allyName: 'Correduría Andina de Seguros S.A.',
      status: 'ACTIVE',
      createdAt: '2026-02-10',
    },
    {
      id: 'user-admin-1',
      name: 'Roberto Silva (Director)',
      email: 'roberto.silva@andina.com',
      role: 'ally_admin',
      allyId: 'ally-100',
      allyName: 'Correduría Andina de Seguros S.A.',
      status: 'ACTIVE',
      createdAt: '2025-11-01',
    },
    {
      id: 'user-tech-3',
      name: 'Jorge Rojas',
      email: 'jorge.rojas@alianza.com',
      role: 'ally_technical',
      allyId: 'ally-200',
      allyName: 'Alianza Corredores PYME Ltda.',
      status: 'ACTIVE',
      createdAt: '2026-03-01',
    },
  ]);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAllyModal, setShowAllyModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('ally_technical');
  const [newUserAllyId, setNewUserAllyId] = useState(currentAllyId);
  const [newAllyName, setNewAllyName] = useState('');
  const [newAllyNit, setNewAllyNit] = useState('');

  // Filter users based on RBAC level
  const visibleUsers = usersList
    .filter((u) => {
      if (currentUserRole === 'ally_admin') {
        return u.allyId === currentAllyId;
      }
      return true; // Super Admin sees all users
    })
    .filter(
      (u) =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail) return;

    const selectedAlly = alliesList.find((a) => a.id === newUserAllyId) || alliesList[0]!;

    const newUser: ManagedUser = {
      id: `user-${Date.now()}`,
      name: newUserName,
      email: newUserEmail,
      role: currentUserRole === 'ally_admin' ? 'ally_technical' : newUserRole,
      allyId: selectedAlly.id,
      allyName: selectedAlly.name,
      status: 'ACTIVE',
      createdAt: new Date().toISOString().split('T')[0]!,
    };

    setUsersList([newUser, ...usersList]);
    setNewUserName('');
    setNewUserEmail('');
    setShowAddModal(false);
  };

  const handleCreateAlly = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAllyName) return;

    const newAlly: Ally = {
      id: `ally-${Date.now()}`,
      name: newAllyName,
      nit: newAllyNit || '900.000.000-0',
      createdAt: new Date().toISOString().split('T')[0],
    };

    setAlliesList([...alliesList, newAlly]);
    setNewAllyName('');
    setNewAllyNit('');
    setShowAllyModal(false);
  };

  const toggleUserStatus = (userId: string) => {
    setUsersList(
      usersList.map((u) =>
        u.id === userId ? { ...u, status: u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } : u
      )
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-12">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-3">
            <h2 className="text-2xl font-bold text-slate-900">
              {currentUserRole === 'super_admin'
                ? 'Gestión Global de Usuarios y Aliados'
                : 'Gestión del Equipo Técnico'}
            </h2>
            <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold uppercase">
              RBAC Control
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            {currentUserRole === 'super_admin'
              ? 'Administre usuarios globales, roles y corredurías asociadas en la plataforma'
              : 'Administre los analistas técnicos pertenecientes a su correduría'}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {currentUserRole === 'super_admin' && (
            <button
              onClick={() => setShowAllyModal(true)}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors flex items-center space-x-2 shadow-xs"
            >
              <Building2 size={16} />
              <span>+ Nuevo Aliado</span>
            </button>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center space-x-2 shadow-xs"
          >
            <UserPlus size={16} />
            <span>+ Crear Usuario</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        {currentUserRole === 'super_admin' ? (
          <div className="flex space-x-2 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('USERS')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ${
                activeTab === 'USERS' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600'
              }`}
            >
              <Users size={16} />
              <span>Usuarios del Sistema ({usersList.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('ALLIES')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ${
                activeTab === 'ALLIES' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600'
              }`}
            >
              <Building2 size={16} />
              <span>Corredurías Aliadas ({alliesList.length})</span>
            </button>
          </div>
        ) : (
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Analistas Asignados a su Correduría
          </div>
        )}

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Buscar por nombre o correo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* VIEW: USERS TABLE */}
      {activeTab === 'USERS' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-6 py-4">Usuario</th>
                  <th className="px-6 py-4">Correo</th>
                  <th className="px-6 py-4">Rol Asignado</th>
                  <th className="px-6 py-4">Aliado / Correduría</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900 flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                        {user.name.charAt(0)}
                      </div>
                      <span>{user.name}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-xs">{user.email}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          user.role === 'super_admin'
                            ? 'bg-purple-100 text-purple-700'
                            : user.role === 'ally_admin'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {user.role === 'super_admin'
                          ? 'Super Admin'
                          : user.role === 'ally_admin'
                            ? 'Admin Aliado'
                            : 'Técnico Analista'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-700">
                      {user.allyName}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          user.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {user.status === 'ACTIVE' ? (
                          <CheckCircle size={12} className="mr-1" />
                        ) : (
                          <XCircle size={12} className="mr-1" />
                        )}
                        {user.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => toggleUserStatus(user.id)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-900 underline"
                      >
                        {user.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW: ALLIES TABLE (Super Admin) */}
      {activeTab === 'ALLIES' && currentUserRole === 'super_admin' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-6 py-4">Correduría / Aliado</th>
                  <th className="px-6 py-4">NIT</th>
                  <th className="px-6 py-4">ID de Sistema</th>
                  <th className="px-6 py-4">Fecha Alta</th>
                  <th className="px-6 py-4 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {alliesList.map((ally) => (
                  <tr key={ally.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900 flex items-center space-x-2">
                      <Building className="text-indigo-600" size={18} />
                      <span>{ally.name}</span>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-600">{ally.nit}</td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-400">{ally.id}</td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {ally.createdAt || '2025-10-01'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">
                        Vigente
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Crear Usuario */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900">Registrar Nuevo Usuario</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Ej: Daniel Restrepo"
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="daniel@correduria.com"
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {currentUserRole === 'super_admin' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Rol de Usuario
                    </label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                      className="w-full border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="ally_technical">Técnico Analista</option>
                      <option value="ally_admin">Administrador de Aliado</option>
                      <option value="super_admin">Super Administrador Global</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Aliado / Correduría Asignada
                    </label>
                    <select
                      value={newUserAllyId}
                      onChange={(e) => setNewUserAllyId(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {alliesList.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700"
                >
                  Crear Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Crear Aliado */}
      {showAllyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900">Registrar Nueva Correduría Aliada</h3>
              <button
                onClick={() => setShowAllyModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAlly} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nombre de la Correduría
                </label>
                <input
                  type="text"
                  required
                  value={newAllyName}
                  onChange={(e) => setNewAllyName(e.target.value)}
                  placeholder="Ej: Seguros del Norte S.A."
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">NIT</label>
                <input
                  type="text"
                  value={newAllyNit}
                  onChange={(e) => setNewAllyNit(e.target.value)}
                  placeholder="Ej: 901.234.567-8"
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAllyModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
                >
                  Guardar Aliado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
