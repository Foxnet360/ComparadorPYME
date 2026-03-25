import React, { useEffect, useState } from 'react';
import { HistoryEntry, QuoteStatus, ComparisonReport } from '../types';
import { storageService } from '../services/storageService';
import { Plus, Search, Eye } from 'lucide-react';

interface TechnicalDashboardProps {
  onNewAnalysis: () => void;
  onViewReport: (report: ComparisonReport) => void;
}

const TechnicalDashboard: React.FC<TechnicalDashboardProps> = ({ onNewAnalysis, onViewReport }) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const historyData = await storageService.getHistory();
      setHistory(historyData);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: QuoteStatus) => {
    await storageService.updateStatus(id, newStatus);
    const updatedHistory = await storageService.getHistory();
    setHistory(updatedHistory);
  };

  const filteredHistory = history.filter(item =>
    (item.clientName?.toLowerCase() || '').includes(filter.toLowerCase()) ||
    (item.bestOption?.toLowerCase() || '').includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header with New Analysis Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Panel de Control</h2>
        <button
          onClick={onNewAnalysis}
          className="flex items-center space-x-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus size={20} />
          <span>Nuevo Análisis</span>
        </button>
      </div>

      {/* History Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-slate-800">Historial de Gestión</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-full md:w-64"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-semibold">
              <tr>
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Aseguradoras</th>
                <th className="px-6 py-4">Mejor Opción</th>
                <th className="px-6 py-4">Prima Est.</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    Cargando...
                  </td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    No se encontraron registros.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 text-slate-500">{item.date}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{item.clientName}</td>
                    <td className="px-6 py-4 text-slate-500">
                      <div className="flex gap-1">
                        {(item.insurers || []).slice(0, 2).map((ins, i) => (
                          <span key={i} className="px-2 py-0.5 bg-slate-100 rounded text-xs">{ins}</span>
                        ))}
                        {(item.insurers || []).length > 2 && (
                          <span className="text-xs text-slate-400">+{(item.insurers || []).length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-indigo-600 font-medium">{item.bestOption || '-'}</td>
                    <td className="px-6 py-4 text-slate-600">
                      ${item.premiumValue ? (item.premiumValue / 1000000).toFixed(2) : '0.00'}M
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={item.status}
                        onChange={(e) => handleStatusChange(item.id, e.target.value as QuoteStatus)}
                        className={`px-3 py-1 rounded-full text-xs font-bold border-none outline-none cursor-pointer ${
                          item.status === 'SOLD' ? 'bg-green-100 text-green-700' :
                          item.status === 'LOST' ? 'bg-red-100 text-red-700' :
                          item.status === 'SENT' ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <option value="DRAFT">Borrador</option>
                        <option value="SENT">Enviada</option>
                        <option value="SOLD">Cerrada/Ganada</option>
                        <option value="LOST">Perdida</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {item.fullReport ? (
                        <button
                          onClick={() => onViewReport(item.fullReport!)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                          title="Ver Reporte Completo"
                        >
                          <Eye size={18} />
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">N/A</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TechnicalDashboard;
