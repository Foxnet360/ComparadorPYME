import React, { useState } from 'react';
import {
  ShieldCheck,
  ArrowLeft,
  FileText,
  Lock,
  Scale,
  Calendar,
  CheckCircle2,
  Printer,
} from 'lucide-react';
import {
  ALL_LEGAL_DOCUMENTS,
  TERMS_OF_SERVICE,
  LegalDocument,
} from '../src/data/legalContent';

interface LegalPageProps {
  onBack: () => void;
  defaultTab?: 'terms' | 'privacy' | 'security' | 'disclaimer';
}

export const LegalPage: React.FC<LegalPageProps> = ({ onBack, defaultTab = 'terms' }) => {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy' | 'security' | 'disclaimer'>(
    defaultTab
  );

  const currentDoc: LegalDocument =
    ALL_LEGAL_DOCUMENTS.find((d) => d.id === activeTab) || TERMS_OF_SERVICE;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 p-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver</span>
            </button>
            <div className="h-5 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-600 text-white">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="font-bold text-slate-800 text-sm">
                Comparador CSA — Marco Legal y Normativo
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir</span>
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Sidebar Nav */}
          <div className="md:col-span-1 space-y-2">
            <div className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-3 px-3">
              Documentos Legales
            </div>
            {ALL_LEGAL_DOCUMENTS.map((doc) => {
              const isActive = activeTab === doc.id;
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setActiveTab(doc.id)}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  {doc.id === 'terms' && <FileText className="w-4 h-4 shrink-0" />}
                  {doc.id === 'privacy' && <Lock className="w-4 h-4 shrink-0" />}
                  {doc.id === 'security' && <ShieldCheck className="w-4 h-4 shrink-0" />}
                  {doc.id === 'disclaimer' && <Scale className="w-4 h-4 shrink-0" />}
                  <span>{doc.shortTitle}</span>
                </button>
              );
            })}

            <div className="mt-8 p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl text-xs text-indigo-900 space-y-2">
              <span className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                Habeas Data Certificado
              </span>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Toda la recolección y tratamiento de datos se rige por la Ley 1581 de 2012 y el
                Decreto 1377 de 2013 de la República de Colombia.
              </p>
            </div>
          </div>

          {/* Document Content View */}
          <div className="md:col-span-3 bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            {/* Header info */}
            <div className="border-b border-slate-100 pb-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <h1 className="text-xl font-extrabold text-slate-900">{currentDoc.title}</h1>
                <div className="flex items-center gap-2 font-mono text-xs text-slate-500">
                  <span className="bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> {currentDoc.lastUpdated}
                  </span>
                  <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold">
                    v{currentDoc.version}
                  </span>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">{currentDoc.summary}</p>
            </div>

            {/* Sections */}
            <div className="space-y-6 divide-y divide-slate-100">
              {currentDoc.sections.map((section, idx) => (
                <section key={section.id} className={idx > 0 ? 'pt-6' : ''}>
                  <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <span className="text-indigo-600 text-xs">§</span>
                    {section.title}
                  </h2>
                  <div className="space-y-2 text-slate-600 text-xs sm:text-sm pl-4 border-l-2 border-indigo-100/60">
                    {section.content.map((p, pIdx) => (
                      <p key={pIdx} className="leading-relaxed">
                        {p}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {/* Contact / Help block */}
            <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500 bg-slate-50 p-4 rounded-xl">
              <div>
                <span className="font-semibold text-slate-700 block">
                  ¿Preguntas sobre esta política o ejercicio de derechos ARCO?
                </span>
                <span>Canal oficial de atención: privacidad@comparadorcsa.com</span>
              </div>
              <button
                type="button"
                onClick={onBack}
                className="px-3.5 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors shrink-0"
              >
                Volver a la Plataforma
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        © 2026 Comparador CSA — Plataforma de Auditoría de Seguros. Bogotá D.C., Colombia.
      </footer>
    </div>
  );
};

export default LegalPage;
