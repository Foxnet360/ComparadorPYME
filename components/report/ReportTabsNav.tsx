import React from 'react';
import { BarChart3, ShieldAlert, Scale, Layers, BookOpen } from 'lucide-react';

export type ReportTab = 'resumen' | 'coberturas' | 'deducibles' | 'auditoria' | 'analisis-avanzado';

export const REPORT_TABS: readonly ReportTab[] = [
  'resumen',
  'coberturas',
  'deducibles',
  'auditoria',
  'analisis-avanzado',
];

interface ReportTabsNavProps {
  activeTab: ReportTab;
  onTabChange: (tab: ReportTab) => void;
  hasAdvancedAnalysis: boolean;
}

const TAB_ITEMS: Array<{
  id: ReportTab;
  label: string;
  Icon: React.FC<{ size?: number }>;
  requiresAdvanced?: boolean;
}> = [
  { id: 'resumen', label: 'Dashboard Resumen', Icon: BarChart3 },
  { id: 'coberturas', label: 'Matriz de Coberturas', Icon: Layers },
  { id: 'deducibles', label: 'Deducibles', Icon: Scale },
  { id: 'auditoria', label: 'Análisis de Letra Chica y Brechas', Icon: ShieldAlert },
  { id: 'analisis-avanzado', label: 'Análisis Avanzado', Icon: BookOpen, requiresAdvanced: true },
];

export const ReportTabsNav: React.FC<ReportTabsNavProps> = ({
  activeTab,
  onTabChange,
  hasAdvancedAnalysis,
}) => (
  <div className="flex overflow-x-auto pb-2 border-b border-slate-200 gap-6">
    {TAB_ITEMS.filter((item) => !item.requiresAdvanced || hasAdvancedAnalysis).map(
      ({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => onTabChange(id)}
          className={`flex items-center space-x-2 pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === id
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Icon size={18} />
          <span>{label}</span>
        </button>
      )
    )}
  </div>
);
