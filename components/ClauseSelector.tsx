import React, { useState, useEffect } from 'react';
import { Library, Upload, Check, ChevronDown, ChevronRight, Tag } from 'lucide-react';
import { clauseService } from '../services/clauseService';

interface ClauseSelectorProps {
  onClausesSelected: (clauseIds: string[]) => void;
  onModeChange: (mode: 'library' | 'upload') => void;
  mode: 'library' | 'upload';
}

interface Document {
  id: string;
  documentName: string;
  documentType: string;
  version?: string;
  productName?: string;
  isActive: boolean;
  insurer: {
    id: string;
    name: string;
  };
}

export const ClauseSelector: React.FC<ClauseSelectorProps> = ({
  onClausesSelected,
  onModeChange,
  mode,
}) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedInsurers, setExpandedInsurers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError('Error al cargar cláusulas. El servicio puede no estar disponible.');
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

  // Group documents by insurer
  const groupedDocs = documents.reduce(
    (acc, doc) => {
      const insurerName = doc.insurer?.name || 'Sin Aseguradora';
      if (!acc[insurerName]) acc[insurerName] = [];
      acc[insurerName].push(doc);
      return acc;
    },
    {} as Record<string, Document[]>
  );

  const getDocumentTypeLabel = (type: string) => {
    switch (type) {
      case 'CLAUSULADO_GENERAL':
        return 'General';
      case 'CLAUSULADO_PARTICULAR':
        return 'Particular';
      case 'ANEXO':
        return 'Anexo';
      default:
        return type;
    }
  };

  const getDocumentTypeColor = (type: string) => {
    switch (type) {
      case 'CLAUSULADO_GENERAL':
        return 'bg-blue-100 text-blue-700';
      case 'CLAUSULADO_PARTICULAR':
        return 'bg-purple-100 text-purple-700';
      case 'ANEXO':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Clausulados</h3>

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => onModeChange('library')}
          className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            mode === 'library'
              ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
              : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Library size={16} />
          Biblioteca
        </button>
        <button
          onClick={() => onModeChange('upload')}
          className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            mode === 'upload'
              ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
              : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Upload size={16} />
          Subir archivos
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Library Mode Content */}
      {mode === 'library' && (
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-4 text-gray-500 text-sm flex items-center justify-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-600 border-t-transparent"></span>
              Cargando...
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-4 text-gray-500 text-sm">
              No hay clausulados en la biblioteca
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
              {Object.entries(groupedDocs).map(([insurerName, docs]) => {
                const isExpanded = expandedInsurers.has(insurerName);
                const docsSelected = docs.filter((d) => selectedIds.includes(d.id));
                const allSelected = docs.length > 0 && docsSelected.length === docs.length;
                const someSelected = docsSelected.length > 0 && !allSelected;

                return (
                  <div key={insurerName} className="border-b border-gray-100 last:border-b-0">
                    {/* Insurer Header */}
                    <div
                      className="flex items-center gap-2 p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => toggleInsurer(insurerName)}
                    >
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      <span className="font-medium text-sm text-gray-900">{insurerName}</span>
                      <span className="text-xs text-gray-500">({docs.length})</span>
                      <div className="flex-1"></div>
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
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                    </div>

                    {/* Documents List */}
                    {isExpanded && (
                      <div className="divide-y divide-gray-50">
                        {docs.map((doc) => (
                          <label
                            key={doc.id}
                            className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors ${selectedIds.includes(doc.id) ? 'bg-indigo-50' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(doc.id)}
                              onChange={() => toggleDocument(doc.id)}
                              className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-gray-900 truncate">
                                  {doc.documentName}
                                </span>
                                <span
                                  className={`text-xs px-1.5 py-0.5 rounded ${getDocumentTypeColor(doc.documentType)}`}
                                >
                                  {getDocumentTypeLabel(doc.documentType)}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 flex gap-2 items-center mt-1">
                                {doc.version && (
                                  <span className="flex items-center gap-1">
                                    <Tag size={10} />v{doc.version}
                                  </span>
                                )}
                                {doc.productName && (
                                  <span className="text-gray-400">{doc.productName}</span>
                                )}
                                <span className="text-green-600 flex items-center gap-1">
                                  <Check size={10} />
                                  Indexado
                                </span>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Selection Summary */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg">
              <Check size={16} />
              {selectedIds.length} documento{selectedIds.length > 1 ? 's' : ''} seleccionado
              {selectedIds.length > 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* Upload Mode - will be handled by parent */}
      {mode === 'upload' && (
        <div className="text-center py-4 text-gray-500 text-sm">
          Use el área de arrastre para subir clausulados
        </div>
      )}
    </div>
  );
};

export default ClauseSelector;
