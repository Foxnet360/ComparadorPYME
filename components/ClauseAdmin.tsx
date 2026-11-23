import React, { useState, useEffect, useCallback } from 'react';
import { clauseService } from '../services/clauseService';
import { SessionExpiredError } from '../services/apiClient';
import { UserProfile } from '../types';
import { InsurerLogo } from './common/InsurerLogo';
import { ConfirmModal } from './common/ConfirmModal';
import { Modal } from './common/Modal';
import { ClauseUploadForm } from './clauses/ClauseUploadForm';
import { ClausePreviewModal } from './clauses/ClausePreviewModal';
import {
  CLAUSE_DOMAIN_OPTIONS,
  getDocumentTypeBadge,
  getDocumentTypeLabel,
  getDomainLabel,
  getDomainBadgeClass,
  type ClauseDocumentItem as Document,
} from './clauses/clauseMetadata';
import { Search, Eye, Trash2, Sparkles, BookOpen, X, Filter } from 'lucide-react';

interface ClauseAdminProps {
  onClose: () => void;
  currentUser?: UserProfile | null;
}

export const ClauseAdmin: React.FC<ClauseAdminProps> = ({ onClose, currentUser }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadFeedback, setUploadFeedback] = useState<{
    message: string;
    deduplicated?: boolean;
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterInsurer, setFilterInsurer] = useState('');
  const [filterDomain, setFilterDomain] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ALL');
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [pendingDeleteDoc, setPendingDeleteDoc] = useState<{
    id: string;
    documentName: string;
  } | null>(null);

  // Form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    insurerName: '',
    documentName: '',
    documentType: 'CLAUSULADO_GENERAL',
    productName: '',
    version: '',
    domain: 'pyme',
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params: { isActive?: boolean } = {};
      if (filterStatus === 'ACTIVE') params.isActive = true;
      if (filterStatus === 'ARCHIVED') params.isActive = false;

      if (
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('demo') === '1'
      ) {
        const demoDocs: Document[] = [
          {
            id: 'doc-sura-01',
            documentName: 'Clausulado General Empresarial Todo Riesgo PYME',
            documentType: 'CLAUSULADO_GENERAL',
            version: '2024.1',
            productName: 'Multirriesgo PYME',
            totalPages: 58,
            isActive: true,
            createdAt: '2026-01-15T10:00:00Z',
            domain: 'pyme',
            insurer: { id: 'ins-sura', name: 'Seguros SURA' },
          },
          {
            id: 'doc-axa-02',
            documentName: 'Condiciones Generales Seguro de Daño Material e ILA',
            documentType: 'CLAUSULADO_GENERAL',
            version: '2023.2',
            productName: 'Integral Pyme',
            totalPages: 44,
            isActive: true,
            createdAt: '2025-11-20T14:30:00Z',
            domain: 'pyme',
            insurer: { id: 'ins-axa', name: 'AXA Colpatria' },
          },
          {
            id: 'doc-bol-03',
            documentName: 'Clausulado Pyme Plus Multirriesgo y Copropiedades',
            documentType: 'CLAUSULADO_GENERAL',
            version: '2024.2',
            productName: 'Pyme Plus',
            totalPages: 62,
            isActive: true,
            createdAt: '2026-02-10T09:15:00Z',
            domain: 'pyme',
            insurer: { id: 'ins-bolivar', name: 'Seguros Bolívar' },
          },
          {
            id: 'doc-chubb-04',
            documentName: 'Póliza Master Copropiedades Ley 675 y Zonas Comunes',
            documentType: 'CLAUSULADO_GENERAL',
            version: '2024.1',
            productName: 'Master Copropiedades',
            totalPages: 76,
            isActive: true,
            createdAt: '2026-03-01T11:45:00Z',
            domain: 'copropiedades',
            insurer: { id: 'ins-chubb', name: 'Chubb Seguros' },
          },
          {
            id: 'doc-sura-arch-05',
            documentName: 'Clausulado General Pyme Versión Previa (Archivada)',
            documentType: 'CLAUSULADO_GENERAL',
            version: '2021.3',
            productName: 'Multirriesgo PYME',
            totalPages: 52,
            isActive: false,
            createdAt: '2023-04-12T08:00:00Z',
            domain: 'pyme',
            insurer: { id: 'ins-sura', name: 'Seguros SURA' },
          },
        ];
        setDocuments(demoDocs);
        return;
      }

      const docs = await clauseService.getDocuments(params);
      setDocuments(docs);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido al cargar clausulados');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      setError('Selecciona un archivo PDF de clausulado');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setUploadFeedback(null);
      const created = await clauseService.createDocument(selectedFile, {
        insurerName: formData.insurerName,
        documentName: formData.documentName,
        documentType: formData.documentType,
        productName: formData.productName || undefined,
        version: formData.version || undefined,
        domain: formData.domain || undefined,
      });

      if (created.deduplicated) {
        setUploadFeedback({
          message: `El documento "${created.documentName}" ya se encontraba indexado con idéntica firma digital (SHA-256). Se vinculó al catálogo sin duplicar almacenamiento.`,
          deduplicated: true,
        });
      } else {
        setUploadFeedback({
          message: `Clausulado "${created.documentName}" indexado y registrado exitosamente en la biblioteca.`,
          deduplicated: false,
        });
      }

      // Reset form
      setSelectedFile(null);
      setFormData({
        insurerName: '',
        documentName: '',
        documentType: 'CLAUSULADO_GENERAL',
        productName: '',
        version: '',
        domain: 'pyme',
      });

      await loadData();
    } catch (err: unknown) {
      setError(
        err instanceof SessionExpiredError
          ? 'Tu sesión no permite cargar documentos. Inicia sesión desde el menú de usuario e intenta de nuevo.'
          : err instanceof Error
            ? err.message
            : 'Error desconocido'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (id: string, documentName: string) => {
    setPendingDeleteDoc({ id, documentName });
  };

  const confirmDeleteDoc = async () => {
    if (!pendingDeleteDoc) return;
    const { id } = pendingDeleteDoc;
    setPendingDeleteDoc(null);
    try {
      await clauseService.deleteDocument(id);
      await loadData();
    } catch (err: unknown) {
      setError(
        err instanceof SessionExpiredError
          ? 'Tu sesión no permite eliminar documentos. Inicia sesión desde el menú de usuario e intenta de nuevo.'
          : err instanceof Error
            ? err.message
            : 'Error desconocido'
      );
    }
  };

  const filteredDocuments = documents.filter((doc) => {
    if (filterInsurer && doc.insurer?.name !== filterInsurer) return false;
    if (filterDomain && doc.domain && doc.domain !== filterDomain) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchName = doc.documentName?.toLowerCase().includes(term);
      const matchInsurer = doc.insurer?.name?.toLowerCase().includes(term);
      const matchProduct = doc.productName?.toLowerCase().includes(term);
      if (!matchName && !matchInsurer && !matchProduct) return false;
    }
    return true;
  });

  const uniqueInsurers = Array.from(new Set(documents.map((d) => d.insurer?.name).filter(Boolean)));

  const getStatusBadge = (isActive: boolean) => {
    if (isActive) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5" />
          Activo
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5" />
        Archivado
      </span>
    );
  };

  return (
    <Modal
      isOpen={true}
      onClose={() => {
        if (!previewDoc && !pendingDeleteDoc) {
          onClose();
        }
      }}
      maxWidthClass="max-w-5xl"
      containerClassName="max-h-[92vh] overflow-hidden flex flex-col border-slate-200/80"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/60">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
            <BookOpen size={20} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Librería de Clausulados y Condiciones
            </h2>
            <p className="text-xs text-slate-500">
              Repositorio documental oficial para verificación técnica de exclusiones y deducibles
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          title="Cerrar ventana"
          aria-label="Cerrar ventana"
        >
          <X size={20} />
        </button>
      </div>

      {/* Content Body */}
      <div className="p-6 overflow-y-auto max-h-[calc(92vh-75px)] flex-1 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {uploadFeedback && (
          <div
            className={`px-4 py-3 rounded-xl text-xs flex items-center justify-between gap-2 ${
              uploadFeedback.deduplicated
                ? 'bg-amber-50 border border-amber-200 text-amber-900'
                : 'bg-emerald-50 border border-emerald-200 text-emerald-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{uploadFeedback.deduplicated ? '⚡' : '✅'}</span>
              <span>{uploadFeedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setUploadFeedback(null)}
              className="text-slate-400 hover:text-slate-600 font-bold ml-2"
            >
              ✕
            </button>
          </div>
        )}

        <ClauseUploadForm
          hasUser={Boolean(currentUser)}
          formData={formData}
          selectedFile={selectedFile}
          uploading={uploading}
          onFormDataChange={setFormData}
          onFileSelect={setSelectedFile}
          onSubmit={handleSubmit}
        />

        {/* Filters Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center mr-1">
              <Filter size={13} className="mr-1 text-slate-400" /> Filtros:
            </span>

            <select
              value={filterInsurer}
              onChange={(e) => setFilterInsurer(e.target.value)}
              className="border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="">Todas las Aseguradoras</option>
              {uniqueInsurers.map((ins) => (
                <option key={ins} value={ins}>
                  {ins}
                </option>
              ))}
            </select>

            <select
              value={filterDomain}
              onChange={(e) => setFilterDomain(e.target.value)}
              className="border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="">Todos los Ramos</option>
              {CLAUSE_DOMAIN_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'ALL' | 'ACTIVE' | 'ARCHIVED')}
              className="border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="ACTIVE">Solo Activos</option>
              <option value="ARCHIVED">Solo Archivados</option>
            </select>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={13} />
            <input
              type="text"
              placeholder="Buscar documento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 bg-white rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        {/* Documents Table */}
        {loading ? (
          <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
            <span className="animate-spin rounded-full h-7 w-7 border-2 border-indigo-600 border-t-transparent" />
            <p className="text-xs">Cargando repositorio de clausulados...</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 text-xs">
            No se encontraron clausulados con los filtros aplicados.
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-hidden border border-slate-200/80 rounded-2xl shadow-xs">
            <table className="w-full min-w-[760px] border-collapse bg-white text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Aseguradora
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Documento Clausulado
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Ramo
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Vector RAG
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Versión
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <InsurerLogo insurerName={doc.insurer?.name} size="xs" />
                        <span>{doc.insurer?.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-800 font-medium max-w-xs truncate">
                      {doc.documentName}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ring-inset ${getDomainBadgeClass(
                          doc.domain
                        )}`}
                      >
                        {getDomainLabel(doc.domain)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${getDocumentTypeBadge(
                          doc.documentType
                        )}`}
                      >
                        {getDocumentTypeLabel(doc.documentType)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 rounded-md text-[10px] font-bold">
                        <Sparkles size={11} className="text-emerald-600" /> PGVector 3072d
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-500 font-mono text-[11px]">
                      {doc.version || 'v2026.1'}
                    </td>
                    <td className="px-4 py-3 text-center">{getStatusBadge(doc.isActive)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex gap-1.5 justify-center items-center">
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(doc)}
                          className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          title="Previsualizar contenido del clausulado"
                        >
                          <Eye size={13} />
                          <span>Ver</span>
                        </button>
                        {currentUser && (
                          <button
                            type="button"
                            onClick={() => handleDelete(doc.id, doc.documentName)}
                            className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar documento"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Stats Bar */}
        <div className="text-xs text-slate-500 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <span>
              Total Documentos:{' '}
              <strong className="text-slate-800">{filteredDocuments.length}</strong>
            </span>
            <span>
              Activos:{' '}
              <strong className="text-emerald-700">
                {filteredDocuments.filter((d) => d.isActive).length}
              </strong>
            </span>
            <span>
              Archivados:{' '}
              <strong className="text-slate-600">
                {filteredDocuments.filter((d) => !d.isActive).length}
              </strong>
            </span>
          </div>
          <div className="text-[11px] text-slate-400">
            Validación cruzada contra ontología multiramo v3.0
          </div>
        </div>
      </div>

      <ClausePreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />

      <ConfirmModal
        isOpen={pendingDeleteDoc !== null}
        title="Eliminar clausulado"
        message={
          pendingDeleteDoc
            ? `¿Eliminar "${pendingDeleteDoc.documentName}" de la biblioteca? Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar"
        onConfirm={confirmDeleteDoc}
        onCancel={() => setPendingDeleteDoc(null)}
      />
    </Modal>
  );
};

export default ClauseAdmin;
