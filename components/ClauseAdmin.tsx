import React, { useState, useEffect, useCallback } from 'react';
import { ClauseSummary, InsurerSummary } from '../types';
import { clauseService } from '../services/clauseService';

interface ClauseAdminProps {
    onClose: () => void;
}

export const ClauseAdmin: React.FC<ClauseAdminProps> = ({ onClose }) => {
    const [clauses, setClauses] = useState<ClauseSummary[]>([]);
    const [insurers, setInsurers] = useState<InsurerSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filterInsurer, setFilterInsurer] = useState<string>('');

    // Form state
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [formData, setFormData] = useState({
        aseguradora: '',
        producto: '',
        version: new Date().getFullYear().toString()
    });

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [clauseData, insurerData] = await Promise.all([
                clauseService.getClauses(filterInsurer || undefined),
                clauseService.getInsurers()
            ]);
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
        console.log('📤 [ClauseAdmin] handleSubmit called');
        console.log('   - selectedFile:', selectedFile?.name);
        console.log('   - formData:', formData);

        if (!selectedFile) {
            console.log('❌ No file selected');
            setError('Selecciona un archivo PDF');
            return;
        }

        try {
            setUploading(true);
            setError(null);
            console.log('🚀 Calling clauseService.createClause...');
            const result = await clauseService.createClause(selectedFile, formData);
            console.log('✅ Clause created:', result);

            // Reset form
            setSelectedFile(null);
            setFormData({ aseguradora: '', producto: '', version: new Date().getFullYear().toString() });

            // Reload data
            console.log('🔄 Reloading data...');
            await loadData();
            console.log('✅ Data reloaded');
        } catch (err: any) {
            console.error('❌ Error creating clause:', err);
            setError(err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este clausulado?')) return;

        try {
            await clauseService.deleteClause(id);
            await loadData();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleReExtract = async (id: string) => {
        try {
            setError(null);
            await clauseService.reExtractSections(id);
            await loadData();
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">📚 Biblioteca de Clausulados</h2>
                    <button onClick={onClose} className="text-white hover:text-gray-200 text-2xl">&times;</button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                            {error}
                        </div>
                    )}

                    {/* Upload Form */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-6">
                        <h3 className="font-semibold text-gray-700 mb-3">Agregar Clausulado</h3>
                        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                            <input
                                type="text"
                                placeholder="Aseguradora"
                                value={formData.aseguradora}
                                onChange={e => setFormData({ ...formData, aseguradora: e.target.value })}
                                className="border rounded px-3 py-2"
                                required
                            />
                            <input
                                type="text"
                                placeholder="Producto"
                                value={formData.producto}
                                onChange={e => setFormData({ ...formData, producto: e.target.value })}
                                className="border rounded px-3 py-2"
                                required
                            />
                            <input
                                type="text"
                                placeholder="Versión"
                                value={formData.version}
                                onChange={e => setFormData({ ...formData, version: e.target.value })}
                                className="border rounded px-3 py-2"
                                required
                            />
                            <label className="border rounded px-3 py-2 bg-white cursor-pointer flex items-center justify-center hover:bg-gray-100">
                                <span className="truncate text-sm">
                                    {selectedFile ? selectedFile.name : '📄 Seleccionar PDF'}
                                </span>
                                <input
                                    type="file"
                                    accept=".pdf"
                                    onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                                    className="hidden"
                                />
                            </label>
                            <button
                                type="submit"
                                disabled={uploading || !formData.aseguradora || !formData.producto || !formData.version || !selectedFile}
                                className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                title={!selectedFile ? 'Selecciona un archivo PDF' : !formData.aseguradora ? 'Ingresa la aseguradora' : ''}
                            >
                                {uploading ? 'Subiendo...' : !selectedFile ? '📄 Falta PDF' : 'Subir'}
                            </button>
                        </form>
                    </div>

                    {/* Filter */}
                    <div className="flex items-center gap-4 mb-4">
                        <label className="text-gray-600">Filtrar por:</label>
                        <select
                            value={filterInsurer}
                            onChange={e => setFilterInsurer(e.target.value)}
                            className="border rounded px-3 py-2"
                        >
                            <option value="">Todas las aseguradoras</option>
                            {insurers.map(ins => (
                                <option key={ins.aseguradora} value={ins.aseguradora}>
                                    {ins.aseguradora} ({ins.count})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Clauses Table */}
                    {loading ? (
                        <div className="text-center py-8 text-gray-500">Cargando...</div>
                    ) : clauses.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            No hay clausulados. Sube el primero arriba.
                        </div>
                    ) : (
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="border px-4 py-2 text-left">Aseguradora</th>
                                    <th className="border px-4 py-2 text-left">Producto</th>
                                    <th className="border px-4 py-2 text-center">Versión</th>
                                    <th className="border px-4 py-2 text-center">Tokens</th>
                                    <th className="border px-4 py-2 text-center">Secciones</th>
                                    <th className="border px-4 py-2 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {clauses.map(clause => (
                                    <tr key={clause.id} className="hover:bg-gray-50">
                                        <td className="border px-4 py-2">{clause.aseguradora}</td>
                                        <td className="border px-4 py-2">{clause.producto}</td>
                                        <td className="border px-4 py-2 text-center">{clause.version}</td>
                                        <td className="border px-4 py-2 text-center text-sm text-gray-600">
                                            ~{clause.tokensEstimados.toLocaleString()}
                                        </td>
                                        <td className="border px-4 py-2 text-center">
                                            {clause.tieneSecciones ? (
                                                <span className="text-green-600">✅</span>
                                            ) : (
                                                <span className="text-yellow-600">⏳</span>
                                            )}
                                        </td>
                                        <td className="border px-4 py-2 text-center space-x-2">
                                            {!clause.tieneSecciones && (
                                                <button
                                                    onClick={() => handleReExtract(clause.id)}
                                                    className="text-blue-500 hover:text-blue-700"
                                                    title="Extraer secciones"
                                                >
                                                    🔄
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(clause.id)}
                                                className="text-red-500 hover:text-red-700"
                                                title="Eliminar"
                                            >
                                                🗑️
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {/* Stats */}
                    <div className="mt-4 text-sm text-gray-500">
                        Total: {clauses.length} clausulados |
                        {insurers.length} aseguradoras
                    </div>
                </div>
            </div>
        </div>
    );
};
