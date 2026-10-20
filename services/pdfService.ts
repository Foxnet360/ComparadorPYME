import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ComparisonReport, UserProfile, DashboardStats, HistoryEntry } from '../types';
import { PLANTILLA_ITEMS } from '../constants';
import { formatCOPMillions, formatCOP } from '../utils/formatCurrency';
import { normalizeText } from '../utils/textUtils';
import { findColombianInsurerProfile } from '@shared/colombianInsurersCatalog';
import {
  getDomainRegulatoryProfile,
  findPedagogicalExplanation,
} from '@shared/domainRegulatoryKnowledge';

function hexToRgb(hex?: string): [number, number, number] {
  if (!hex) return [30, 41, 59];
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean, 16);
  if (isNaN(bigint)) return [30, 41, 59];
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

// Helper for robust string matching (ignores accents, case, whitespace)

// Format coverage value for PDF (similar to UI formatting)
const formatCoverageValuePDF = (value: string | undefined | null): string => {
  if (!value || typeof value !== 'string') return 'NO ESPECIFICADO';

  const trimmed = value.trim();
  const upperValue = trimmed.toUpperCase();

  // Special text values - return as-is
  if (['EXCLUIDO', 'NO CUBRE', 'NO APLICA', 'NO ESPECIFICADO', 'INCLUIDO'].includes(upperValue)) {
    return trimmed;
  }

  // Handle "500M" format (millions)
  const millionMatch = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*M$/i);
  if (millionMatch) {
    const num = parseFloat(millionMatch[1]!.replace(/\./g, '').replace(',', '.'));
    if (!isNaN(num)) {
      return formatCOP(num * 1000000);
    }
  }

  // Handle values with $ sign or plain numbers
  const dollarMatch = trimmed.match(/^\$?\s*([\d.,]+)\s*(.*)$/);
  if (dollarMatch) {
    const numStr = dollarMatch[1]!.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(numStr);
    if (!isNaN(num) && num > 0) {
      return formatCOP(num);
    }
  }

  // If nothing matched, return original value
  return trimmed;
};

export interface BrokerInfo {
  name?: string;
  intermediaryName?: string;
  registrationNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  logoUrl?: string;
}

interface PDFOptions {
  logoBase64?: string;
  customTitle?: string;
  primaryColor?: [number, number, number];
  brokerInfo?: BrokerInfo;
}

export const generatePDF = (
  report: ComparisonReport,
  options?: PDFOptions,
  cellNotes?: Record<string, string>
) => {
  const doc = new jsPDF();
  const today = new Date().toLocaleDateString('es-ES');
  const domain = report.domain || 'pyme';
  const regProfile = getDomainRegulatoryProfile(domain);

  // --- COLORS ---
  const PRIMARY_COLOR: [number, number, number] = options?.primaryColor || [79, 70, 229]; // Default Indigo
  const LIGHT_GRAY: [number, number, number] = [241, 245, 249]; // Slate 100

  // Helper to add Title Header on new pages
  const addHeader = (title: string) => {
    doc.setFillColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
    doc.rect(0, 0, 210, 30, 'F');

    // Logo Logic (Broker logoUrl or default logoBase64)
    const logoToUse = options?.brokerInfo?.logoUrl || options?.logoBase64;
    if (logoToUse) {
      try {
        const format =
          logoToUse.includes('image/jpeg') || logoToUse.includes('image/jpg') ? 'JPEG' : 'PNG';
        doc.addImage(logoToUse, format, 160, 4, 35, 22, undefined, 'FAST');
      } catch (e) {
        console.warn('Failed to add logo', e);
      }
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    const displayTitle = options?.customTitle || `Reporte Ejecutivo de Seguros · ${regProfile.displayName}`;
    doc.text(displayTitle.substring(0, 50), 14, 18);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Ramo: ${regProfile.displayName}  |  Informe generado el ${today}`, 14, 25);

    // Reset text color for body
    doc.setTextColor(30, 41, 59);
    return 36; // New Y position
  };

  const quotes = report.quotes || [];

  // Extraer metadatos de riesgo y cliente para la portada ejecutiva
  const firstMeta = report.quoteMetadata?.[0];
  const clientName =
    report.clientInfo?.name ||
    firstMeta?.cliente ||
    (quotes.find((q) => (q as any).clientName) as any)?.clientName ||
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

  // --- PAGE 1: RESUMEN EJECUTIVO Y PERFIL DEL RIESGO ---
  let currentY = addHeader('Resumen Ejecutivo y Ficha Técnica');

  // Intermediary / Broker Banner if available
  const broker = options?.brokerInfo;
  if (broker && (broker.intermediaryName || broker.name)) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, currentY, 182, 20, 2, 2, 'FD');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
    doc.text(broker.intermediaryName || 'INTERMEDIARIO DE SEGUROS', 18, currentY + 6.5);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);

    const line1 = [
      broker.name ? `Asesor: ${broker.name}` : null,
      broker.registrationNumber ? `Reg. SFC: ${broker.registrationNumber}` : null,
    ]
      .filter(Boolean)
      .join('  |  ');
    doc.text(line1 || '', 18, currentY + 12);

    const line2 = [
      broker.phone ? `Tel: ${broker.phone}` : null,
      broker.email ? `Email: ${broker.email}` : null,
      broker.city ? `Ciudad: ${broker.city}` : null,
    ]
      .filter(Boolean)
      .join('  |  ');
    doc.text(line2 || '', 18, currentY + 16.5);

    currentY += 25;
  }

  // Ficha Técnica del Riesgo / Copropiedad
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, currentY, 182, 24, 2, 2, 'FD');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Asegurado / Copropiedad: ${clientName.toUpperCase()}`, 18, currentY + 7);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(`Dirección del Riesgo: ${riskAddress} (${riskCity})  |  Ramo: ${regProfile.displayName}`, 18, currentY + 13);
  doc.text(buildingDetails || `Marco Legal: ${regProfile.tagline}`, 18, currentY + 19);

  currentY += 30;

  // Propósito Asesor y Marco Normativo
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Propósito del Estudio y Marco Normativo', 14, currentY);
  currentY += 6;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const introText = doc.splitTextToSize(regProfile.advisoryIntroForClient, 182);
  doc.text(introText, 14, currentY);
  currentY += introText.length * 4.5 + 8;

  // Dictamen del Auditor
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Dictamen y Recomendación del Auditor de Seguros', 14, currentY);
  currentY += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  const splitRecommendation = doc.splitTextToSize(
    report.recommendation || 'Sin recomendación registrada.',
    182
  );
  doc.text(splitRecommendation, 14, currentY);
  currentY += splitRecommendation.length * 4.5 + 10;

  // Resumen comparativo de aseguradoras
  quotes.forEach((q) => {
    if (currentY > 245) {
      doc.addPage();
      currentY = addHeader('Resumen Ejecutivo (Cont.)');
    }

    const profile = findColombianInsurerProfile(q.insurerName);
    const [r, g, b] = hexToRgb(profile?.primaryColor || '#0033A0');
    doc.setFillColor(r, g, b);
    doc.roundedRect(14, currentY, 18, 8, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(profile?.monogram || q.insurerName.slice(0, 3).toUpperCase(), 16, currentY + 5.5);

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(34, currentY, 162, 8, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `${q.insurerName} ${profile?.nit ? `• NIT: ${profile.nit}` : ''}  |  Score Técnico: ${q.score || 0}/100`,
      37,
      currentY + 5.5
    );
    currentY += 12;

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Enfoque Cliente (Beneficios):', 16, currentY);
    currentY += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const clientText = doc.splitTextToSize(q.clientAnalysis || 'Cobertura conforme a condiciones cotizadas.', 175);
    doc.text(clientText, 16, currentY);
    currentY += clientText.length * 4 + 4;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Enfoque Técnico (Riesgos y Cláusulas):', 16, currentY);
    currentY += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const techText = doc.splitTextToSize(q.technicalAnalysis || 'Sin observaciones técnicas adicionales.', 175);
    doc.text(techText, 16, currentY);
    currentY += techText.length * 4 + 8;
  });

  // --- PAGE 2: MATRIZ COMPARATIVA DE COBERTURAS DINÁMICA POR RAMO ---
  doc.addPage();
  currentY = addHeader(`Matriz Comparativa de Coberturas (${regProfile.displayName})`);

  const insurers = quotes.map((q) => q.insurerName || 'Aseguradora');
  const tableHead = [['Amparo / Cobertura y Alcance Legal', ...insurers]];
  const tableBody: string[][] = [];

  // Obtener filas de datos desde la matriz unificada o recolectar de quotes
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
        if (!cell || cell.isExcluded || cell.value === 'No incluida' || cell.value === 'No Cotizado') {
          rowCells.push('No cotizado');
        } else {
          let cellText = formatCoverageValuePDF(cell.value);
          if (cell.notes && cell.notes !== cell.value && !['No cotizado', 'No incluida'].includes(cell.notes)) {
            cellText += `\n[Nota: ${cell.notes}]`;
          }
          rowCells.push(cellText);
        }
      });

      tableBody.push(rowCells);
    });
  } else {
    // Si no hay matrix precomputada, construir desde quotes dinámicamente
    const uniqueCoverageNames = Array.from(
      new Set(quotes.flatMap((q) => (q.coverages || []).map((c) => c.name)).filter(Boolean))
    );

    const itemsToProcess =
      uniqueCoverageNames.length > 0
        ? uniqueCoverageNames
        : PLANTILLA_ITEMS;

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
          return normName === normItem || normName.includes(normItem) || normItem.includes(normName);
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
    startY: currentY,
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: PRIMARY_COLOR, fontSize: 8.5, halign: 'center' },
    bodyStyles: { fontSize: 7.5, cellPadding: 2.5, valign: 'middle' },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 62 } },
    alternateRowStyles: { fillColor: LIGHT_GRAY },
  });

  // --- PAGE 3: ANÁLISIS DE DEDUCIBLES Y GUÍA PEDAGÓGICA ---
  doc.addPage();
  currentY = addHeader('Estructura de Deducibles y Guía Pedagógica');

  // Tabla detallada de deducibles por aseguradora
  const deducHead = [['Concepto / Amparo', ...insurers, 'Criterio Técnico del Deducible']];
  const deducBody: string[][] = [];

  // Buscar deducibles en matrix o en report.deductibleComparison
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
    // Usar deductibleComparison o lista de deducibles de quotes
    quotes.forEach((q) => {
      const explanation = findPedagogicalExplanation('Deducibles Generales', q.deductibles, 'deductible');
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
      startY: currentY,
      head: deducHead,
      body: deducBody,
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85], fontSize: 8, halign: 'center' },
      bodyStyles: { fontSize: 7.5, cellPadding: 2.5 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } },
      alternateRowStyles: { fillColor: LIGHT_GRAY },
    });
    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Cuadro Pedagógico para el Cliente sobre Deducibles en Colombia
  if (currentY > 200) {
    doc.addPage();
    currentY = addHeader('Guía Pedagógica de Deducibles para el Asegurado');
  }

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
  doc.roundedRect(14, currentY, 182, 60, 2, 2, 'FD');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
  doc.text('GUÍA PEDAGÓGICA: ¿Cómo interpretar los Deducibles en Colombia?', 18, currentY + 7);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  const pedagogicalPoints = [
    '• ¿Qué es el Deducible? (Art. 1103 Código de Comercio): Es la participación económica fija o porcentual que asume el asegurado en caso de siniestro. A menor deducible, mayor es el traslado real del riesgo a la aseguradora.',
    '• Salario Mínimo Mensual Legal Vigente (SMMLV): En Colombia equivale a $1.423.500 COP. Cuando una póliza indica "10% mín. 2 SMMLV", el asegurado pagará el 10% del daño, pero nunca menos de $2.847.000 COP.',
    '• Terremoto: ¿% sobre Valor Asegurado vs % sobre la Pérdida?: REGLA CRÍTICA. Si el deducible es 2% sobre el VALOR ASEGURADO en un edificio de $10.000 millones, los primeros $200 millones los asume la copropiedad independientemente del tamaño del daño. Si es sobre la PÉRDIDA, solo asume el 2% del daño efectivamente tasado.',
    '• Coaseguro e Infraseguro (Art. 1102 Co.Co.): Si el valor asegurado es inferior al valor real de reposición a nuevo, la aseguradora aplicará la regla proporcional reduciendo la indemnización.',
  ];

  let pY = currentY + 14;
  pedagogicalPoints.forEach((point) => {
    const splitPoint = doc.splitTextToSize(point, 174);
    doc.text(splitPoint, 18, pY);
    pY += splitPoint.length * 3.8 + 2;
  });

  // --- PAGE 4: MATRIZ DE HALLAZGOS Y AUDITORÍA DE RIESGOS ---
  doc.addPage();
  currentY = addHeader('Matriz de Hallazgos y Auditoría Técnica');

  quotes.forEach((q) => {
    if (currentY > 230) {
      doc.addPage();
      currentY = addHeader('Matriz de Hallazgos y Auditoría (Cont.)');
    }

    doc.setDrawColor(203, 213, 225);
    doc.line(14, currentY, 196, currentY);
    currentY += 5;

    const profile = findColombianInsurerProfile(q.insurerName);
    const [r, g, b] = hexToRgb(profile?.primaryColor || '#0033A0');
    doc.setFillColor(r, g, b);
    doc.roundedRect(14, currentY, 12, 6, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text(profile?.monogram || q.insurerName.slice(0, 3).toUpperCase(), 15.5, currentY + 4.2);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${q.insurerName} · Score Técnico: ${q.score}/100`, 30, currentY + 4.8);
    currentY += 9;

    if (q.alerts && q.alerts.length > 0) {
      q.alerts.forEach((alert) => {
        if (currentY > 265) {
          doc.addPage();
          currentY = addHeader('Matriz de Hallazgos (Cont.)');
        }

        let color: [number, number, number] = [50, 50, 50];
        let label = 'INFO';

        if (alert.level === 'CRITICAL') {
          label = 'RIESGO CRÍTICO';
          color = [220, 38, 38];
        } else if (alert.level === 'WARNING') {
          label = 'ATENCIÓN';
          color = [217, 119, 6];
        } else if (alert.level === 'GOOD') {
          label = 'PUNTO FUERTE';
          color = [22, 163, 74];
        }

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(color[0], color[1], color[2]);
        doc.setFontSize(8.5);
        doc.text(`[${label}] ${alert.title}`, 14, currentY);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        const desc = doc.splitTextToSize(alert.description, 170);
        doc.text(desc, 14, currentY + 4);

        currentY += 4 + desc.length * 3.8 + 4;
      });
    } else {
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text('Sin alertas de riesgo restrictivas en el análisis.', 14, currentY);
      currentY += 8;
    }
    currentY += 6;
  });

  // --- PAGE 5: RESUMEN ECONÓMICO Y RESPALDO NORMATIVO ---
  doc.addPage();
  currentY = addHeader('Resumen Económico y Cumplimiento Normativo');

  // Tabla Financiera
  const financialHead = [['Concepto Financiero', ...insurers]];
  const financialRows: string[][] = [
    [
      'Prima Anual (Total a Pagar)',
      ...quotes.map((q) => (q.priceAnnual && q.priceAnnual > 0 ? formatCOP(q.priceAnnual) : 'No informada')),
    ],
  ];

  if (quotes.some((q) => q.priceMonthly && q.priceMonthly > 0)) {
    financialRows.push([
      'Cuota Mensual Estimada',
      ...quotes.map((q) => (q.priceMonthly && q.priceMonthly > 0 ? formatCOP(q.priceMonthly) : 'N/A')),
    ]);
  }

  autoTable(doc, {
    startY: currentY,
    head: financialHead,
    body: financialRows,
    theme: 'grid',
    headStyles: { fillColor: PRIMARY_COLOR, fontSize: 8.5, halign: 'center' },
    bodyStyles: { fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 60 } },
    alternateRowStyles: { fillColor: LIGHT_GRAY },
  });

  currentY = (doc as any).lastAutoTable.finalY + 12;

  // Respaldo Normativo y Leyes Aplicables
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`Marco Regulatorio Aplicable en Colombia (${regProfile.displayName})`, 14, currentY);
  currentY += 7;

  regProfile.primaryLaws.forEach((law) => {
    if (currentY > 265) {
      doc.addPage();
      currentY = addHeader('Cumplimiento Normativo (Cont.)');
    }

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
    doc.text(`${law.code}: ${law.title}`, 14, currentY);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const splitLaw = doc.splitTextToSize(law.summary, 180);
    doc.text(splitLaw, 14, currentY + 4);

    currentY += 4 + splitLaw.length * 3.8 + 4;
  });

  // Tabla de Verificación de Conformidad Regulatoria por Aseguradora
  if (quotes && quotes.length > 0 && regProfile.mandatoryVerificationRules.length > 0) {
    if (currentY > 210) {
      doc.addPage();
      currentY = addHeader('Auditoría de Conformidad Regulatoria');
    }

    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Dictamen de Conformidad Normativa por Aseguradora', 14, currentY);
    currentY += 4;

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
            !['no incluido', 'no incluida', 'no informado', 'excluido', 'no cubre', 'n.c.'].includes(val);
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
      startY: currentY,
      head: [['Aseguradora', 'Amparo Mandatorio', 'Base Legal', 'Estado', 'Detalle']],
      body: auditRows,
      theme: 'grid',
      headStyles: {
        fillColor: PRIMARY_COLOR,
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
      margin: { left: 14, right: 14 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // Numeración de páginas
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(150, 150, 150);
    doc.text(`Página ${i} de ${pageCount}`, 190, 290, { align: 'right' });
  }

  const safeDomain = (domain || 'Seguros').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Reporte_Ejecutivo_${safeDomain.toUpperCase()}.pdf`);
};

export const generatePerformanceReport = (
  user: UserProfile,
  stats: DashboardStats,
  history: HistoryEntry[]
) => {
  const doc = new jsPDF();
  const today = new Date().toLocaleDateString('es-ES');
  const PRIMARY_COLOR: [number, number, number] = [79, 70, 229];

  // Header
  doc.setFillColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
  doc.rect(0, 0, 210, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Informe de Desempeño Comercial', 14, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generado el: ${today}`, 14, 30);
  doc.text(`Agente: ${user.name}`, 140, 20);
  doc.text(`Intermediario: ${user.intermediaryName || 'N/A'}`, 140, 26);
  if (user.agentDetails?.field) {
    doc.text(`Ramo: ${user.agentDetails.field}`, 140, 32);
  }

  let currentY = 55;

  // Stats Section
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumen del Mes Actual', 14, currentY);
  currentY += 10;

  // Draw Stats Cards (Text representation)
  const drawStat = (label: string, value: string, x: number, y: number) => {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, 40, 25, 3, 3, 'FD');

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(label, x + 5, y + 8);

    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text(value, x + 5, y + 18);
  };

  drawStat('Cotizaciones', stats.totalQuotes.toString(), 14, currentY);
  drawStat('Tasa Cierre', `${stats.conversionRate}%`, 60, currentY);
  drawStat('Primas Vendidas', formatCOPMillions(stats.totalPremiumSold), 106, currentY);
  drawStat('Prospectos', stats.activeProspects.toString(), 152, currentY);

  currentY += 40;

  // History Table
  doc.setFontSize(14);
  doc.text('Historial de Actividad Reciente', 14, currentY);
  currentY += 10;

  const tableHead = [['Fecha', 'Cliente', 'Aseguradoras', 'Opción Ganadora', 'Valor', 'Estado']];
  const tableBody = history
    .slice(0, 20)
    .map((h) => [
      h.date,
      h.clientName,
      h.insurers.join(', '),
      h.bestOption,
      formatCOPMillions(h.premiumValue),
      h.status,
    ]);

  autoTable(doc, {
    startY: currentY,
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [51, 65, 85], fontSize: 9 },
    bodyStyles: { fontSize: 8 },
  });

  doc.save(`Performance_${user.name.replace(/\s+/g, '_')}_${today.replace(/\//g, '-')}.pdf`);
};
