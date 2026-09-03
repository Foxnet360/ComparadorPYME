import React from 'react';
import {
  MessageSquare,
  ShieldCheck,
  LogOut,
  LayoutDashboard,
  Library,
  Users,
  BarChart3,
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
  onOpenAnalytics: () => void;
  onOpenUsers: () => void;
  onOpenClauseAdmin: () => void;
  onToggleChat: () => void;
  onOpenProfile: () => void;
  onLogout: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentUser,
  currentView,
  showChatButton,
  chatOpen,
  onNavigateDashboard,
  onOpenClients,
  onOpenAnalytics,
  onOpenUsers,
  onOpenClauseAdmin,
  onToggleChat,
  onOpenProfile,
  onLogout,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={onNavigateDashboard}>
          <div className="bg-indigo-600 p-2 rounded-lg">
            <ShieldCheck className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-indigo-500 leading-tight hidden sm:block">
              Agente Comparador CSA
            </h1>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {currentUser && (
            <div
              onClick={onOpenProfile}
              className="hidden md:flex items-center px-3 py-1 bg-slate-100 rounded-full cursor-pointer hover:bg-slate-200 transition-colors"
            >
              <img src={currentUser.avatarUrl} alt="Avatar" className="w-6 h-6 rounded-full mr-2" />
              <span className="text-sm font-medium text-slate-700">{currentUser.name}</span>
            </div>
          )}

          {currentView !== 'DASHBOARD' && (
            <button
              onClick={onNavigateDashboard}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
              title="Ir al Dashboard"
            >
              <LayoutDashboard size={20} />
            </button>
          )}

          {/* Clientes & Auditorías Correlacionadas */}
          <button
            onClick={onOpenClients}
            className={`p-2 rounded-full transition-colors ${
              currentView === 'CLIENTS'
                ? 'bg-indigo-100 text-indigo-700 font-semibold'
                : 'text-slate-500 hover:bg-indigo-100 hover:text-indigo-600'
            }`}
            title="Gestión de Clientes y Auditorías"
          >
            <Users size={20} />
          </button>

          {/* Analítica Ejecutiva (RBAC) */}
          <button
            onClick={onOpenAnalytics}
            className={`p-2 rounded-full transition-colors ${
              currentView === 'ANALYTICS'
                ? 'bg-indigo-100 text-indigo-700 font-semibold'
                : 'text-slate-500 hover:bg-indigo-100 hover:text-indigo-600'
            }`}
            title="Analítica Ejecutiva (KPIs)"
          >
            <BarChart3 size={20} />
          </button>

          {/* Gestión de Usuarios & Aliados (RBAC) */}
          <button
            onClick={onOpenUsers}
            className={`p-2 rounded-full transition-colors ${
              currentView === 'USERS'
                ? 'bg-indigo-100 text-indigo-700 font-semibold'
                : 'text-slate-500 hover:bg-indigo-100 hover:text-indigo-600'
            }`}
            title="Gestión de Usuarios y Aliados (RBAC)"
          >
            <ShieldCheck size={20} />
          </button>

          {/* Clause Library Button (Admin) */}
          <button
            onClick={onOpenClauseAdmin}
            className="p-2 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600 rounded-full transition-colors"
            title="Biblioteca de Clausulados"
          >
            <Library size={20} />
          </button>

          {showChatButton && (
            <button
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
            onClick={onLogout}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
            title="Cerrar Sesión"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </header>
  );
};
