import React, { useState } from 'react';
import { ShieldCheck, Lock, Mail, ArrowRight, Loader2 } from 'lucide-react';
import { authService } from '../services/authService';
import { UserProfile } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
  onRegisterClick: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, onRegisterClick }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const user = await authService.signIn(email, password);
      onLoginSuccess(user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Credenciales incorrectas');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoLogin = (role: 'super_admin' | 'ally_admin' | 'ally_technical') => {
    let demoUser: UserProfile;
    if (role === 'super_admin') {
      demoUser = {
        id: 'user-super-1',
        name: 'Administrador General (Super Admin)',
        email: 'superadmin@comparadorcsa.com',
        intermediaryName: 'Plataforma Global CSA',
        role: 'super_admin',
      } as unknown as UserProfile;
    } else if (role === 'ally_admin') {
      demoUser = {
        id: 'user-admin-1',
        name: 'Roberto Silva (Director Correduría)',
        email: 'roberto.silva@andina.com',
        intermediaryName: 'Correduría Andina de Seguros S.A.',
        role: 'ally_admin',
        allyId: 'ally-100',
        allyName: 'Correduría Andina de Seguros S.A.',
      } as unknown as UserProfile;
    } else {
      demoUser = {
        id: 'user-tech-1',
        name: 'Carlos Mendoza (Técnico Senior)',
        email: 'carlos.mendoza@andina.com',
        intermediaryName: 'Correduría Andina de Seguros S.A.',
        role: 'ally_technical',
        allyId: 'ally-100',
        allyName: 'Correduría Andina de Seguros S.A.',
      } as unknown as UserProfile;
    }

    (authService as unknown as { saveSession: (user: UserProfile) => void }).saveSession(demoUser);
    onLoginSuccess(demoUser);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-indigo-600 p-3 rounded-xl shadow-lg shadow-indigo-200">
            <ShieldCheck className="text-white w-10 h-10" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900 tracking-tight">
          Agente Comparador CSA
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Acceso exclusivo para rol técnico y auditores.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-slate-200 border border-slate-100 sm:rounded-2xl sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Correo Corporativo
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-slate-300 rounded-lg p-2.5 border"
                  placeholder="tecnico@aseguradora.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Contraseña
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-slate-300 rounded-lg p-2.5 border"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg border border-red-100">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:opacity-70"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin h-5 w-5" />
                ) : (
                  <span className="flex items-center">
                    Ingresar al Sistema <ArrowRight className="ml-2 h-4 w-4" />
                  </span>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-500">¿No tienes cuenta?</span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={onRegisterClick}
                className="w-full flex justify-center py-3 px-4 border border-slate-300 rounded-xl shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all"
              >
                Crear Nueva Cuenta
              </button>
            </div>

            <div className="mt-6 text-center">
              <span className="text-xs text-slate-400">
                Versión Beta - Acceso con email verificado
              </span>
            </div>

            {/* Quick Demo Access Bar for Role Testing */}
            <div className="mt-6 pt-6 border-t border-slate-200 space-y-2.5">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider text-center">
                ⚡ Acceso Rápido de Prueba por Rol (1-Clic)
              </div>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin('super_admin')}
                  className="w-full py-2.5 px-3 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-xl text-xs font-bold transition-all flex items-center justify-between shadow-xs"
                >
                  <span>👑 Super Administrador Global</span>
                  <span className="text-[10px] bg-purple-200 text-purple-800 px-2 py-0.5 rounded-md font-extrabold">Probar Rol</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin('ally_admin')}
                  className="w-full py-2.5 px-3 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl text-xs font-bold transition-all flex items-center justify-between shadow-xs"
                >
                  <span>👔 Admin de Aliado (Director Correduría)</span>
                  <span className="text-[10px] bg-blue-200 text-blue-800 px-2 py-0.5 rounded-md font-extrabold">Probar Rol</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin('ally_technical')}
                  className="w-full py-2.5 px-3 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center justify-between shadow-xs"
                >
                  <span>👷 Analista Técnico de Seguros</span>
                  <span className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-md font-extrabold">Probar Rol</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
