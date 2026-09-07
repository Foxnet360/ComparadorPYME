import * as React from 'react';
import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import DeferredChart from './DeferredChart';
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  BookOpen,
  Target,
  Activity,
  Users,
  Filter,
  ChevronDown,
  ChevronUp,
  BarChart3,
  PieChart as PieChartIcon,
} from 'lucide-react';

interface LearningMetric {
  id: string;
  timestamp: string;
  coverageName: string;
  originalMapping: string;
  correctedMapping: string;
  confidenceBefore: number;
  confidenceAfter: number;
  userId: string;
  snippet?: string;
  page?: number;
}

interface ConsensusHistoryEntry {
  date: string;
  totalClassifications: number;
  discrepancies: number;
  consensusRate: number;
  avgConfidence: number;
}

interface CuratorDashboardProps {
  metrics?: LearningMetric[];
  consensusHistory?: ConsensusHistoryEntry[];
  isLoading?: boolean;
}

const COLORS = ['#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6'];

export const CuratorDashboard = ({
  metrics = [],
  consensusHistory = [],
  isLoading = false,
}: CuratorDashboardProps) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'corrections' | 'consensus'>('overview');
  const [sortField, setSortField] = useState<keyof LearningMetric>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterCoverage, setFilterCoverage] = useState('');

  // Calculate summary statistics
  const totalCorrections = metrics.length;
  const pendingReviews = metrics.filter((m) => m.confidenceAfter < 0.7).length;
  const consensusRate =
    consensusHistory.length > 0 ? consensusHistory[consensusHistory.length - 1]!.consensusRate : 0;
  const avgConfidence =
    metrics.length > 0
      ? metrics.reduce((sum, m) => sum + m.confidenceAfter, 0) / metrics.length
      : 0;

  // Corrections by category for pie chart
  const correctionsByCategory = metrics.reduce(
    (acc, metric) => {
      const category = metric.correctedMapping || 'Sin categoría';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const pieData = Object.entries(correctionsByCategory)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Confidence trend over time
  const confidenceTrend = metrics
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .reduce(
      (acc, metric, _idx) => {
        const date = new Date(metric.timestamp).toLocaleDateString('es-CO');
        const existing = acc.find((item) => item.date === date);
        if (existing) {
          existing.avgConfidence =
            (existing.avgConfidence * existing.count + metric.confidenceAfter) /
            (existing.count + 1);
          existing.count += 1;
        } else {
          acc.push({ date, avgConfidence: metric.confidenceAfter, count: 1 });
        }
        return acc;
      },
      [] as Array<{ date: string; avgConfidence: number; count: number }>
    );

  // Filter and sort metrics
  const filteredMetrics = metrics
    .filter(
      (m) => !filterCoverage || m.coverageName.toLowerCase().includes(filterCoverage.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (sortDirection === 'asc') {
        return (aVal ?? '') > (bVal ?? '') ? 1 : -1;
      }
      return (aVal ?? '') < (bVal ?? '') ? 1 : -1;
    });

  const handleSort = (field: keyof LearningMetric) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 p-6 rounded-2xl shadow-lg border border-slate-700 text-white">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Brain className="text-purple-400" size={24} />
            Consola del Curador
          </h2>
          <p className="text-xs md:text-sm text-slate-300 mt-1">
            Dashboard de auditoría y retroalimentación del sistema de ontología.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Última actualización:</span>
          <span className="text-xs font-mono bg-slate-800 px-2 py-1 rounded">
            {new Date().toLocaleString('es-CO')}
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 max-w-lg shadow-inner">
        {[
          { id: 'overview', label: 'Resumen', icon: BarChart3 },
          { id: 'corrections', label: 'Correcciones', icon: BookOpen },
          { id: 'consensus', label: 'Consenso', icon: Target },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'overview' | 'corrections' | 'consensus')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs md:text-sm font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                    Correcciones Totales
                  </p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{totalCorrections}</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <BookOpen className="text-blue-600" size={20} />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-xs text-green-600">
                <TrendingUp size={12} />
                <span>Aprendizaje activo</span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                    Revisiones Pendientes
                  </p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{pendingReviews}</p>
                </div>
                <div className="bg-amber-50 p-3 rounded-lg">
                  <Clock className="text-amber-600" size={20} />
                </div>
              </div>
              <div className="mt-3 text-xs text-amber-600">
                <span>Requieren validación humana</span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                    Tasa de Consenso
                  </p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {(consensusRate * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <CheckCircle className="text-green-600" size={20} />
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-500">
                <span>Doble agente en acuerdo</span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                    Confianza Promedio
                  </p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {(avgConfidence * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                  <Activity className="text-purple-600" size={20} />
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-500">
                <span>Post-corrección humana</span>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Confidence Trend */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-blue-500" />
                Tendencia de Confianza
              </h3>
              <div className="h-64">
                <DeferredChart>
                  <LineChart data={confidenceTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis
                      domain={[0, 1]}
                      tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                      tick={{ fontSize: 11 }}
                    />
                    <RechartsTooltip
                      formatter={(value) => [`${(Number(value) * 100).toFixed(1)}%`, 'Confianza']}
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        fontSize: '12px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgConfidence"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      dot={{ fill: '#3B82F6', r: 4 }}
                    />
                  </LineChart>
                </DeferredChart>
              </div>
            </div>

            {/* Corrections by Category */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                <PieChartIcon size={16} className="text-purple-500" />
                Correcciones por Categoría
              </h3>
              <div className="h-64">
                <DeferredChart>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </DeferredChart>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {pieData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-1 text-xs">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-slate-600">{entry.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Corrections Tab */}
      {activeTab === 'corrections' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-3">
            <Filter size={16} className="text-slate-400" />
            <input
              type="text"
              placeholder="Filtrar por nombre de cobertura..."
              value={filterCoverage}
              onChange={(e) => setFilterCoverage(e.target.value)}
              className="flex-1 text-sm text-slate-700 placeholder-slate-400 outline-none"
            />
            {filterCoverage && (
              <button
                onClick={() => setFilterCoverage('')}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Corrections Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {[
                      { key: 'timestamp', label: 'Fecha' },
                      { key: 'coverageName', label: 'Cobertura' },
                      { key: 'originalMapping', label: 'Mapeo Original' },
                      { key: 'correctedMapping', label: 'Corrección' },
                      { key: 'confidenceBefore', label: 'Conf. Inicial' },
                      { key: 'confidenceAfter', label: 'Conf. Final' },
                      { key: 'userId', label: 'Usuario' },
                    ].map((col) => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key as keyof LearningMetric)}
                        className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          {col.label}
                          {sortField === col.key &&
                            (sortDirection === 'asc' ? (
                              <ChevronUp size={12} />
                            ) : (
                              <ChevronDown size={12} />
                            ))}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMetrics.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                        No hay correcciones registradas.
                      </td>
                    </tr>
                  ) : (
                    filteredMetrics.map((metric) => (
                      <tr key={metric.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {new Date(metric.timestamp).toLocaleString('es-CO')}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-800">
                          {metric.coverageName}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {metric.originalMapping}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                            {metric.correctedMapping}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <ConfidenceBadge value={metric.confidenceBefore} />
                        </td>
                        <td className="px-4 py-3">
                          <ConfidenceBadge value={metric.confidenceAfter} />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 flex items-center gap-1">
                          <Users size={12} />
                          {metric.userId}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Consensus Tab */}
      {activeTab === 'consensus' && (
        <div className="space-y-6">
          {/* Consensus History Chart */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Target size={16} className="text-blue-500" />
              Historial de Consenso de Doble Agente
            </h3>
            <div className="h-72">
              <DeferredChart>
                <BarChart data={consensusHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 1]}
                    tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                    tick={{ fontSize: 11 }}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      fontSize: '12px',
                    }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="totalClassifications"
                    fill="#3B82F6"
                    radius={[4, 4, 0, 0]}
                    name="Total"
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="discrepancies"
                    fill="#EF4444"
                    radius={[4, 4, 0, 0]}
                    name="Discrepancias"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="consensusRate"
                    stroke="#10B981"
                    strokeWidth={2}
                    name="Tasa de Consenso"
                  />
                </BarChart>
              </DeferredChart>
            </div>
          </div>

          {/* Consensus Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <Target className="text-blue-600" size={20} />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Clasificaciones Totales</p>
                  <p className="text-xl font-bold text-slate-900">
                    {consensusHistory.reduce((sum, h) => sum + h.totalClassifications, 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="bg-red-50 p-3 rounded-lg">
                  <AlertTriangle className="text-red-600" size={20} />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Discrepancias Totales</p>
                  <p className="text-xl font-bold text-slate-900">
                    {consensusHistory.reduce((sum, h) => sum + h.discrepancies, 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="bg-green-50 p-3 rounded-lg">
                  <Activity className="text-green-600" size={20} />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Confianza Promedio</p>
                  <p className="text-xl font-bold text-slate-900">
                    {consensusHistory.length > 0
                      ? `${((consensusHistory.reduce((sum, h) => sum + h.avgConfidence, 0) / consensusHistory.length) * 100).toFixed(1)}%`
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper component for confidence badges
const ConfidenceBadge = ({ value }: { value: number }) => {
  let colorClass = 'bg-red-50 text-red-700 border-red-200';
  if (value >= 0.9) colorClass = 'bg-green-50 text-green-700 border-green-200';
  else if (value >= 0.7) colorClass = 'bg-yellow-50 text-yellow-700 border-yellow-200';
  else if (value >= 0.5) colorClass = 'bg-orange-50 text-orange-700 border-orange-200';

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colorClass}`}
    >
      {(value * 100).toFixed(0)}%
    </span>
  );
};

export default CuratorDashboard;
