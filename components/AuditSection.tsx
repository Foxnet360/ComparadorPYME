import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info, BookOpen, Shield, FileText } from 'lucide-react';
import { QuoteAnalysis, AlertItem, AlertLevel } from '../types';

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

const AlertCard: React.FC<{ alert: AlertItem; styles: any }> = ({ alert, styles }) => {
  return (
    <div className={`rounded-lg border ${styles.container} overflow-hidden`}>
      <div className={`p-3 ${styles.header} flex items-start gap-3`}>
        {getAlertIcon(alert.level)}
        <div className="flex-1">
          <h4 className={`font-bold text-sm ${styles.title}`}>{alert.title}</h4>
          <p className="text-sm mt-1 opacity-90">{alert.description}</p>
          
          {alert.clauseReference && (
            <div className="mt-3 pt-3 border-t border-current border-opacity-20">
              <div className="flex items-start gap-2">
                <BookOpen size={14} className="mt-0.5 shrink-0 opacity-70" />
                <div className="text-xs">
                  <span className="font-semibold opacity-80">Fundamento en clausulado:</span>
                  <p className="italic mt-1 opacity-90">"{alert.clauseReference}"</p>
                  {alert.sourceDocument && (
                    <p className="opacity-70 mt-1">— {alert.sourceDocument}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const AuditSection: React.FC<AuditSectionProps> = ({ quotes, viewMode }) => {
  // Defensive check for undefined quotes
  if (!quotes || !Array.isArray(quotes)) {
    return (
      <div className="p-8 text-center text-slate-500">
        No hay datos de auditoría disponibles.
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      {/* Resumen de Hallazgos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {quotes.map((quote, idx) => {
          const alerts = quote.alerts || [];
          const critical = alerts.filter(a => a.level === 'CRITICAL').length;
          const warning = alerts.filter(a => a.level === 'WARNING').length;
          const good = alerts.filter(a => a.level === 'GOOD').length;
          
          return (
            <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <h3 className="font-bold text-slate-800 mb-3">{quote.insurerName}</h3>
              <div className="space-y-2">
                {critical > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-red-600">
                      <AlertCircle size={16} /> Críticos
                    </span>
                    <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold">
                      {critical}
                    </span>
                  </div>
                )}
                {warning > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-amber-600">
                      <AlertTriangle size={16} /> Advertencias
                    </span>
                    <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                      {warning}
                    </span>
                  </div>
                )}
                {good > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-green-600">
                      <CheckCircle size={16} /> Destacados
                    </span>
                    <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-bold">
                      {good}
                    </span>
                  </div>
                )}
                {alerts.length === 0 && (
                  <p className="text-sm text-slate-400 italic">Sin hallazgos</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Alertas Detalladas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {quotes.map((quote, idx) => {
          const alerts = quote.alerts || [];
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
