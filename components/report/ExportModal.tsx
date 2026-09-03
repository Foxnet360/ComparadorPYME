import React from 'react';
import { generatePDF } from '../../services/pdfService';
import { storageService } from '../../services/storageService';
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
            className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            Generar PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
