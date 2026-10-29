import React, { useState, useEffect } from 'react';
import { X, ShieldCheck } from 'lucide-react';
import { UserRole, Ally } from '../../types';

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  allyId: string;
  allyName: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  phone?: string;
}

export interface UserEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserRole: UserRole;
  alliesList: Ally[];
  user: ManagedUser | null;
  onUpdate: (
    userId: string,
    updates: {
      name?: string;
      role?: UserRole;
      orgId?: string;
      status?: 'ACTIVE' | 'INACTIVE';
      password?: string;
      phone?: string;
    }
  ) => Promise<void>;
}

export const UserEditModal: React.FC<UserEditModalProps> = ({
  isOpen,
  onClose,
  currentUserRole,
  alliesList,
  user,
  onUpdate,
}) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('ally_technical');
  const [allyId, setAllyId] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setRole(user.role || 'ally_technical');
      setAllyId(user.allyId || (alliesList[0]?.id ?? ''));
      setStatus(user.status || 'ACTIVE');
      setPassword('');
    }
  }, [user, alliesList]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onUpdate(user.id, {
        name: name.trim(),
        role: currentUserRole === 'super_admin' ? role : user.role,
        orgId: currentUserRole === 'super_admin' ? allyId : user.allyId,
        status,
        password: password.trim().length >= 6 ? password.trim() : undefined,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
        <div className="flex justify-between items-center border-b pb-3">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="text-indigo-600" size={20} />
            <h3 className="font-bold text-slate-900">Editar Usuario</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Correo Electrónico (No modificable)
            </label>
            <input
              type="email"
              disabled
              value={user.email}
              className="w-full border border-slate-200 bg-slate-100 rounded-xl p-2.5 text-xs text-slate-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Nombre Completo
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Daniel Restrepo"
              className="w-full border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {currentUserRole === 'super_admin' ? (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Rol de Usuario
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
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
                  value={allyId}
                  onChange={(e) => setAllyId(e.target.value)}
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
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Correduría Aliada
              </label>
              <input
                type="text"
                disabled
                value={user.allyName}
                className="w-full border border-slate-200 bg-slate-100 rounded-xl p-2.5 text-xs text-slate-500 cursor-not-allowed"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Estado de la Cuenta
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
              className="w-full border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ACTIVE">Activo</option>
              <option value="INACTIVE">Inactivo (Suspendido)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Restablecer Contraseña (Opcional)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Dejar en blanco para no modificar"
              className="w-full border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[10px] text-slate-400 mt-0.5">
              Si se ingresa una nueva contraseña, debe tener al menos 6 caracteres.
            </p>
          </div>

          <div className="pt-3 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
