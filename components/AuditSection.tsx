import React, { useEffect } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info, BookOpen, Shield, FileText, Sparkles, Loader2 } from 'lucide-react';
import { QuoteAnalysis, AlertItem, AlertLevel } from '../types';
import { AuditDashboard } from './AuditDashboard';
import { EvidenceCard } from './EvidenceCard';
import { useAuditEnrichment } from '../hooks/useAuditEnrichment';

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
  const { 
    enrichedAlerts, 
    crossInsurerRisks, 
    businessContextAnalysis,
    hasClauses,
    isLoading, 
    error, 
    isEnriched,
    enrich,
    reset 
  } = useAuditEnrichment();

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
    if (!isEnriched) {
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
        
        <button
          onClick={handleEnrich}
          disabled={isLoading || isEnriched}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            isEnriched
              ? 'bg-green-100 text-green-700 cursor-default'
              : hasClauses
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
          title={!hasClauses ? 'No hay clausulados indexados disponibles' : ''}
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Enriqueciendo...</span>
            </>
          ) : isEnriched ? (
            <>
              <CheckCircle size={16} />
              <span>Enriquecido</span>
            </>
          ) : (
            <>
              <Sparkles size={16} />
              <span>Enriquecer con Clausulados</span>
            </>
          )}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Error al enriquecer: {error}
        </div>
      )}

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
  );
};

export default AuditSection;
