import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { QuoteAnalysis } from '../types';

interface AuditWizardProps {
  quotes: QuoteAnalysis[];
  onNavigateToRow: (rowId: string) => void;
}

interface Discrepancy {
  id: string;
  type: 'consensus' | 'inverse' | 'lowConfidence';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  rowId: string;
  insurerName?: string;
}

export const AuditWizard: React.FC<AuditWizardProps> = ({ quotes, onNavigateToRow }) => {
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(
    new Set(['critical'])
  );

  // Detectar discrepancias
  const discrepancies: Discrepancy[] = React.useMemo(() => {
    const items: Discrepancy[] = [];

    quotes.forEach((quote, quoteIdx) => {
      // Discrepancias de consenso (needsHumanReview)
      quote.coverages.forEach((coverage, covIdx) => {
        if (coverage.needsHumanReview) {
          items.push({
            id: `consensus-${quoteIdx}-${covIdx}`,
            type: 'consensus',
            severity: 'WARNING',
            title: `Discrepancia en ${coverage.name}`,
            description: `Doble agente en discrepancia para ${quote.insurerName}`,
            rowId: `section_${coverage.categoryId}_row_value`,
            insurerName: quote.insurerName,
          });
        }

        // Coberturas de baja confianza
        if (coverage.matchConfidence !== undefined && coverage.matchConfidence < 0.7) {
          items.push({
            id: `lowconf-${quoteIdx}-${covIdx}`,
            type: 'lowConfidence',
            severity: 'INFO',
            title: `Baja confianza en ${coverage.name}`,
            description: `Confianza del match: ${(coverage.matchConfidence * 100).toFixed(0)}%`,
            rowId: `section_${coverage.categoryId}_row_value`,
            insurerName: quote.insurerName,
          });
        }
      });
    });

    // Alertas de cobertura inversa (simulado - en realidad vendría del backend)
    const inverseAlerts = quotes.flatMap(
      (q) =>
        q.quoteAudit?.missingCoverages?.map((mc, idx) => ({
          id: `inverse-${q.insurerName}-${idx}`,
          type: 'inverse' as const,
          severity: 'CRITICAL' as const,
          title: `Cobertura inversa: ${mc.categoryName}`,
          description: mc.reason,
          rowId: `section_${mc.categoryId}_row_value`,
          insurerName: q.insurerName,
        })) || []
    );

    return [...items, ...inverseAlerts];
  }, [quotes]);

  const groupedDiscrepancies = React.useMemo(() => {
    return {
      CRITICAL: discrepancies.filter((d) => d.severity === 'CRITICAL'),
      WARNING: discrepancies.filter((d) => d.severity === 'WARNING'),
      INFO: discrepancies.filter((d) => d.severity === 'INFO'),
    };
  }, [discrepancies]);

  const resolvedCount = discrepancies.length; // En una implementación real, esto vendría del estado
  const totalCount = discrepancies.length;
  const progressPercentage = totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 100;

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return <AlertCircle className="text-red-500" size={16} />;
      case 'WARNING':
        return <AlertTriangle className="text-yellow-500" size={16} />;
      default:
        return <AlertCircle className="text-blue-500" size={16} />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'WARNING':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  if (discrepancies.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
        <CheckCircle className="text-green-500" size={20} />
        <div>
          <p className="font-semibold text-green-800">Todas las coberturas han sido validadas</p>
          <p className="text-sm text-green-600">El análisis está listo para exportar.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header con progreso */}
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-slate-800">Asistente de Auditoría</h3>
          <div
            className="flex items-center gap-2"
            role="progressbar"
            aria-valuenow={progressPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progreso de auditoría: ${resolvedCount} de ${totalCount} alertas resueltas`}
          >
            <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <span className="text-xs text-slate-600">
              {resolvedCount}/{totalCount}
            </span>
          </div>
        </div>
        <p className="text-sm text-slate-600">
          Hemos detectado {groupedDiscrepancies.CRITICAL.length} discrepancias críticas,{' '}
          {groupedDiscrepancies.WARNING.length} advertencias y {groupedDiscrepancies.INFO.length}{' '}
          items informativos.
        </p>
      </div>

      {/* Lista de discrepancias agrupadas */}
      <div className="divide-y divide-slate-100">
        {(['CRITICAL', 'WARNING', 'INFO'] as const).map((severity) => {
          const items = groupedDiscrepancies[severity];
          if (items.length === 0) return null;

          const isExpanded = expandedSections.has(severity.toLowerCase());

          return (
            <div key={severity}>
              <button
                onClick={() => toggleSection(severity.toLowerCase())}
                className={`w-full px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors ${getSeverityColor(severity)}`}
              >
                <div className="flex items-center gap-2">
                  {getSeverityIcon(severity)}
                  <span className="font-medium text-sm">
                    {severity === 'CRITICAL' && 'Críticas'}
                    {severity === 'WARNING' && 'Advertencias'}
                    {severity === 'INFO' && 'Informativas'}
                  </span>
                  <span className="text-xs bg-white/60 px-2 py-0.5 rounded-full">
                    {items.length}
                  </span>
                </div>
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {isExpanded && (
                <div className="divide-y divide-slate-50">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => onNavigateToRow(item.rowId)}
                      className="w-full px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="mt-0.5">{getSeverityIcon(item.severity)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-slate-800 truncate">{item.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                        {item.insurerName && (
                          <span className="text-xs text-slate-400 mt-1 inline-block">
                            {item.insurerName}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AuditWizard;
