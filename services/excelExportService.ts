import { apiClient } from './apiClient';
import { storageService } from './storageService';
import {
  extractCommercialConditionsFromReport,
  type InsurerCommercialConditions,
} from '../src/data/commercialPolicies';
import type { ComparisonReport } from '../types';

export interface ExportExcelParams {
  analysisId: string;
  domain?: string;
  quotes: ComparisonReport['quotes'];
  matrix: ComparisonReport['matrix'];
  exportMode: 'client' | 'technical';
  cellNotes?: Record<string, unknown>;
  commercialConditions?: Record<string, InsurerCommercialConditions>;
  report?: ComparisonReport;
}

/**
 * Shared Excel export helper used by ExportModal and UnifiedCoverageMatrix
 * so both entry points always include brokerInfo and commercialConditions.
 */
export async function exportAnalysisToExcel(params: ExportExcelParams): Promise<void> {
  const {
    analysisId,
    domain = 'pyme',
    quotes,
    matrix,
    exportMode,
    cellNotes = {},
    commercialConditions,
    report,
  } = params;

  const currentUser = await storageService.getCurrentUser();
  const brokerInfo = {
    name: currentUser?.name || 'Asesor Técnico de Seguros',
    intermediaryName:
      currentUser?.intermediaryName || currentUser?.agencyName || 'Corredores de Seguros Asociados S.A.',
    registrationNumber:
      currentUser?.registrationNumber ||
      currentUser?.agentDetails?.registrationNumber ||
      'Inscripción Vigente SFC',
    phone: currentUser?.agentDetails?.phone || currentUser?.phone || '+57 (601) 345-6789',
    email: currentUser?.email || 'soporte@comparadorcsa.com',
    address: currentUser?.address || currentUser?.agentDetails?.address || 'Bogotá D.C., Colombia',
    city: currentUser?.city || currentUser?.agentDetails?.city || 'Bogotá D.C.',
    commercialPolicies: currentUser?.commercialPolicies,
  };

  const resolvedCommercialConditions =
    commercialConditions ?? (report ? extractCommercialConditionsFromReport(report) : {});

  const response = await apiClient.fetch(`/analysis/${analysisId}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      domain,
      quotes,
      matrix,
      commercialConditions: resolvedCommercialConditions,
      exportMode,
      brokerInfo,
      cellNotes: typeof cellNotes === 'object' && cellNotes !== null ? cellNotes : {},
    }),
  });

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download =
    exportMode === 'client'
      ? `informe_cliente_${domain}_${analysisId}.xlsx`
      : `comparativa_tecnica_${analysisId}.xlsx`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
