import React, { useState, useEffect } from 'react';
import { UserRole, Ally } from '../types';
import { DEMO_ALLIES, DEMO_ANALYSTS } from '../services/analyticsService';
import { organizationService } from '../services/organizationService';
import {
  CommercialPolicies,
  DEFAULT_COMMERCIAL_POLICIES,
  getEffectiveCommercialPolicies,
} from '../src/data/commercialPolicies';
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
  RotateCcw,
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

  // New User State
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('ally_technical');
  const [newUserAllyId, setNewUserAllyId] = useState(currentAllyId);

  // New Ally State
  const [newAllyName, setNewAllyName] = useState('');
  const [newAllyNit, setNewAllyNit] = useState('');
  const [newAllyEmail, setNewAllyEmail] = useState('');
  const [newAllyPhone, setNewAllyPhone] = useState('');

  // Edit Ally State
  const [editAllyName, setEditAllyName] = useState('');
  const [editAllyNit, setEditAllyNit] = useState('');
  const [editAllyEmail, setEditAllyEmail] = useState('');
  const [editAllyPhone, setEditAllyPhone] = useState('');
  const [editAllyStatus, setEditAllyStatus] = useState<'ACTIVE' | 'INACTIVE' | 'SUSPENDED'>('ACTIVE');
  const [editCommercialPolicies, setEditCommercialPolicies] = useState<CommercialPolicies>(DEFAULT_COMMERCIAL_POLICIES);
  const [showPoliciesSection, setShowPoliciesSection] = useState(false);

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
          if (!newUserAllyId || newUserAllyId === 'ally-100' || newUserAllyId === 'csa-global') {
            setNewUserAllyId(orgs[0]?.id || '');
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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail) return;

    const selectedAlly = alliesList.find((a) => a.id === newUserAllyId) || alliesList[0]!;
    const roleToAssign = currentUserRole === 'ally_admin' ? 'ally_technical' : newUserRole;

    setIsSubmitting(true);
    setFeedback(null);

    try {
      // Create or invite real user in Supabase Auth & Organization
      const res = await organizationService.inviteUser({
        email: newUserEmail.trim(),
        name: newUserName.trim(),
        role: roleToAssign,
        orgId: selectedAlly.id,
        password: newUserPassword.trim() || undefined,
      });

      const newUser: ManagedUser = {
        id: res.user?.id || `user-${Date.now()}`,
        name: newUserName.trim(),
        email: newUserEmail.trim(),
        role: roleToAssign,
        allyId: selectedAlly.id,
        allyName: selectedAlly.name,
        status: 'ACTIVE',
        createdAt: new Date().toISOString().split('T')[0]!,
      };

      setUsersList([newUser, ...usersList.filter((u) => u.email !== newUserEmail.trim())]);
      setFeedback({
        type: 'success',
        message: `Usuario ${newUserName} autorizado y registrado exitosamente con rol ${roleToAssign}.`,
      });
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setShowAddModal(false);
    } catch (err: unknown) {
      console.warn('Could not invite user via API, attempting member binding fallback', err);
      try {
        await organizationService.addMember(selectedAlly.id, {
          user_id: newUserEmail.trim(),
          role: roleToAssign,
        });
        const newUser: ManagedUser = {
          id: `user-${Date.now()}`,
          name: newUserName,
          email: newUserEmail,
          role: roleToAssign,
          allyId: selectedAlly.id,
          allyName: selectedAlly.name,
          status: 'ACTIVE',
          createdAt: new Date().toISOString().split('T')[0]!,
        };
        setUsersList([newUser, ...usersList]);
        setFeedback({
          type: 'success',
          message: `Usuario ${newUserName} vinculado a la correduría ${selectedAlly.name}.`,
        });
        setNewUserName('');
        setNewUserEmail('');
        setShowAddModal(false);
      } catch (fallbackErr: any) {
        setFeedback({
          type: 'error',
          message: fallbackErr?.message || 'Error registrando usuario en la plataforma',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateAlly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAllyName) return;

    setIsSubmitting(true);
    setFeedback(null);

    let createdAlly: Ally | null = null;
    try {
      createdAlly = await organizationService.createOrganization({
        name: newAllyName.trim(),
        nit: newAllyNit.trim() || undefined,
        contact_email: newAllyEmail.trim() || undefined,
        phone: newAllyPhone.trim() || undefined,
      });
      setFeedback({
        type: 'success',
        message: `Correduría aliada "${newAllyName}" registrada exitosamente.`,
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
      name: newAllyName.trim(),
      nit: newAllyNit.trim() || '900.000.000-0',
      contact_email: newAllyEmail.trim() || undefined,
      phone: newAllyPhone.trim() || undefined,
      status: 'ACTIVE',
      createdAt: new Date().toISOString().split('T')[0],
    };

    setAlliesList([...alliesList, newAlly]);
    setNewAllyName('');
    setNewAllyNit('');
    setNewAllyEmail('');
    setNewAllyPhone('');
    setShowAllyModal(false);
    setIsSubmitting(false);
  };

  const handleOpenEditAlly = (ally: Ally) => {
    setEditingAlly(ally);
    setEditAllyName(ally.name);
    setEditAllyNit(ally.nit || '');
    setEditAllyEmail(ally.contact_email || '');
    setEditAllyPhone(ally.phone || '');
    setEditAllyStatus(ally.status || 'ACTIVE');
    setShowPoliciesSection(false);
    setShowEditAllyModal(true);

    // Load commercial policies for this ally
    organizationService
      .getCommercialPolicies(ally.id)
      .then((policies) => setEditCommercialPolicies(policies))
      .catch((err) => console.warn('Could not load ally policies', err));
  };

  const handleUpdateAlly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAlly || !editAllyName) return;

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const updated = await organizationService.updateOrganization(editingAlly.id, {
        name: editAllyName.trim(),
        nit: editAllyNit.trim() || undefined,
        contact_email: editAllyEmail.trim() || undefined,
        phone: editAllyPhone.trim() || undefined,
        status: editAllyStatus,
        settings: {
          ...(editingAlly.settings || {}),
          commercial_policies: editCommercialPolicies,
        },
      });

      // Also persist to commercial policies route
      try {
        await organizationService.updateCommercialPolicies(editingAlly.id, editCommercialPolicies);
      } catch (policyErr) {
        console.warn('Could not update ally commercial policies route', policyErr);
      }

      setAlliesList(
        alliesList.map((a) =>
          a.id === editingAlly.id
            ? { ...a, ...updated, commercialPolicies: editCommercialPolicies }
            : a
        )
      );
      setFeedback({
        type: 'success',
        message: `Correduría "${editAllyName}" y sus políticas comerciales actualizadas exitosamente.`,
      });
      setShowEditAllyModal(false);
      setEditingAlly(null);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error al actualizar información de la correduría',
      });
    } finally {
      setIsSubmitting(false);
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

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Contraseña Inicial (Opcional)
                </label>
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres (o se autogenerará)"
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Si se omite, se generará una contraseña segura temporal para el usuario.
                </p>
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

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Correo Electrónico de Contacto
                </label>
                <input
                  type="email"
                  value={newAllyEmail}
                  onChange={(e) => setNewAllyEmail(e.target.value)}
                  placeholder="contacto@correduria.com"
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Teléfono / Celular
                </label>
                <input
                  type="tel"
                  value={newAllyPhone}
                  onChange={(e) => setNewAllyPhone(e.target.value)}
                  placeholder="+57 300 123 4567"
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
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar Aliado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Aliado (Super Admin) */}
      {showEditAllyModal && editingAlly && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="text-indigo-600" size={18} />
                <span>Editar Correduría Aliada</span>
              </h3>
              <button
                onClick={() => {
                  setShowEditAllyModal(false);
                  setEditingAlly(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateAlly} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nombre de la Correduría
                </label>
                <input
                  type="text"
                  required
                  value={editAllyName}
                  onChange={(e) => setEditAllyName(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">NIT</label>
                  <input
                    type="text"
                    value={editAllyNit}
                    onChange={(e) => setEditAllyNit(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Teléfono / Celular
                  </label>
                  <input
                    type="tel"
                    value={editAllyPhone}
                    onChange={(e) => setEditAllyPhone(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  value={editAllyEmail}
                  onChange={(e) => setEditAllyEmail(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Estado de la Correduría
                </label>
                <select
                  value={editAllyStatus}
                  onChange={(e) =>
                    setEditAllyStatus(e.target.value as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED')
                  }
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                >
                  <option value="ACTIVE">Vigente / Activa</option>
                  <option value="INACTIVE">Inactiva</option>
                  <option value="SUSPENDED">Suspendida</option>
                </select>
              </div>

              {/* Políticas Comerciales Accordion */}
              <div className="border border-indigo-100 rounded-xl bg-indigo-50/50 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowPoliciesSection(!showPoliciesSection)}
                  className="w-full p-3 flex justify-between items-center text-xs font-bold text-indigo-900 hover:bg-indigo-50 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <FileText size={15} className="text-indigo-600" />
                    <span>Políticas Comerciales de Oferta ({editCommercialPolicies.offerValidityDays} días)</span>
                  </span>
                  <span className="text-[11px] text-indigo-600 underline">
                    {showPoliciesSection ? 'Ocultar' : 'Configurar'}
                  </span>
                </button>

                {showPoliciesSection && (
                  <div className="p-3.5 border-t border-indigo-100 bg-white space-y-3 animate-in fade-in">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-slate-500">
                        Inyectadas en exportaciones PDF y Excel.
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditCommercialPolicies({ ...DEFAULT_COMMERCIAL_POLICIES })}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
                      >
                        <RotateCcw size={12} />
                        <span>Restablecer Estándar</span>
                      </button>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-0.5">
                        Validez de la Oferta (días)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="90"
                        value={editCommercialPolicies.offerValidityDays}
                        onChange={(e) =>
                          setEditCommercialPolicies((p) => ({
                            ...p,
                            offerValidityDays: parseInt(e.target.value) || 15,
                          }))
                        }
                        className="w-32 border border-slate-300 rounded-lg p-1.5 text-xs font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-0.5">
                        Condiciones de Pago
                      </label>
                      <textarea
                        rows={2}
                        value={editCommercialPolicies.paymentConditions}
                        onChange={(e) =>
                          setEditCommercialPolicies((p) => ({ ...p, paymentConditions: e.target.value }))
                        }
                        className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-0.5">
                        Requisitos de Inspección
                      </label>
                      <textarea
                        rows={2}
                        value={editCommercialPolicies.inspectionRequirements}
                        onChange={(e) =>
                          setEditCommercialPolicies((p) => ({
                            ...p,
                            inspectionRequirements: e.target.value,
                          }))
                        }
                        className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-0.5">
                        Requisitos de Emisión
                      </label>
                      <textarea
                        rows={2}
                        value={editCommercialPolicies.issuanceRequirements}
                        onChange={(e) =>
                          setEditCommercialPolicies((p) => ({
                            ...p,
                            issuanceRequirements: e.target.value,
                          }))
                        }
                        className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-0.5">
                        Atención de Siniestros (Art. 1075 C.Co.)
                      </label>
                      <textarea
                        rows={2}
                        value={editCommercialPolicies.claimsPolicy}
                        onChange={(e) =>
                          setEditCommercialPolicies((p) => ({ ...p, claimsPolicy: e.target.value }))
                        }
                        className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-0.5">
                        Alcance de Intermediación
                      </label>
                      <textarea
                        rows={2}
                        value={editCommercialPolicies.intermediationScope}
                        onChange={(e) =>
                          setEditCommercialPolicies((p) => ({
                            ...p,
                            intermediationScope: e.target.value,
                          }))
                        }
                        className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditAllyModal(false);
                    setEditingAlly(null);
                  }}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Actualizando...' : 'Guardar Cambios'}
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
