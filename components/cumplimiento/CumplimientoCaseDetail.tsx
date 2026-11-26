import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Copy,
  FileDown,
  FileText,
  GitBranchPlus,
  Loader2,
  Plus,
  Save,
  Shield,
  Trash2,
} from 'lucide-react';
import { CumplimientoChecklistTab } from './CumplimientoChecklistTab';
import { CumplimientoValidationTab } from './CumplimientoValidationTab';
import { fetchOfficialTrm } from '../../services/cumplimientoService';
import {
  COLOMBIA_SMMLV_2026,
  addContractTerm,
  computeCoverageValidityDates,
} from '../../utils/colombianCalendar';
import {
  exportPrepolicyToDocx,
  exportPrepolicyToPdf,
  formatPrepolicyForClipboard,
} from '../../utils/cumplimientoSlipExport';
import type {
  CumplimientoCase,
  CumplimientoCaseStatus,
  CumplimientoChecklistItem,
  CumplimientoContractType,
  CumplimientoCoveragePhase,
  CumplimientoDisplayCurrency,
  CumplimientoDurationUnit,
  CumplimientoLegalRegime,
  CumplimientoPersonType,
  CumplimientoPrepolicyData,
  CumplimientoRceAdditionalCoverage,
  CumplimientoRequiredCoverageItem,
  CumplimientoValidationTarget,
} from '../../types';

interface CumplimientoCaseDetailProps {
  caseRecord: CumplimientoCase;
  saving: boolean;
  validating: boolean;
  creatingMod: boolean;
  onBack: () => void;
  onSave: (patch: {
    title?: string;
    status?: CumplimientoCaseStatus;
    prepolicyData?: CumplimientoPrepolicyData;
    checklistData?: CumplimientoChecklistItem[];
  }) => Promise<void>;
  onValidate: (params: {
    files: File[];
    validationTarget: CumplimientoValidationTarget;
    clauseIds: string[];
  }) => Promise<void>;
  onCreateModification: (files: File[]) => Promise<void>;
}

const CONTRACT_TYPES: Array<{ id: CumplimientoContractType; label: string }> = [
  { id: 'PRESTACION_SERVICIOS', label: 'Prestación de Servicios' },
  { id: 'OBRA', label: 'Obra' },
  { id: 'SUMINISTRO', label: 'Suministro' },
  { id: 'ORDEN_DE_COMPRA', label: 'Orden de Compra' },
  { id: 'ORDEN_DE_SERVICIO', label: 'Orden de Servicio' },
  { id: 'CONVENIO', label: 'Convenio' },
  { id: 'LICITACION', label: 'Licitación' },
  { id: 'OTRO', label: 'Otro' },
];

const DEFAULT_RCE_ADDITIONALS: Array<{ code: string; label: string }> = [
  { code: 'CONTRATISTAS_SUBCONTRATISTAS', label: 'Contratistas y Subcontratistas' },
  { code: 'VEHICULOS_PROPIOS_NO_PROPIOS', label: 'Vehículos Propios y No Propios' },
  { code: 'RC_CRUZADA', label: 'RC Cruzada' },
  { code: 'RC_PATRONAL', label: 'RC Patronal' },
  { code: 'GASTOS_MEDICOS', label: 'Gastos Médicos' },
  { code: 'EXTRAPATRIMONIALES', label: 'Amparos Extrapatrimoniales' },
  { code: 'LUCRO_CESANTE', label: 'Lucro Cesante' },
];

function formatUsdBadge(cop: number | null | undefined, trm: number | null | undefined): string {
  if (typeof cop !== 'number' || typeof trm !== 'number' || trm <= 0) return 'USD —';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(cop / trm);
}

function formatCopSimple(cop: number | null | undefined): string {
  if (typeof cop !== 'number' || Number.isNaN(cop)) return '—';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(cop);
}

function mergeRceAdditionals(
  existing?: CumplimientoRceAdditionalCoverage[]
): CumplimientoRceAdditionalCoverage[] {
  return DEFAULT_RCE_ADDITIONALS.map((def) => {
    const found = existing?.find((a) => a.code === def.code);
    return (
      found || {
        code: def.code,
        label: def.label,
        included: false,
      }
    );
  });
}

export const CumplimientoCaseDetail: React.FC<CumplimientoCaseDetailProps> = ({
  caseRecord,
  saving,
  validating,
  creatingMod,
  onBack,
  onSave,
  onValidate,
  onCreateModification,
}) => {
  const [activeTab, setActiveTab] = useState<'PREPOLICY' | 'CHECKLIST' | 'VALIDATION'>('PREPOLICY');
  const [title, setTitle] = useState(caseRecord.title);
  const [status, setStatus] = useState<CumplimientoCaseStatus>(caseRecord.status);
  const [prepolicy, setPrepolicy] = useState<CumplimientoPrepolicyData>(() => ({
    ...caseRecord.prepolicy_data,
    smmlvValue: caseRecord.prepolicy_data.smmlvValue || COLOMBIA_SMMLV_2026,
    displayCurrency: caseRecord.prepolicy_data.displayCurrency || 'COP',
    rceRequirement: {
      required: Boolean(caseRecord.prepolicy_data.rceRequirement?.required),
      basicPloIncluded: caseRecord.prepolicy_data.rceRequirement?.basicPloIncluded !== false,
      amountSmmlv: caseRecord.prepolicy_data.rceRequirement?.amountSmmlv ?? null,
      amountCop: caseRecord.prepolicy_data.rceRequirement?.amountCop ?? null,
      suggestedMinSmmlv: caseRecord.prepolicy_data.rceRequirement?.suggestedMinSmmlv ?? null,
      subcoverages: caseRecord.prepolicy_data.rceRequirement?.subcoverages || [],
      additionalCoverages: mergeRceAdditionals(
        caseRecord.prepolicy_data.rceRequirement?.additionalCoverages
      ),
      maxDeductibleRule: caseRecord.prepolicy_data.rceRequirement?.maxDeductibleRule ?? null,
      validityRule: caseRecord.prepolicy_data.rceRequirement?.validityRule ?? null,
      startDate:
        caseRecord.prepolicy_data.rceRequirement?.startDate ||
        caseRecord.prepolicy_data.contractStartDate ||
        null,
      endDate:
        caseRecord.prepolicy_data.rceRequirement?.endDate ||
        caseRecord.prepolicy_data.contractEndDate ||
        null,
    },
  }));
  const [checklist, setChecklist] = useState<CumplimientoChecklistItem[]>(
    caseRecord.checklist_data || []
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (prepolicy.trmValue) return;
    let active = true;
    fetchOfficialTrm()
      .then((trm) => {
        if (!active) return;
        setPrepolicy((prev) =>
          prev.trmValue
            ? prev
            : {
                ...prev,
                trmValue: trm.value,
                trmDate: trm.validFrom,
                smmlvValue: trm.smmlv2026 || prev.smmlvValue || COLOMBIA_SMMLV_2026,
              }
        );
      })
      .catch(() => {
        // Keep manual TRM editable if network unavailable
      });
    return () => {
      active = false;
    };
  }, [prepolicy.trmValue]);

  const buildCurrentRecord = (): CumplimientoCase => ({
    ...caseRecord,
    title,
    status,
    prepolicy_data: prepolicy,
    checklist_data: checklist,
  });

  const handleSave = async () => {
    await onSave({
      title,
      status,
      prepolicyData: prepolicy,
      checklistData: checklist,
    });
  };

  const handleCopyClipboard = async () => {
    await navigator.clipboard.writeText(formatPrepolicyForClipboard(buildCurrentRecord()));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const recalculateDates = (draft: CumplimientoPrepolicyData): CumplimientoPrepolicyData => {
    const startIso =
      draft.contractStartDate ||
      draft.contractSignatureDate ||
      new Date().toISOString().slice(0, 10);
    const endIso =
      draft.durationValue && draft.durationUnit
        ? addContractTerm(
            startIso,
            draft.durationValue,
            draft.durationUnit,
            Boolean(draft.includeSaturdays)
          )
        : draft.contractEndDate || startIso;

    const updatedCoverages = draft.requiredCoverages.map((cov) => {
      const dates = computeCoverageValidityDates(
        startIso,
        endIso,
        cov,
        Boolean(draft.includeSaturdays)
      );
      return {
        ...cov,
        estimatedStartDate: dates.startDate,
        estimatedEndDate: dates.endDate,
      };
    });

    return {
      ...draft,
      contractStartDate: startIso,
      contractEndDate: endIso,
      requiredCoverages: updatedCoverages,
      rceRequirement: draft.rceRequirement
        ? { ...draft.rceRequirement, startDate: startIso, endDate: endIso }
        : undefined,
    };
  };

  const updateCoverage = (idx: number, patch: Partial<CumplimientoRequiredCoverageItem>) => {
    const next = [...prepolicy.requiredCoverages];
    const current = next[idx];
    if (!current) return;
    const merged = { ...current, ...patch };
    if (
      patch.percentageNumeric !== undefined &&
      patch.percentageNumeric !== null &&
      typeof prepolicy.contractValue === 'number' &&
      prepolicy.contractValue > 0
    ) {
      merged.minimumAmount = Math.round((prepolicy.contractValue * patch.percentageNumeric) / 100);
      merged.percentageOfContract = `${patch.percentageNumeric}%`;
    }
    next[idx] = merged;
    setPrepolicy({ ...prepolicy, requiredCoverages: next });
  };

  const addCoverageRow = () => {
    setPrepolicy({
      ...prepolicy,
      requiredCoverages: [
        ...prepolicy.requiredCoverages,
        {
          id: `cov-${Date.now()}`,
          name: 'Nuevo Amparo',
          phase: 'CONTRACTUAL',
          percentageOfContract: '10%',
          percentageNumeric: 10,
          minimumAmount:
            typeof prepolicy.contractValue === 'number'
              ? Math.round(prepolicy.contractValue * 0.1)
              : null,
          estimatedStartDate: prepolicy.contractStartDate || null,
          estimatedEndDate: prepolicy.contractEndDate || null,
          validityRule: '',
          isMandatory: true,
        },
      ],
    });
  };

  const removeCoverageRow = (idx: number) => {
    setPrepolicy({
      ...prepolicy,
      requiredCoverages: prepolicy.requiredCoverages.filter((_, i) => i !== idx),
    });
  };

  const smmlv = prepolicy.smmlvValue || COLOMBIA_SMMLV_2026;
  const showUsd = prepolicy.displayCurrency === 'USD' || prepolicy.displayCurrency === 'BOTH';
  const rce = prepolicy.rceRequirement || {
    required: false,
    basicPloIncluded: true,
    subcoverages: [],
    additionalCoverages: mergeRceAdditionals(),
  };

  return (
    <div className="space-y-5" data-testid="cumplimiento-case-detail">
      {/* Top Action Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer"
            aria-label="Volver a casos"
          >
            <ArrowLeft className="w-4 h-4 text-slate-700" />
          </button>
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-base font-bold text-slate-900 border-b border-transparent focus:border-indigo-500 outline-none bg-transparent w-full sm:w-96"
            />
            <p className="text-[11px] text-slate-500">
              {caseRecord.case_type} · Documentos: {caseRecord.governing_document_names.join(', ')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as CumplimientoCaseStatus)}
            className="px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-xl bg-slate-50"
          >
            <option value="DRAFT">Borrador</option>
            <option value="READY_TO_QUOTE">Listo para Cotizar</option>
            <option value="QUOTED">Cotizado</option>
            <option value="VALIDATED">Validado</option>
            <option value="ISSUED">Emitido</option>
            <option value="MODIFICATION_PENDING">Otrosí Pendiente</option>
            <option value="CLOSED">Cerrado</option>
          </select>

          <button
            type="button"
            onClick={() => exportPrepolicyToPdf(buildCurrentRecord())}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5" />
            PDF Slip
          </button>

          <button
            type="button"
            onClick={() => exportPrepolicyToDocx(buildCurrentRecord())}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            Word (.docx)
          </button>

          <button
            type="button"
            onClick={handleCopyClipboard}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            {copied ? 'Copiado' : 'Correo / WhatsApp'}
          </button>

          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 cursor-pointer">
            {creatingMod ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <GitBranchPlus className="w-3.5 h-3.5" />
            )}
            + Otrosí
            <input
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                const selected = Array.from(e.target.files || []);
                if (selected.length > 0) void onCreateModification(selected);
              }}
            />
          </label>

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Guardar
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        {[
          { id: 'PREPOLICY' as const, label: '1. Pre-póliza / Slip Editable' },
          { id: 'CHECKLIST' as const, label: '2. Checklist Cupo y SARLAFT' },
          { id: 'VALIDATION' as const, label: '3. Validar Cotización / Borrador' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'PREPOLICY' && (
        <div className="space-y-5">
          {/* Currency / TRM / SMMLV Bar */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-700">Moneda:</span>
              {(['COP', 'USD', 'BOTH'] as CumplimientoDisplayCurrency[]).map((curr) => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => setPrepolicy({ ...prepolicy, displayCurrency: curr })}
                  className={`px-2.5 py-1 rounded-lg font-semibold border cursor-pointer ${
                    (prepolicy.displayCurrency || 'COP') === curr
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  {curr === 'BOTH' ? 'COP + USD' : curr}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5">
                <span className="text-slate-600 font-medium">TRM (COP/USD):</span>
                <input
                  type="number"
                  step="0.01"
                  value={prepolicy.trmValue ?? ''}
                  onChange={(e) =>
                    setPrepolicy({
                      ...prepolicy,
                      trmValue: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="w-28 px-2 py-1 border border-slate-200 rounded-lg bg-white"
                />
              </label>
              <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 font-semibold border border-indigo-200">
                SMMLV 2026: {formatCopSimple(smmlv)}
              </span>
            </div>
          </div>

          {prepolicy.decreto1082Alerts && prepolicy.decreto1082Alerts.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                <AlertTriangle className="w-4 h-4" />
                Alertas Normativas de Contratación Pública (Decreto 1082 de 2015)
              </div>
              <ul className="space-y-1 text-xs text-amber-900 list-disc pl-5">
                {prepolicy.decreto1082Alerts.map((a) => (
                  <li key={a.id}>
                    <strong>[{a.severity}]</strong> {a.message}{' '}
                    {a.recommendation ? (
                      <span className="text-amber-700">({a.recommendation})</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Tomador */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Tomador / Contratista
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <label className="space-y-1 sm:col-span-2">
                  <span className="text-slate-500">Razón Social / Nombre</span>
                  <input
                    type="text"
                    value={prepolicy.contractor.name}
                    onChange={(e) =>
                      setPrepolicy({
                        ...prepolicy,
                        contractor: { ...prepolicy.contractor, name: e.target.value },
                      })
                    }
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-500">NIT / C.C.</span>
                  <input
                    type="text"
                    value={prepolicy.contractor.nit}
                    onChange={(e) =>
                      setPrepolicy({
                        ...prepolicy,
                        contractor: { ...prepolicy.contractor, nit: e.target.value },
                      })
                    }
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-500">Tipo de Persona</span>
                  <select
                    value={prepolicy.contractor.personType}
                    onChange={(e) =>
                      setPrepolicy({
                        ...prepolicy,
                        contractor: {
                          ...prepolicy.contractor,
                          personType: e.target.value as CumplimientoPersonType,
                        },
                      })
                    }
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50"
                  >
                    <option value="JURIDICA">Persona Jurídica</option>
                    <option value="NATURAL">Persona Natural</option>
                    <option value="CONSORCIO">Consorcio</option>
                    <option value="UNION_TEMPORAL">Unión Temporal</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-slate-500">Dirección Contratista</span>
                  <input
                    type="text"
                    value={prepolicy.contractor.address || ''}
                    onChange={(e) =>
                      setPrepolicy({
                        ...prepolicy,
                        contractor: { ...prepolicy.contractor, address: e.target.value },
                      })
                    }
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-500">Teléfono Contratista</span>
                  <input
                    type="text"
                    value={prepolicy.contractor.phone || prepolicy.contractor.contactPhone || ''}
                    onChange={(e) =>
                      setPrepolicy({
                        ...prepolicy,
                        contractor: { ...prepolicy.contractor, phone: e.target.value },
                      })
                    }
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                  />
                </label>
              </div>
            </div>

            {/* Asegurado / Beneficiario */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Contratante — Asegurado / Beneficiario
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <label className="space-y-1 sm:col-span-2">
                  <span className="text-slate-500">Nombre Entidad / Empresa</span>
                  <input
                    type="text"
                    value={prepolicy.beneficiary.name}
                    onChange={(e) =>
                      setPrepolicy({
                        ...prepolicy,
                        beneficiary: { ...prepolicy.beneficiary, name: e.target.value },
                      })
                    }
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-500">NIT Entidad</span>
                  <input
                    type="text"
                    value={prepolicy.beneficiary.nit}
                    onChange={(e) =>
                      setPrepolicy({
                        ...prepolicy,
                        beneficiary: { ...prepolicy.beneficiary, nit: e.target.value },
                      })
                    }
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-500">Régimen Jurídico</span>
                  <select
                    value={prepolicy.legalRegime}
                    onChange={(e) =>
                      setPrepolicy({
                        ...prepolicy,
                        legalRegime: e.target.value as CumplimientoLegalRegime,
                      })
                    }
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50"
                  >
                    <option value="ESTATAL_LEY_80">Estatal (Ley 80 / Decreto 1082)</option>
                    <option value="PARTICULAR">Particular / Privado</option>
                    <option value="REGIMEN_ESPECIAL">Régimen Especial</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-slate-500">Dirección Contratante</span>
                  <input
                    type="text"
                    value={prepolicy.beneficiary.address || ''}
                    onChange={(e) =>
                      setPrepolicy({
                        ...prepolicy,
                        beneficiary: { ...prepolicy.beneficiary, address: e.target.value },
                      })
                    }
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-500">Teléfono Contratante</span>
                  <input
                    type="text"
                    value={prepolicy.beneficiary.phone || ''}
                    onChange={(e) =>
                      setPrepolicy({
                        ...prepolicy,
                        beneficiary: { ...prepolicy.beneficiary, phone: e.target.value },
                      })
                    }
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Datos del Contrato y Vigencia Exacta */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-600" />
                Información del Contrato y Vigencia Exacta (Calendario Colombia 2026)
              </h4>
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={Boolean(prepolicy.includeSaturdays)}
                  onChange={(e) =>
                    setPrepolicy(
                      recalculateDates({ ...prepolicy, includeSaturdays: e.target.checked })
                    )
                  }
                  className="rounded border-slate-300"
                />
                Incluir sábados como hábiles
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
              <label className="space-y-1">
                <span className="text-slate-500">Tipo de Contrato</span>
                <select
                  value={prepolicy.contractType}
                  onChange={(e) =>
                    setPrepolicy({
                      ...prepolicy,
                      contractType: e.target.value as CumplimientoContractType,
                    })
                  }
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50"
                >
                  {CONTRACT_TYPES.map((ct) => (
                    <option key={ct.id} value={ct.id}>
                      {ct.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-slate-500"># Contrato / Proceso</span>
                <input
                  type="text"
                  value={prepolicy.contractNumber}
                  onChange={(e) => setPrepolicy({ ...prepolicy, contractNumber: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-500">
                  Valor del Contrato (COP){' '}
                  {showUsd
                    ? `· ${formatUsdBadge(prepolicy.contractValue, prepolicy.trmValue)}`
                    : ''}
                </span>
                <input
                  type="number"
                  value={prepolicy.contractValue ?? ''}
                  onChange={(e) =>
                    setPrepolicy({
                      ...prepolicy,
                      contractValue: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-500">Fecha de Firma</span>
                <input
                  type="date"
                  value={prepolicy.contractSignatureDate || ''}
                  onChange={(e) =>
                    setPrepolicy(
                      recalculateDates({
                        ...prepolicy,
                        contractSignatureDate: e.target.value || null,
                      })
                    )
                  }
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-500">
                  Inicio ({prepolicy.contractStartDateSource || 'CONTRATO'})
                </span>
                <input
                  type="date"
                  value={prepolicy.contractStartDate || ''}
                  onChange={(e) =>
                    setPrepolicy(
                      recalculateDates({
                        ...prepolicy,
                        contractStartDate: e.target.value || null,
                        contractStartDateSource: 'CONTRATO',
                      })
                    )
                  }
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-500">Plazo (Cantidad)</span>
                <input
                  type="number"
                  value={prepolicy.durationValue ?? ''}
                  onChange={(e) =>
                    setPrepolicy(
                      recalculateDates({
                        ...prepolicy,
                        durationValue: e.target.value ? Number(e.target.value) : null,
                      })
                    )
                  }
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-500">Unidad del Plazo</span>
                <select
                  value={prepolicy.durationUnit || 'DIAS_CALENDARIO'}
                  onChange={(e) =>
                    setPrepolicy(
                      recalculateDates({
                        ...prepolicy,
                        durationUnit: e.target.value as CumplimientoDurationUnit,
                      })
                    )
                  }
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50"
                >
                  <option value="DIAS_HABILES">Días Hábiles (Colombia)</option>
                  <option value="DIAS_CALENDARIO">Días Calendario</option>
                  <option value="MESES">Meses</option>
                  <option value="ANIOS">Años</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-slate-500">Fin Calculado</span>
                <input
                  type="date"
                  value={prepolicy.contractEndDate || ''}
                  onChange={(e) =>
                    setPrepolicy({ ...prepolicy, contractEndDate: e.target.value || null })
                  }
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-indigo-50/40 font-semibold"
                />
              </label>
              <label className="space-y-1 sm:col-span-2 lg:col-span-4">
                <span className="text-slate-500">Objeto del Contrato</span>
                <textarea
                  rows={2}
                  value={prepolicy.objectDescription}
                  onChange={(e) =>
                    setPrepolicy({ ...prepolicy, objectDescription: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                />
              </label>
            </div>
          </div>

          {/* Tabla editable de Garantías de Cumplimiento */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Garantías de Cumplimiento Solicitadas (Fechas Exactas y Calidad Contractual/Post)
              </h4>
              <button
                type="button"
                onClick={addCoverageRow}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Amparo
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="p-2 text-left">Amparo</th>
                    <th className="p-2 text-left">Fase</th>
                    <th className="p-2 text-left">%</th>
                    <th className="p-2 text-left">Valor (COP)</th>
                    {showUsd && <th className="p-2 text-left">Valor (USD)</th>}
                    <th className="p-2 text-left">Inicio</th>
                    <th className="p-2 text-left">Fin</th>
                    <th className="p-2 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {prepolicy.requiredCoverages.map((cov, idx) => (
                    <tr key={cov.id}>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={cov.name}
                          onChange={(e) => updateCoverage(idx, { name: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-200 rounded-lg"
                        />
                      </td>
                      <td className="p-1.5 w-36">
                        <select
                          value={cov.phase || 'CONTRACTUAL'}
                          onChange={(e) =>
                            updateCoverage(idx, {
                              phase: e.target.value as CumplimientoCoveragePhase,
                            })
                          }
                          className="w-full px-2 py-1 border border-slate-200 rounded-lg bg-slate-50"
                        >
                          <option value="PRECONTRACTUAL">Precontractual</option>
                          <option value="CONTRACTUAL">Contractual</option>
                          <option value="POST_CONTRACTUAL">Post-contractual</option>
                        </select>
                      </td>
                      <td className="p-1.5 w-20">
                        <input
                          type="number"
                          step="0.1"
                          value={cov.percentageNumeric ?? ''}
                          onChange={(e) =>
                            updateCoverage(idx, {
                              percentageNumeric: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                          className="w-full px-2 py-1 border border-slate-200 rounded-lg"
                        />
                      </td>
                      <td className="p-1.5 w-36">
                        <input
                          type="number"
                          value={cov.minimumAmount ?? ''}
                          onChange={(e) =>
                            updateCoverage(idx, {
                              minimumAmount: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                          className="w-full px-2 py-1 border border-slate-200 rounded-lg"
                        />
                      </td>
                      {showUsd && (
                        <td className="p-1.5 w-28 text-slate-600 font-medium">
                          {formatUsdBadge(cov.minimumAmount, prepolicy.trmValue)}
                        </td>
                      )}
                      <td className="p-1.5 w-32">
                        <input
                          type="date"
                          value={cov.estimatedStartDate || ''}
                          onChange={(e) =>
                            updateCoverage(idx, { estimatedStartDate: e.target.value || null })
                          }
                          className="w-full px-1.5 py-1 border border-slate-200 rounded-lg"
                        />
                      </td>
                      <td className="p-1.5 w-32">
                        <input
                          type="date"
                          value={cov.estimatedEndDate || ''}
                          onChange={(e) =>
                            updateCoverage(idx, { estimatedEndDate: e.target.value || null })
                          }
                          className="w-full px-1.5 py-1 border border-slate-200 rounded-lg"
                        />
                      </td>
                      <td className="p-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeCoverageRow(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                          aria-label="Eliminar amparo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sección Independiente: RCE Derivada en SMMLV */}
          <div
            className="bg-white p-4 rounded-2xl border border-teal-200 space-y-3"
            data-testid="cumplimiento-rce-section"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-teal-700" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-teal-900">
                  Póliza RCE Derivada (Independiente — Cuantías en SMMLV 2026)
                </h4>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-teal-900">
                <input
                  type="checkbox"
                  checked={rce.required}
                  onChange={(e) =>
                    setPrepolicy({
                      ...prepolicy,
                      rceRequirement: { ...rce, required: e.target.checked },
                    })
                  }
                  className="rounded border-teal-300"
                />
                Aplica RCE Derivada en este contrato
              </label>
            </div>

            {rce.required && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                  <label className="space-y-1">
                    <span className="text-slate-500">
                      Cuantía en SMMLV{' '}
                      {rce.suggestedMinSmmlv ? `(Mín. D.1082: ${rce.suggestedMinSmmlv})` : ''}
                    </span>
                    <input
                      type="number"
                      value={rce.amountSmmlv ?? ''}
                      onChange={(e) => {
                        const sm = e.target.value ? Number(e.target.value) : null;
                        setPrepolicy({
                          ...prepolicy,
                          rceRequirement: {
                            ...rce,
                            amountSmmlv: sm,
                            amountCop: sm !== null ? Math.round(sm * smmlv) : null,
                          },
                        });
                      }}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                    />
                  </label>
                  <div className="space-y-1">
                    <span className="text-slate-500">Equivalente COP / USD</span>
                    <div className="px-2.5 py-1.5 bg-teal-50/60 border border-teal-100 rounded-lg font-semibold text-teal-900">
                      {formatCopSimple(rce.amountCop)}
                      {showUsd ? ` (${formatUsdBadge(rce.amountCop, prepolicy.trmValue)})` : ''}
                    </div>
                  </div>
                  <label className="space-y-1">
                    <span className="text-slate-500">Vigencia RCE Inicio</span>
                    <input
                      type="date"
                      value={rce.startDate || ''}
                      onChange={(e) =>
                        setPrepolicy({
                          ...prepolicy,
                          rceRequirement: { ...rce, startDate: e.target.value || null },
                        })
                      }
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-slate-500">Vigencia RCE Fin</span>
                    <input
                      type="date"
                      value={rce.endDate || ''}
                      onChange={(e) =>
                        setPrepolicy({
                          ...prepolicy,
                          rceRequirement: { ...rce, endDate: e.target.value || null },
                        })
                      }
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                    />
                  </label>
                </div>

                <div className="p-2.5 rounded-xl bg-teal-50/70 border border-teal-200 text-xs font-semibold text-teal-900">
                  Amparo Básico: Predios, Labores y Operaciones (PLO)
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                  {mergeRceAdditionals(rce.additionalCoverages).map((add) => (
                    <div
                      key={add.code}
                      className="flex items-center justify-between gap-2 p-2 rounded-xl border border-slate-200 bg-slate-50"
                    >
                      <label className="inline-flex items-center gap-2 font-medium text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={add.included}
                          onChange={(e) => {
                            const nextAdds = mergeRceAdditionals(rce.additionalCoverages).map(
                              (item) =>
                                item.code === add.code
                                  ? { ...item, included: e.target.checked }
                                  : item
                            );
                            setPrepolicy({
                              ...prepolicy,
                              rceRequirement: { ...rce, additionalCoverages: nextAdds },
                            });
                          }}
                          className="rounded border-slate-300"
                        />
                        {add.label}
                      </label>
                      <input
                        type="number"
                        placeholder="SMMLV"
                        value={add.sublimitSmmlv ?? ''}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : null;
                          const nextAdds = mergeRceAdditionals(rce.additionalCoverages).map(
                            (item) =>
                              item.code === add.code
                                ? {
                                    ...item,
                                    sublimitSmmlv: val,
                                    sublimitCop: val !== null ? Math.round(val * smmlv) : null,
                                  }
                                : item
                          );
                          setPrepolicy({
                            ...prepolicy,
                            rceRequirement: { ...rce, additionalCoverages: nextAdds },
                          });
                        }}
                        className="w-20 px-2 py-1 border border-slate-200 rounded-lg bg-white text-right"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'CHECKLIST' && (
        <CumplimientoChecklistTab items={checklist} onChange={setChecklist} />
      )}

      {activeTab === 'VALIDATION' && (
        <CumplimientoValidationTab
          caseRecord={buildCurrentRecord()}
          isValidating={validating}
          onValidate={onValidate}
        />
      )}
    </div>
  );
};
