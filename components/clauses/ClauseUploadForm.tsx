import React from 'react';
import { ShieldCheck, Sparkles, Upload } from 'lucide-react';
import { CLAUSE_DOMAIN_OPTIONS, type ClauseUploadFormData } from './clauseMetadata';

interface ClauseUploadFormProps {
  hasUser: boolean;
  formData: ClauseUploadFormData;
  selectedFile: File | null;
  uploading: boolean;
  onFormDataChange: (next: ClauseUploadFormData) => void;
  onFileSelect: (file: File | null) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const ClauseUploadForm: React.FC<ClauseUploadFormProps> = ({
  hasUser,
  formData,
  selectedFile,
  uploading,
  onFormDataChange,
  onFileSelect,
  onSubmit,
}) => (
  <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-5 shadow-xs">
    <div className="flex items-center gap-2 mb-4">
      <Sparkles size={16} className="text-indigo-600" />
      <h3 className="font-bold text-sm text-slate-800">Subir Nuevo Clausulado al Repositorio</h3>
    </div>

    {hasUser ? (
      <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Aseguradora</label>
          <input
            type="text"
            placeholder="Ej: AXA COLPATRIA, SURA, HDI"
            value={formData.insurerName}
            onChange={(e) =>
              onFormDataChange({ ...formData, insurerName: e.target.value.toUpperCase() })
            }
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Nombre del Documento
          </label>
          <input
            type="text"
            placeholder="Ej: Clausulado PYME Todo Riesgo"
            value={formData.documentName}
            onChange={(e) => onFormDataChange({ ...formData, documentName: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Ramo de Seguros</label>
          <select
            value={formData.domain}
            onChange={(e) => onFormDataChange({ ...formData, domain: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors cursor-pointer"
          >
            {CLAUSE_DOMAIN_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Tipo de Documento
          </label>
          <select
            value={formData.documentType}
            onChange={(e) => onFormDataChange({ ...formData, documentType: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors cursor-pointer"
          >
            <option value="CLAUSULADO_GENERAL">Clausulado General</option>
            <option value="CLAUSULADO_PARTICULAR">Clausulado Particular</option>
            <option value="ANEXO">Anexo de Coberturas</option>
            <option value="COTIZACION">Cotización / Resumen</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Versión / Año</label>
          <input
            type="text"
            placeholder="Ej: 2026.1"
            value={formData.version}
            onChange={(e) => onFormDataChange({ ...formData, version: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Archivo (PDF)</label>
            <label className="border border-slate-200 rounded-xl px-3 py-2 bg-white cursor-pointer flex items-center justify-center hover:bg-slate-50 transition-colors h-[38px] text-xs text-slate-600">
              <span className="truncate">
                {selectedFile ? selectedFile.name : '📄 Seleccionar PDF'}
              </span>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  onFileSelect(file);
                  if (file && !formData.documentName) {
                    onFormDataChange({
                      ...formData,
                      documentName: file.name.replace(/\.pdf$/i, ''),
                    });
                  }
                }}
                className="hidden"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={uploading || !formData.insurerName || !formData.documentName || !selectedFile}
            className="bg-indigo-600 text-white font-semibold rounded-xl px-4 py-2 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors h-[38px] text-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {uploading ? (
              <>
                <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                <span>Subiendo...</span>
              </>
            ) : (
              <>
                <Upload size={14} />
                <span>Subir</span>
              </>
            )}
          </button>
        </div>
      </form>
    ) : (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-xs flex items-start gap-2">
        <ShieldCheck size={16} className="mt-0.5 flex-shrink-0 text-amber-600" />
        <span>
          La carga y gestión de clausulados requiere inicio de sesión. Inicia sesión con tu cuenta
          para agregar o modificar documentos del repositorio; la consulta es de acceso libre.
        </span>
      </div>
    )}
  </div>
);
