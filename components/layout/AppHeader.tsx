import React, { useState } from 'react';
import {
  MessageSquare,
  ShieldCheck,
  LogOut,
  LayoutDashboard,
  Library,
  Users,
  BarChart3,
  RefreshCw,
  Building2,
  Scale,
  Menu,
  X,
} from 'lucide-react';
import type { UserProfile } from '../../types';
import type { AppView } from '../../hooks/useAnalysisFlow';

interface AppHeaderProps {
  currentUser: UserProfile | null;
  currentView: AppView;
  showChatButton: boolean;
  chatOpen: boolean;
  onNavigateDashboard: () => void;
  onOpenClients: () => void;
  onOpenPortfolio: () => void;
  onOpenAnalytics: () => void;
  onOpenUsers: () => void;
  onOpenInsurers: () => void;
  onOpenClauseAdmin: () => void;
  onToggleChat: () => void;
  onOpenProfile: () => void;
  onLogout: () => void;
  onOpenLegal?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentUser,
  currentView,
  showChatButton,
  chatOpen,
  onNavigateDashboard,
  onOpenClients,
  onOpenPortfolio,
  onOpenAnalytics,
  onOpenUsers,
  onOpenInsurers,
  onOpenClauseAdmin,
  onToggleChat,
  onOpenProfile,
  onLogout,
  onOpenLegal,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeAndRun = (action: () => void) => {
    setMobileMenuOpen(false);
    action();
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <button
          type="button"
          onClick={onNavigateDashboard}
          aria-label="Ir al inicio Agente Comparador CSA"
          className="flex items-center space-x-2 cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg"
        >
          <div className="bg-indigo-600 p-2 rounded-lg">
            <ShieldCheck className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-indigo-500 leading-tight hidden sm:block">
              Agente Comparador CSA
            </h1>
          </div>
        </button>

        <div className="hidden md:flex items-center space-x-3">
          {currentUser && (
            <button
              type="button"
              onClick={onOpenProfile}
              aria-label={`Abrir perfil de ${currentUser.name}`}
              className="flex items-center px-3 py-1 bg-slate-100 rounded-full cursor-pointer hover:bg-slate-200 transition-colors"
            >
              <img src={currentUser.avatarUrl} alt="Avatar" className="w-6 h-6 rounded-full mr-2" />
              <span className="text-sm font-medium text-slate-700">{currentUser.name}</span>
            </button>
          )}

          {currentView !== 'DASHBOARD' && (
            <button
              type="button"
              onClick={onNavigateDashboard}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
              title="Ir al Dashboard"
              aria-label="Ir al Dashboard"
            >
              <LayoutDashboard size={20} />
            </button>
          )}

          {/* Clientes & Auditorías Correlacionadas */}
          <button
            type="button"
            onClick={onOpenClients}
            className={`p-2 rounded-full transition-colors ${
              currentView === 'CLIENTS'
                ? 'bg-indigo-100 text-indigo-700 font-semibold'
                : 'text-slate-500 hover:bg-indigo-100 hover:text-indigo-600'
            }`}
            title="Gestión de Clientes y Auditorías"
            aria-label="Gestión de Clientes y Auditorías"
          >
            <Users size={20} />
          </button>

          {/* Portafolio de Renovaciones (renovacion-polizas) */}
          <button
            type="button"
            onClick={onOpenPortfolio}
            className={`p-2 rounded-full transition-colors ${
              currentView === 'PORTFOLIO'
                ? 'bg-indigo-100 text-indigo-700 font-semibold'
                : 'text-slate-500 hover:bg-indigo-100 hover:text-indigo-600'
            }`}
            title="Portafolio y Renovaciones de Pólizas"
            aria-label="Portafolio y Renovaciones de Pólizas"
          >
            <RefreshCw size={20} />
          </button>

          {/* Analítica Ejecutiva (RBAC) */}
          <button
            type="button"
            onClick={onOpenAnalytics}
            className={`p-2 rounded-full transition-colors ${
              currentView === 'ANALYTICS'
                ? 'bg-indigo-100 text-indigo-700 font-semibold'
                : 'text-slate-500 hover:bg-indigo-100 hover:text-indigo-600'
            }`}
            title="Analítica Ejecutiva (KPIs)"
            aria-label="Analítica Ejecutiva (KPIs)"
          >
            <BarChart3 size={20} />
          </button>

          {/* Gestión de Usuarios & Aliados (super_admin & ally_admin only) */}
          {currentUser &&
            (currentUser.role === 'super_admin' ||
              currentUser.role === 'ally_admin' ||
              currentUser.role === 'ADMIN') && (
              <button
                type="button"
                onClick={onOpenUsers}
                className={`p-2 rounded-full transition-colors ${
                  currentView === 'USERS'
                    ? 'bg-indigo-100 text-indigo-700 font-semibold'
                    : 'text-slate-500 hover:bg-indigo-100 hover:text-indigo-600'
                }`}
                title="Gestión de Usuarios y Aliados (RBAC)"
                aria-label="Gestión de Usuarios y Aliados (RBAC)"
              >
                <ShieldCheck size={20} />
              </button>
            )}

          {/* Gestión de Aseguradoras & RPA (super_admin only) */}
          {currentUser && (currentUser.role === 'super_admin' || currentUser.role === 'ADMIN') && (
            <button
              type="button"
              onClick={onOpenInsurers}
              className={`p-2 rounded-full transition-colors ${
                currentView === 'INSURERS'
                  ? 'bg-indigo-100 text-indigo-700 font-semibold'
                  : 'text-slate-500 hover:bg-indigo-100 hover:text-indigo-600'
              }`}
              title="Gestión de Aseguradoras y Conectores RPA"
              aria-label="Gestión de Aseguradoras y Conectores RPA"
            >
              <Building2 size={20} />
            </button>
          )}

          {/* Clause Library Button */}
          <button
            type="button"
            onClick={onOpenClauseAdmin}
            className="p-2 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600 rounded-full transition-colors"
            title="Biblioteca de Clausulados"
            aria-label="Biblioteca de Clausulados"
          >
            <Library size={20} />
          </button>

          {/* Legal and Compliance */}
          {onOpenLegal && (
            <button
              type="button"
              onClick={onOpenLegal}
              className={`p-2 rounded-full transition-colors ${
                currentView === 'LEGAL'
                  ? 'bg-indigo-100 text-indigo-700 font-semibold'
                  : 'text-slate-500 hover:bg-indigo-100 hover:text-indigo-600'
              }`}
              title="Marco Legal y Privacidad (Ley 1581)"
              aria-label="Marco Legal y Privacidad (Ley 1581)"
            >
              <Scale size={20} />
            </button>
          )}

          {showChatButton && (
            <button
              type="button"
              onClick={onToggleChat}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors font-medium text-sm ${
                chatOpen
                  ? 'bg-indigo-600 text-white'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
              }`}
            >
              <MessageSquare size={18} />
              <span className="hidden sm:inline">SeguroBot</span>
            </button>
          )}

          <button
            type="button"
            onClick={onLogout}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
            title="Cerrar Sesión"
            aria-label="Cerrar Sesión"
          >
            <LogOut size={20} />
          </button>
        </div>

        <div className="flex md:hidden items-center gap-2">
          {showChatButton && (
            <button
              type="button"
              onClick={onToggleChat}
              aria-label="Abrir SeguroBot"
              className={`p-2 rounded-lg transition-colors ${
                chatOpen ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700'
              }`}
            >
              <MessageSquare size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
            aria-expanded={mobileMenuOpen}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <nav
          aria-label="Navegación móvil"
          className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1 shadow-lg"
        >
          {currentUser && (
            <button
              type="button"
              onClick={() => closeAndRun(onOpenProfile)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <span>Perfil ({currentUser.name})</span>
            </button>
          )}
          {currentView !== 'DASHBOARD' && (
            <button
              type="button"
              onClick={() => closeAndRun(onNavigateDashboard)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100"
            >
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => closeAndRun(onOpenClients)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100"
          >
            <Users size={18} />
            <span>Gestión de Clientes y Auditorías</span>
          </button>
          <button
            type="button"
            onClick={() => closeAndRun(onOpenPortfolio)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100"
          >
            <RefreshCw size={18} />
            <span>Portafolio y Renovaciones</span>
          </button>
          <button
            type="button"
            onClick={() => closeAndRun(onOpenAnalytics)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100"
          >
            <BarChart3 size={18} />
            <span>Analítica Ejecutiva</span>
          </button>
          <button
            type="button"
            onClick={() => closeAndRun(onOpenClauseAdmin)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100"
          >
            <Library size={18} />
            <span>Biblioteca de Clausulados</span>
          </button>
          <button
            type="button"
            onClick={() => closeAndRun(onLogout)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut size={18} />
            <span>Cerrar Sesión</span>
          </button>
        </nav>
      )}
    </header>
  );
};
