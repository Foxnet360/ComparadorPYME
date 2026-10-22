import React, { useState } from 'react';
import { ShieldCheck, Lock, ArrowRight, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { authService } from '../services/authService';

interface ResetPasswordScreenProps {
  onSuccess: () => void;
  onBackToLogin: () => void;
}

export const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({
  onSuccess,
  onBackToLogin,
}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden. Por favor verifícalas.');
      return;
    }

    try {
      setIsLoading(true);
      await authService.updatePassword(password);
      setIsSuccess(true);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo actualizar la contraseña. El enlace puede haber expirado.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-200">
            <ShieldCheck className="text-white w-10 h-10" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Restablecer Contraseña
        </h2>
        <p className="mt-2 text-center text-xs sm:text-sm text-slate-600">
          Crea una nueva contraseña segura para tu cuenta en Comparador CSA
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-slate-200 border border-slate-100 sm:rounded-2xl sm:px-10">
          {isSuccess ? (
            <div className="text-center space-y-4 py-3">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg">
                ¡Contraseña Actualizada con Éxito!
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tu clave de acceso ha sido actualizada. Ya puedes iniciar sesión con tu nueva contraseña.
              </p>
              <button
                type="button"
                onClick={onSuccess}
                className="w-full flex justify-center py-3 px-4 rounded-xl shadow-xs text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-all cursor-pointer mt-2"
              >
                Ir a Iniciar Sesión <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="new-password"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Nueva Contraseña
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="new-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="block w-full pl-9 pr-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirm-new-password"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Confirmar Nueva Contraseña
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="confirm-new-password"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite la nueva contraseña"
                    className="block w-full pl-9 pr-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-xs text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:opacity-70 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4 mr-2" />
                    <span>Guardando cambios...</span>
                  </>
                ) : (
                  <span>Guardar Nueva Contraseña</span>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={onBackToLogin}
                  className="text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
                >
                  Volver al Inicio de Sesión
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordScreen;
