import React, { useState } from 'react';
import { Mail, KeyRound, ArrowLeft, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { authService } from '../services/authService';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmail?: string;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  defaultEmail = '',
}) => {
  const [email, setEmail] = useState(defaultEmail);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Por favor ingresa un correo electrónico corporativo válido.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      await authService.resetPassword(email);
      setIsSuccess(true);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Ocurrió un error al enviar el correo de recuperación. Intenta nuevamente.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetState = () => {
    setError(null);
    setIsSuccess(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <KeyRound className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">Recuperar Contraseña</h3>
          </div>
          <button
            type="button"
            onClick={handleResetState}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isSuccess ? (
            <div className="space-y-4 text-center py-2">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="font-bold text-slate-900 text-base">¡Enlace Enviado con Éxito!</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Hemos enviado las instrucciones para restablecer tu contraseña al correo{' '}
                <strong className="text-slate-800 font-mono">{email}</strong>.
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-left text-xs text-amber-800">
                <span className="font-bold block mb-0.5">ℹ️ Revisa tu bandeja de entrada</span>
                Haz clic en el enlace que recibas para crear tu nueva contraseña. Si no lo encuentras en unos minutos, revisa tu carpeta de correo no deseado (Spam).
              </div>
              <button
                type="button"
                onClick={handleResetState}
                className="w-full py-2.5 px-4 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-xs mt-2"
              >
                Volver al Inicio de Sesión
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Ingresa el correo electrónico corporativo asociado a tu cuenta. Te enviaremos un
                enlace seguro para restablecer tu contraseña.
              </p>

              <div>
                <label htmlFor="recovery-email" className="block text-xs font-semibold text-slate-700 mb-1">
                  Correo Electrónico
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    id="recovery-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@correduria.com"
                    className="block w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleResetState}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <span>Enviar Instrucciones</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordModal;
