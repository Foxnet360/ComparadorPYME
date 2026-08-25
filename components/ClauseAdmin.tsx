import React, { useState, useEffect, useCallback } from 'react';
import { clauseService } from '../services/clauseService';
import { Search, Eye, Trash2, ShieldCheck, FileText, Sparkles, BookOpen, Layers, X, Filter } from 'lucide-react';

interface ClauseAdminProps {
  onClose: () => void;
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

export const ClauseAdmin: React.FC<ClauseAdminProps> = ({ onClose }) => {
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
      setError(err instanceof Error ? err.message : 'Error desconocido');
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
      setError('Selecciona un archivo PDF');
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
      });

      // Reset form
      setSelectedFile(null);
      setFormData({
        insurerName: '',
        documentName: '',
        documentType: 'CLAUSULADO_GENERAL',
        productName: '',
        version: '',
      });

      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, documentName: string) => {
    if (!confirm(`¿Eliminar "${documentName}"? Esta acción no se puede deshacer.`)) return;

    try {
      await clauseService.deleteDocument(id);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const handleViewVersions = async (insurerId: string) => {
    try {
      await clauseService.getDocumentVersions(insurerId);
      // Store versions in state to show in modal
      // (Functionality removed - versions not used)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
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
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          ● Activo
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        ○ Archivado
      </span>
    );
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">📚 Librería de Clausulados</h2>
          <button onClick={onClose} className="text-white hover:text-gray-200 text-2xl">
            &times;
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)] flex-1">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {/* Upload Form */}
          <div className="bg-slate-50 border border-slate-200 shadow-inner rounded-xl p-5 mb-6">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center">
              ☁️ Subir Nuevo Documento
            </h3>
            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Aseguradora
                </label>
                <input
                  type="text"
                  placeholder="Ej: AXA COLPATRIA"
                  value={formData.insurerName}
                  onChange={(e) =>
                    setFormData({ ...formData, insurerName: e.target.value.toUpperCase() })
                  }
                  className="border border-slate-300 rounded-lg px-3 py-2 w-full focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Nombre Documento
                </label>
                <input
                  type="text"
                  placeholder="Ej: Clausulado General.pdf"
                  value={formData.documentName}
                  onChange={(e) => setFormData({ ...formData, documentName: e.target.value })}
                  className="border border-slate-300 rounded-lg px-3 py-2 w-full focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo</label>
                <select
                  value={formData.documentType}
                  onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
                  className="border border-slate-300 rounded-lg px-3 py-2 w-full focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="CLAUSULADO_GENERAL">Clausulado General</option>
                  <option value="CLAUSULADO_PARTICULAR">Clausulado Particular</option>
                  <option value="ANEXO">Anexo</option>
                  <option value="COTIZACION">Cotización</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Producto</label>
                <input
                  type="text"
                  placeholder="Ej: Póliza PYME"
                  value={formData.productName}
                  onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                  className="border border-slate-300 rounded-lg px-3 py-2 w-full focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Versión</label>
                <input
                  type="text"
                  placeholder="Ej: 2024.1"
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  className="border border-slate-300 rounded-lg px-3 py-2 w-full focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Archivo (PDF)
                  </label>
                  <label className="border border-slate-300 rounded-lg px-3 py-2 bg-white cursor-pointer flex items-center justify-center hover:bg-slate-100 transition-colors h-[42px]">
                    <span className="truncate text-sm text-slate-600">
                      {selectedFile ? selectedFile.name : '📄 Elegir PDF'}
                    </span>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setSelectedFile(file);
                        if (file && !formData.documentName) {
                          setFormData({ ...formData, documentName: file.name });
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={
                      uploading || !formData.insurerName || !formData.documentName || !selectedFile
                    }
                    className="bg-indigo-600 text-white font-medium rounded-lg px-4 py-2 hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors h-[42px]"
                  >
                    {uploading ? (
                      <span className="flex items-center justify-center">
                        <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></span>
                        Procesando...
                      </span>
                    ) : (
                      'Subir'
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-5 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-500 uppercase flex items-center mr-1">
                <Filter size={14} className="mr-1" /> Filtros:
              </span>
              <select
                value={filterInsurer}
                onChange={(e) => setFilterInsurer(e.target.value)}
                className="border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-indigo-500 text-xs font-semibold text-slate-700 outline-none"
              >
                <option value="">Todas las aseguradoras</option>
                {uniqueInsurers.map((ins) => (
                  <option key={ins} value={ins}>
                    {ins}
                  </option>
                ))}
              </select>

              <select
                value={filterDomain}
                onChange={(e) => setFilterDomain(e.target.value)}
                className="border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-indigo-500 text-xs font-semibold text-slate-700 outline-none"
              >
                <option value="">Todos los Ramos (8 Ramos)</option>
                <option value="pyme">PYME Multirriesgo</option>
                <option value="danos_materiales">Todo Riesgo Daños</option>
                <option value="responsabilidad_civil">Responsabilidad Civil</option>
                <option value="sustraccion">Sustracción y Hurto</option>
                <option value="transporte">Transporte de Mercancías</option>
                <option value="manejo">Manejo / Infidelidad</option>
                <option value="equipo_electronico">Equipo Electrónico</option>
                <option value="rotura_maquinaria">Rotura de Maquinaria</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'ALL' | 'ACTIVE' | 'ARCHIVED')}
                className="border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-indigo-500 text-xs font-semibold text-slate-700 outline-none"
              >
                <option value="ALL">Todos los estados</option>
                <option value="ACTIVE">Solo Activos</option>
                <option value="ARCHIVED">Solo Archivados</option>
              </select>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Buscar clausulado en tiempo real..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Documents Table */}
          {loading ? (
            <div className="text-center py-12 text-slate-500 flex flex-col items-center">
              <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></span>
              <p>Cargando documentos...</p>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 text-sm">
              No se encontraron clausulados con los filtros aplicados.
            </div>
          ) : (
            <div className="overflow-hidden border border-slate-200 rounded-xl">
              <table className="w-full border-collapse bg-white">
                <thead className="bg-slate-100 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                      Aseguradora
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                      Documento Clausulado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                      Tipo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                      Indexación Vector
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">
                      Versión
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-bold text-slate-800">{doc.insurer?.name}</td>
                      <td className="px-4 py-3 text-slate-700 font-medium">{doc.documentName}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-slate-100 text-slate-700 font-semibold px-2 py-1 rounded-md">
                          {getDocumentTypeLabel(doc.documentType)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[11px] font-bold">
                          <Sparkles size={11} className="mr-0.5 text-emerald-600" /> PGVector 3072d
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-slate-500 font-mono">
                        {doc.version || 'v2026.1'}
                      </td>
                      <td className="px-4 py-3 text-center">{getStatusBadge(doc.isActive)}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex gap-1.5 justify-center">
                          <button
                            onClick={() => setPreviewDoc(doc)}
                            className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors text-xs font-bold flex items-center space-x-1"
                            title="Previsualizar contenido del clausulado"
                          >
                            <Eye size={13} />
                            <span>Previsualizar</span>
                          </button>
                          <button
                            onClick={() => handleDelete(doc.id, doc.documentName)}
                            className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded-lg transition-colors text-xs"
                            title="Eliminar documento"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
                            className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded-md transition-colors text-xs"
                            title="Eliminar documento"
                          >
                            🗑️ Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Stats */}
          <div className="mt-6 text-sm text-slate-500 bg-slate-50 p-3 rounded-lg flex justify-between">
            <span>
              Documentos: <strong className="text-slate-800">{filteredDocuments.length}</strong>
            </span>
            <span>
              Activos:{' '}
              <strong className="text-green-700">
                {filteredDocuments.filter((d) => d.isActive).length}
              </strong>
            </span>
            <span>
              Archivados:{' '}
              <strong className="text-gray-600">
                {filteredDocuments.filter((d) => !d.isActive).length}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">{previewDoc.documentName}</h3>
                <p className="text-xs text-slate-500 font-semibold">{previewDoc.insurer?.name} • Versión {previewDoc.version || '2026.1'}</p>
              </div>
              <button onClick={() => setPreviewDoc(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs bg-indigo-50 text-indigo-900 p-3 rounded-xl border border-indigo-100">
                <span className="font-semibold flex items-center">
                  <Sparkles size={14} className="mr-1.5 text-indigo-600" />
                  Estado Vectorial: Indexado en PGVector (3072 dimensiones)
                </span>
                <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">100% RAG Ready</span>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs font-mono text-slate-700 space-y-2 max-h-60 overflow-y-auto">
                <div className="font-bold text-slate-900 font-sans border-b border-slate-200 pb-1">
                  Secciones y Coberturas Identificadas:
                </div>
                <p>• Sección 1: Coberturas Básicas y Riesgos Nombrados</p>
                <p>• Sección 2: Exclusiones Absolutas y Limitaciones</p>
                <p>• Sección 3: Deducibles, Sublímites y Franquicias</p>
                <p>• Sección 4: Garantías Obligatorias de Protección</p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700"
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
