import React, { useState, useEffect } from 'react';
import { Library, Upload, Check, Search } from 'lucide-react';
import { clauseService } from '../services/clauseService';
import { ClauseSummary, InsurerSummary } from '../types';

interface ClauseSelectorProps {
    onClausesSelected: (clauseIds: string[]) => void;
    onModeChange: (mode: 'library' | 'upload') => void;
    mode: 'library' | 'upload';
}

export const ClauseSelector: React.FC<ClauseSelectorProps> = ({
    onClausesSelected,
    onModeChange,
    mode
}) => {
    const [clauses, setClauses] = useState<ClauseSummary[]>([]);
    const [insurers, setInsurers] = useState<InsurerSummary[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [filterInsurer, setFilterInsurer] = useState<string>('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (mode === 'library') {
            loadData();
        }
    }, [mode]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [clauseData, insurerData] = await Promise.all([
                clauseService.getClauses(),
                clauseService.getInsurers()
            ]);
            setClauses(clauseData);
            setInsurers(insurerData);
        } catch (err) {
            console.error('Error loading clauses:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleClause = (id: string) => {
        const newSelection = selectedIds.includes(id)
            ? selectedIds.filter(x => x !== id)
            : [...selectedIds, id];
        setSelectedIds(newSelection);
        onClausesSelected(newSelection);
    };

    const filteredClauses = filterInsurer
        ? clauses.filter(c => c.aseguradora === filterInsurer)
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
                                <option key={ins.aseguradora} value={ins.aseguradora}>
                                    {ins.aseguradora} ({ins.count})
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
                            {filteredClauses.map(clause => (
                                <label
                                    key={clause.id}
                                    className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors ${selectedIds.includes(clause.id) ? 'bg-indigo-50' : ''
                                        }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.includes(clause.id)}
                                        onChange={() => toggleClause(clause.id)}
                                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm text-gray-900 truncate">
                                            {clause.aseguradora} - {clause.producto}
                                        </div>
                                        <div className="text-xs text-gray-500 flex gap-2 items-center">
                                            <span>{clause.version}</span>
                                            <span>•</span>
                                            <span>~{Math.round(clause.tokensEstimados / 1000)}k tokens</span>
                                            {clause.tieneSecciones && (
                                                <>
                                                    <span>•</span>
                                                    <span className="text-green-600">Optimizado ✓</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    )}

                    {/* Selection Summary */}
                    {selectedIds.length > 0 && (
                        <div className="flex items-center gap-2 text-sm text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg">
                            <Check size={16} />
                            {selectedIds.length} clausulado{selectedIds.length > 1 ? 's' : ''} seleccionado{selectedIds.length > 1 ? 's' : ''}
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
