import * as ExcelJS from 'exceljs';
import { QuoteAnalysis, MatrixRow } from '../types';
import { InsuranceDomain } from '../types/domain';
import {
  transformQuotesToMatrix,
  parseNumericValue,
  alignMatrixRowsToQuotes,
} from './unifiedComparison/matrixTransformer';
import { getDomainRegulatoryProfile } from '../shared/domainRegulatoryKnowledge';
import {
  ClientInfo,
  ExcelReportData,
  BrokerInfo,
  BrokerDetails,
  ExcelContext,
} from './excel/types';
import { getInsurerLogoPngBuffer } from './excel/excelHelpers';
import {
  buildPortadaSheet,
  buildSummarySheet,
  buildCoveragesSheet,
  buildDeductiblesSheet,
  buildFinancialsSheet,
  buildRiskSheet,
  buildLegalSheet,
  buildCommercialPoliciesSheet,
} from './excel/sheets';

// Re-export public interfaces and utilities for 100% backward compatibility
export type { ClientInfo, ExcelReportData, BrokerInfo } from './excel/types';
export { formatRatioCell } from './excel/excelHelpers';

/**
 * Orchestrates multi-worksheet Excel workbook generation for insurance quote comparisons.
 * Dispatches individual worksheet building to dedicated sheet builders.
 */
export async function generateExcelBuffer(
  quotes: QuoteAnalysis[],
  clientInfo?: ClientInfo,
  cellNotes?: Record<string, string>,
  brokerInfo?: BrokerInfo,
  domain: string = 'pyme',
  reportData?: ExcelReportData,
  mode: 'technical' | 'client' = 'technical'
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = brokerInfo?.intermediaryName || 'Agente Comparador CSA';
  workbook.lastModifiedBy = brokerInfo?.name || 'Agente Comparador CSA';
  workbook.created = new Date();
  workbook.modified = new Date();

  const hasNotes = Boolean(cellNotes && Object.keys(cellNotes).length > 0);
  const regulatoryProfile = getDomainRegulatoryProfile(domain);

  // Pre-generate offline brand logo buffers for each insurer
  const insurerLogoBuffers = await Promise.all(
    quotes.map((q) => getInsurerLogoPngBuffer(q.insurerName))
  );
  const insurerImageIds: (number | null)[] = insurerLogoBuffers.map((buf) =>
    buf ? workbook.addImage({ buffer: buf as unknown as ExcelJS.Buffer, extension: 'png' }) : null
  );

  // Obtain ground-truth matrix rows from reportData or build using matrixTransformer
  const matrix: MatrixRow[] =
    reportData?.matrix && Array.isArray(reportData.matrix) && reportData.matrix.length > 0
      ? alignMatrixRowsToQuotes(reportData.matrix, quotes, domain as InsuranceDomain)
      : transformQuotesToMatrix(quotes, domain);

  // Client Info
  const clientName = clientInfo?.name || 'Cliente';
  const defaultActivity =
    domain === 'copropiedades'
      ? 'Edificio Residencial / Comercial (Copropiedad)'
      : domain === 'autos'
        ? 'Vehículo Particular / Flotas'
        : domain === 'hogar'
          ? 'Vivienda Residencial / Hogar'
          : 'Comercial / PYME';
  const clientActivity =
    clientInfo?.activity && clientInfo.activity !== 'Centro de Belleza y/o Estetica (CIIU 9602)'
      ? clientInfo.activity
      : defaultActivity;
  const clientLocation = clientInfo?.location || 'Bogotá D.C.';

  // Max Asset Calculation
  const assetValues: number[] = [];
  quotes.forEach((q) => {
    (q.coverages || []).forEach((c) => {
      const name = (c.name || '').toLowerCase();
      const canonical = (c.canonicalName || '').toLowerCase();
      if (
        name.includes('incendio') ||
        name.includes('edificio') ||
        name.includes('bienes') ||
        name.includes('daño material') ||
        name.includes('amparo básico') ||
        canonical.includes('incendio') ||
        canonical.includes('edificio') ||
        canonical.includes('daño material')
      ) {
        const val = parseNumericValue(c.value);
        if (val > 0) assetValues.push(val);
      }
    });
  });
  const maxAsset = assetValues.length > 0 ? Math.max(...assetValues) : 0;
  const totalAssetValueStr =
    maxAsset > 0
      ? '$' +
        maxAsset.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
      : 'No especificado';

  // Find Best Quote
  const bestQuote = quotes.reduce(
    (prev, current) => ((prev.score || 0) > (current.score || 0) ? prev : current),
    quotes[0]!
  );

  // Intermediary / Broker Commercial Details
  const brokerDetails: BrokerDetails = {
    name:
      brokerInfo?.intermediaryName || brokerInfo?.name || 'Corredores de Seguros Asociados S.A.',
    advisor: brokerInfo?.name || 'Asesor Técnico de Seguros',
    phone: brokerInfo?.phone || '+57 (601) 345-6789',
    email: brokerInfo?.email || 'soporte@comparadorcsa.com',
    reg: brokerInfo?.registrationNumber || 'Inscripción Vigente SFC',
    address: brokerInfo?.address || 'Bogotá D.C., Colombia',
    city: brokerInfo?.city || 'Colombia',
    website: 'https://correseguros.co/',
  };
  const todayStr = new Date().toLocaleDateString('es-ES');

  const context: ExcelContext = {
    workbook,
    quotes,
    clientInfo,
    cellNotes,
    brokerInfo,
    domain,
    reportData,
    mode,
    hasNotes,
    regulatoryProfile,
    matrix,
    insurerImageIds,
    clientName,
    clientActivity,
    clientLocation,
    maxAsset,
    totalAssetValueStr,
    bestQuote,
    brokerDetails,
    todayStr,
  };

  // Dispatch sheet builders according to export mode
  if (mode === 'technical') {
    buildPortadaSheet(context);
  }

  buildSummarySheet(context);

  if (mode === 'technical') {
    buildCoveragesSheet(context);
    buildDeductiblesSheet(context);
    buildFinancialsSheet(context);
    buildRiskSheet(context);
    await buildLegalSheet(context);
  }

  buildCommercialPoliciesSheet(context);

  // Generate binary buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as unknown as Buffer;
}
