import React, { useEffect, useState } from 'react';
import { DashboardStats, HistoryEntry, QuoteStatus, ComparisonReport } from '../types';
import { storageService } from '../services/storageService';
import { generatePerformanceReport } from '../services/pdfService';
import { BarChart3, TrendingUp, Users, DollarSign, Plus, Search, Filter, Calendar, Eye, Download } from 'lucide-react';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area } from 'recharts';

interface TechnicalDashboardProps {
  onNewAnalysis: () => void;
  onViewReport: (report: ComparisonReport) => void;
}

const TechnicalDashboard: React.FC<TechnicalDashboardProps> = ({ onNewAnalysis, onViewReport }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const statsData = await storageService.getStats();
    const historyData = await storageService.getHistory();
    setStats(statsData);
    setHistory(historyData);
  };

  const handleStatusChange = async (id: string, newStatus: QuoteStatus) => {
    await storageService.updateStatus(id, newStatus);
    const updatedHistory = await storageService.getHistory();
    setHistory(updatedHistory);
    const updatedStats = await storageService.getStats();
    setStats(updatedStats); // Refresh stats
  };

  const filteredHistory = history.filter(item =>
    item.clientName.toLowerCase().includes(filter.toLowerCase()) ||
    item.bestOption.toLowerCase().includes(filter.toLowerCase())
  );

  // Mock data for the chart with both volume and premium value
  const chartData = [
    { name: 'Ene', sent: 4, sold: 2, premium: 12 },
    { name: 'Feb', sent: 6, sold: 3, premium: 18 },
    { name: 'Mar', sent: 8, sold: 5, premium: 25 },
    { name: 'Abr', sent: 5, sold: 4, premium: 22 },
    { name: 'May', sent: 10, sold: 6, premium: 35 },
    { name: 'Jun', sent: 12, sold: 8, premium: 48 },
  ];

  const handleDownloadReport = () => {
    const user = storageService.getCurrentUser();
    if (user && stats) {
      generatePerformanceReport(user, stats, history);
    }
  };

  if (!stats) return <div>Cargando dashboard...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Date Context Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Panel de Control</h2>
        <div className="flex items-center space-x-4">
          <button
            onClick={handleDownloadReport}
            className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-200 rounded-full text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Download size={16} className="text-indigo-600" />
            <span className="hidden sm:inline">Descargar Informe</span>
          </button>
          <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
            <Calendar className="text-indigo-600" size={18} />
            <span className="text-sm font-semibold text-slate-700">Analizando: {stats.monthName}</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Tasa Cierre (Mes)</p>
            <h3 className="text-3xl font-bold text-slate-800">{stats.conversionRate}%</h3>
          </div>
          <div className="bg-green-100 p-3 rounded-xl text-green-600">
            <TrendingUp size={24} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Cotizaciones (Mes)</p>
            <h3 className="text-3xl font-bold text-slate-800">{stats.totalQuotes}</h3>
          </div>
          <div className="bg-blue-100 p-3 rounded-xl text-blue-600">
            <BarChart3 size={24} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Ventas (Mes)</p>
            <h3 className="text-2xl font-bold text-slate-800">${(stats.totalPremiumSold / 1000000).toFixed(1)}M</h3>
          </div>
          <div className="bg-indigo-100 p-3 rounded-xl text-indigo-600">
            <DollarSign size={24} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Prospectos Activos</p>
            <h3 className="text-3xl font-bold text-slate-800">{stats.activeProspects}</h3>
          </div>
          <div className="bg-amber-100 p-3 rounded-xl text-amber-600">
            <Users size={24} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart with Dual Axis */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-800">Tendencia de Negocios y Primas</h3>
            <div className="flex items-center space-x-4 text-xs">
              <div className="flex items-center"><div className="w-3 h-3 bg-indigo-500 rounded-sm mr-1"></div> Primas (Barras)</div>
              <div className="flex items-center"><div className="w-3 h-3 bg-slate-300 rounded-sm mr-1"></div> Cotizaciones (Area)</div>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <defs>
                  <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#cbd5e1" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#cbd5e1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} label={{ value: 'Cant. Negocios', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#cbd5e1', fontSize: 10 } }} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#818cf8' }} tickFormatter={(val) => `${val}M`} />
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />

                {/* Area for Quotes Volume */}
                <Area yAxisId="left" type="monotone" dataKey="sent" stroke="#94a3b8" fill="url(#colorSent)" name="Cotizado" />

                {/* Bar for Premiums (Histogram style) */}
                <Bar yAxisId="right" dataKey="premium" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20} name="Primas ($M)" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-indigo-900 text-white p-6 rounded-2xl shadow-lg flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-bold mb-2">Nuevo Análisis</h3>
            <p className="text-indigo-200 mb-6 text-sm">Carga nuevas cotizaciones y clausulados para auditar un prospecto.</p>
          </div>
          <button
            onClick={onNewAnalysis}
            className="w-full py-4 bg-white text-indigo-900 rounded-xl font-bold flex items-center justify-center space-x-2 hover:bg-indigo-50 transition-colors"
          >
            <Plus size={20} />
            <span>Iniciar Comparación</span>
          </button>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-slate-800">Historial de Gestiones</h3>
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
              {filteredHistory.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 text-slate-500">{item.date}</td>
                  <td className="px-6 py-4 font-medium text-slate-800">{item.clientName}</td>
                  <td className="px-6 py-4 text-slate-500">
                    <div className="flex gap-1">
                      {item.insurers.slice(0, 2).map((ins, i) => (
                        <span key={i} className="px-2 py-0.5 bg-slate-100 rounded text-xs">{ins}</span>
                      ))}
                      {item.insurers.length > 2 && <span className="text-xs text-slate-400">+{item.insurers.length - 2}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-indigo-600 font-medium">{item.bestOption}</td>
                  <td className="px-6 py-4 text-slate-600">${(item.premiumValue / 1000000).toFixed(2)}M</td>
                  <td className="px-6 py-4">
                    <select
                      value={item.status}
                      onChange={(e) => handleStatusChange(item.id, e.target.value as QuoteStatus)}
                      className={`px-3 py-1 rounded-full text-xs font-bold border-none outline-none cursor-pointer ${item.status === 'SOLD' ? 'bg-green-100 text-green-700' :
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
              ))}
              {filteredHistory.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    No se encontraron registros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TechnicalDashboard;