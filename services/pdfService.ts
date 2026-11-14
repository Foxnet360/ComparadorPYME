import jsPDF from 'jspdf';
import type { ComparisonReport } from '../types';
import { findColombianInsurerProfile } from '@shared/colombianInsurersCatalog';
import { getDomainRegulatoryProfile } from '@shared/domainRegulatoryKnowledge';
import { getEffectiveCommercialPolicies } from '../src/data/commercialPolicies';
import type { BrokerInfo, PDFOptions, PdfRenderContext } from './pdf/types';
import {
  TABLE_MARGINS,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_LIGHT_GRAY,
  getLastAutoTableFinalY,
} from './pdf/pdfHelpers';
import { renderPageHeader, renderEnrichedFooter } from './pdf/pdfHeader';
import {
  renderExecutiveSummarySection,
  renderCuadroChicoSection,
  renderCoverageMatrixSection,
  renderDeductiblesSection,
  renderRiskAuditSection,
  renderEconomicAndRegulatorySection,
  renderCommercialPoliciesSection,
} from './pdf/pdfSections';
import { generatePerformanceReport } from './pdf/performanceReportPdf';

export type { BrokerInfo, PDFOptions };
export { getLastAutoTableFinalY, generatePerformanceReport };

/**
 * Orchestrator service to generate professional comparative executive report PDFs.
 * Supports both extended technical audit mode and condensed executive summary mode.
 */
export const generatePDF = (
  report: ComparisonReport,
  options?: PDFOptions,
  _cellNotes?: Record<string, string>
) => {
  const doc = new jsPDF();
  const today = new Date().toLocaleDateString('es-ES');
  const domain = report.domain || 'pyme';
  const regProfile = getDomainRegulatoryProfile(domain);

  // --- COLORS ---
  const PRIMARY_COLOR: [number, number, number] = options?.primaryColor || DEFAULT_PRIMARY_COLOR;
  const LIGHT_GRAY: [number, number, number] = DEFAULT_LIGHT_GRAY;

  const effectivePolicies = getEffectiveCommercialPolicies(
    options?.commercialPolicies || options?.brokerInfo?.commercialPolicies
  );

  const pagesWithHeader = new Set<number>();

  // Helper to add Title Header on new pages
  const addHeader = (title: string): number => {
    return renderPageHeader({
      doc,
      title,
      options,
      regProfile,
      today,
      pagesWithHeader,
      primaryColor: PRIMARY_COLOR,
    });
  };

  const quotes = report.quotes || [];

  // Extraer metadatos de riesgo y cliente para la portada ejecutiva
  const firstMeta = report.quoteMetadata?.[0];
  const clientName =
    report.clientInfo?.name ||
    firstMeta?.cliente ||
    quotes.find((q) => q.clientName)?.clientName ||
    'Cliente / Tomador';
  const riskAddress =
    report.clientInfo?.address ||
    report.clientInfo?.location ||
    firstMeta?.ubicacionRiesgo ||
    'Ubicación según póliza';
  const riskCity = report.clientInfo?.city || 'Colombia';
  const buildingDetails = [
    firstMeta?.anoConstruccion ? `Año: ${firstMeta.anoConstruccion}` : null,
    firstMeta?.pisos ? `Pisos: ${firstMeta.pisos}` : null,
    firstMeta?.actividadOcupacion ? `Ocupación: ${firstMeta.actividadOcupacion}` : null,
    firstMeta?.vigencia ? `Vigencia: ${firstMeta.vigencia}` : null,
  ]
    .filter(Boolean)
    .join('  •  ');

  const isCondensed = options?.mode === 'condensed' || options?.condensed === true;
  const broker = options?.brokerInfo;
  const brokerName =
    broker?.intermediaryName || broker?.name || 'Corredores de Seguros Asociados S.A.';

  const insurers = quotes.map((q) => {
    const prof = findColombianInsurerProfile(q.insurerName);
    return prof?.monogram ? `[${prof.monogram}]\n${q.insurerName}` : q.insurerName;
  });

  const ctx: PdfRenderContext = {
    doc,
    report,
    options,
    today,
    domain,
    regProfile,
    primaryColor: PRIMARY_COLOR,
    lightGray: LIGHT_GRAY,
    tableMargins: TABLE_MARGINS,
    pagesWithHeader,
    addHeader,
    isCondensed,
    effectivePolicies,
    quotes,
    insurers,
    clientMeta: {
      clientName,
      riskAddress,
      riskCity,
      buildingDetails,
    },
    brokerName,
  };

  // --- 1. RESUMEN EJECUTIVO Y PERFIL DEL RIESGO (Only in extended mode) ---
  if (!isCondensed) {
    renderExecutiveSummarySection(ctx);
  }

  // --- 2. CUADRO RESUMEN COMPARATIVO (CUADRO CHICO EJECUTIVO) ---
  renderCuadroChicoSection(ctx);

  // --- 3. MATRICES TÉCNICAS EXTENDIDAS (Only in extended mode) ---
  if (!isCondensed) {
    // Matriz Comparativa de Coberturas Dinámica por Ramo
    renderCoverageMatrixSection(ctx);

    // Análisis de Deducibles y Guía Pedagógica
    renderDeductiblesSection(ctx);

    // Matriz de Hallazgos y Auditoría de Riesgos
    renderRiskAuditSection(ctx);

    // Resumen Económico y Respaldo Normativo
    renderEconomicAndRegulatorySection(ctx);
  }

  // --- 4. POLÍTICAS COMERCIALES Y CONDICIONES DE LA OFERTA (Both modes) ---
  renderCommercialPoliciesSection(ctx);

  // --- 5. ENRICHED FOOTER ON EVERY PAGE ---
  renderEnrichedFooter(doc, options);

  const safeDomain = (domain || 'Seguros').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Reporte_Ejecutivo_${safeDomain.toUpperCase()}.pdf`);
  return doc;
};
