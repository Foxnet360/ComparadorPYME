import React, { useState, useEffect } from 'react';
import { Library, Upload, Check, Search } from 'lucide-react';
import { clauseService } from '../services/clauseService';

interface ClauseSelectorProps {
    onClausesSelected: (clauseIds: string[]) => void;
    onModeChange: (mode: 'library' | 'upload') => void;
    mode: 'library' | 'upload';
}

interface RAGClause {
    insurerName: string;
    documentName: string;
    chunkCount: number;
}

export const ClauseSelector: React.FC<ClauseSelectorProps> = ({
    onClausesSelected,
    onModeChange,
    mode
}) => {
    const [clauses, setClauses] = useState<RAGClause[]>([]);
    const [insurers, setInsurers] = useState<string[]>([]);
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [filterInsurer, setFilterInsurer] = useState<string>('');
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
            // Use RAG endpoints instead of legacy Firestore endpoints
            const clauseData = await clauseService.ragGetClauses();
            setClauses(clauseData);
            
            // Extract unique insurers from clauses
            const uniqueInsurers = [...new Set(clauseData.map(c => c.insurerName))];
            setInsurers(uniqueInsurers);
        } catch (err: any) {
            console.error('Error loading clauses:', err);
            setError('Error al cargar cláusulas. El servicio puede no estar disponible.');
        } finally {
            setLoading(false);
        }
    };

    const toggleClause = (insurerName: string, documentName: string) => {
        const key = `${insurerName}::${documentName}`;
        const newSelection = selectedItems.includes(key)
            ? selectedItems.filter(x => x !== key)
            : [...selectedItems, key];
        setSelectedItems(newSelection);
        onClausesSelected(newSelection);
    };

    const filteredClauses = filterInsurer
        ? clauses.filter(c => c.insurerName === filterInsurer)
        : clauses;

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Clausulados</h3>

            {/* Mode Toggle */}
            <div className="flex gap-2 mb-4">
                <button
                    onClick={() => onModeChange('library')}
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-2 ${mode === 'library'
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                >
                    <Library size={16} />
                    Biblioteca
                </button>
                <button
                    onClick={() => onModeChange('upload')}
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-2 ${mode === 'upload'
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
                    {/* Insurer Filter */}
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <select
                            value={filterInsurer}
                            onChange={(e) => setFilterInsurer(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="">Todas las aseguradoras</option>
                            {insurers.map(ins => (
                                <option key={ins} value={ins}>
                                    {ins}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Clause List */}
                    {loading ? (
                        <div className="text-center py-4 text-gray-500 text-sm">Cargando...</div>
                    ) : filteredClauses.length === 0 ? (
                        <div className="text-center py-4 text-gray-500 text-sm">
                            No hay clausulados en la biblioteca
                        </div>
                    ) : (
                        <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y">
                            {filteredClauses.map((clause, idx) => {
                                const key = `${clause.insurerName}::${clause.documentName}`;
                                return (
                                    <label
                                        key={idx}
                                        className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors ${selectedItems.includes(key) ? 'bg-indigo-50' : ''}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedItems.includes(key)}
                                            onChange={() => toggleClause(clause.insurerName, clause.documentName)}
                                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm text-gray-900 truncate">
                                                {clause.insurerName} - {clause.documentName}
                                            </div>
                                            <div className="text-xs text-gray-500 flex gap-2 items-center">
                                                <span>{clause.chunkCount} chunks</span>
                                                <span className="text-green-600">Indexado ✓</span>
                                            </div>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    )}

                    {/* Selection Summary */}
                    {selectedItems.length > 0 && (
                        <div className="flex items-center gap-2 text-sm text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg">
                            <Check size={16} />
                            {selectedItems.length} clausulado{selectedItems.length > 1 ? 's' : ''} seleccionado{selectedItems.length > 1 ? 's' : ''}
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
