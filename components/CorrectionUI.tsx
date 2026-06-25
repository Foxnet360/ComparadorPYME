import React, { useState } from 'react';
import { QuoteAnalysis } from '../types';
import { AlertTriangle, Check, X, Edit3, Save, RotateCcw, Loader2 } from 'lucide-react';
import { useOptimisticCorrection } from '../hooks/useOptimisticCorrection';
import { ToastContainer, useToasts } from './ToastNotification';

interface CorrectionUIProps {
  quote: QuoteAnalysis;
  onCorrection: (correction: {
    field: string;
    originalValue: string;
    correctedValue: string;
    reason?: string;
  }) => void;
}

export const CorrectionUI: React.FC<CorrectionUIProps> = ({ quote, onCorrection }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [savedFields, setSavedFields] = useState<Set<string>>(new Set());
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set());
  const { submitCorrection } = useOptimisticCorrection();
  const { toasts, addToast, removeToast } = useToasts();

  const handleCorrection = async (field: string, originalValue: string) => {
    const correctedValue = corrections[field];
    const reason = reasons[field];
    
    if (!correctedValue || correctedValue === originalValue) return;
    
    setSavingFields(prev => new Set(prev).add(field));
    
    try {
      // Call the real API
      const result = await submitCorrection({
        rawName: field,
        insurerName: quote.insurerName,
        systemMapping: originalValue,
        userCorrection: correctedValue,
        correctionType: field.startsWith('coverage_') ? 'coverage_mapping' : 'value',
        quoteId: quote.id,
      });

      if (result.success) {
        setSavedFields(prev => new Set(prev).add(field));
        addToast(`Corrección guardada para ${field}`, 'success');
        
        // Also call the parent callback if provided
        onCorrection({
          field,
          originalValue,
          correctedValue,
          reason
        });
        
        // Clear saved status after 3 seconds
        setTimeout(() => {
          setSavedFields(prev => {
            const next = new Set(prev);
            next.delete(field);
            return next;
          });
        }, 3000);
      } else {
        addToast(`Error: ${result.error || 'No se pudo guardar'}`, 'error');
      }
    } catch (_error) {
      addToast('Error de conexión. Corrección guardada localmente.', 'warning');
    } finally {
      setSavingFields(prev => {
        const next = new Set(prev);
        next.delete(field);
        return next;
      });
    }
  };

  const handleReset = (field: string) => {
    setCorrections(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setReasons(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const coverageFields = quote.coverages?.map(c => ({
    field: `coverage_${c.name}`,
    label: c.name,
    value: c.value,
    type: 'coverage'
  })) || [];

  const deductibleField = {
    field: 'deductible',
    label: 'Deducible General',
    value: quote.deductibles,
    type: 'deductible'
  };

  const priceFields = [
    { field: 'price_annual', label: 'Prima Anual', value: String(quote.priceAnnual || ''), type: 'price' },
    { field: 'price_monthly', label: 'Prima Mensual', value: String(quote.priceMonthly || ''), type: 'price' }
  ];

  const allFields = [deductibleField, ...priceFields, ...coverageFields];

  if (!isExpanded) {
    return (
      <div className="mt-4 pt-4 border-t border-slate-200">
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
        >
          <Edit3 size={16} />
          <span>Reportar correcciones</span>
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Edit3 size={16} className="text-indigo-600" />
          <h4 className="font-semibold text-slate-800">Correcciones</h4>
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className="text-slate-400 hover:text-slate-600"
        >
          <X size={16} />
        </button>
      </div>
      
      <p className="text-sm text-slate-600 mb-4">
        Si encuentras valores incorrectos, corrígelos aquí para mejorar el sistema:
      </p>
      
      <div className="space-y-3">
        {allFields.map((field) => (
          <div key={field.field} className="bg-slate-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">{field.label}</span>
              <span className="text-xs text-slate-500">
                Actual: {field.value || 'No especificado'}
              </span>
            </div>
            
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Valor correcto..."
                value={corrections[field.field] || ''}
                onChange={(e) => setCorrections(prev => ({
                  ...prev,
                  [field.field]: e.target.value
                }))}
                className="flex-1 text-sm border border-slate-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <input
                type="text"
                placeholder="Razón (opcional)"
                value={reasons[field.field] || ''}
                onChange={(e) => setReasons(prev => ({
                  ...prev,
                  [field.field]: e.target.value
                }))}
                className="flex-1 text-sm border border-slate-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <button
                onClick={() => handleCorrection(field.field, field.value)}
                disabled={!corrections[field.field] || corrections[field.field] === field.value || savingFields.has(field.field)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  savedFields.has(field.field)
                    ? 'bg-green-100 text-green-700'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {savingFields.has(field.field) ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : savedFields.has(field.field) ? (
                  <><Check size={16} /></>
                ) : (
                  <Save size={16} />
                )}
              </button>
              
              {corrections[field.field] && (
                <button
                  onClick={() => handleReset(field.field)}
                  className="px-3 py-2 rounded-md text-sm text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  <RotateCcw size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {quote.needsReview && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Esta cotización tiene baja confianza de extracción.
            Tus correcciones son especialmente valiosas para mejorar el sistema.
          </p>
        </div>
      )}

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
};