import React, { useEffect, useState } from 'react';
import { HistoryEntry, QuoteStatus, ComparisonReport } from '../types';
import { storageService } from '../services/storageService';
import { Plus, Search, Eye, BarChart3, TrendingUp, DollarSign, FileCheck, Calendar } from 'lucide-react';
import { formatCOPMillions } from '../utils/formatCurrency';

interface TechnicalDashboardProps {
  onNewAnalysis: () => void;
  onViewReport: (report: ComparisonReport) => void;
}

const TechnicalDashboard: React.FC<TechnicalDashboardProps> = ({ onNewAnalysis, onViewReport }) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
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

  // Metric Computations
  const totalComparisons = history.length;
  const soldCount = history.filter((h) => h.status === 'SOLD').length;
  const activeCount = history.filter((h) => h.status === 'SENT' || h.status === 'DRAFT').length;
  const conversionRate =
    totalComparisons > 0 ? Math.round((soldCount / totalComparisons) * 100) : 0;
  const totalPremium = history.reduce((sum, item) => sum + (item.premiumValue || 0), 0);

  const filteredHistory = history.filter((item) => {
    const matchesText =
      (item.clientName?.toLowerCase() || '').includes(filter.toLowerCase()) ||
      (item.bestOption?.toLowerCase() || '').includes(filter.toLowerCase()) ||
      (item.insurers || []).some((ins) => ins.toLowerCase().includes(filter.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;

    return matchesText && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
      {/* Header with New Comparison Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Panel de Control Técnico
          </h2>
          <p className="text-slate-500 text-sm">
            Gestión y seguimiento comparativo de cotizaciones de seguros
          </p>
        </div>
        <button
          onClick={onNewAnalysis}
          className="flex items-center space-x-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 hover:shadow-indigo-200"
        >
          <Plus size={20} />
          <span>Nueva Comparación</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Comparaciones */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              Comparaciones Total
            </div>
            <div className="text-2xl font-extrabold text-slate-900">{totalComparisons}</div>
            <div className="text-xs text-slate-500 mt-1">Registradas en plataforma</div>
          </div>
          <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <BarChart3 size={24} />
          </div>
        </div>

        {/* KPI 2: Tasa de Conversión */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              Tasa de Conversión
            </div>
            <div className="text-2xl font-extrabold text-emerald-600">{conversionRate}%</div>
            <div className="text-xs text-slate-500 mt-1">{soldCount} comparaciones cerradas</div>
          </div>
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <TrendingUp size={24} />
          </div>
        </div>

        {/* KPI 3: Prima Total Cotizada */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              Prima Total Comparada
            </div>
            <div className="text-xl font-extrabold text-slate-900">
              {formatCOPMillions(totalPremium)}
            </div>
            <div className="text-xs text-slate-500 mt-1">Suma acumulada de pólizas</div>
          </div>
          <div className="p-3.5 bg-blue-50 text-blue-600 rounded-xl">
            <DollarSign size={24} />
          </div>
        </div>

        {/* KPI 4: Prospectos Activos */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              Prospectos Activos
            </div>
            <div className="text-2xl font-extrabold text-indigo-600">{activeCount}</div>
            <div className="text-xs text-slate-500 mt-1">Enviadas o en borrador</div>
          </div>
          <div className="p-3.5 bg-amber-50 text-amber-600 rounded-xl">
            <FileCheck size={24} />
          </div>
        </div>
      </div>

      {/* History Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Header & Controls */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Historial de Comparaciones</h3>
            <p className="text-xs text-slate-500">
              Visualizá y gestioná las cotizaciones comparadas para tus clientes
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-auto"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="DRAFT">Borrador</option>
              <option value="SENT">Enviada</option>
              <option value="SOLD">Cerrada / Ganada</option>
              <option value="LOST">Perdida</option>
            </select>

            {/* Global Search Input */}
            <div className="relative w-full sm:w-64">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                type="text"
                placeholder="Buscar cliente o aseguradora..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-full"
              />
            </div>
          </div>
        </div>

        {/* History Content */}
        {loading ? (
          <div className="py-12 text-center text-slate-400 font-medium">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3" />
            <p className="text-sm">Cargando comparaciones...</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="py-12 text-center text-slate-400 px-4">
            <p className="font-semibold text-slate-700 mb-1">
              No se encontraron comparaciones
            </p>
            <p className="text-xs text-slate-400 mb-4">
              {filter || statusFilter !== 'ALL'
                ? 'Probá ajustando los filtros de búsqueda.'
                : 'Hacé clic en "Nueva Comparación" para realizar la primera.'}
            </p>
            {!filter && statusFilter === 'ALL' && (
              <button
                onClick={onNewAnalysis}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors"
              >
                <Plus size={16} />
                <span>Nueva Comparación</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table: Constrained table-fixed, zero horizontal overflow */}
            <div className="hidden md:block">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="w-[30%] px-4 py-3.5">Cliente / Fecha</th>
                    <th className="w-[24%] px-4 py-3.5">Aseguradoras</th>
                    <th className="w-[20%] px-4 py-3.5">Recomendación & Prima</th>
                    <th className="w-[14%] px-3 py-3.5 text-center">Estado</th>
                    <th className="w-[12%] px-4 py-3.5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-800 truncate" title={item.clientName}>
                          {item.clientName}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                          <Calendar size={12} className="flex-shrink-0" />
                          <span>{item.date}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1 items-center">
                          {(item.insurers || []).slice(0, 2).map((ins, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-xs font-medium truncate max-w-[110px]"
                              title={ins}
                            >
                              {ins}
                            </span>
                          ))}
                          {(item.insurers || []).length > 2 && (
                            <span
                              className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[11px] font-semibold"
                              title={(item.insurers || []).slice(2).join(', ')}
                            >
                              +{(item.insurers || []).length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="text-xs font-bold text-indigo-600 truncate" title={item.bestOption || '-'}>
                          {item.bestOption || '-'}
                        </div>
                        <div className="text-xs font-medium text-slate-700 mt-0.5">
                          {formatCOPMillions(item.premiumValue)}
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <select
                          value={item.status}
                          onChange={(e) => handleStatusChange(item.id, e.target.value as QuoteStatus)}
                          className={`w-full max-w-[120px] px-2.5 py-1 rounded-full text-xs font-bold border-none outline-none cursor-pointer transition-colors text-center ${
                            item.status === 'SOLD'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.status === 'LOST'
                                ? 'bg-rose-100 text-rose-800'
                                : item.status === 'SENT'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          <option value="DRAFT">Borrador</option>
                          <option value="SENT">Enviada</option>
                          <option value="SOLD">Cerrada/Ganada</option>
                          <option value="LOST">Perdida</option>
                        </select>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {item.fullReport ? (
                          <button
                            onClick={() => onViewReport({ ...item.fullReport!, id: item.id })}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold transition-colors"
                            title="Ver Informe Comparativo Completo"
                          >
                            <Eye size={14} />
                            <span>Ver Informe</span>
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">Sin informe</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Cards View */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredHistory.map((item) => (
                <div key={item.id} className="p-4 space-y-3 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-900 text-sm truncate" title={item.clientName}>
                        {item.clientName}
                      </h4>
                      <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                        <Calendar size={12} />
                        <span>{item.date}</span>
                      </div>
                    </div>
                    <select
                      value={item.status}
                      onChange={(e) => handleStatusChange(item.id, e.target.value as QuoteStatus)}
                      className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-bold border-none outline-none cursor-pointer ${
                        item.status === 'SOLD'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'LOST'
                            ? 'bg-rose-100 text-rose-800'
                            : item.status === 'SENT'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      <option value="DRAFT">Borrador</option>
                      <option value="SENT">Enviada</option>
                      <option value="SOLD">Cerrada/Ganada</option>
                      <option value="LOST">Perdida</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Mejor Opción</span>
                      <span className="font-bold text-indigo-600 truncate block">
                        {item.bestOption || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Prima Est.</span>
                      <span className="font-semibold text-slate-800 block">
                        {formatCOPMillions(item.premiumValue)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex flex-wrap gap-1 items-center min-w-0">
                      {(item.insurers || []).slice(0, 3).map((ins, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-xs font-medium truncate max-w-[120px]"
                        >
                          {ins}
                        </span>
                      ))}
                      {(item.insurers || []).length > 3 && (
                        <span className="text-xs text-slate-400">
                          +{(item.insurers || []).length - 3}
                        </span>
                      )}
                    </div>

                    {item.fullReport ? (
                      <button
                        onClick={() => onViewReport({ ...item.fullReport!, id: item.id })}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold flex-shrink-0 transition-colors"
                      >
                        <Eye size={14} />
                        <span>Ver Informe</span>
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400 flex-shrink-0">Sin informe</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TechnicalDashboard;
