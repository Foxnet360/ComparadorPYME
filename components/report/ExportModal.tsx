import React, { useState } from 'react';
import { generatePDF } from '../../services/pdfService';
import { storageService } from '../../services/storageService';
import { apiClient } from '../../services/apiClient';
import { FileDown, FileSpreadsheet, Loader2 } from 'lucide-react';
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
}

const COLOR_CHOICES: Array<{ c: string; v: [number, number, number] }> = [
  { c: '#4f46e5', v: [79, 70, 229] },
  { c: '#059669', v: [5, 150, 105] },
  { c: '#dc2626', v: [220, 38, 38] },
  { c: '#2563eb', v: [37, 99, 235] },
];

export const ExportModal: React.FC<ExportModalProps> = ({
  report,
  pdfOptions,
  onPdfOptionsChange,
  cellNotes,
  onClose,
}) => {
  const [exportingExcel, setExportingExcel] = useState<string | null>(null);

  const handleExportExcel = async (exportMode: 'client' | 'technical') => {
    const analysisId = (report as any).id || (report as any).analysisId;
    if (!analysisId) {
      alert('ID de análisis no disponible para exportación.');
      return;
    }

    try {
      setExportingExcel(exportMode);
      const response = await apiClient.fetch(`/analysis/${analysisId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: report.domain || 'pyme',
          quotes: report.quotes,
          matrix: report.matrix,
          exportMode,
        }),
      });

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        exportMode === 'client'
          ? `informe_cliente_${report.domain || 'seguros'}_${analysisId}.xlsx`
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
    <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-slate-800">Personalizar Reporte</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          ×
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Título Personalizado
          </label>
          <input
            type="text"
            className="w-full text-sm border-slate-200 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Ej: Informe Ejecutivo CSA"
            value={pdfOptions.title}
            onChange={(e) => onPdfOptionsChange({ ...pdfOptions, title: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Logo del Aliado (Opcional)
          </label>
          <input
            type="file"
            accept="image/*"
            className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
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

        {/* Color Picker Simple */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Color Principal</label>
          <div className="flex gap-2">
            {COLOR_CHOICES.map((color, i) => (
              <button
                key={i}
                className={`w-6 h-6 rounded-full border-2 ${pdfOptions.color[0] === color.v[0] ? 'border-slate-800 ring-1 ring-slate-800' : 'border-transparent'}`}
                style={{ backgroundColor: color.c }}
                onClick={() => onPdfOptionsChange({ ...pdfOptions, color: color.v })}
              />
            ))}
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={() => {
              // ERR-4: the user profile comes from the Supabase session,
              // never from local storage.
              void storageService.getCurrentUser().then((user) => {
                const brokerInfo = user
                  ? {
                      name: user.name,
                      intermediaryName: user.intermediaryName,
                      registrationNumber:
                        user.registrationNumber || user.agentDetails?.registrationNumber,
                      phone: user.agentDetails?.phone,
                      email: user.email,
                      address: user.address || user.agentDetails?.address,
                      city: user.city || user.agentDetails?.city,
                      logoUrl: user.logoUrl || user.agentDetails?.logoUrl,
                    }
                  : undefined;

                generatePDF(
                  report,
                  {
                    customTitle: pdfOptions.title,
                    logoBase64: brokerInfo?.logoUrl || pdfOptions.logo,
                    primaryColor: pdfOptions.color,
                    brokerInfo,
                  },
                  cellNotes as unknown as Record<string, string>
                );
                onClose();
              });
            }}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-xs"
          >
            <FileDown size={16} />
            <span>Generar PDF</span>
          </button>

          <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
            <button
              onClick={() => handleExportExcel('client')}
              disabled={!!exportingExcel}
              className="w-full bg-emerald-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
              title="Excel consultivo enriquecido con guías pedagógicas y resúmenes descriptivos"
            >
              {exportingExcel === 'client' ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <FileSpreadsheet size={15} />
              )}
              <span>Excel Cliente (Asesoría)</span>
            </button>

            <button
              onClick={() => handleExportExcel('technical')}
              disabled={!!exportingExcel}
              className="w-full bg-slate-800 text-white py-2 rounded-lg text-xs font-semibold hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
              title="Sábana técnica 1:1 con matrices completas y auditoría de riesgos"
            >
              {exportingExcel === 'technical' ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <FileSpreadsheet size={15} />
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
