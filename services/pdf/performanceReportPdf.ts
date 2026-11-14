import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { UserProfile, DashboardStats, HistoryEntry } from '../../types';
import { formatCOPMillions } from '../../utils/formatCurrency';

/**
 * Generates and downloads the commercial performance report PDF.
 */
export const generatePerformanceReport = (
  user: UserProfile,
  stats: DashboardStats,
  history: HistoryEntry[]
): void => {
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
