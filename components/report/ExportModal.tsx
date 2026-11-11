import React, { useState, useEffect } from 'react';
import { generatePDF } from '../../services/pdfService';
import { storageService } from '../../services/storageService';
import { apiClient } from '../../services/apiClient';
import { FileDown, FileSpreadsheet, Loader2, Briefcase, ChevronDown, ChevronUp } from 'lucide-react';
import {
  COMMERCIAL_CONDITION_FIELDS,
  extractCommercialConditionsFromReport,
  applyCommercialConditionsToReport,
  type InsurerCommercialConditions,
} from '../../src/data/commercialPolicies';
import type { CellNote } from '../../contexts/AnalysisContext';
import type { ComparisonReport as ReportType } from '../../types';

export interface PdfExportOptions {
  title: string;
  logo?: string;
  color: [number, number, number];
}

interface ExportModalProps {
  report: ReportType;
  pdfOptions: PdfExportOptions;
  onPdfOptionsChange: (options: PdfExportOptions) => void;
  cellNotes: Record<string, CellNote>;
  onClose: () => void;
  onUpdateReport?: (updatedReport: ReportType) => void;
}

const COLOR_CHOICES: Array<{ c: string; v: [number, number, number] }> = [
  { c: '#4f46e5', v: [79, 70, 229] },
  { c: '#059669', v: [5, 150, 105] },
  { c: '#0284c7', v: [2, 132, 199] },
  { c: '#dc2626', v: [220, 38, 38] },
  { c: '#d97706', v: [217, 119, 6] },
];

export const ExportModal: React.FC<ExportModalProps> = ({
  report,
  pdfOptions,
  onPdfOptionsChange,
  cellNotes,
  onClose,
  onUpdateReport,
}) => {
  const [exportingExcel, setExportingExcel] = useState<string | null>(null);
  const [commercialConditions, setCommercialConditions] = useState<Record<string, InsurerCommercialConditions>>(() =>
    extractCommercialConditionsFromReport(report)
  );
  const insurers = (report.quotes || []).map((q) => q.insurerName || 'Aseguradora');
  const [selectedInsurer, setSelectedInsurer] = useState<string>(insurers[0] || '');
  const [showCommercialSection, setShowCommercialSection] = useState<boolean>(true);

  // Pre-load ally logo from authenticated user profile if not manually set
  useEffect(() => {
    if (!pdfOptions.logo) {
      storageService
        .getCurrentUser()
        .then((user) => {
          const logo = user?.logoUrl || user?.agentDetails?.logoUrl;
          if (logo) {
            onPdfOptionsChange({ ...pdfOptions, logo });
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleConditionChange = (fieldKey: string, value: string) => {
    setCommercialConditions((prev) => ({
      ...prev,
      [selectedInsurer]: {
        ...(prev[selectedInsurer] || {}),
        [fieldKey]: value,
      },
    }));
  };

  const getUpdatedReport = (): ReportType => {
    const updated = applyCommercialConditionsToReport(report, commercialConditions);
    if (onUpdateReport) {
      onUpdateReport(updated);
    }
    return updated;
  };

  const handleExportExcel = async (exportMode: 'client' | 'technical') => {
    const effectiveReport = getUpdatedReport();
    const analysisId = (effectiveReport as any).id || (effectiveReport as any).analysisId;
    if (!analysisId) {
      alert('ID de análisis no disponible para exportación.');
      return;
    }

    try {
      setExportingExcel(exportMode);
      const currentUser = await storageService.getCurrentUser();
      const brokerInfo = {
        name: currentUser?.name || 'Asesor Técnico de Seguros',
        intermediaryName:
          currentUser?.intermediaryName || currentUser?.agencyName || 'Corredores de Seguros Asociados S.A.',
        registrationNumber:
          currentUser?.registrationNumber ||
          currentUser?.agentDetails?.registrationNumber ||
          'Inscripción Vigente SFC',
        phone: currentUser?.agentDetails?.phone || currentUser?.phone || '+57 (601) 345-6789',
        email: currentUser?.email || 'soporte@comparadorcsa.com',
        address: currentUser?.address || currentUser?.agentDetails?.address || 'Bogotá D.C., Colombia',
        city: currentUser?.city || currentUser?.agentDetails?.city || 'Bogotá D.C.',
        commercialPolicies: currentUser?.commercialPolicies,
      };

      const response = await apiClient.fetch(`/analysis/${analysisId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: effectiveReport.domain || 'pyme',
          quotes: effectiveReport.quotes,
          matrix: effectiveReport.matrix,
          commercialConditions,
          exportMode,
          brokerInfo,
          cellNotes: cellNotes ? (typeof cellNotes === 'object' ? cellNotes : {}) : {},
        }),
      });

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        exportMode === 'client'
          ? `informe_cliente_${effectiveReport.domain || 'seguros'}_${analysisId}.xlsx`
          : `comparativa_tecnica_${analysisId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      onClose();
    } catch (err: any) {
      alert(`Error al exportar Excel: ${err?.message || 'Error desconocido'}`);
    } finally {
      setExportingExcel(null);
    }
  };

  return (
    <div className="absolute top-full right-0 mt-2 w-96 sm:w-[440px] max-h-[85vh] overflow-y-auto bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
          <span>Personalizar Reporte</span>
        </h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 rounded-md p-1 hover:bg-slate-100 text-lg leading-none"
        >
          ×
        </button>
      </div>

      <div className="space-y-3.5">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Título Personalizado
          </label>
          <input
            type="text"
            className="w-full text-xs border border-slate-200 rounded-md px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Ej: Informe Ejecutivo CSA"
            value={pdfOptions.title}
            onChange={(e) => onPdfOptionsChange({ ...pdfOptions, title: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Logo del Aliado (Opcional)
          </label>
          <input
            type="file"
            accept="image/*"
            className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onloadend = () => {
                  onPdfOptionsChange({ ...pdfOptions, logo: reader.result as string });
                };
                reader.readAsDataURL(file);
              }
            }}
          />
        </div>

        {/* Color Picker */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Color Principal</label>
          <div className="flex gap-2">
            {COLOR_CHOICES.map((color, i) => (
              <button
                key={i}
                className={`w-5 h-5 rounded-full border-2 transition-transform ${
                  pdfOptions.color[0] === color.v[0] ? 'scale-110 border-slate-800 ring-1 ring-slate-800' : 'border-transparent'
                }`}
                style={{ backgroundColor: color.c }}
                onClick={() => onPdfOptionsChange({ ...pdfOptions, color: color.v })}
              />
            ))}
          </div>
        </div>

        {/* Sección Editable de Condiciones Comerciales por Aseguradora */}
        {insurers.length > 0 && (
          <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/70">
            <button
              type="button"
              onClick={() => setShowCommercialSection((prev) => !prev)}
              className="w-full flex items-center justify-between text-left text-xs font-bold text-slate-700 hover:text-indigo-600"
            >
              <span className="flex items-center gap-1.5">
                <Briefcase size={14} className="text-indigo-600" />
                <span>Condiciones Comerciales de Cotizaciones</span>
              </span>
              {showCommercialSection ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showCommercialSection && (
              <div className="mt-2.5 space-y-2.5">
                {/* Selector de Aseguradora */}
                <div className="flex gap-1 overflow-x-auto pb-1 border-b border-slate-200">
                  {insurers.map((ins) => (
                    <button
                      key={ins}
                      type="button"
                      onClick={() => setSelectedInsurer(ins)}
                      className={`text-[11px] font-semibold px-2 py-1 rounded transition-colors whitespace-nowrap ${
                        selectedInsurer === ins
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {ins}
                    </button>
                  ))}
                </div>

                {/* Campos editables para la aseguradora seleccionada */}
                <div className="space-y-2">
                  {COMMERCIAL_CONDITION_FIELDS.map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                        {label}
                      </label>
                      <input
                        type="text"
                        className="w-full text-xs bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder={placeholder}
                        value={commercialConditions[selectedInsurer]?.[key] || ''}
                        onChange={(e) => handleConditionChange(key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="pt-2">
          <button
            onClick={() => {
              const effectiveReport = getUpdatedReport();
              void storageService.getCurrentUser().then((user) => {
                const brokerInfo = {
                  name: user?.name || 'Asesor Técnico de Seguros',
                  intermediaryName:
                    user?.intermediaryName || user?.agencyName || 'Corredores de Seguros Asociados S.A.',
                  registrationNumber:
                    user?.registrationNumber ||
                    user?.agentDetails?.registrationNumber ||
                    'Inscripción Vigente SFC',
                  phone: user?.agentDetails?.phone || user?.phone || '+57 (601) 345-6789',
                  email: user?.email || 'soporte@comparadorcsa.com',
                  address: user?.address || user?.agentDetails?.address || 'Bogotá D.C., Colombia',
                  city: user?.city || user?.agentDetails?.city || 'Bogotá D.C.',
                  logoUrl: user?.logoUrl || user?.agentDetails?.logoUrl,
                  commercialPolicies: user?.commercialPolicies,
                };

                generatePDF(
                  effectiveReport,
                  {
                    customTitle: pdfOptions.title,
                    logoBase64: brokerInfo?.logoUrl || pdfOptions.logo,
                    primaryColor: pdfOptions.color,
                    brokerInfo,
                    commercialPolicies: user?.commercialPolicies,
                  },
                  cellNotes as unknown as Record<string, string>
                );
                onClose();
              });
            }}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-xs"
          >
            <FileDown size={15} />
            <span>Generar PDF</span>
          </button>

          <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
            <button
              onClick={() => handleExportExcel('client')}
              disabled={!!exportingExcel}
              className="w-full bg-emerald-600 text-white py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
              title="Excel consultivo enriquecido con guías pedagógicas y resúmenes descriptivos"
            >
              {exportingExcel === 'client' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <FileSpreadsheet size={14} />
              )}
              <span>Excel Cliente (Asesoría)</span>
            </button>

            <button
              onClick={() => handleExportExcel('technical')}
              disabled={!!exportingExcel}
              className="w-full bg-slate-800 text-white py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
              title="Sábana técnica 1:1 con matrices completas y auditoría de riesgos"
            >
              {exportingExcel === 'technical' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <FileSpreadsheet size={14} />
              )}
              <span>Excel Auditoría Técnica</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
