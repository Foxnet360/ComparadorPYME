import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  FileText,
  Lock,
  Scale,
  ExternalLink,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import {
  ALL_LEGAL_DOCUMENTS,
  TERMS_OF_SERVICE,
  PRIVACY_POLICY,
  SECURITY_POLICY,
  REGULATORY_DISCLAIMER,
  LegalDocument,
} from '../../src/data/legalContent';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'terms' | 'privacy' | 'security' | 'disclaimer';
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'terms',
}) => {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy' | 'security' | 'disclaimer'>(
    initialTab
  );

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentDoc: LegalDocument =
    ALL_LEGAL_DOCUMENTS.find((d) => d.id === activeTab) || TERMS_OF_SERVICE;

  const getTabIcon = (id: string) => {
    switch (id) {
      case 'terms':
        return <FileText className="w-4 h-4" />;
      case 'privacy':
        return <Lock className="w-4 h-4" />;
      case 'security':
        return <ShieldCheck className="w-4 h-4" />;
      case 'disclaimer':
        return <Scale className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 id="legal-modal-title" className="text-base font-bold text-slate-800">
                Centro de Cumplimiento Legal y Privacidad
              </h2>
              <p className="text-xs text-slate-500">
                Marco normativo de Colombia (Ley 1581 de 2012 & Circular Externa SFC)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 border-b border-slate-200 bg-white flex space-x-1 overflow-x-auto scrollbar-none">
          {ALL_LEGAL_DOCUMENTS.map((doc) => {
            const isActive = activeTab === doc.id;
            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => setActiveTab(doc.id)}
                className={`flex items-center gap-2 py-3 px-3.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40 rounded-t-lg'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {getTabIcon(doc.id)}
                <span>{doc.shortTitle}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-slate-700 text-sm leading-relaxed">
          {/* Document Metadata Banner */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-bold text-slate-800 block text-sm mb-1">
                {currentDoc.title}
              </span>
              <p className="text-slate-500 leading-normal">{currentDoc.summary}</p>
            </div>
            <div className="shrink-0 flex items-center gap-3 text-slate-500">
              <span className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-md border border-slate-200 font-mono text-[11px]">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {currentDoc.lastUpdated}
              </span>
              <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold font-mono text-[11px]">
                v{currentDoc.version}
              </span>
            </div>
          </div>

          {/* Document Sections */}
          <div className="space-y-6 divide-y divide-slate-100">
            {currentDoc.sections.map((section, idx) => (
              <div key={section.id} className={idx > 0 ? 'pt-5' : ''}>
                <h3 className="font-bold text-slate-900 text-sm mb-2.5 flex items-center gap-2">
                  <span className="text-indigo-600 text-xs">§</span>
                  {section.title}
                </h3>
                <div className="space-y-2 text-slate-600 text-xs sm:text-sm pl-4 border-l-2 border-slate-100">
                  {section.content.map((paragraph, pIdx) => (
                    <p key={pIdx} className="leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs">
          <div className="text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Documento oficial vigente para usuarios registrados en Comparador CSA</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-xs cursor-pointer"
          >
            Entendido y Aceptar
          </button>
        </div>
      </div>
    </div>
  );
};
