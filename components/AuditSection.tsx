import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Info,
  Shield,
  ShieldAlert,
  FileText,
  Sparkles,
  Loader2,
  RefreshCw,
  LayoutGrid,
  Radar,
  Handshake,
  Trophy,
  TrendingDown,
} from 'lucide-react';
import { QuoteAnalysis, AlertLevel, EnrichedAlert } from '../types';
import { AuditDashboard } from './AuditDashboard';
import { EvidenceCard } from './EvidenceCard';
import { useAuditEnrichment } from '../hooks/useAuditEnrichment';
import { RiskHeatmap } from './RiskHeatmap';
import { InsurerRadar } from './InsurerRadar';

interface AuditSectionProps {
  quotes: QuoteAnalysis[];
  viewMode: 'client' | 'technical';
}

const getAlertIcon = (level: AlertLevel) => {
  switch (level) {
    case 'CRITICAL':
      return <AlertCircle className="text-red-600" size={20} />;
    case 'WARNING':
      return <AlertTriangle className="text-amber-500" size={20} />;
    case 'GOOD':
      return <CheckCircle className="text-green-600" size={20} />;
    default:
      return <Info className="text-blue-500" size={20} />;
  }
};

const getAlertStyles = (level: AlertLevel) => {
  switch (level) {
    case 'CRITICAL':
      return {
        container: 'bg-red-50 border-red-200',
        header: 'text-red-800 bg-red-100',
        title: 'text-red-900',
        badge: 'bg-red-600 text-white',
      };
    case 'WARNING':
      return {
        container: 'bg-amber-50 border-amber-200',
        header: 'text-amber-800 bg-amber-100',
        title: 'text-amber-900',
        badge: 'bg-amber-600 text-white',
      };
    case 'GOOD':
      return {
        container: 'bg-green-50 border-green-200',
        header: 'text-green-800 bg-green-100',
        title: 'text-green-900',
        badge: 'bg-green-600 text-white',
      };
    default:
      return {
        container: 'bg-blue-50 border-blue-200',
        header: 'text-blue-800 bg-blue-100',
        title: 'text-blue-900',
        badge: 'bg-blue-600 text-white',
      };
  }
};

interface AlertStyles {
  container: string;
  header: string;
  title: string;
  badge: string;
}

const AlertCard: React.FC<{ alert: EnrichedAlert; styles: AlertStyles }> = ({ alert, styles }) => {
  return (
    <div className={`rounded-lg border ${styles.container} overflow-hidden`}>
      <div className={`p-3 ${styles.header} flex items-start gap-3`}>
        {getAlertIcon(alert.level)}
        <div className="flex-1">
          <h4 className={`font-bold text-sm ${styles.title}`}>{alert.title}</h4>
          <p className="text-sm mt-1 opacity-90">{alert.description}</p>

          {alert.businessContext && (
            <div className="mt-2 text-xs opacity-80 italic">💡 {alert.businessContext}</div>
          )}

          <EvidenceCard
            evidence={alert.evidence || []}
            analysisType={alert.analysisType || 'quote_based'}
          />
        </div>
      </div>
    </div>
  );
};

export const AuditSection: React.FC<AuditSectionProps> = ({ quotes, viewMode }) => {
  const [activeVisualization, setActiveVisualization] = useState<'alerts' | 'heatmap'>('alerts');
  const [showRadarModal, setShowRadarModal] = useState(false);

  const {
    enrichedAlerts,
    crossInsurerRisks,
    businessContextAnalysis,
    hasClauses,
    isLoading,
    error,
    isEnriched,
    progress,
    enrich,
  } = useAuditEnrichment();

  const clausesAvailable = hasClauses || (quotes && quotes.some((q) => q.isRagAvailable));

  // Auto-enrich on mount when clauses are available
  useEffect(() => {
    if (clausesAvailable && !isEnriched && !isLoading && quotes.length > 0) {
      console.log('🔄 [AuditSection] Auto-enriching with clauses...');
      enrich(quotes);
    }
  }, [clausesAvailable, isEnriched, isLoading, quotes, enrich]);

  // Defensive check for undefined quotes
  if (!quotes || !Array.isArray(quotes)) {
    return (
      <div className="p-8 text-center text-slate-500">No hay datos de auditoría disponibles.</div>
    );
  }

  // Use enriched alerts if available, otherwise use original alerts
  const getAlertsForQuote = (quote: QuoteAnalysis) => {
    if (isEnriched && enrichedAlerts.length > 0) {
      return enrichedAlerts.filter((a) => a.insurerName === quote.insurerName);
    }
    return (quote.alerts || []).map((a) => ({
      ...a,
      insurerName: quote.insurerName,
      evidence: [],
      analysisType: 'quote_based' as const,
    }));
  };

  const handleEnrich = () => {
    if (error) {
      enrich(quotes);
    } else if (!isEnriched) {
      enrich(quotes);
    }
  };

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      {/* Enrichment Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Análisis de Letra Chica y Brechas</h2>
          <p className="text-sm text-slate-500">
            {isEnriched
              ? 'Análisis profundo enriquecido con clausulados contractuales'
              : 'Auditoría consultiva basada en datos de cotización'}
          </p>
        </div>

        {!clausesAvailable ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 px-3 py-2 rounded-lg">
            <Info size={16} />
            <span>Sin clausulados indexados</span>
          </div>
        ) : (
          <button
            onClick={handleEnrich}
            disabled={isLoading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              error
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : isEnriched
                  ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
            }`}
            title={error ? 'Click para reintentar' : isEnriched ? 'Actualizar análisis' : ''}
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Enriqueciendo...</span>
              </>
            ) : error ? (
              <>
                <AlertCircle size={16} />
                <span>Reintentar</span>
              </>
            ) : isEnriched ? (
              <>
                <RefreshCw size={16} />
                <span>Actualizar</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>Enriquecer con Clausulados</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Consultative Value Banner */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-xl p-4 flex items-start gap-3 shadow-sm">
        <div className="p-2 bg-amber-100 rounded-lg text-amber-700 mt-0.5 shrink-0">
          <ShieldAlert size={18} />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-amber-900">
            Detección de Letra Chica, Exclusiones Ocultas y Brechas de Cobertura
          </h4>
          <p className="text-xs text-amber-800 leading-relaxed">
            Identifica trampas contractuales, garantías obligatorias no divulgadas, infraseguro y diferencias críticas de deducibles entre aseguradoras para asesorar con máxima certeza a tu cliente antes de la contratación.
          </p>
        </div>
      </div>

      {/* Auto-enrichment loading indicator with progress */}
      {isLoading && !isEnriched && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Loader2 size={20} className="animate-spin text-blue-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-800">
                {progress && progress.total > 0
                  ? `Enriqueciendo ${progress.current} de ${progress.total} alertas...`
                  : 'Enriqueciendo análisis con clausulados...'}
              </p>
              <p className="text-xs text-blue-600">Esto puede tomar unos segundos</p>
              {progress && progress.total > 0 && (
                <div className="mt-2 h-2 w-full bg-blue-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300 rounded-full"
                    style={{ width: `${progress.percentage}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* No clauses info message */}
      {!clausesAvailable && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info size={20} className="text-amber-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                Análisis basado en datos de cotización
              </p>
              <p className="text-xs text-amber-700 mt-1">
                No hay clausulados indexados disponibles. Suba clausulados para enriquecer el
                análisis con referencias normativas.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-600 mt-0.5 flex-shrink-0" size={18} />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Error al enriquecer análisis</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              {error.includes('demasiado grande') && (
                <p className="text-xs text-red-600 mt-2">
                  💡 Tip: Intenta analizar menos cotizaciones a la vez o recarga la página.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Visualization Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveVisualization('alerts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeVisualization === 'alerts'
              ? 'bg-indigo-100 text-indigo-700'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <AlertCircle size={16} />
          Alertas
        </button>
        <button
          onClick={() => setActiveVisualization('heatmap')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeVisualization === 'heatmap'
              ? 'bg-indigo-100 text-indigo-700'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <LayoutGrid size={16} />
          Mapa de Calor
        </button>
        <button
          onClick={() => setShowRadarModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-all ml-auto"
        >
          <Radar size={16} />
          Radar
        </button>
      </div>

      {/* Heatmap View */}
      {activeVisualization === 'heatmap' && (
        <div className="animate-in fade-in duration-300">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <LayoutGrid className="text-indigo-600" size={20} />
              Mapa de Calor de Riesgos
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Visualización de riesgos por categoría y aseguradora. Verde = bajo riesgo, Rojo = alto
              riesgo.
            </p>
            <RiskHeatmap quotes={quotes} />
          </div>
        </div>
      )}

      {/* Alerts View */}
      {activeVisualization === 'alerts' && (
        <div className="space-y-6">
          {/* Dashboard */}
          <AuditDashboard
            quotes={quotes}
            crossInsurerRisks={crossInsurerRisks}
            businessContextAnalysis={businessContextAnalysis}
            viewMode={viewMode}
          />

          {/* Alertas Detalladas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {quotes.map((quote, idx) => {
              const alerts = getAlertsForQuote(quote);
              const criticalAlerts = alerts.filter((a) => a.level === 'CRITICAL');
              const warningAlerts = alerts.filter((a) => a.level === 'WARNING');
              const goodAlerts = alerts.filter((a) => a.level === 'GOOD');

              return (
                <div
                  key={idx}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
                >
                  <div className="bg-slate-50 p-4 border-b border-slate-200">
                    <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                      <Shield className="text-indigo-600" size={24} />
                      {quote.insurerName}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      {viewMode === 'client' ? quote.clientAnalysis : quote.technicalAnalysis}
                    </p>
                  </div>

                  <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
                    {/* Críticos */}
                    {criticalAlerts.length > 0 && (
                      <div>
                        <h4 className="flex items-center gap-2 text-red-700 font-bold mb-3 text-sm uppercase tracking-wide">
                          <AlertCircle size={16} />
                          Riesgos Críticos
                          <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">
                            {criticalAlerts.length}
                          </span>
                        </h4>
                        <div className="space-y-3">
                          {criticalAlerts.map((alert, i) => (
                            <AlertCard key={i} alert={alert} styles={getAlertStyles('CRITICAL')} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Advertencias */}
                    {warningAlerts.length > 0 &&
                      (viewMode === 'technical' || warningAlerts.length <= 3) && (
                        <div>
                          <h4 className="flex items-center gap-2 text-amber-600 font-bold mb-3 text-sm uppercase tracking-wide">
                            <AlertTriangle size={16} />
                            Puntos de Atención
                            <span className="bg-amber-600 text-white text-xs px-2 py-0.5 rounded-full">
                              {warningAlerts.length}
                            </span>
                          </h4>
                          <div className="space-y-3">
                            {warningAlerts.map((alert, i) => (
                              <AlertCard key={i} alert={alert} styles={getAlertStyles('WARNING')} />
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Destacados */}
                    {goodAlerts.length > 0 && (
                      <div>
                        <h4 className="flex items-center gap-2 text-green-700 font-bold mb-3 text-sm uppercase tracking-wide">
                          <CheckCircle size={16} />
                          Destacados
                          <span className="bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">
                            {goodAlerts.length}
                          </span>
                        </h4>
                        <div className="space-y-3">
                          {goodAlerts.map((alert, i) => (
                            <AlertCard key={i} alert={alert} styles={getAlertStyles('GOOD')} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quote-based Audit Summary */}
                    {quote.quoteAudit && (
                      <div className="mt-4 pt-4 border-t border-slate-200 space-y-4">
                        <h4 className="flex items-center gap-2 text-indigo-700 font-bold mb-2 text-sm uppercase tracking-wide">
                          <Shield size={16} />
                          Análisis de Cotización
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              quote.quoteAudit.overallRiskScore >= 80
                                ? 'bg-green-100 text-green-700'
                                : quote.quoteAudit.overallRiskScore >= 60
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-red-100 text-red-700'
                            }`}
                          >
                            Score: {quote.quoteAudit.overallRiskScore}/100
                          </span>
                        </h4>

                        {/* Missing Coverages */}
                        {quote.quoteAudit.missingCoverages.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs font-medium text-slate-600 mb-1">
                              Coberturas Faltantes ({quote.quoteAudit.missingCoverages.length}):
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {quote.quoteAudit.missingCoverages.slice(0, 5).map((mc, i) => (
                                <span
                                  key={i}
                                  className={`text-xs px-2 py-0.5 rounded ${
                                    mc.impact === 'HIGH'
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-yellow-100 text-yellow-700'
                                  }`}
                                >
                                  {mc.categoryName}
                                </span>
                              ))}
                              {quote.quoteAudit.missingCoverages.length > 5 && (
                                <span className="text-xs text-slate-500">
                                  +{quote.quoteAudit.missingCoverages.length - 5} más
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Deductible Risks */}
                        {quote.quoteAudit.deductibleRisks.filter(
                          (r) => r.riskLevel === 'HIGH' || r.riskLevel === 'CRITICAL'
                        ).length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs font-medium text-slate-600 mb-1">
                              Riesgos de Deducibles:
                            </p>
                            <div className="space-y-1">
                              {quote.quoteAudit.deductibleRisks
                                .filter((r) => r.riskLevel === 'HIGH' || r.riskLevel === 'CRITICAL')
                                .slice(0, 3)
                                .map((dr, i) => (
                                  <div key={i} className="flex items-center gap-2 text-xs">
                                    <span
                                      className={`w-2 h-2 rounded-full ${
                                        dr.riskLevel === 'CRITICAL' ? 'bg-red-500' : 'bg-orange-500'
                                      }`}
                                    />
                                    <span className="text-slate-700">{dr.coverageName}:</span>
                                    <span className="font-medium text-slate-900">
                                      {dr.deductible}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Special Conditions */}
                        {quote.quoteAudit.specialConditions.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-slate-600 mb-1">
                              Condiciones Especiales ({quote.quoteAudit.specialConditions.length}):
                            </p>
                            <div className="space-y-1">
                              {quote.quoteAudit.specialConditions.slice(0, 3).map((sc, i) => (
                                <div
                                  key={i}
                                  className="text-xs text-slate-600 bg-slate-50 p-2 rounded"
                                >
                                  {sc.text.substring(0, 100)}
                                  {sc.text.length > 100 ? '...' : ''}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Negotiation Points */}
                        {quote.quoteAudit.negotiationPoints &&
                          quote.quoteAudit.negotiationPoints.length > 0 && (
                            <div>
                              <h5 className="flex items-center gap-2 text-amber-700 font-bold mb-2 text-xs uppercase tracking-wide">
                                <Handshake size={14} />
                                Puntos de Negociación
                              </h5>
                              <div className="space-y-2">
                                {quote.quoteAudit.negotiationPoints.slice(0, 3).map((np, i) => (
                                  <div
                                    key={i}
                                    className="bg-amber-50 border border-amber-200 rounded p-2"
                                  >
                                    <div className="flex items-start gap-2">
                                      <TrendingDown
                                        size={14}
                                        className="text-amber-600 mt-0.5 flex-shrink-0"
                                      />
                                      <div>
                                        <p className="text-xs font-semibold text-amber-800">
                                          {np.title}
                                        </p>
                                        <p className="text-xs text-amber-700 mt-0.5">
                                          {np.description}
                                        </p>
                                        {np.potentialSavings && (
                                          <p className="text-xs text-amber-600 mt-1 font-medium">
                                            💰 {np.potentialSavings}
                                          </p>
                                        )}
                                        <span
                                          className={`inline-block mt-1 text-xs px-1.5 py-0.5 rounded ${
                                            np.priority === 'HIGH'
                                              ? 'bg-red-100 text-red-700'
                                              : np.priority === 'MEDIUM'
                                                ? 'bg-yellow-100 text-yellow-700'
                                                : 'bg-green-100 text-green-700'
                                          }`}
                                        >
                                          {np.priority}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                        {/* Competitive Advantages */}
                        {quote.quoteAudit.competitiveAdvantages &&
                          quote.quoteAudit.competitiveAdvantages.length > 0 && (
                            <div>
                              <h5 className="flex items-center gap-2 text-green-700 font-bold mb-2 text-xs uppercase tracking-wide">
                                <Trophy size={14} />
                                Ventajas Competitivas
                              </h5>
                              <div className="space-y-2">
                                {quote.quoteAudit.competitiveAdvantages.slice(0, 3).map((ca, i) => (
                                  <div
                                    key={i}
                                    className="bg-green-50 border border-green-200 rounded p-2"
                                  >
                                    <div className="flex items-start gap-2">
                                      <Trophy
                                        size={14}
                                        className="text-green-600 mt-0.5 flex-shrink-0"
                                      />
                                      <p className="text-xs text-green-800">{ca.description}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                      </div>
                    )}

                    {alerts.length === 0 && !quote.quoteAudit && (
                      <div className="text-center py-8">
                        <FileText className="mx-auto mb-2 text-slate-300" size={48} />
                        <p className="text-slate-400">
                          Sin hallazgos relevantes para esta cotización.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Radar Modal */}
      <InsurerRadar
        quotes={quotes}
        isOpen={showRadarModal}
        onClose={() => setShowRadarModal(false)}
      />
    </div>
  );
};

export default AuditSection;
