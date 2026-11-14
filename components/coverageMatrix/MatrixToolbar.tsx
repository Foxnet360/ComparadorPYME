import React from 'react';
import {
  ListChecks,
  Download,
  Loader2,
  ShieldCheck,
  DollarSign,
  Calendar,
  Pin,
  Layers,
} from 'lucide-react';

export interface MatrixToolbarProps {
  analysisId?: string;
  isExporting: boolean;
  activeTab: 'coverages' | 'financials' | 'additional';
  onTabChange: (tab: 'coverages' | 'financials' | 'additional') => void;
  quotesCount: number;
  pinnedCount: number;
  onResetPinned: () => void;
  totalSublimits: number;
  allSublimitsCollapsed: boolean;
  onToggleAllSublimits: () => void;
  onExportExcel: (exportMode: 'technical' | 'client') => void;
}

export const MatrixToolbar: React.FC<MatrixToolbarProps> = ({
  analysisId,
  isExporting,
  activeTab,
  onTabChange,
  quotesCount,
  pinnedCount,
  onResetPinned,
  totalSublimits,
  allSublimitsCollapsed,
  onToggleAllSublimits,
  onExportExcel,
}) => {
  return (
    <>
      {/* Header Panel with Premium Title & Export Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 p-6 rounded-2xl shadow-lg border border-slate-700 text-white">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <ListChecks className="text-blue-400" size={24} />
            Análisis de Cotizaciones Unificado
          </h2>
          <p className="text-xs md:text-sm text-slate-300 mt-1">
            Visualización interactiva con paridad total de filas del reporte técnico en Excel.
          </p>
        </div>
        {analysisId && (
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => onExportExcel('client')}
              disabled={isExporting}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs md:text-sm transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Descarga el Excel consultivo para el cliente final, con explicaciones descriptivas del ramo"
            >
              {isExporting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              <span>Excel Cliente (Asesoría)</span>
            </button>
            <button
              type="button"
              onClick={() => onExportExcel('technical')}
              disabled={isExporting}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs md:text-sm transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Descarga la matriz técnica completa con auditoría de riesgos, deducibles y coberturas"
            >
              {isExporting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              <span>Excel Técnico (Auditoría)</span>
            </button>
          </div>
        )}
      </div>

      {/* Segmented Premium Tab Controls & Sublimit Folding Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 max-w-lg shadow-inner">
          <button
            type="button"
            onClick={() => onTabChange('coverages')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs md:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'coverages'
                ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <ShieldCheck size={16} />
            Bienes y Coberturas
          </button>
          <button
            type="button"
            onClick={() => onTabChange('financials')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs md:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'financials'
                ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <DollarSign size={16} />
            Primas y Costos
          </button>
          <button
            type="button"
            onClick={() => onTabChange('additional')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs md:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'additional'
                ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Calendar size={16} />
            Información Adicional
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {quotesCount >= 3 && (
            <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 text-xs shadow-sm">
              <span className="text-slate-500 font-medium px-2 flex items-center gap-1">
                <Pin size={12} className="text-indigo-600" />
                Frente a Frente:
              </span>
              {pinnedCount > 0 ? (
                <button
                  type="button"
                  onClick={onResetPinned}
                  className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-semibold hover:bg-indigo-100 transition-colors cursor-pointer"
                  title="Restablecer vista completa de todas las aseguradoras"
                >
                  Ver todas ({quotesCount}) ✕
                </button>
              ) : (
                <span className="text-slate-400 text-[11px] pr-2">
                  (Haz clic en 📌 de la cabecera para aislar)
                </span>
              )}
            </div>
          )}

          {totalSublimits > 0 && activeTab === 'coverages' && (
            <button
              type="button"
              onClick={onToggleAllSublimits}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all shadow-sm active:scale-95 cursor-pointer"
              title="Plegar o desplegar sublímites agrupados bajo coberturas principales"
            >
              <Layers size={15} className="text-blue-600" />
              <span>
                {allSublimitsCollapsed
                  ? `Expandir sublímites (${totalSublimits})`
                  : `Plegar sublímites (${totalSublimits})`}
              </span>
            </button>
          )}
        </div>
      </div>
    </>
  );
};
