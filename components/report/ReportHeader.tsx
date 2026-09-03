import React from 'react';
import { ShieldAlert, FileDown, Layers } from 'lucide-react';

interface ReportHeaderProps {
  domain?: string;
  viewMode: 'technical' | 'client';
  onViewModeChange: (mode: 'technical' | 'client') => void;
  onExport: () => void;
  /** Rendered inside the header's relative container (absolute-positioned export popover). */
  exportModal?: React.ReactNode;
}

const DOMAIN_BADGE_STYLES: Record<string, string> = {
  autos: 'bg-blue-100 text-blue-800',
  copropiedades: 'bg-emerald-100 text-emerald-800',
  cumplimiento: 'bg-amber-100 text-amber-800',
  transporte: 'bg-purple-100 text-purple-800',
  salud: 'bg-rose-100 text-rose-800',
  vida_grupo: 'bg-teal-100 text-teal-800',
  hogar: 'bg-cyan-100 text-cyan-800',
};

const DOMAIN_LABELS: Record<string, string> = {
  pyme: 'PYME',
  copropiedades: 'Copropiedades',
  autos: 'Autos',
  cumplimiento: 'Cumplimiento',
  transporte: 'Transporte',
  salud: 'Salud',
  vida_grupo: 'Vida Grupo',
  hogar: 'Hogar',
};

/**
 * ARCH-1: report title, domain badge, dual view-mode selector and the
 * PDF export action. Extracted from the ComparisonReport shell.
 */
export const ReportHeader: React.FC<ReportHeaderProps> = ({
  domain,
  viewMode,
  onViewModeChange,
  onExport,
  exportModal,
}) => {
  const domainKey = domain || 'pyme';
  const domainLabel =
    DOMAIN_LABELS[domainKey] || (domain ? String(domain).toUpperCase() : 'PYME');

  return (
    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200 relative">
      <div>
        <div className="flex items-center space-x-2">
          <h2 className="text-2xl font-bold text-slate-800">Dashboard de Análisis</h2>
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
              DOMAIN_BADGE_STYLES[domainKey] || 'bg-indigo-100 text-indigo-800'
            }`}
          >
            Ramo: {domainLabel}
          </span>
        </div>
        <p className="text-sm text-slate-500">
          {viewMode === 'technical'
            ? 'Vista técnica detallada para auditores de seguros (sublímites, deducibles, confianzas).'
            : 'Resumen ejecutivo simplificado para presentación y toma de decisión del cliente.'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Dual View Mode Selector */}
        <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
          <button
            onClick={() => onViewModeChange('technical')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              viewMode === 'technical'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Vista para Auditor Técnico"
          >
            <Layers size={14} />
            Auditor Técnico
          </button>
          <button
            onClick={() => onViewModeChange('client')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              viewMode === 'client'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Vista Presentación Cliente"
          >
            <ShieldAlert size={14} />
            Cliente Final
          </button>
        </div>

        <button
          onClick={onExport}
          className="flex items-center space-x-2 bg-slate-800 text-white px-5 py-2.5 rounded-lg hover:bg-slate-700 transition-all shadow-sm text-sm font-medium"
        >
          <FileDown size={18} />
          <span className="hidden sm:inline">Exportar PDF</span>
        </button>
      </div>

      {/* Export Modal */}
      {exportModal}
    </div>
  );
};

export default ReportHeader;
