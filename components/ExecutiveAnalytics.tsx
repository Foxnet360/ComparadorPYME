import React, { useEffect, useState } from 'react';
import { UserRole, ExecutiveAnalyticsData } from '../types';
import { analyticsService } from '../services/analyticsService';
import { formatCOPMillions } from '../utils/formatCurrency';
import {
  BarChart3,
  TrendingUp,
  Clock,
  DollarSign,
  ShieldCheck,
  Building2,
  UserCheck,
  Sparkles,
  ArrowLeft,
  PieChart,
  Users,
  Activity,
  Award,
} from 'lucide-react';

interface ExecutiveAnalyticsProps {
  initialRole?: UserRole;
  onBackToDashboard?: () => void;
}

export const ExecutiveAnalytics: React.FC<ExecutiveAnalyticsProps> = ({
  initialRole = 'super_admin',
  onBackToDashboard,
}) => {
  const [role, setRole] = useState<UserRole>(initialRole);
  const [selectedAllyId, setSelectedAllyId] = useState<string>('ally-100');
  const [data, setData] = useState<ExecutiveAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const allies = analyticsService.getAvailableAllies();

  useEffect(() => {
    loadAnalytics();
  }, [role, selectedAllyId]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const result = await analyticsService.getExecutiveAnalytics(
        role,
        'user-tech-1',
        selectedAllyId
      );
      setData(result);
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-12">
      {/* Navigation & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-4">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
              title="Volver al Panel de Control"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                Módulo de Analítica Ejecutiva
              </h2>
              <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-wider">
                RBAC Multi-Tenant
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-0.5">
              Tablero estratégico adaptativo de rendimiento técnico, conversión e Inteligencia
              Artificial
            </p>
          </div>
        </div>

        {/* Role Selector Tabs (Interactive RBAC Switcher) */}
        <div className="bg-slate-100 p-1.5 rounded-xl flex items-center space-x-1 border border-slate-200">
          <button
            onClick={() => setRole('super_admin')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
              role === 'super_admin'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck size={14} />
            <span>Super Admin</span>
          </button>

          <button
            onClick={() => setRole('ally_admin')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
              role === 'ally_admin'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 size={14} />
            <span>Admin Aliado</span>
          </button>

          <button
            onClick={() => setRole('ally_technical')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
              role === 'ally_technical'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck size={14} />
            <span>Técnico Analista</span>
          </button>
        </div>
      </div>

      {/* Role Context Bar & Ally Selector */}
      <div className="bg-indigo-900 text-white p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-white/10 rounded-xl">
            {role === 'super_admin' && <ShieldCheck size={22} className="text-indigo-300" />}
            {role === 'ally_admin' && <Building2 size={22} className="text-indigo-300" />}
            {role === 'ally_technical' && <UserCheck size={22} className="text-indigo-300" />}
          </div>
          <div>
            <div className="text-xs text-indigo-300 uppercase font-semibold tracking-wider">
              {role === 'super_admin'
                ? 'Modo: Administrador General de Plataforma (Global Multi-Aliado)'
                : role === 'ally_admin'
                  ? 'Modo: Director Técnico / Admin de Correduría'
                  : 'Modo: Autogestión de Técnico Analista'}
            </div>
            <div className="text-base font-bold">
              {role === 'super_admin'
                ? 'Consolidado de Red Multi-Aliados & Benchmarks de IA'
                : data?.allyName || 'Correduría Andina de Seguros S.A.'}
            </div>
          </div>
        </div>

        {/* Ally Selector Dropdown (for Ally Admin and Super Admin) */}
        {role !== 'ally_technical' && (
          <div className="flex items-center space-x-2">
            <label className="text-xs text-indigo-200 font-medium">Filtrar Aliado:</label>
            <select
              value={selectedAllyId}
              onChange={(e) => setSelectedAllyId(e.target.value)}
              className="bg-indigo-950 text-white border border-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {allies.map((ally) => (
                <option key={ally.id} value={ally.id}>
                  {ally.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading || !data ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 font-medium">
          Cargando analítica ejecutiva...
        </div>
      ) : (
        <>
          {/* Top 4 Executive KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Volumen */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  {role === 'ally_technical' ? 'Mis Comparaciones' : 'Comparaciones Totales'}
                </div>
                <div className="text-2xl font-extrabold text-slate-900">
                  {data.totalComparisons}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {role === 'super_admin' ? 'En todas las corredurías' : 'Estudios procesados'}
                </div>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <BarChart3 size={22} />
              </div>
            </div>

            {/* KPI 2: Conversión */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Tasa de Conversión
                </div>
                <div className="text-2xl font-extrabold text-emerald-600">
                  {data.conversionRate}%
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {data.soldCount} pólizas cerradas ganadas
                </div>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <TrendingUp size={22} />
              </div>
            </div>

            {/* KPI 3: Prima Total */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Prima Total Comparada
                </div>
                <div className="text-xl font-extrabold text-slate-900">
                  {formatCOPMillions(data.totalPremium)}
                </div>
                <div className="text-xs text-slate-500 mt-1">Volumen económico negociado</div>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <DollarSign size={22} />
              </div>
            </div>

            {/* KPI 4: Tiempo Medio */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Tiempo Promedio / Estudio
                </div>
                <div className="text-2xl font-extrabold text-indigo-600">
                  {data.avgProcessTimeMinutes} min
                </div>
                <div className="text-xs text-slate-500 mt-1">Vs. 3.5 hrs de análisis manual</div>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <Clock size={22} />
              </div>
            </div>
          </div>

          {/* Super Admin AI Benchmarks Banner */}
          {role === 'super_admin' && data.aiBenchmarks && (
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sparkles className="text-indigo-400" size={20} />
                  <h3 className="font-bold text-base">
                    Benchmarks Globales del Motor IA Gemini 3.5 & Supabase Vector
                  </h3>
                </div>
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-bold">
                  Precisión Ontológica: {data.aiBenchmarks.overallAccuracy}%
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                <div className="bg-white/5 p-3.5 rounded-xl border border-white/10">
                  <div className="text-xs text-slate-400">Match Tesauro Exacto</div>
                  <div className="text-lg font-bold text-white">
                    {data.aiBenchmarks.thesaurusExactRate}%
                  </div>
                </div>

                <div className="bg-white/5 p-3.5 rounded-xl border border-white/10">
                  <div className="text-xs text-slate-400">Fuzzy Similarity Match</div>
                  <div className="text-lg font-bold text-white">
                    {data.aiBenchmarks.fuzzyMatchRate}%
                  </div>
                </div>

                <div className="bg-white/5 p-3.5 rounded-xl border border-white/10">
                  <div className="text-xs text-slate-400">Vector Embeddings (3072d)</div>
                  <div className="text-lg font-bold text-white">
                    {data.aiBenchmarks.embeddingMatchRate}%
                  </div>
                </div>

                <div className="bg-white/5 p-3.5 rounded-xl border border-white/10">
                  <div className="text-xs text-slate-400">Latencia Promedio API</div>
                  <div className="text-lg font-bold text-indigo-300">
                    {data.aiBenchmarks.avgApiLatencyMs} ms
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Super Admin Token & Cost Monitor */}
          {role === 'super_admin' && data.aiBenchmarks?.totalInputTokens && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 flex items-center space-x-2">
                  <DollarSign className="text-amber-500" size={20} />
                  <span>Monitor de Consumo de Tokens & Costo Estimado IA (Gemini 3.5)</span>
                </h3>
                <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">
                  ${data.aiBenchmarks.totalEstimatedCostUSD} USD Acumulados
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-xs text-slate-500 font-semibold">
                    Tokens Entrada / Salida
                  </div>
                  <div className="text-lg font-extrabold text-slate-900">
                    {(data.aiBenchmarks.totalInputTokens / 1000000).toFixed(2)}M /{' '}
                    {((data.aiBenchmarks.totalOutputTokens || 0) / 1000).toFixed(0)}k
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Input / Output tokens procesados
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-xs text-slate-500 font-semibold">
                    Costo Medio / Comparación
                  </div>
                  <div className="text-lg font-extrabold text-emerald-600">
                    ${data.aiBenchmarks.avgCostPerComparisonUSD} USD
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    ~ ${data.aiBenchmarks.avgCostPerComparisonCOP} COP por estudio
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-xs text-slate-500 font-semibold">Eficiencia Económica</div>
                  <div className="text-lg font-extrabold text-indigo-600">97.8%</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Ahorro vs. auditoría externa manual
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Breakdown Grids */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Domain Breakdown (8 Ramos) */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 flex items-center space-x-2">
                  <PieChart className="text-indigo-600" size={18} />
                  <span>Distribución por Ramo de Seguro (8 Ramos)</span>
                </h3>
                <span className="text-xs text-slate-400 font-medium">Volumen Relativo</span>
              </div>

              <div className="space-y-3">
                {data.domainDistribution.map((item) => (
                  <div key={item.domainId} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-slate-700">
                      <span>{item.domainName}</span>
                      <span className="text-indigo-600">
                        {item.count} estudios ({item.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${item.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Insurer Market Share */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 flex items-center space-x-2">
                  <Activity className="text-emerald-600" size={18} />
                  <span>Participación por Compañía Aseguradora</span>
                </h3>
                <span className="text-xs text-slate-400 font-medium">
                  Frecuencia en Cotizaciones
                </span>
              </div>

              <div className="space-y-3">
                {data.insurerDistribution.map((ins, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100"
                  >
                    <div className="font-bold text-sm text-slate-800">{ins.insurerName}</div>
                    <div className="text-xs font-bold text-slate-600">
                      <span className="text-indigo-600 mr-2">{ins.count} cotizaciones</span>
                      <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                        {ins.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Team Performance Table (for Ally Admin and Super Admin) */}
          {data.analystPerformance && data.analystPerformance.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
                    <Users className="text-indigo-600" size={18} />
                    <span>Rendimiento Técnico por Analista Dependiente</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Producción individual, velocidad de entrega y efectividad comercial del equipo
                  </p>
                </div>
                <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold">
                  {data.analystPerformance.length} Analistas
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Técnico Analista</th>
                      <th className="px-6 py-4">Comparaciones</th>
                      <th className="px-6 py-4">Pólizas Ganadas</th>
                      <th className="px-6 py-4">Conversión %</th>
                      <th className="px-6 py-4">Prima Total</th>
                      <th className="px-6 py-4">Tiempo Medio</th>
                      <th className="px-6 py-4">Especialidad Ramo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.analystPerformance.map((analyst) => (
                      <tr
                        key={analyst.analystId}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        <td className="px-6 py-4 font-bold text-slate-900 flex items-center space-x-2">
                          <Award size={16} className="text-amber-500 flex-shrink-0" />
                          <span>{analyst.analystName}</span>
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-800">
                          {analyst.totalComparisons}
                        </td>
                        <td className="px-6 py-4 text-emerald-600 font-bold">
                          {analyst.soldCount}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-extrabold rounded-full text-xs">
                            {analyst.conversionRate}%
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-700 font-semibold">
                          {formatCOPMillions(analyst.totalPremium)}
                        </td>
                        <td className="px-6 py-4 text-indigo-600 font-medium">
                          {analyst.avgTimeMinutes} min
                        </td>
                        <td className="px-6 py-4 text-xs font-semibold text-slate-600">
                          <span className="bg-slate-100 px-2 py-1 rounded-md">
                            {analyst.topDomain}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ExecutiveAnalytics;
