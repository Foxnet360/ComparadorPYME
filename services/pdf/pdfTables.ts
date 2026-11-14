import autoTable from 'jspdf-autotable';
import { PLANTILLA_ITEMS } from '../../constants';
import { formatCOP } from '../../utils/formatCurrency';
import { normalizeText } from '../../utils/textUtils';
import { findColombianInsurerProfile } from '@shared/colombianInsurersCatalog';
import { findPedagogicalExplanation } from '@shared/domainRegulatoryKnowledge';
import {
  COMMERCIAL_CONDITION_FIELDS,
  extractCommercialConditionsFromReport,
  getStructuredCommercialPolicyEntries,
} from '../../src/data/commercialPolicies';
import type { PdfRenderContext } from './types';
import { hexToRgb, getLastAutoTableFinalY, formatCoverageValuePDF } from './pdfHelpers';

/**
 * Renders the compact executive summary comparison table (Cuadro Chico).
 */
export function renderCuadroChicoTable(
  ctx: PdfRenderContext,
  startY: number,
  getCuadroChicoValue: (quote: PdfRenderContext['quotes'][0], keywords: string[]) => string
): void {
  const {
    doc,
    quotes,
    insurers,
    regProfile,
    domain,
    primaryColor,
    lightGray,
    tableMargins,
    pagesWithHeader,
    addHeader,
  } = ctx;
  const domainRules = regProfile.mandatoryVerificationRules || [];
  const isVida = domain === 'vida_grupo';

  const condensedHead = [['Concepto / Parámetro Clave', ...insurers]];
  const condensedRows: string[][] = [
    [
      'Prima Neta Anual',
      ...quotes.map((q) => {
        if (q.financialBreakdown?.netPremium) return formatCOP(q.financialBreakdown.netPremium);
        return q.priceAnnual
          ? formatCOP(isVida ? q.priceAnnual : Math.round(q.priceAnnual / 1.19))
          : 'No informada';
      }),
    ],
    [
      'Gastos de Expedición',
      ...quotes.map((q) => {
        const exp = q.financialBreakdown?.expenses ?? q.expenses ?? q.fees ?? 0;
        return exp > 0 ? formatCOP(exp) : '$ 0 (Incluidos)';
      }),
    ],
    [
      isVida ? 'I.V.A. (0% Exento Art. 427 E.T.)' : 'I.V.A. (19%)',
      ...quotes.map((q) => {
        if (isVida) return '$ 0';
        if (q.financialBreakdown?.iva !== undefined) return formatCOP(q.financialBreakdown.iva);
        return q.priceAnnual
          ? formatCOP(Math.max(0, q.priceAnnual - Math.round(q.priceAnnual / 1.19)))
          : 'N/A';
      }),
    ],
    [
      'Total a Pagar (Anual)',
      ...quotes.map((q) => {
        const total = q.financialBreakdown?.totalPayable ?? q.priceAnnual;
        return total ? formatCOP(total) : 'No informada';
      }),
    ],
    [
      'Forma de Pago / Plazo',
      ...quotes.map(
        (q) =>
          (q as unknown as { paymentTerms?: string }).paymentTerms ||
          (q.priceMonthly ? 'Financiado / Mensual' : 'Anual Contado')
      ),
    ],
    ...(domainRules.length > 0
      ? domainRules.map((rule) => [
          rule.title,
          ...quotes.map((q) => getCuadroChicoValue(q, rule.keywords)),
        ])
      : [
          [
            'Amparo Principal / Cobertura Básica',
            ...quotes.map((q) => (q.coverages && q.coverages[0]?.value) || 'Ver detalle'),
          ],
        ]),
    [
      'Deducible Predominante',
      ...quotes.map((q) =>
        q.deductibles
          ? q.deductibles.substring(0, 38) + (q.deductibles.length > 38 ? '...' : '')
          : 'Ver tabla detallada'
      ),
    ],
    ['Score Técnico CSA', ...quotes.map((q) => `${q.score || 0} / 100`)],
  ];

  autoTable(doc, {
    startY,
    head: condensedHead,
    body: condensedRows,
    theme: 'grid',
    headStyles: { fillColor: primaryColor, fontSize: 8, halign: 'center' },
    bodyStyles: { fontSize: 7.5, cellPadding: 2.2, valign: 'middle' },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 54, fillColor: [248, 250, 252] } },
    alternateRowStyles: { fillColor: lightGray },
    margin: tableMargins,
    didDrawPage: () => {
      const pageNum = doc.getCurrentPageInfo().pageNumber;
      if (!pagesWithHeader.has(pageNum)) {
        addHeader('Cuadro Resumen Comparativo (Cont.)');
      }
    },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index > 0 && data.column.index <= quotes.length) {
        const q = quotes[data.column.index - 1];
        if (q) {
          const prof = findColombianInsurerProfile(q.insurerName);
          if (prof?.primaryColor) {
            data.cell.styles.fillColor = hexToRgb(prof.primaryColor);
            data.cell.styles.textColor = [255, 255, 255];
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.halign = 'center';
          }
        }
      }
      if (data.section === 'body' && data.row.index === 2) {
        data.cell.styles.fontStyle = 'bold';
        if (data.column.index > 0) {
          data.cell.styles.textColor = primaryColor;
        }
      }
    },
  });
}

/**
 * Renders the multi-page dynamic coverage matrix table.
 */
export function renderCoverageMatrixTable(ctx: PdfRenderContext, startY: number): void {
  const {
    doc,
    report,
    quotes,
    insurers,
    regProfile,
    primaryColor,
    lightGray,
    tableMargins,
    pagesWithHeader,
    addHeader,
  } = ctx;
  const tableHead = [['Amparo / Cobertura y Alcance Legal', ...insurers]];
  const tableBody: string[][] = [];

  // Filter data rows from matrix or construct from quotes
  const matrixDataRows = (report.matrix || []).filter(
    (r) =>
      r.type === 'data' &&
      !['prima', 'total a pagar', 'iva', 'gastos', 'forma de pago', 'financiero'].some((k) =>
        r.label.toLowerCase().includes(k)
      )
  );

  if (matrixDataRows.length > 0) {
    matrixDataRows.forEach((row) => {
      const explanation = findPedagogicalExplanation(row.label);
      const labelText = `${row.label}\n\n• ${explanation.whatItCovers}`;
      const rowCells: string[] = [labelText];

      quotes.forEach((_q, colIdx) => {
        const cell = row.cells[colIdx];
        if (
          !cell ||
          cell.isExcluded ||
          cell.value === 'No incluida' ||
          cell.value === 'No Cotizado'
        ) {
          rowCells.push('No cotizado');
        } else {
          let cellText = formatCoverageValuePDF(cell.value);
          if (
            cell.notes &&
            cell.notes !== cell.value &&
            !['No cotizado', 'No incluida'].includes(cell.notes)
          ) {
            cellText += `\n[Nota: ${cell.notes}]`;
          }
          rowCells.push(cellText);
        }
      });

      tableBody.push(rowCells);
    });
  } else {
    // Dynamic fallback when precomputed matrix is absent
    const uniqueCoverageNames = Array.from(
      new Set(quotes.flatMap((q) => (q.coverages || []).map((c) => c.name)).filter(Boolean))
    );

    const itemsToProcess = uniqueCoverageNames.length > 0 ? uniqueCoverageNames : PLANTILLA_ITEMS;

    itemsToProcess.forEach((itemName) => {
      const explanation = findPedagogicalExplanation(itemName);
      const labelText = `${itemName}\n\n• ${explanation.whatItCovers}`;
      const rowCells: string[] = [labelText];

      quotes.forEach((q) => {
        const coverages = Array.isArray(q.coverages) ? q.coverages : [];
        const normItem = normalizeText(itemName);
        const found = coverages.find((c) => {
          if (!c.name) return false;
          const normName = normalizeText(c.name);
          return (
            normName === normItem || normName.includes(normItem) || normItem.includes(normName)
          );
        });

        if (found) {
          let cellVal = formatCoverageValuePDF(found.value);
          if (found.deductible && found.deductible !== found.value) {
            cellVal += `\n[Ded: ${found.deductible}]`;
          }
          rowCells.push(cellVal);
        } else {
          rowCells.push('No cotizado');
        }
      });

      tableBody.push(rowCells);
    });
  }

  autoTable(doc, {
    startY,
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: primaryColor, fontSize: 8, halign: 'center' },
    bodyStyles: { fontSize: 7.5, cellPadding: 2.5, valign: 'middle' },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 62 } },
    alternateRowStyles: { fillColor: lightGray },
    margin: tableMargins,
    didDrawPage: () => {
      const pageNum = doc.getCurrentPageInfo().pageNumber;
      if (!pagesWithHeader.has(pageNum)) {
        addHeader(`Matriz Comparativa de Coberturas (${regProfile.displayName}) (Cont.)`);
      }
    },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index > 0 && data.column.index <= quotes.length) {
        const q = quotes[data.column.index - 1];
        if (q) {
          const prof = findColombianInsurerProfile(q.insurerName);
          if (prof?.primaryColor) {
            data.cell.styles.fillColor = hexToRgb(prof.primaryColor);
            data.cell.styles.textColor = [255, 255, 255];
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.halign = 'center';
          }
        }
      }
    },
  });
}

/**
 * Renders the deductibles comparison table.
 */
export function renderDeductiblesTable(ctx: PdfRenderContext, startY: number): number {
  const { doc, report, quotes, insurers, lightGray, tableMargins, pagesWithHeader, addHeader } =
    ctx;
  const deducHead = [['Concepto / Amparo', ...insurers, 'Criterio Técnico del Deducible']];
  const deducBody: string[][] = [];

  const deductibleRows = (report.matrix || []).filter(
    (r) =>
      r.type === 'data' &&
      (r.label.toLowerCase().includes('deducible') ||
        (r.cells && r.cells.some((c) => c.notes && c.notes.toLowerCase().includes('deducible'))))
  );

  if (deductibleRows.length > 0) {
    deductibleRows.forEach((r) => {
      const explanation = findPedagogicalExplanation(r.label, undefined, 'deductible');
      const rowCells: string[] = [r.label];
      quotes.forEach((_q, colIdx) => {
        const cell = r.cells[colIdx];
        const val = cell?.notes || cell?.value || 'Según amparo';
        rowCells.push(val);
      });
      rowCells.push(explanation.comparisonTip);
      deducBody.push(rowCells);
    });
  } else {
    quotes.forEach((q) => {
      const explanation = findPedagogicalExplanation(
        'Deducibles Generales',
        q.deductibles,
        'deductible'
      );
      deducBody.push([
        `Deducibles ${q.insurerName}`,
        q.deductibles || 'Ver condicionado particular',
        ...quotes.map((other) => (other.insurerName === q.insurerName ? 'Declarado' : '-')),
        explanation.comparisonTip,
      ]);
    });
  }

  if (deducBody.length > 0) {
    autoTable(doc, {
      startY,
      head: deducHead,
      body: deducBody,
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85], fontSize: 8, halign: 'center' },
      bodyStyles: { fontSize: 7.5, cellPadding: 2.5 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } },
      alternateRowStyles: { fillColor: lightGray },
      margin: tableMargins,
      didDrawPage: () => {
        const pageNum = doc.getCurrentPageInfo().pageNumber;
        if (!pagesWithHeader.has(pageNum)) {
          addHeader('Estructura de Deducibles (Cont.)');
        }
      },
      didParseCell: (data) => {
        if (
          data.section === 'head' &&
          data.column.index > 0 &&
          data.column.index <= quotes.length
        ) {
          const q = quotes[data.column.index - 1];
          if (q) {
            const prof = findColombianInsurerProfile(q.insurerName);
            if (prof?.primaryColor) {
              data.cell.styles.fillColor = hexToRgb(prof.primaryColor);
              data.cell.styles.textColor = [255, 255, 255];
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.halign = 'center';
            }
          }
        }
      },
    });
    return getLastAutoTableFinalY(doc, startY) + 10;
  }

  return startY;
}

/**
 * Renders the financial overview table (annual & monthly amounts).
 */
export function renderFinancialTable(ctx: PdfRenderContext, startY: number): number {
  const {
    doc,
    quotes,
    insurers,
    primaryColor,
    lightGray,
    tableMargins,
    pagesWithHeader,
    addHeader,
  } = ctx;
  const financialHead = [['Concepto Financiero', ...insurers]];
  const financialRows: string[][] = [
    [
      'Prima Anual (Total a Pagar)',
      ...quotes.map((q) =>
        q.priceAnnual && q.priceAnnual > 0 ? formatCOP(q.priceAnnual) : 'No informada'
      ),
    ],
  ];

  if (quotes.some((q) => q.priceMonthly && q.priceMonthly > 0)) {
    financialRows.push([
      'Cuota Mensual Estimada',
      ...quotes.map((q) =>
        q.priceMonthly && q.priceMonthly > 0 ? formatCOP(q.priceMonthly) : 'N/A'
      ),
    ]);
  }

  autoTable(doc, {
    startY,
    head: financialHead,
    body: financialRows,
    theme: 'grid',
    headStyles: { fillColor: primaryColor, fontSize: 8.5, halign: 'center' },
    bodyStyles: { fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 60 } },
    alternateRowStyles: { fillColor: lightGray },
    margin: tableMargins,
    didDrawPage: () => {
      const pageNum = doc.getCurrentPageInfo().pageNumber;
      if (!pagesWithHeader.has(pageNum)) {
        addHeader('Resumen Económico (Cont.)');
      }
    },
  });

  return getLastAutoTableFinalY(doc, startY) + 12;
}

/**
 * Renders the regulatory conformity verification audit table.
 */
export function renderRegulatoryAuditTable(ctx: PdfRenderContext, startY: number): number {
  const { doc, quotes, regProfile, primaryColor, tableMargins, pagesWithHeader, addHeader } = ctx;
  const auditRows: string[][] = [];

  quotes.forEach((q) => {
    const coverages = q.coverages || [];
    regProfile.mandatoryVerificationRules.forEach((rule) => {
      const matched = coverages.find((cov) => {
        const label = `${cov.name || ''} ${cov.canonicalName || ''}`.toLowerCase();
        const val = String(cov.value || '').toLowerCase();
        const isIncluded =
          cov.isPositive !== false &&
          val.length > 0 &&
          !['no incluido', 'no incluida', 'no informado', 'excluido', 'no cubre', 'n.c.'].includes(
            val
          );
        return isIncluded && rule.keywords.some((kw) => label.includes(kw.toLowerCase()));
      });

      const status = matched
        ? 'CONFORME'
        : rule.severityIfMissing === 'CRITICAL'
          ? 'NO CONFORME'
          : 'ADVERTENCIA';

      const detail = matched
        ? `Verificado: ${matched.name}`
        : `Requiere verificación (${rule.legalBasis})`;

      auditRows.push([q.insurerName, rule.title, rule.legalBasis, status, detail]);
    });
  });

  autoTable(doc, {
    startY,
    head: [['Aseguradora', 'Amparo Mandatorio', 'Base Legal', 'Estado', 'Detalle']],
    body: auditRows,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'left',
    },
    styles: {
      fontSize: 7,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 26, fontStyle: 'bold' },
      1: { cellWidth: 42 },
      2: { cellWidth: 38 },
      3: { cellWidth: 24, fontStyle: 'bold', halign: 'center' },
      4: { cellWidth: 50 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        if (data.cell.raw === 'CONFORME') {
          data.cell.styles.textColor = [5, 150, 105];
        } else if (data.cell.raw === 'NO CONFORME') {
          data.cell.styles.textColor = [220, 38, 38];
        } else {
          data.cell.styles.textColor = [217, 119, 6];
        }
      }
    },
    margin: tableMargins,
    didDrawPage: () => {
      const pageNum = doc.getCurrentPageInfo().pageNumber;
      if (!pagesWithHeader.has(pageNum)) {
        addHeader('Auditoría de Conformidad Regulatoria (Cont.)');
      }
    },
  });

  return getLastAutoTableFinalY(doc, startY) + 8;
}

/**
 * Renders the insurer proposed commercial conditions comparative table.
 */
export function renderCommercialConditionsTable(ctx: PdfRenderContext, startY: number): number {
  const { doc, report, quotes, insurers, primaryColor, tableMargins, pagesWithHeader, addHeader } =
    ctx;
  const extractedConditions = extractCommercialConditionsFromReport(report);

  const compTableHead = [['Condición Comercial', ...insurers]];
  const compTableBody = COMMERCIAL_CONDITION_FIELDS.map(({ key, label }) => {
    const row: string[] = [label];
    quotes.forEach((q) => {
      const ins = q.insurerName || 'Aseguradora';
      const val = extractedConditions[ins]?.[key] || 'No especificado en cotización';
      row.push(val);
    });
    return row;
  });

  autoTable(doc, {
    startY,
    head: compTableHead,
    body: compTableBody,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 44, fontStyle: 'bold', fillColor: [248, 250, 252] },
    },
    margin: tableMargins,
    didDrawPage: () => {
      const pageNum = doc.getCurrentPageInfo().pageNumber;
      if (!pagesWithHeader.has(pageNum)) {
        addHeader('Condiciones Comerciales de Cotizaciones (Cont.)');
      }
    },
  });

  return getLastAutoTableFinalY(doc, startY) + 7;
}

/**
 * Renders the broker structured commercial policies table.
 */
export function renderBrokerCommercialPoliciesTable(ctx: PdfRenderContext, startY: number): number {
  const { doc, effectivePolicies, primaryColor, tableMargins, pagesWithHeader, addHeader } = ctx;
  const structuredPolicies = getStructuredCommercialPolicyEntries(effectivePolicies);
  const policyTableHead = [['Categoría / Condición', 'Detalle y Alcance Operativo']];
  const policyTableBody = structuredPolicies.map((p) => [`${p.title}\n(${p.category})`, p.detail]);

  autoTable(doc, {
    startY,
    head: policyTableHead,
    body: policyTableBody,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold', fillColor: [248, 250, 252] },
      1: { cellWidth: 132 },
    },
    margin: tableMargins,
    didDrawPage: () => {
      const pageNum = doc.getCurrentPageInfo().pageNumber;
      if (!pagesWithHeader.has(pageNum)) {
        addHeader('Políticas Comerciales (Cont.)');
      }
    },
  });

  return getLastAutoTableFinalY(doc, startY) + 8;
}
