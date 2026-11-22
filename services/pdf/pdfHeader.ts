import type jsPDF from 'jspdf';
import type { PDFOptions } from './types';
import type { DomainRegulatoryProfile } from '@shared/domainRegulatoryKnowledge';

export interface HeaderParams {
  doc: jsPDF;
  title: string;
  options?: PDFOptions;
  regProfile: DomainRegulatoryProfile;
  today: string;
  pagesWithHeader: Set<number>;
  primaryColor: [number, number, number];
}

/**
 * Renders the top stylized banner header on a page.
 */
export function renderPageHeader({
  doc,
  title,
  options,
  regProfile,
  today,
  pagesWithHeader,
  primaryColor,
}: HeaderParams): number {
  const pageNum = doc.getCurrentPageInfo().pageNumber;
  pagesWithHeader.add(pageNum);

  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 34, 'F');

  // Logo Logic (Broker logoUrl or default logoBase64)
  const logoToUse = options?.logoBase64 || options?.brokerInfo?.logoUrl;
  if (logoToUse) {
    try {
      const format =
        logoToUse.includes('image/jpeg') || logoToUse.includes('image/jpg') ? 'JPEG' : 'PNG';
      // White rounded background container for ally logo
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(156, 4, 40, 26, 2, 2, 'F');
      doc.addImage(logoToUse, format, 158, 6, 36, 22, undefined, 'FAST');
    } catch (e) {
      console.warn('Failed to add logo', e);
    }
  } else {
    // Stylized Ally Corporate Emblem Badge
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(156, 4, 40, 26, 2, 2, 'F');

    const emblemName = (options?.brokerInfo?.intermediaryName || 'CORREDURÍA').slice(0, 14);
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.circle(166, 17, 5, 'F');
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(emblemName.slice(0, 3).toUpperCase(), 166, 19, { align: 'center' });

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(emblemName, 174, 14);

    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('ALIADO DE SEGUROS', 174, 18.5);
    doc.text('VIGILADO SFC', 174, 22.5);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  const displayTitle =
    options?.customTitle || title || `Reporte Ejecutivo · ${regProfile.displayName}`;
  doc.text(displayTitle.substring(0, 48), 14, 11);

  // CSA Platform Credits
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(224, 231, 255);
  doc.text('Plataforma CSA · Corredores de Seguros Asociados S.A.', 14, 16.5);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  const brokerTitle =
    options?.brokerInfo?.intermediaryName ||
    options?.brokerInfo?.name ||
    'Corredores de Seguros Asociados S.A.';
  doc.text(
    `Ramo: ${regProfile.displayName}  |  Expedición: ${today}  |  Intermediario: ${brokerTitle.substring(0, 32)}`,
    14,
    22
  );

  const brokerAdvisor = options?.brokerInfo?.name
    ? `Técnico Analista: ${options.brokerInfo.name}`
    : '';
  const brokerReg = options?.brokerInfo?.registrationNumber
    ? `Matrícula: ${options.brokerInfo.registrationNumber}`
    : '';
  const brokerPhone = options?.brokerInfo?.phone ? `Tel: ${options.brokerInfo.phone}` : '';
  const brokerEmail = options?.brokerInfo?.email ? `Email: ${options.brokerInfo.email}` : '';
  const headerContact = [brokerAdvisor, brokerReg, brokerPhone, brokerEmail]
    .filter(Boolean)
    .join('  |  ');
  if (headerContact) {
    doc.setFontSize(6.5);
    doc.setTextColor(224, 231, 255);
    doc.text(headerContact.substring(0, 78), 14, 27.5);
  }

  // Reset text color for body
  doc.setTextColor(30, 41, 59);
  return 40; // New Y position
}

/**
 * Renders the enriched professional footer on every page of the document.
 */
export function renderEnrichedFooter(doc: jsPDF, options?: PDFOptions): void {
  const pageCount = doc.getNumberOfPages();
  const brokerDisplayName =
    options?.brokerInfo?.intermediaryName ||
    options?.brokerInfo?.name ||
    'Corredores de Seguros Asociados S.A.';
  const brokerAdvisorName = options?.brokerInfo?.name || 'Técnico Analista de Seguros';
  const brokerPhoneStr = options?.brokerInfo?.phone || '+57 (601) 345-6789';
  const brokerEmailStr = options?.brokerInfo?.email || 'soporte@comparadorcsa.com';
  const brokerRegStr = options?.brokerInfo?.registrationNumber || 'Inscripción Vigente SFC';
  const brokerWebStr = 'https://correseguros.co/';

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // Subtle top border for footer
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(14, 281, 196, 281);

    // Row 1 (Bold primary contact line): Company, Advisor, Phone, Email
    doc.setFontSize(6.8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138);
    const row1 = `${brokerDisplayName}  |  Técnico Analista: ${brokerAdvisorName}  |  Tel: ${brokerPhoneStr}  |  Email: ${brokerEmailStr}`;
    doc.text(row1.substring(0, 115), 14, 285);

    // Row 2 (Secondary line): Web, SFC registration, Claims & Regulatory Supervision
    doc.setFontSize(6.2);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    const row2 = `Web: ${brokerWebStr}  |  Reg. SFC: ${brokerRegStr}  |  Atención y radicación de siniestros  |  Vigilado Superintendencia Financiera de Colombia`;
    doc.text(row2.substring(0, 130), 14, 289);

    // Right: Page number and system mark
    doc.setFontSize(6.8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`Página ${i} de ${pageCount}  |  CSA`, 196, 287, { align: 'right' });
  }
}
