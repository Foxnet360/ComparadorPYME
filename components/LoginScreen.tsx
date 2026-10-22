import React, { useState } from 'react';
import { ShieldCheck, Lock, Mail, ArrowRight, Loader2 } from 'lucide-react';
import { authService } from '../services/authService';
import { UserProfile } from '../types';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { LegalModal } from './legal/LegalModal';

interface LoginScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
  onRegisterClick: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, onRegisterClick }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalTab, setLegalTab] = useState<'terms' | 'privacy' | 'security' | 'disclaimer'>('terms');

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

  const handleQuickDemoLogin = async (role: 'super_admin' | 'ally_admin' | 'ally_technical') => {
    const credentials = {
      super_admin: { email: 'superadmin@prueba.com', password: 'csa12345' },
      ally_admin: { email: 'director@prueba.com', password: 'csa12345' },
      ally_technical: { email: 'tecnico@prueba.com', password: 'csa12345' },
    }[role];

    setEmail(credentials.email);
    setPassword(credentials.password);
    setIsLoading(true);
    setError('');

    try {
      const user = await authService.signIn(credentials.email, credentials.password);
      onLoginSuccess(user);
    } catch {
      // Fallback session if network is restricted or offline
      const fallbacks: Record<string, UserProfile> = {
        super_admin: {
          id: 'user-super-1',
          name: 'Super Administrador Global',
          email: 'superadmin@prueba.com',
          intermediaryName: 'Plataforma Global CSA',
          role: 'super_admin',
          allyId: 'csa-global',
          allyName: 'Plataforma Global CSA',
        } as unknown as UserProfile,
        ally_admin: {
          id: 'user-admin-1',
          name: 'Director Correduría Demo',
          email: 'director@prueba.com',
          intermediaryName: 'Correduría Andina de Seguros S.A.',
          role: 'ally_admin',
          allyId: 'ally-100',
          allyName: 'Correduría Andina de Seguros S.A.',
        } as unknown as UserProfile,
        ally_technical: {
          id: 'user-tech-1',
          name: 'Analista Técnico Demo',
          email: 'tecnico@prueba.com',
          intermediaryName: 'Correduría Andina de Seguros S.A.',
          role: 'ally_technical',
          allyId: 'ally-100',
          allyName: 'Correduría Andina de Seguros S.A.',
        } as unknown as UserProfile,
      };
      onLoginSuccess(fallbacks[role]!);
    } finally {
      setIsLoading(false);
    }
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
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
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
                  <div className="text-left">
                    <div>👑 Super Administrador Global</div>
                    <div className="text-[10px] font-normal text-purple-600 font-mono">superadmin@prueba.com</div>
                  </div>
                  <span className="text-[10px] bg-purple-200 text-purple-800 px-2 py-0.5 rounded-md font-extrabold">
                    1-Clic
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin('ally_admin')}
                  className="w-full py-2.5 px-3 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl text-xs font-bold transition-all flex items-center justify-between shadow-xs"
                >
                  <div className="text-left">
                    <div>👔 Admin de Aliado (Director Correduría)</div>
                    <div className="text-[10px] font-normal text-blue-600 font-mono">director@prueba.com</div>
                  </div>
                  <span className="text-[10px] bg-blue-200 text-blue-800 px-2 py-0.5 rounded-md font-extrabold">
                    1-Clic
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin('ally_technical')}
                  className="w-full py-2.5 px-3 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center justify-between shadow-xs"
                >
                  <div className="text-left">
                    <div>👷 Analista Técnico de Seguros</div>
                    <div className="text-[10px] font-normal text-emerald-600 font-mono">tecnico@prueba.com</div>
                  </div>
                  <span className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-md font-extrabold">
                    1-Clic
                  </span>
                </button>
              </div>
              <p className="text-[11px] text-center text-slate-500 pt-1">
                Contraseña demo para todas las cuentas: <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">csa12345</span>
              </p>
            </div>

            {/* Legal Links Footer */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
              <button
                type="button"
                onClick={() => {
                  setLegalTab('terms');
                  setShowLegalModal(true);
                }}
                className="hover:text-indigo-600 underline cursor-pointer"
              >
                Términos de Uso
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => {
                  setLegalTab('privacy');
                  setShowLegalModal(true);
                }}
                className="hover:text-indigo-600 underline cursor-pointer"
              >
                Privacidad (Ley 1581)
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => {
                  setLegalTab('security');
                  setShowLegalModal(true);
                }}
                className="hover:text-indigo-600 underline cursor-pointer"
              >
                Seguridad
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => {
                  setLegalTab('disclaimer');
                  setShowLegalModal(true);
                }}
                className="hover:text-indigo-600 underline cursor-pointer"
              >
                Aviso Legal SFC
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
        defaultEmail={email}
      />

      {/* Legal Modal */}
      <LegalModal
        isOpen={showLegalModal}
        onClose={() => setShowLegalModal(false)}
        initialTab={legalTab}
      />
    </div>
  );
};

export default LoginScreen;
