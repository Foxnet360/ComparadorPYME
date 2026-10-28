import React, { useState, useEffect, useMemo } from 'react';
import {
  Library,
  Upload,
  Check,
  ChevronDown,
  ChevronRight,
  Tag,
  BookOpen,
  Search,
  ShieldCheck,
  Filter,
} from 'lucide-react';
import { clauseService } from '../services/clauseService';
import { InsurerLogo } from './common/InsurerLogo';

interface ClauseSelectorProps {
  onClausesSelected: (clauseIds: string[]) => void;
  onModeChange: (mode: 'library' | 'upload') => void;
  mode: 'library' | 'upload';
  domain?: string;
}

interface Document {
  id: string;
  documentName: string;
  documentType: string;
  version?: string;
  productName?: string;
  isActive: boolean;
  domain?: string;
  insurer: {
    id: string;
    name: string;
  };
}

export const ClauseSelector: React.FC<ClauseSelectorProps> = ({
  onClausesSelected,
  onModeChange,
  mode,
  domain,
}) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedInsurers, setExpandedInsurers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterByDomain, setFilterByDomain] = useState<boolean>(true);

  useEffect(() => {
    if (mode === 'library') {
      loadData();
    }
  }, [mode]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const docs = await clauseService.getDocuments({ isActive: true });
      setDocuments(docs);

      // Auto-expand first insurer
      if (docs.length > 0) {
        setExpandedInsurers(new Set([docs[0]!.insurer?.name]));
      }
    } catch (err: unknown) {
      console.error('Error loading documents:', err);
      setError('Error al cargar clausulados de la biblioteca.');
    } finally {
      setLoading(false);
    }
  };

  const toggleDocument = (docId: string) => {
    const newSelection = selectedIds.includes(docId)
      ? selectedIds.filter((id) => id !== docId)
      : [...selectedIds, docId];
    setSelectedIds(newSelection);
    onClausesSelected(newSelection);
  };

  const toggleInsurer = (insurerName: string) => {
    const newExpanded = new Set(expandedInsurers);
    if (newExpanded.has(insurerName)) {
      newExpanded.delete(insurerName);
    } else {
      newExpanded.add(insurerName);
    }
    setExpandedInsurers(newExpanded);
  };

  const selectAllInInsurer = (insurerName: string, docs: Document[]) => {
    const docIds = docs.map((d) => d.id);
    const allSelected = docIds.every((id) => selectedIds.includes(id));

    let newSelection: string[];
    if (allSelected) {
      newSelection = selectedIds.filter((id) => !docIds.includes(id));
    } else {
      newSelection = [...new Set([...selectedIds, ...docIds])];
    }
    setSelectedIds(newSelection);
    onClausesSelected(newSelection);
  };

  // Filter documents by search and optional domain
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      if (filterByDomain && domain && doc.domain) {
        if (doc.domain.toLowerCase() !== domain.toLowerCase()) return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchName = doc.documentName?.toLowerCase().includes(query);
        const matchInsurer = doc.insurer?.name?.toLowerCase().includes(query);
        const matchProduct = doc.productName?.toLowerCase().includes(query);
        if (!matchName && !matchInsurer && !matchProduct) return false;
      }
      return true;
    });
  }, [documents, searchQuery, filterByDomain, domain]);

  // Group documents by insurer
  const groupedDocs = useMemo(() => {
    return filteredDocuments.reduce(
      (acc, doc) => {
        const insurerName = doc.insurer?.name || 'Otras Aseguradoras';
        if (!acc[insurerName]) acc[insurerName] = [];
        acc[insurerName].push(doc);
        return acc;
      },
      {} as Record<string, Document[]>
    );
  }, [filteredDocuments]);

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

  const getDocumentTypeBadge = (type: string) => {
    switch (type) {
      case 'CLAUSULADO_GENERAL':
        return 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10';
      case 'CLAUSULADO_PARTICULAR':
        return 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-700/10';
      case 'ANEXO':
        return 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-700/10';
      default:
        return 'bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-600/10';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 transition-all">
      {/* Header with Title and Mode Segmented Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <BookOpen size={18} />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Clausulados y Condiciones</h3>
            {domain && (
              <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                {domain}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Auditoría cruzada de exclusiones, deducibles y amparos oficiales
          </p>
        </div>

        {/* Mode Pill Selector */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => onModeChange('library')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              mode === 'library'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Library size={14} />
            Biblioteca
          </button>
          <button
            type="button"
            onClick={() => onModeChange('upload')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              mode === 'upload'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload size={14} />
            Subir PDFs
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Library Mode Content */}
      {mode === 'library' && (
        <div className="space-y-3">
          <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200/60 text-[11px] text-blue-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              <strong>Biblioteca Permanente Activa:</strong> Los clausulados subidos se conservan y
              reutilizan automáticamente sin volver a subirlos, indexados por firma criptográfica y
              ramo.
            </span>
          </div>

          {/* Real-time Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Buscar por aseguradora o documento..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Domain Filter Indicator & Toggle */}
          {domain && (
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs">
              <div className="flex items-center gap-1.5 text-slate-600">
                <Filter size={12} className="text-indigo-600 shrink-0" />
                <span>
                  Filtro por Ramo:{' '}
                  <strong className="uppercase text-slate-800">{domain}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setFilterByDomain(!filterByDomain)}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 underline transition-colors"
              >
                {filterByDomain ? 'Ver todos los ramos' : `Filtrar solo ${domain.toUpperCase()}`}
              </button>
            </div>
          )}

          {loading ? (
            <div className="py-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
              <span className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-600 border-t-transparent"></span>
              <span>Cargando repositorio de clausulados...</span>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="py-6 text-center text-slate-500 text-xs bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
              {searchQuery ? 'No se encontraron clausulados para esta búsqueda.' : 'No hay clausulados disponibles en la biblioteca.'}
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200/80 divide-y divide-slate-100 bg-white">
              {Object.entries(groupedDocs).map(([insurerName, docs]) => {
                const isExpanded = expandedInsurers.has(insurerName);
                const docsSelected = docs.filter((d) => selectedIds.includes(d.id));
                const allSelected = docs.length > 0 && docsSelected.length === docs.length;
                const someSelected = docsSelected.length > 0 && !allSelected;

                return (
                  <div key={insurerName} className="transition-colors">
                    {/* Insurer Group Header */}
                    <div
                      className="flex items-center gap-2.5 px-3.5 py-2.5 bg-slate-50/70 hover:bg-slate-100/80 cursor-pointer select-none transition-colors"
                      onClick={() => toggleInsurer(insurerName)}
                    >
                      <button type="button" className="text-slate-400 hover:text-slate-600">
                        {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </button>
                      <InsurerLogo insurerName={insurerName} size="xs" />
                      <span className="font-semibold text-xs text-slate-800">{insurerName}</span>
                      <span className="text-[10px] font-medium text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                        {docs.length}
                      </span>
                      <div className="flex-1" />
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someSelected;
                        }}
                        onChange={(e) => {
                          e.stopPropagation();
                          selectAllInInsurer(insurerName, docs);
                        }}
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-slate-300 cursor-pointer"
                        title="Seleccionar todos los de esta aseguradora"
                      />
                    </div>

                    {/* Documents in Insurer */}
                    {isExpanded && (
                      <div className="divide-y divide-slate-50 bg-white">
                        {docs.map((doc) => {
                          const isSelected = selectedIds.includes(doc.id);
                          return (
                            <label
                              key={doc.id}
                              className={`flex items-start gap-3 px-3.5 py-2.5 cursor-pointer transition-colors ${
                                isSelected ? 'bg-indigo-50/40' : 'hover:bg-slate-50/50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleDocument(doc.id)}
                                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-slate-300 mt-0.5 cursor-pointer"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-xs text-slate-800 truncate">
                                    {doc.documentName}
                                  </span>
                                  <span
                                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${getDocumentTypeBadge(
                                      doc.documentType
                                    )}`}
                                  >
                                    {getDocumentTypeLabel(doc.documentType)}
                                  </span>
                                  {doc.domain && (
                                    <span
                                      className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                                        domain && doc.domain.toLowerCase() === domain.toLowerCase()
                                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold'
                                          : 'bg-slate-100 text-slate-500'
                                      }`}
                                    >
                                      {doc.domain}
                                      {domain &&
                                        doc.domain.toLowerCase() === domain.toLowerCase() &&
                                        ' ✓ Coincide con Cotización'}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 flex flex-wrap gap-2.5 items-center mt-1">
                                  {doc.version && (
                                    <span className="flex items-center gap-1 font-mono text-[10px]">
                                      <Tag size={10} />
                                      v{doc.version}
                                    </span>
                                  )}
                                  {doc.productName && (
                                    <span className="text-slate-400">{doc.productName}</span>
                                  )}
                                  <span className="text-emerald-700 font-medium flex items-center gap-1 text-[10px]">
                                    <Check size={11} className="stroke-[2.5]" />
                                    Indexado y Verificado
                                  </span>
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Selection Badge Footer */}
          {selectedIds.length > 0 && (
            <div className="flex items-center justify-between text-xs text-indigo-800 bg-indigo-50/80 border border-indigo-200/70 px-3.5 py-2.5 rounded-xl">
              <div className="flex items-center gap-2 font-medium">
                <ShieldCheck size={16} className="text-indigo-600" />
                <span>
                  {selectedIds.length} clausulado{selectedIds.length > 1 ? 's' : ''} seleccionado
                  {selectedIds.length > 1 ? 's' : ''} para validación cruzada
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedIds([]);
                  onClausesSelected([]);
                }}
                className="text-[11px] text-indigo-600 hover:text-indigo-900 font-semibold underline cursor-pointer"
              >
                Limpiar selección
              </button>
            </div>
          )}
        </div>
      )}

      {/* Upload Mode Prompt */}
      {mode === 'upload' && (
        <div className="py-5 px-4 text-center rounded-xl border border-dashed border-indigo-200 bg-indigo-50/30">
          <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-2">
            <Upload size={18} />
          </div>
          <h4 className="text-xs font-bold text-slate-800">Cargar Clausulados Particulares</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Usa el área de arrastre inferior para adjuntar pólizas y condiciones particulares. El motor
            auditará automáticamente los deducibles y exclusiones frente a tus cotizaciones.
          </p>
        </div>
      )}
    </div>
  );
};

export default ClauseSelector;
