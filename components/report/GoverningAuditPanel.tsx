import React from 'react';
import { FileCheck2, AlertTriangle, CheckCircle2, XCircle, Scale } from 'lucide-react';
import type { GoverningDocumentAudit } from '../../types';

interface GoverningAuditPanelProps {
  audit: GoverningDocumentAudit;
}

const STAGE_LABEL_MAP: Record<string, string> = {
  AUTO: 'Detección Automática',
  LICITACION: 'Licitación / Pliego de Condiciones (Precontractual)',
  CONTRATO: 'Contrato / Minuta Adjudicada (Ejecución + RCE)',
  OTROSI: 'Otrosí / Modificación Contractual',
};

export const GoverningAuditPanel: React.FC<GoverningAuditPanelProps> = ({ audit }) => {
  const insurers = Object.entries(audit.perInsurerStatus || {});

  return (
    <div
      className="bg-white rounded-2xl border-2 border-indigo-200/80 shadow-sm p-5 space-y-4"
      data-testid="governing-audit-panel"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
            <FileCheck2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                Auditoría contra Documento Rector ({audit.documentName})
              </h3>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                {STAGE_LABEL_MAP[audit.stage] || audit.stage}
              </span>
              {audit.legalRegime && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  <Scale className="w-3 h-3" />
                  {audit.legalRegime}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              {audit.processOrContractNumber && (
                <span className="mr-3">
                  <strong>Proceso / Contrato:</strong> {audit.processOrContractNumber}
                </span>
              )}
              {audit.entityName && (
                <span className="mr-3">
                  <strong>Entidad:</strong> {audit.entityName}
                </span>
              )}
              {typeof audit.contractOrBudgetValue === 'number' &&
                audit.contractOrBudgetValue > 0 && (
                  <span>
                    <strong>Cuantía Base:</strong> $
                    {audit.contractOrBudgetValue.toLocaleString('es-CO')}
                  </span>
                )}
            </p>
          </div>
        </div>
        <div className="text-xs text-slate-500 shrink-0">
          {audit.requiredCoverages.length} amparo{audit.requiredCoverages.length === 1 ? '' : 's'}{' '}
          exigido{audit.requiredCoverages.length === 1 ? '' : 's'}
        </div>
      </div>

      {insurers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {insurers.map(([insurerName, status]) => {
            const isFullCompliance =
              status.totalRequired > 0 && status.compliantCount === status.totalRequired;
            return (
              <div
                key={insurerName}
                className={`rounded-xl border p-3.5 space-y-2 ${
                  isFullCompliance
                    ? 'bg-emerald-50/50 border-emerald-200'
                    : 'bg-amber-50/40 border-amber-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800">{insurerName}</span>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      isFullCompliance
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {status.compliantCount}/{status.totalRequired} Cumple
                  </span>
                </div>

                <ul className="space-y-1.5 text-[11px]">
                  {status.gaps.map((gap, idx) => (
                    <li key={idx} className="flex items-start gap-1.5 text-slate-700">
                      {gap.status === 'COMPLIANT' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      ) : gap.status === 'PARTIAL_GAP' ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <span className="font-semibold">{gap.coverageName}</span>
                        {gap.requiredPercentage && (
                          <span className="text-slate-500"> ({gap.requiredPercentage})</span>
                        )}
                        {gap.status !== 'COMPLIANT' && (
                          <div className="text-[10px] text-slate-600">{gap.notes}</div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default GoverningAuditPanel;
