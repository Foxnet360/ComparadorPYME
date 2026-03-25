import React, { useState, useEffect, useCallback } from 'react';
import { InsurerSummary } from '../types';
import { clauseService } from '../services/clauseService';

interface ClauseAdminProps {
    onClose: () => void;
}

interface RAGClause {
    insurerName: string;
    documentName: string;
    chunkCount: number;
}

export const ClauseAdmin: React.FC<ClauseAdminProps> = ({ onClose }) => {
    const [clauses, setClauses] = useState<RAGClause[]>([]);
    const [insurers, setInsurers] = useState<InsurerSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filterInsurer, setFilterInsurer] = useState<string>('');

    // Form state
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [formData, setFormData] = useState({
        insurerName: '',
        documentName: '',
        documentType: 'CLAUSULADO'
    });

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const clauseData = await clauseService.ragGetClauses(filterInsurer || undefined);
            const insurerData = await clauseService.getInsurers(); // Keep original if we still want old insurers mix?
            setClauses(clauseData);
            setInsurers(insurerData);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [filterInsurer]);

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
            await clauseService.ragCreateClause(selectedFile, {
                insurerName: formData.insurerName,
                documentName: formData.documentName,
                documentType: formData.documentType
            });

            // Reset form
            setSelectedFile(null);
            setFormData({ insurerName: '', documentName: '', documentType: 'CLAUSULADO' });

            await loadData();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (insurerName: string, documentName: string) => {
        if (!confirm('¿Eliminar este clausulado RAG?')) return;

        try {
            await clauseService.ragDeleteClause(insurerName, documentName);
            await loadData();
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="bg-gradient-to-r from-indigo-600 to-purple-700 px-6 py-4 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">📚 Librería RAG (Vectorial)</h2>
                    <button onClick={onClose} className="text-white hover:text-gray-200 text-2xl">&times;</button>
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
                            ☁️ Indexar Nuevo Documento RAG
                        </h3>
                        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Aseguradora</label>
                                <input
                                    type="text"
                                    placeholder="Ej: SURAMERICANA"
                                    value={formData.insurerName}
                                    onChange={e => setFormData({ ...formData, insurerName: e.target.value.toUpperCase() })}
                                    className="border border-slate-300 rounded-lg px-3 py-2 w-full focus:ring-indigo-500 focus:border-indigo-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre Documento</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Póliza General.pdf"
                                    value={formData.documentName}
                                    onChange={e => setFormData({ ...formData, documentName: e.target.value })}
                                    className="border border-slate-300 rounded-lg px-3 py-2 w-full focus:ring-indigo-500 focus:border-indigo-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Archivo (PDF)</label>
                                <label className="border border-slate-300 rounded-lg px-3 py-2 bg-white cursor-pointer flex items-center justify-center hover:bg-slate-100 transition-colors h-[42px]">
                                    <span className="truncate text-sm text-slate-600">
                                        {selectedFile ? selectedFile.name : '📄 Elegir PDF'}
                                    </span>
                                    <input
                                        type="file"
                                        accept=".pdf"
                                        onChange={e => {
                                            const file = e.target.files?.[0] || null;
                                            setSelectedFile(file);
                                            // Autofill document name if empty
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
                                    disabled={uploading || !formData.insurerName || !formData.documentName || !selectedFile}
                                    className="bg-indigo-600 w-full text-white font-medium rounded-lg px-4 py-2 hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors h-[42px]"
                                >
                                    {uploading ? (
                                        <span className="flex items-center justify-center">
                                            <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></span>
                                            Procesando...
                                        </span>
                                    ) : (
                                        'Indexar PDF'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Filter */}
                    <div className="flex items-center gap-4 mb-5 bg-white p-3 rounded-lg border border-slate-200">
                        <label className="text-sm font-semibold text-slate-600">Filtrar Colección:</label>
                        <select
                            value={filterInsurer}
                            onChange={e => setFilterInsurer(e.target.value)}
                            className="border border-slate-300 rounded-md px-3 py-1.5 focus:ring-indigo-500 text-sm"
                        >
                            <option value="">Todas las aseguradoras indexadas</option>
                            {Array.from(new Set(clauses.map(c => c.insurerName))).map(ins => (
                                <option key={ins} value={ins}>{ins}</option>
                            ))}
                        </select>
                    </div>

                    {/* Clauses Table */}
                    {loading ? (
                        <div className="text-center py-12 text-slate-500 flex flex-col items-center">
                            <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></span>
                            <p>Cargando índices vectoriales...</p>
                        </div>
                    ) : clauses.length === 0 ? (
                        <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500">
                            No hay clausulados indexados en ChromaDB.
                        </div>
                    ) : (
                        <div className="overflow-hidden border border-slate-200 rounded-xl">
                            <table className="w-full border-collapse bg-white">
                                <thead className="bg-slate-100 border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Aseguradora</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Documento</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Chunks Semánticos</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {clauses.map((clause, index) => (
                                        <tr key={`${clause.insurerName}-${clause.documentName}-${index}`} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3 font-medium text-slate-800">{clause.insurerName}</td>
                                            <td className="px-4 py-3 text-slate-600">{clause.documentName}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                    {clause.chunkCount} vectores
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => handleDelete(clause.insurerName, clause.documentName)}
                                                    className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded-md transition-colors"
                                                    title="Eliminar de Vector DB"
                                                >
                                                    🗑️ Remover
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Stats */}
                    <div className="mt-6 text-sm text-slate-500 bg-slate-50 p-3 rounded-lg flex justify-between">
                        <span>Documentos Indexados: <strong className="text-slate-800">{clauses.length}</strong></span>
                        <span>Total Chunks: <strong className="text-slate-800">{clauses.reduce((acc, curr) => acc + curr.chunkCount, 0)}</strong></span>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default ClauseAdmin;
