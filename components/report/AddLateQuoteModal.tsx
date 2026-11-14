import React, { useState } from 'react';
import { FilePlus, Loader2, Upload, X, AlertCircle } from 'lucide-react';
import { appendQuotesToComparison } from '../../services/geminiService';
import type { ComparisonReport } from '../../types';

interface AddLateQuoteModalProps {
  analysisId: string;
  domain?: string;
  existingInsurers: string[];
  onClose: () => void;
  onQuotesAppended: (updatedReport: ComparisonReport) => void;
}

export const AddLateQuoteModal: React.FC<AddLateQuoteModalProps> = ({
  analysisId,
  domain = 'pyme',
  existingInsurers,
  onClose,
  onQuotesAppended,
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (selected.length === 0) {
      setError('Selecciona archivos en formato PDF.');
      return;
    }
    setError(null);
    setFiles((prev) => [...prev, ...selected]);
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const updatedReport = await appendQuotesToComparison(analysisId, files, domain);
      onQuotesAppended(updatedReport);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Ocurrió un error al adicionar la cotización.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
              <FilePlus size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Adicionar cotización a la comparación
              </h3>
              <p className="text-xs text-slate-500">
                Se integrará con las {existingInsurers.length} aseguradora(s) actuales sin perder
                tu análisis previo.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {existingInsurers.length > 0 && (
            <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
              <span className="font-semibold text-slate-700">Aseguradoras actuales: </span>
              {existingInsurers.join(', ')}
            </div>
          )}

          <label className="flex flex-col items-center justify-center border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-xl p-6 cursor-pointer bg-indigo-50/30 transition-colors">
            <Upload className="w-7 h-7 text-indigo-600 mb-2" />
            <span className="text-sm font-semibold text-slate-800">
              Seleccionar PDF(s) de cotización tardía
            </span>
            <span className="text-xs text-slate-500 mt-1">
              Puedes subir una o varias cotizaciones adicionales
            </span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              multiple
              onChange={handleFileChange}
              disabled={isSubmitting}
              className="hidden"
            />
          </label>

          {files.length > 0 && (
            <ul className="space-y-1.5 max-h-36 overflow-y-auto">
              {files.map((file, idx) => (
                <li
                  key={`${file.name}-${idx}`}
                  className="flex items-center justify-between text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                >
                  <span className="truncate font-medium text-slate-700">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(idx)}
                    disabled={isSubmitting}
                    className="text-slate-400 hover:text-red-600 ml-2"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {error && (
            <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={files.length === 0 || isSubmitting}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <FilePlus size={16} />
                  Adicionar a la comparación
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddLateQuoteModal;
