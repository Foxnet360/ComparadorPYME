import React, { useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info, Shield, FileText, Sparkles, Loader2, RefreshCw, LayoutGrid, Radar } from 'lucide-react';
import { QuoteAnalysis, AlertItem, AlertLevel } from '../types';
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
    case 'CRITICAL': return <AlertCircle className="text-red-600" size={20} />;
    case 'WARNING': return <AlertTriangle className="text-amber-500" size={20} />;
    case 'GOOD': return <CheckCircle className="text-green-600" size={20} />;
    default: return <Info className="text-blue-500" size={20} />;
  }
};

const getAlertStyles = (level: AlertLevel) => {
  switch (level) {
    case 'CRITICAL': 
      return {
        container: 'bg-red-50 border-red-200',
        header: 'text-red-800 bg-red-100',
        title: 'text-red-900',
        badge: 'bg-red-600 text-white'
      };
    case 'WARNING': 
      return {
        container: 'bg-amber-50 border-amber-200',
        header: 'text-amber-800 bg-amber-100',
        title: 'text-amber-900',
        badge: 'bg-amber-600 text-white'
      };
    case 'GOOD': 
      return {
        container: 'bg-green-50 border-green-200',
        header: 'text-green-800 bg-green-100',
        title: 'text-green-900',
        badge: 'bg-green-600 text-white'
      };
    default: 
      return {
        container: 'bg-blue-50 border-blue-200',
        header: 'text-blue-800 bg-blue-100',
        title: 'text-blue-900',
        badge: 'bg-blue-600 text-white'
      };
  }
};

const AlertCard: React.FC<{ alert: any; styles: any }> = ({ alert, styles }) => {
  return (
    <div className={`rounded-lg border ${styles.container} overflow-hidden`}>
      <div className={`p-3 ${styles.header} flex items-start gap-3`}>
        {getAlertIcon(alert.level)}
        <div className="flex-1">
          <h4 className={`font-bold text-sm ${styles.title}`}>{alert.title}</h4>
          <p className="text-sm mt-1 opacity-90">{alert.description}</p>
          
          {alert.businessContext && (
            <div className="mt-2 text-xs opacity-80 italic">
              💡 {alert.businessContext}
            </div>
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
    reset 
  } = useAuditEnrichment();

  // Auto-enrich on mount when clauses are available
  useEffect(() => {
    if (hasClauses && !isEnriched && !isLoading && quotes.length > 0) {
      console.log('🔄 [AuditSection] Auto-enriching with clauses...');
      enrich(quotes);
    }
  }, [hasClauses, isEnriched, isLoading, quotes, enrich]);

  // Defensive check for undefined quotes
  if (!quotes || !Array.isArray(quotes)) {
    return (
      <div className="p-8 text-center text-slate-500">
        No hay datos de auditoría disponibles.
      </div>
    );
  }

  // Use enriched alerts if available, otherwise use original alerts
  const getAlertsForQuote = (quote: QuoteAnalysis) => {
    if (isEnriched && enrichedAlerts.length > 0) {
      return enrichedAlerts.filter(a => a.insurerName === quote.insurerName);
    }
    return (quote.alerts || []).map(a => ({
      ...a,
      insurerName: quote.insurerName,
      evidence: [],
      analysisType: 'quote_based' as const
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
          <h2 className="text-xl font-bold text-slate-800">Auditoría de Riesgos</h2>
          <p className="text-sm text-slate-500">
            {isEnriched 
              ? 'Análisis enriquecido con clausulados'
              : 'Análisis basado en datos de cotización'
            }
          </p>
        </div>
        
        {!hasClauses ? (
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

      {/* Auto-enrichment loading indicator with progress */}
      {isLoading && !isEnriched && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Loader2 size={20} className="animate-spin text-blue-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-800">
                {progress && progress.total > 0 
                  ? `Enriqueciendo ${progress.current} de ${progress.total} alertas...`
                  : 'Enriqueciendo análisis con clausulados...'
                }
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
      {!hasClauses && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info size={20} className="text-amber-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Análisis basado en datos de cotización</p>
              <p className="text-xs text-amber-700 mt-1">
                No hay clausulados indexados disponibles. Suba clausulados para enriquecer el análisis con referencias normativas.
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
              Visualización de riesgos por categoría y aseguradora. Verde = bajo riesgo, Rojo = alto riesgo.
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
              const criticalAlerts = alerts.filter(a => a.level === 'CRITICAL');
              const warningAlerts = alerts.filter(a => a.level === 'WARNING');
              const goodAlerts = alerts.filter(a => a.level === 'GOOD');
              
              return (
                <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
                            <AlertCard 
                              key={i} 
                              alert={alert} 
                              styles={getAlertStyles('CRITICAL')} 
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Advertencias */}
                    {warningAlerts.length > 0 && (viewMode === 'technical' || warningAlerts.length <= 3) && (
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
                            <AlertCard 
                              key={i} 
                              alert={alert} 
                              styles={getAlertStyles('WARNING')} 
                            />
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
                            <AlertCard 
                              key={i} 
                              alert={alert} 
                              styles={getAlertStyles('GOOD')} 
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {alerts.length === 0 && (
                      <div className="text-center py-8">
                        <FileText className="mx-auto mb-2 text-slate-300" size={48} />
                        <p className="text-slate-400">Sin hallazgos relevantes para esta cotización.</p>
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
