import React, { useState, useEffect } from 'react';
import { UserRole, Ally } from '../types';
import { DEMO_ALLIES, DEMO_ANALYSTS } from '../services/analyticsService';
import { organizationService } from '../services/organizationService';
import { CommercialPolicies } from '../src/data/commercialPolicies';
import { UserInviteModal } from './users/UserInviteModal';
import { AllyCreateModal } from './users/AllyCreateModal';
import { AllyEditModal } from './users/AllyEditModal';
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
  FileText,
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
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [alliesList, setAlliesList] = useState<Ally[]>(DEMO_ALLIES);
  const [usersList, setUsersList] = useState<ManagedUser[]>([]);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAllyModal, setShowAllyModal] = useState(false);
  const [showEditAllyModal, setShowEditAllyModal] = useState(false);
  const [editingAlly, setEditingAlly] = useState<Ally | null>(null);
  const [defaultAllyId, setDefaultAllyId] = useState(currentAllyId);

  // Feedback & Action state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Load real organizations and members from Supabase / Backend
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setIsLoadingData(true);
      try {
        // 1. Fetch real organizations
        const orgs = await organizationService.listOrganizations();
        if (isMounted && orgs.length > 0) {
          setAlliesList(orgs);
          if (!defaultAllyId || defaultAllyId === 'ally-100' || defaultAllyId === 'csa-global') {
            setDefaultAllyId(orgs[0]?.id || '');
          }
        }

        // 2. Fetch real users directory
        const directoryUsers = await organizationService.getDirectory();
        if (isMounted && directoryUsers.length > 0) {
          setUsersList(directoryUsers);
        } else if (currentAllyId && currentAllyId.length === 36) {
          // Fallback to org members if directory RPC was not available
          const members = await organizationService.listMembers(currentAllyId);
          if (isMounted && members.length > 0) {
            const orgMap = new Map((orgs.length > 0 ? orgs : alliesList).map((o) => [o.id, o.name]));
            const remoteUsers: ManagedUser[] = members.map((m) => ({
              id: m.id,
              name: m.user_id.includes('@') ? m.user_id.split('@')[0]! : m.user_id,
              email: m.user_id.includes('@') ? m.user_id : `${m.user_id}@correduria.com`,
              role: m.role,
              allyId: m.org_id,
              allyName: orgMap.get(m.org_id) || 'Correduría Aliada',
              status: 'ACTIVE',
              createdAt: m.created_at ? m.created_at.split('T')[0]! : '2026-01-01',
            }));
            setUsersList(remoteUsers);
          }
        }
      } catch (err) {
        console.warn('Could not load directory or organizations from server', err);
      } finally {
        if (isMounted) setIsLoadingData(false);
      }
    };
    loadData();
    return () => {
      isMounted = false;
    };
  }, [currentUserRole, currentAllyId]);

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

  const handleInviteUser = async (userData: {
    name: string;
    email: string;
    password?: string;
    role: UserRole;
    allyId: string;
  }) => {
    const selectedAlly =
      alliesList.find((a) => a.id === userData.allyId) ||
      alliesList[0] || { id: userData.allyId, name: 'Correduría General' };

    setFeedback(null);
    try {
      const res = await organizationService.inviteUser({
        email: userData.email.trim(),
        name: userData.name.trim(),
        role: userData.role,
        orgId: selectedAlly.id,
        password: userData.password?.trim() || undefined,
      });

      const newUser: ManagedUser = {
        id: res.user?.id || `user-${Date.now()}`,
        name: userData.name.trim(),
        email: userData.email.trim(),
        role: userData.role,
        allyId: selectedAlly.id,
        allyName: selectedAlly.name,
        status: 'ACTIVE',
        createdAt: new Date().toISOString().split('T')[0]!,
      };

      setUsersList([newUser, ...usersList.filter((u) => u.email !== userData.email.trim())]);
      setFeedback({
        type: 'success',
        message: `Usuario ${userData.name} autorizado y registrado exitosamente con rol ${userData.role}.`,
      });
    } catch (err: unknown) {
      console.warn('Could not invite user via API, attempting member binding fallback', err);
      try {
        await organizationService.addMember(selectedAlly.id, {
          user_id: userData.email.trim(),
          role: userData.role,
        });
        const newUser: ManagedUser = {
          id: `user-${Date.now()}`,
          name: userData.name,
          email: userData.email,
          role: userData.role,
          allyId: selectedAlly.id,
          allyName: selectedAlly.name,
          status: 'ACTIVE',
          createdAt: new Date().toISOString().split('T')[0]!,
        };
        setUsersList([newUser, ...usersList]);
        setFeedback({
          type: 'success',
          message: `Usuario ${userData.name} vinculado a la correduría ${selectedAlly.name}.`,
        });
      } catch (fallbackErr: any) {
        setFeedback({
          type: 'error',
          message: fallbackErr?.message || 'Error registrando usuario en la plataforma',
        });
        throw fallbackErr;
      }
    }
  };

  const handleCreateAlly = async (allyData: {
    name: string;
    nit?: string;
    contactEmail?: string;
    contactPhone?: string;
  }) => {
    setFeedback(null);
    let createdAlly: Ally | null = null;
    try {
      createdAlly = await organizationService.createOrganization({
        name: allyData.name.trim(),
        nit: allyData.nit?.trim() || undefined,
        contact_email: allyData.contactEmail?.trim() || undefined,
        phone: allyData.contactPhone?.trim() || undefined,
      });
      setFeedback({
        type: 'success',
        message: `Correduría aliada "${allyData.name}" registrada exitosamente.`,
      });
    } catch (err: any) {
      console.warn('Could not persist organization to backend, updating local state', err);
      setFeedback({
        type: 'error',
        message: err.message || 'Error al persistir correduría aliada',
      });
    }

    const newAlly: Ally = createdAlly || {
      id: `ally-${Date.now()}`,
      name: allyData.name.trim(),
      nit: allyData.nit?.trim() || '900.000.000-0',
      contact_email: allyData.contactEmail?.trim() || undefined,
      phone: allyData.contactPhone?.trim() || undefined,
      status: 'ACTIVE',
      createdAt: new Date().toISOString().split('T')[0],
    };

    setAlliesList([...alliesList, newAlly]);
  };

  const handleOpenEditAlly = (ally: Ally) => {
    setEditingAlly(ally);
    setShowEditAllyModal(true);
  };

  const handleUpdateAlly = async (
    allyId: string,
    updates: {
      name: string;
      nit?: string;
      contactPhone?: string;
      contactEmail?: string;
      status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    },
    commercialPolicies?: CommercialPolicies
  ) => {
    setFeedback(null);
    try {
      const updated = await organizationService.updateOrganization(allyId, {
        name: updates.name.trim(),
        nit: updates.nit?.trim() || undefined,
        contact_email: updates.contactEmail?.trim() || undefined,
        phone: updates.contactPhone?.trim() || undefined,
        status: updates.status,
        settings: commercialPolicies
          ? {
              ...(editingAlly?.settings || {}),
              commercial_policies: commercialPolicies,
            }
          : editingAlly?.settings,
      });

      if (commercialPolicies) {
        try {
          await organizationService.updateCommercialPolicies(allyId, commercialPolicies);
        } catch (policyErr) {
          console.warn('Could not update ally commercial policies route', policyErr);
        }
      }

      setAlliesList(
        alliesList.map((a) =>
          a.id === allyId
            ? { ...a, ...updated, ...(commercialPolicies ? { commercialPolicies } : {}) }
            : a
        )
      );
      setFeedback({
        type: 'success',
        message: `Correduría "${updates.name}" y sus políticas comerciales actualizadas exitosamente.`,
      });
      setShowEditAllyModal(false);
      setEditingAlly(null);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error al actualizar información de la correduría',
      });
      throw err;
    }
  };

  const handleDeleteAlly = async (allyId: string, allyName: string) => {
    if (!window.confirm(`¿Está seguro de eliminar la correduría "${allyName}"? Esta acción desvinculará sus registros asociados.`)) {
      return;
    }

    setIsSubmitting(true);
    try {
      await organizationService.deleteOrganization(allyId);
      setAlliesList(alliesList.filter((a) => a.id !== allyId));
      setFeedback({
        type: 'success',
        message: `Correduría "${allyName}" eliminada correctamente del sistema.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error eliminando correduría',
      });
    } finally {
      setIsSubmitting(false);
    }
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

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-medium flex items-center justify-between transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === 'success' ? (
              <CheckCircle size={16} className="text-emerald-600 shrink-0" />
            ) : (
              <XCircle size={16} className="text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-700 ml-4"
          >
            <X size={14} />
          </button>
        </div>
      )}

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
          {isLoadingData ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent mb-2"></div>
              <p>Cargando directorio de usuarios desde la base de datos...</p>
            </div>
          ) : visibleUsers.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              No se encontraron usuarios registrados en el sistema.
            </div>
          ) : (
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
          )}
        </div>
      )}

      {/* VIEW: ALLIES TABLE (Super Admin) */}
      {activeTab === 'ALLIES' && currentUserRole === 'super_admin' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {isLoadingData ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent mb-2"></div>
              <p>Cargando organizaciones aliadas...</p>
            </div>
          ) : alliesList.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              No hay organizaciones aliadas registradas.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Correduría / Aliado</th>
                    <th className="px-6 py-4">NIT</th>
                    <th className="px-6 py-4">Contacto / Tel</th>
                    <th className="px-6 py-4">Fecha Alta</th>
                    <th className="px-6 py-4">Estado</th>
                    <th className="px-6 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {alliesList.map((ally) => (
                    <tr key={ally.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900 flex items-center space-x-2">
                        <Building className="text-indigo-600" size={18} />
                        <div>
                          <span>{ally.name}</span>
                          <span className="block text-[10px] font-mono text-slate-400 font-normal">
                            {ally.id}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-600">{ally.nit || '—'}</td>
                      <td className="px-6 py-4 text-xs text-slate-600">
                        {ally.contact_email || ally.phone ? (
                          <div>
                            <div>{ally.contact_email || ''}</div>
                            <div className="text-slate-400 text-[11px]">{ally.phone || ''}</div>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {ally.createdAt || '2025-10-01'}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            ally.status === 'INACTIVE'
                              ? 'bg-slate-100 text-slate-600'
                              : ally.status === 'SUSPENDED'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {ally.status === 'INACTIVE'
                            ? 'Inactivo'
                            : ally.status === 'SUSPENDED'
                              ? 'Suspendido'
                              : 'Vigente'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenEditAlly(ally)}
                          className="px-2.5 py-1 text-xs font-bold text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded-lg transition-colors inline-flex items-center space-x-1"
                        >
                          <Edit2 size={13} />
                          <span>Editar</span>
                        </button>
                        <button
                          onClick={() => handleDeleteAlly(ally.id, ally.name)}
                          className="px-2.5 py-1 text-xs font-bold text-rose-600 hover:text-rose-900 hover:bg-rose-50 rounded-lg transition-colors inline-flex items-center space-x-1"
                        >
                          <Trash2 size={13} />
                          <span>Eliminar</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal: Crear Usuario */}
      <UserInviteModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        currentUserRole={currentUserRole}
        alliesList={alliesList}
        defaultAllyId={defaultAllyId}
        onInvite={handleInviteUser}
      />

      {/* Modal: Crear Aliado */}
      <AllyCreateModal
        isOpen={showAllyModal}
        onClose={() => setShowAllyModal(false)}
        onCreate={handleCreateAlly}
      />

      {/* Modal: Editar Aliado (Super Admin) */}
      <AllyEditModal
        isOpen={showEditAllyModal}
        onClose={() => {
          setShowEditAllyModal(false);
          setEditingAlly(null);
        }}
        ally={editingAlly}
        onUpdate={handleUpdateAlly}
      />
    </div>
  );
};

export default UserManagement;
