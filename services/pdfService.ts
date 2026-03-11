import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ComparisonReport, UserProfile, DashboardStats, HistoryEntry } from '../types';
import { PLANTILLA_ITEMS } from '../constants';

// Helper for robust string matching (ignores accents, case, whitespace)
const normalizeText = (text: string) => {
  if (!text) return "";
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
};

interface PDFOptions {
  logoBase64?: string;
  customTitle?: string;
  primaryColor?: [number, number, number];
}

export const generatePDF = (report: ComparisonReport, options?: PDFOptions) => {
  const doc = new jsPDF();
  const today = new Date().toLocaleDateString('es-ES');

  // --- COLORS ---
  const PRIMARY_COLOR: [number, number, number] = options?.primaryColor || [79, 70, 229]; // Default Indigo
  const LIGHT_GRAY: [number, number, number] = [241, 245, 249]; // Slate 100

  // Helper to add Title Header on new pages
  const addHeader = (title: string) => {
    doc.setFillColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
    doc.rect(0, 0, 210, 30, 'F');

    // Logo Logic
    if (options?.logoBase64) {
      try {
        doc.addImage(options.logoBase64, 'PNG', 160, 5, 35, 20, undefined, 'FAST');
      } catch (e) {
        console.warn("Failed to add logo", e);
      }
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    const displayTitle = options?.customTitle || title;
    doc.text(displayTitle.substring(0, 50), 14, 18);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Informe generado el ${today}`, 14, 25);

    // Reset text color for body
    doc.setTextColor(30, 41, 59);
    return 40; // New Y position
  };

  // --- PAGE 1: RESUMEN EJECUTIVO ---
  let currentY = addHeader("Resumen Ejecutivo y Recomendación");

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Dictamen del Auditor", 14, currentY);
  currentY += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const splitRecommendation = doc.splitTextToSize(report.recommendation || "Sin recomendación.", 180);
  doc.text(splitRecommendation, 14, currentY);

  currentY += splitRecommendation.length * 5 + 10;

  // New Section: Análisis por Perfil en el PDF
  const quotes = report.quotes || [];

  quotes.forEach(q => {
    if (currentY > 250) { doc.addPage(); currentY = addHeader("Resumen Ejecutivo (Cont.)"); }

    doc.setFillColor(240, 240, 240);
    doc.rect(14, currentY, 182, 8, 'F');
    doc.setFont("helvetica", "bold");
    doc.text(q.insurerName, 16, currentY + 5.5);
    currentY += 12;

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Enfoque Cliente (Beneficios):", 16, currentY);
    currentY += 5;

    doc.setFont("helvetica", "normal");
    const clientText = doc.splitTextToSize(q.clientAnalysis || "N/A", 175);
    doc.text(clientText, 16, currentY);
    currentY += (clientText.length * 4) + 6;

    doc.setFont("helvetica", "bold");
    doc.text("Enfoque Técnico (Riesgos y Clausulado):", 16, currentY);
    currentY += 5;

    doc.setFont("helvetica", "normal");
    const techText = doc.splitTextToSize(q.technicalAnalysis || "N/A", 175);
    doc.text(techText, 16, currentY);
    currentY += (techText.length * 4) + 10;
  });

  // --- PAGE 2: PLANTILLA PYME (COBERTURAS) ---
  doc.addPage();
  currentY = addHeader("Matriz Comparativa Normalizada (PYME)");

  const insurers = quotes.map(q => q.insurerName || "Aseguradora");
  const tableHead = [['Rubro Estandarizado', ...insurers]];

  const tableBody: string[][] = [];

  PLANTILLA_ITEMS.forEach(standardItem => {
    const row: string[] = [standardItem];
    quotes.forEach(q => {
      const coverages = Array.isArray(q.coverages) ? q.coverages : [];
      // Robust matching
      const found = coverages.find(c => {
        if (!c.name) return false;
        const nItem = normalizeText(standardItem);
        const nName = normalizeText(c.name);
        return nName === nItem || nName.includes(nItem) || nItem.includes(nName);
      });

      let cellValue = found ? found.value : 'NO ESPECIFICADO';
      if (cellValue.length > 50) cellValue = cellValue.substring(0, 50) + "...";

      row.push(cellValue);
    });
    tableBody.push(row);
  });

  autoTable(doc, {
    startY: currentY,
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [51, 65, 85], fontSize: 9, halign: 'center' },
    bodyStyles: { fontSize: 8, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
    alternateRowStyles: { fillColor: LIGHT_GRAY },
  });


  // --- PAGE 3: DEDUCIBLES ---
  doc.addPage();
  currentY = addHeader("Análisis de Estructura de Deducibles");

  const deducRows: any[] = [];
  if (report.deductibleComparison && report.deductibleComparison.length > 0) {
    report.deductibleComparison.forEach(d => deducRows.push([d.insurer, d.deductibleText]));
  } else {
    quotes.forEach(q => deducRows.push([q.insurerName, q.deductibles]));
  }

  deducRows.forEach(row => {
    if (currentY > 250) { doc.addPage(); currentY = addHeader("Análisis de Estructura de Deducibles (Cont.)"); }

    doc.setFillColor(241, 245, 249);
    doc.rect(14, currentY, 182, 8, 'F');
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(row[0] as string, 16, currentY + 5.5);
    currentY += 12;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const splitDed = doc.splitTextToSize(row[1] as string, 175);
    doc.text(splitDed, 16, currentY);

    currentY += (splitDed.length * 4) + 10;
  });


  // --- PAGE 4: AUDITORÍA DE RIESGOS (INSIGHTS) ---
  doc.addPage();
  currentY = addHeader("Matriz de Hallazgos y Riesgos");

  quotes.forEach(q => {
    if (currentY > 240) { doc.addPage(); currentY = addHeader("Matriz de Hallazgos (Cont.)"); }

    doc.setDrawColor(200, 200, 200);
    doc.line(14, currentY, 196, currentY);
    currentY += 5;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(`${q.insurerName} (Score: ${q.score}/100)`, 14, currentY);
    currentY += 8;

    if (q.alerts && q.alerts.length > 0) {
      q.alerts.forEach(alert => {
        if (currentY > 270) { doc.addPage(); currentY = addHeader("Matriz de Hallazgos (Cont.)"); }

        let color: [number, number, number] = [50, 50, 50];
        let label = "INFO";

        if (alert.level === 'CRITICAL') { label = "RIESGO CRÍTICO"; color = [220, 38, 38]; }
        else if (alert.level === 'WARNING') { label = "ATENCIÓN"; color = [217, 119, 6]; }
        else if (alert.level === 'GOOD') { label = "PUNTO FUERTE"; color = [22, 163, 74]; }

        doc.setFont("helvetica", "bold");
        doc.setTextColor(color[0], color[1], color[2]);
        doc.setFontSize(9);
        doc.text(`[${label}] ${alert.title}`, 14, currentY);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(70, 70, 70);
        const desc = doc.splitTextToSize(alert.description, 170);
        doc.text(desc, 14, currentY + 4);

        currentY += 4 + (desc.length * 4) + 4;
      });
    } else {
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text("Sin hallazgos relevantes.", 14, currentY);
      currentY += 10;
    }
    currentY += 10;
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Página ${i} de ${pageCount}`, 190, 290, { align: 'right' });
  }

  doc.save("Reporte_Analisis_PYME.pdf");
};

export const generatePerformanceReport = (user: UserProfile, stats: DashboardStats, history: HistoryEntry[]) => {
  const doc = new jsPDF();
  const today = new Date().toLocaleDateString('es-ES');
  const PRIMARY_COLOR: [number, number, number] = [79, 70, 229];

  // Header
  doc.setFillColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
  doc.rect(0, 0, 210, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("Informe de Desempeño Comercial", 14, 20);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
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
  doc.setFont("helvetica", "bold");
  doc.text("Resumen del Mes Actual", 14, currentY);
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
    doc.setFont("helvetica", "bold");
    doc.text(value, x + 5, y + 18);
  };

  drawStat("Cotizaciones", stats.totalQuotes.toString(), 14, currentY);
  drawStat("Tasa Cierre", `${stats.conversionRate}%`, 60, currentY);
  drawStat("Primas Vendidas", `$ ${(stats.totalPremiumSold / 1000000).toFixed(1)}M`, 106, currentY);
  drawStat("Prospectos", stats.activeProspects.toString(), 152, currentY);

  currentY += 40;

  // History Table
  doc.setFontSize(14);
  doc.text("Historial de Actividad Reciente", 14, currentY);
  currentY += 10;

  const tableHead = [['Fecha', 'Cliente', 'Aseguradoras', 'Opción Ganadora', 'Valor', 'Estado']];
  const tableBody = history.slice(0, 20).map(h => [
    h.date,
    h.clientName,
    h.insurers.join(", "),
    h.bestOption,
    `$ ${(h.premiumValue / 1000000).toFixed(1)}M`,
    h.status
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