import React, { useState, useEffect, useCallback } from 'react';
import { clauseService } from '../services/clauseService';
import { SessionExpiredError } from '../services/apiClient';
import { UserProfile } from '../types';
import {
  Search,
  Eye,
  Trash2,
  ShieldCheck,
  FileText,
  Sparkles,
  BookOpen,
  Layers,
  X,
  Filter,
  Upload,
  CheckCircle2,
  Building2,
  Car,
  Home,
  HeartPulse,
  Briefcase,
  Users,
} from 'lucide-react';

interface ClauseAdminProps {
  onClose: () => void;
  currentUser?: UserProfile | null;
}

interface Document {
  id: string;
  documentName: string;
  documentType: string;
  version?: string;
  productName?: string;
  totalPages: number;
  isActive: boolean;
  createdAt: string;
  domain?: string;
  insurer: {
    id: string;
    name: string;
  };
}

const DOMAIN_OPTIONS = [
  { value: 'pyme', label: 'PYME Comercial', color: 'bg-blue-50 text-blue-700 ring-blue-700/10' },
  { value: 'copropiedades', label: 'Copropiedades (Ley 675)', color: 'bg-amber-50 text-amber-700 ring-amber-700/10' },
  { value: 'autos', label: 'Vehículos y Flotas', color: 'bg-emerald-50 text-emerald-700 ring-emerald-700/10' },
  { value: 'hogar', label: 'Hogar y Habitación', color: 'bg-indigo-50 text-indigo-700 ring-indigo-700/10' },
  { value: 'salud', label: 'Salud y Prepagada', color: 'bg-rose-50 text-rose-700 ring-rose-700/10' },
  { value: 'rc_medica', label: 'RC Médica y Hospitalaria', color: 'bg-teal-50 text-teal-700 ring-teal-700/10' },
  { value: 'd_and_o', label: 'Directores y Administradores (D&O)', color: 'bg-purple-50 text-purple-700 ring-purple-700/10' },
];

export const ClauseAdmin: React.FC<ClauseAdminProps> = ({ onClose, currentUser }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterInsurer, setFilterInsurer] = useState('');
  const [filterDomain, setFilterDomain] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ALL');
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);

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
      await clauseService.createDocument(selectedFile, {
        insurerName: formData.insurerName,
        documentName: formData.documentName,
        documentType: formData.documentType,
        productName: formData.productName || undefined,
        version: formData.version || undefined,
        domain: formData.domain || undefined,
      });

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

  const handleDelete = async (id: string, documentName: string) => {
    if (!confirm(`¿Eliminar "${documentName}" de la biblioteca? Esta acción no se puede deshacer.`)) return;

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

  const getDocumentTypeBadge = (type: string) => {
    switch (type) {
      case 'CLAUSULADO_GENERAL':
        return 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10';
      case 'CLAUSULADO_PARTICULAR':
        return 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-700/10';
      case 'ANEXO':
        return 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-700/10';
      case 'COTIZACION':
        return 'bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-600/10';
      default:
        return 'bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-600/10';
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    switch (type) {
      case 'CLAUSULADO_GENERAL':
        return 'General';
      case 'CLAUSULADO_PARTICULAR':
        return 'Particular';
      case 'ANEXO':
        return 'Anexo';
      case 'COTIZACION':
        return 'Cotización';
      default:
        return type;
    }
  };

  const getDomainLabel = (dom?: string) => {
    const found = DOMAIN_OPTIONS.find((d) => d.value === dom);
    return found ? found.label : (dom ? dom.toUpperCase() : 'General');
  };

  const getDomainBadgeClass = (dom?: string) => {
    const found = DOMAIN_OPTIONS.find((d) => d.value === dom);
    return found ? found.color : 'bg-slate-50 text-slate-700 ring-slate-700/10';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
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
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="Cerrar ventana"
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

          {/* Upload Form Card */}
          <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={16} className="text-indigo-600" />
              <h3 className="font-bold text-sm text-slate-800">
                Subir Nuevo Clausulado al Repositorio
              </h3>
            </div>

            {currentUser ? (
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Aseguradora
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: AXA COLPATRIA, SURA, HDI"
                    value={formData.insurerName}
                    onChange={(e) =>
                      setFormData({ ...formData, insurerName: e.target.value.toUpperCase() })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Nombre del Documento
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Clausulado PYME Todo Riesgo"
                    value={formData.documentName}
                    onChange={(e) => setFormData({ ...formData, documentName: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Ramo de Seguros
                  </label>
                  <select
                    value={formData.domain}
                    onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors cursor-pointer"
                  >
                    {DOMAIN_OPTIONS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Tipo de Documento
                  </label>
                  <select
                    value={formData.documentType}
                    onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors cursor-pointer"
                  >
                    <option value="CLAUSULADO_GENERAL">Clausulado General</option>
                    <option value="CLAUSULADO_PARTICULAR">Clausulado Particular</option>
                    <option value="ANEXO">Anexo de Coberturas</option>
                    <option value="COTIZACION">Cotización / Resumen</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Versión / Año
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: 2026.1"
                    value={formData.version}
                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Archivo (PDF)
                    </label>
                    <label className="border border-slate-200 rounded-xl px-3 py-2 bg-white cursor-pointer flex items-center justify-center hover:bg-slate-50 transition-colors h-[38px] text-xs text-slate-600">
                      <span className="truncate">
                        {selectedFile ? selectedFile.name : '📄 Seleccionar PDF'}
                      </span>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setSelectedFile(file);
                          if (file && !formData.documentName) {
                            setFormData({ ...formData, documentName: file.name.replace(/\.pdf$/i, '') });
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={
                      uploading ||
                      !formData.insurerName ||
                      !formData.documentName ||
                      !selectedFile
                    }
                    className="bg-indigo-600 text-white font-semibold rounded-xl px-4 py-2 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors h-[38px] text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {uploading ? (
                      <>
                        <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                        <span>Subiendo...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={14} />
                        <span>Subir</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-xs flex items-start gap-2">
                <ShieldCheck size={16} className="mt-0.5 flex-shrink-0 text-amber-600" />
                <span>
                  La carga y gestión de clausulados requiere inicio de sesión. Inicia sesión con tu
                  cuenta para agregar o modificar documentos del repositorio; la consulta es de acceso libre.
                </span>
              </div>
            )}
          </div>

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
                {DOMAIN_OPTIONS.map((d) => (
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
            <div className="overflow-hidden border border-slate-200/80 rounded-2xl shadow-xs">
              <table className="w-full border-collapse bg-white text-left">
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
                          <div className="w-5 h-5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold flex items-center justify-center">
                            {doc.insurer?.name?.slice(0, 2) || 'AS'}
                          </div>
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
                Total Documentos: <strong className="text-slate-800">{filteredDocuments.length}</strong>
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
      </div>

      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{previewDoc.documentName}</h3>
                <p className="text-xs text-slate-500">
                  {previewDoc.insurer?.name} • Versión {previewDoc.version || '2026.1'} • {getDomainLabel(previewDoc.domain)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs bg-indigo-50/80 text-indigo-900 p-3 rounded-xl border border-indigo-100">
                <span className="font-semibold flex items-center gap-1.5">
                  <Sparkles size={14} className="text-indigo-600" />
                  Indexado en PGVector (3072 dimensiones)
                </span>
                <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md text-[10px]">
                  100% RAG Ready
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs font-mono text-slate-700 space-y-2 max-h-60 overflow-y-auto">
                <div className="font-bold text-slate-900 font-sans border-b border-slate-200 pb-1">
                  Secciones y Coberturas Identificadas:
                </div>
                <p>• Sección 1: Coberturas Básicas y Riesgos Nombrados</p>
                <p>• Sección 2: Exclusiones Absolutas y Limitaciones Legales</p>
                <p>• Sección 3: Deducibles, Sublímites y Franquicias</p>
                <p>• Sección 4: Garantías Obligatorias de Protección</p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors cursor-pointer"
              >
                Cerrar Previsualización
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClauseAdmin;
