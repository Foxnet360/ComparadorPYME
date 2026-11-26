import React, { useState } from 'react';
import { AlertOctagon, CheckCircle2, Copy, FileCheck2, Loader2, Upload } from 'lucide-react';
import { ClauseSelector } from '../ClauseSelector';
import type {
  CumplimientoCase,
  CumplimientoValidationRecord,
  CumplimientoValidationTarget,
} from '../../types';
import { InsuranceDomain } from '../../types';

interface CumplimientoValidationTabProps {
  caseRecord: CumplimientoCase;
  isValidating: boolean;
  onValidate: (params: {
    files: File[];
    validationTarget: CumplimientoValidationTarget;
    clauseIds: string[];
  }) => Promise<void>;
}

const TARGET_OPTIONS: Array<{ id: CumplimientoValidationTarget; label: string }> = [
  { id: 'COTIZACION', label: 'Cotización de Aseguradora' },
  { id: 'BORRADOR_POLIZA', label: 'Borrador de Póliza (Pre-emisión)' },
  { id: 'ANEXO_MODIFICACION', label: 'Anexo Modificatorio / Otrosí' },
];

function formatCop(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

export const CumplimientoValidationTab: React.FC<CumplimientoValidationTabProps> = ({
  caseRecord,
  isValidating,
  onValidate,
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [target, setTarget] = useState<CumplimientoValidationTarget>('COTIZACION');
  const [clauseIds, setClauseIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const history = caseRecord.validation_history || [];
  const latest: CumplimientoValidationRecord | undefined = history[0];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    setFiles(selected);
  };

  const handleSubmit = async () => {
    if (files.length === 0) return;
    await onValidate({ files, validationTarget: target, clauseIds });
    setFiles([]);
  };

  const handleCopyCorrections = async (record: CumplimientoValidationRecord) => {
    await navigator.clipboard.writeText(record.correctionMessage);
    setCopiedId(record.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
        <div>
          <h4 className="text-sm font-bold text-slate-900">
            Validar Cotización, Borrador de Póliza o Anexo contra esta Pre-póliza
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Carga 1 documento para auditoría campo a campo (evita rechazos en la entidad
            contratante) o 2+ cotizaciones para comparar prima, tasa y contragarantía.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {TARGET_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTarget(opt.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                target === opt.id
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-indigo-50/40 cursor-pointer text-center">
            <Upload className="w-6 h-6 text-indigo-600 mb-2" />
            <span className="text-xs font-semibold text-slate-800">
              {files.length > 0
                ? `${files.length} archivo(s) PDF seleccionado(s): ${files.map((f) => f.name).join(', ')}`
                : 'Seleccionar 1 o más PDFs (Cotización / Borrador / Anexo)'}
            </span>
            <input
              type="file"
              accept=".pdf,application/pdf"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          <ClauseSelector
            mode="library"
            onModeChange={() => {}}
            onClausesSelected={setClauseIds}
            domain={InsuranceDomain.CUMPLIMIENTO}
            cumplimientoStage={caseRecord.case_type}
          />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={files.length === 0 || isValidating}
            onClick={handleSubmit}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
          >
            {isValidating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileCheck2 className="w-4 h-4" />
            )}
            {isValidating ? 'Auditando documentos...' : 'Ejecutar Auditoría Campo a Campo'}
          </button>
        </div>
      </div>

      {latest && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {latest.overallStatus === 'COMPLIANT' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <div>
                <h5 className="text-sm font-bold text-slate-900">{latest.summary}</h5>
                <p className="text-[11px] text-slate-500">
                  {latest.validationTarget} · {new Date(latest.validatedAt).toLocaleString('es-CO')}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleCopyCorrections(latest)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              {copiedId === latest.id ? 'Copiado' : 'Copiar correcciones para aseguradora'}
            </button>
          </div>

          {latest.economicComparison.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="p-2 text-left">Aseguradora</th>
                    <th className="p-2 text-right">Prima Total</th>
                    <th className="p-2 text-right">Tasa</th>
                    <th className="p-2 text-left">Contragarantía / Pago</th>
                    <th className="p-2 text-center">Bloqueantes</th>
                    <th className="p-2 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {latest.economicComparison.map((row, idx) => (
                    <tr key={`${row.fileName}-${idx}`}>
                      <td className="p-2 font-semibold text-slate-900">{row.insurerName}</td>
                      <td className="p-2 text-right">{formatCop(row.premiumAnnual)}</td>
                      <td className="p-2 text-right">
                        {row.ratePercent !== null ? `${row.ratePercent}%` : '—'}
                      </td>
                      <td className="p-2 text-slate-600">
                        {[row.counterGuarantee, row.paymentTerms].filter(Boolean).join(' · ') ||
                          '—'}
                      </td>
                      <td className="p-2 text-center font-bold">{row.blockingGapsCount}</td>
                      <td className="p-2 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            row.overallStatus === 'COMPLIANT'
                              ? 'bg-emerald-100 text-emerald-800'
                              : row.overallStatus === 'PARTIAL_GAP'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {row.overallStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-slate-200 rounded-xl overflow-hidden">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="p-2 text-left">Aseguradora</th>
                  <th className="p-2 text-left">Campo</th>
                  <th className="p-2 text-left">Exigido (Pre-póliza)</th>
                  <th className="p-2 text-left">Encontrado</th>
                  <th className="p-2 text-center">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {latest.fieldChecks.map((chk, idx) => (
                  <tr key={`${chk.fieldKey}-${idx}`}>
                    <td className="p-2 font-medium text-slate-700">{chk.insurerName || '—'}</td>
                    <td className="p-2 font-semibold text-slate-900">{chk.fieldLabel}</td>
                    <td className="p-2 text-slate-600">{chk.expectedValue}</td>
                    <td className="p-2 text-slate-800">{chk.foundValue}</td>
                    <td className="p-2 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          chk.status === 'MATCH'
                            ? 'bg-emerald-100 text-emerald-800'
                            : chk.severity === 'BLOCKING'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {chk.status === 'MATCH' ? 'COINCIDE' : chk.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
