import React, { useState } from 'react';
import { FileText, Loader2, Plus, Search, Trash2, Upload } from 'lucide-react';
import type { CumplimientoCase, CumplimientoCaseType } from '../../types';

interface CumplimientoCaseListProps {
  cases: CumplimientoCase[];
  loading: boolean;
  extracting: boolean;
  onSelectCase: (item: CumplimientoCase) => void;
  onDeleteCase: (id: string) => Promise<void>;
  onCreateFromDocuments: (params: {
    files: File[];
    caseType: CumplimientoCaseType;
    isNewClient: boolean;
  }) => Promise<void>;
}

const CASE_TYPE_OPTIONS: Array<{ id: CumplimientoCaseType; label: string }> = [
  { id: 'CONTRATO', label: 'Contrato / Minuta / Orden' },
  { id: 'LICITACION', label: 'Licitación / Pliego' },
  { id: 'OTROSI', label: 'Otrosí / Modificación' },
];

export const CumplimientoCaseList: React.FC<CumplimientoCaseListProps> = ({
  cases,
  loading,
  extracting,
  onSelectCase,
  onDeleteCase,
  onCreateFromDocuments,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showNewForm, setShowNewForm] = useState(cases.length === 0);
  const [caseType, setCaseType] = useState<CumplimientoCaseType>('CONTRATO');
  const [isNewClient, setIsNewClient] = useState(true);
  const [files, setFiles] = useState<File[]>([]);

  const filtered = cases.filter((c) => {
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [c.title, c.contractor_name, c.contractor_nit, c.entity_name, c.contract_number]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });

  const handleExtract = async () => {
    if (files.length === 0) return;
    await onCreateFromDocuments({ files, caseType, isNewClient });
    setFiles([]);
    setShowNewForm(false);
  };

  return (
    <div className="space-y-6" data-testid="cumplimiento-case-list">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-indigo-200 shadow-sm">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
            Cumplimiento y Fianzas · Flujo Técnico por Momentos
          </span>
          <h3 className="text-lg font-bold text-slate-900 mt-0.5">
            Casos de Pre-póliza (Slip) y Auditoría Contractual
          </h3>
          <p className="text-xs text-slate-500">
            Extrae los requisitos del Contrato/Pliego para pedir cotización y retoma el caso para
            auditar la cotización o borrador campo a campo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewForm((prev) => !prev)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Nueva Pre-póliza
        </button>
      </div>

      {showNewForm && (
        <div
          className="bg-white p-5 rounded-2xl border-2 border-indigo-200 shadow-sm space-y-4"
          data-testid="cumplimiento-new-case-form"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Paso 1 · Cargar Documento Rector (Sin cotizaciones todavía)
            </span>
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={isNewClient}
                onChange={(e) => setIsNewClient(e.target.checked)}
                className="rounded border-slate-300"
              />
              Cliente nuevo (requiere vinculación y estudio de cupo completo)
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {CASE_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setCaseType(opt.id)}
                className={`px-3 py-2 rounded-xl border text-xs font-semibold text-left cursor-pointer ${
                  caseType === opt.id
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-indigo-300 rounded-xl bg-indigo-50/40 hover:bg-indigo-50 cursor-pointer text-center">
            <Upload className="w-6 h-6 text-indigo-600 mb-2" />
            <span className="text-xs font-semibold text-slate-800">
              {files.length > 0
                ? `${files.length} PDF(s) listo(s): ${files.map((f) => f.name).join(', ')}`
                : 'Adjuntar Contrato, Pliego de Condiciones, Minuta u Orden de Compra (PDF)'}
            </span>
            <input
              type="file"
              accept=".pdf,application/pdf"
              multiple
              onChange={(e) =>
                setFiles(
                  Array.from(e.target.files || []).filter(
                    (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
                  )
                )
              }
              className="hidden"
            />
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={files.length === 0 || extracting}
              onClick={handleExtract}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
            >
              {extracting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              {extracting ? 'Extrayendo Pre-póliza...' : 'Extraer Pre-póliza y Guardar Caso'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por contratista, NIT, entidad o # de contrato..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 font-medium"
          >
            <option value="ALL">Todos los estados</option>
            <option value="DRAFT">Borrador</option>
            <option value="READY_TO_QUOTE">Listo para Cotizar</option>
            <option value="QUOTED">Cotizado</option>
            <option value="VALIDATED">Validado</option>
            <option value="ISSUED">Emitido</option>
            <option value="MODIFICATION_PENDING">Otrosí Pendiente</option>
          </select>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-500">Cargando casos guardados...</div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No hay casos registrados todavía. Crea tu primera Pre-póliza adjuntando un contrato o
            pliego.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/70 px-2 rounded-xl"
              >
                <button
                  type="button"
                  onClick={() => onSelectCase(item)}
                  className="text-left flex-1 cursor-pointer"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-900">{item.title}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                      {item.case_type}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {item.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Tomador: {item.contractor_name || 'Sin definir'} ({item.contractor_nit || 'S/N'}
                    ) · Entidad: {item.entity_name || 'Sin definir'} · Actualizado:{' '}
                    {new Date(item.updated_at).toLocaleDateString('es-CO')}
                  </p>
                </button>
                <button
                  type="button"
                  aria-label="Eliminar caso"
                  onClick={() => onDeleteCase(item.id)}
                  className="p-2 text-slate-400 hover:text-rose-600 cursor-pointer self-end sm:self-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
