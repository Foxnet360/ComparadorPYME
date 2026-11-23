import React from 'react';
import { Sparkles, X } from 'lucide-react';
import { Modal } from '../common/Modal';
import { getDocumentTypeLabel, getDomainLabel, type ClauseDocumentItem } from './clauseMetadata';

interface ClausePreviewModalProps {
  doc: ClauseDocumentItem | null;
  onClose: () => void;
}

export const ClausePreviewModal: React.FC<ClausePreviewModalProps> = ({ doc, onClose }) => (
  <Modal
    isOpen={doc !== null}
    onClose={onClose}
    zIndexClass="z-[60]"
    maxWidthClass="max-w-xl"
    containerClassName="p-6 space-y-4"
  >
    {doc && (
      <>
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">{doc.documentName}</h3>
            <p className="text-xs text-slate-500">
              {doc.insurer?.name} • Versión {doc.version || 'No especificada'} •{' '}
              {getDomainLabel(doc.domain)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar previsualización"
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs bg-indigo-50/80 text-indigo-900 p-3 rounded-xl border border-indigo-100">
            <span className="font-semibold flex items-center gap-1.5">
              <Sparkles size={14} className="text-indigo-600" />
              Metadatos reales del documento indexado
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                doc.isActive
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20'
                  : 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20'
              }`}
            >
              {doc.isActive ? 'Activo' : 'Archivado'}
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-700">
            <div>
              <dt className="text-slate-500 font-medium">Aseguradora</dt>
              <dd className="font-semibold text-slate-900">{doc.insurer?.name || 'N/D'}</dd>
            </div>
            <div>
              <dt className="text-slate-500 font-medium">Tipo de documento</dt>
              <dd className="font-semibold text-slate-900">
                {getDocumentTypeLabel(doc.documentType)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 font-medium">Ramo</dt>
              <dd className="font-semibold text-slate-900">{getDomainLabel(doc.domain)}</dd>
            </div>
            <div>
              <dt className="text-slate-500 font-medium">Producto</dt>
              <dd className="font-semibold text-slate-900">{doc.productName || 'General'}</dd>
            </div>
            <div>
              <dt className="text-slate-500 font-medium">Páginas</dt>
              <dd className="font-semibold text-slate-900">
                {doc.totalPages > 0 ? `${doc.totalPages} págs.` : 'No reportado'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 font-medium">Fecha de registro</dt>
              <dd className="font-semibold text-slate-900">
                {doc.createdAt
                  ? new Date(doc.createdAt).toLocaleDateString('es-CO')
                  : 'No disponible'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            Cerrar Previsualización
          </button>
        </div>
      </>
    )}
  </Modal>
);
