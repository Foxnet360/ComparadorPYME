import { findColombianInsurerProfile } from '@shared/colombianInsurersCatalog';
import type { PdfRenderContext } from './types';
import { hexToRgb, formatCoverageValuePDF } from './pdfHelpers';
import {
  renderCuadroChicoTable,
  renderCoverageMatrixTable,
  renderDeductiblesTable,
  renderFinancialTable,
  renderRegulatoryAuditTable,
  renderCommercialConditionsTable,
  renderBrokerCommercialPoliciesTable,
} from './pdfTables';

/**
 * Renders Page 1: Executive Summary, Intermediary Profile, Risk Details, and Insurer Cards.
 */
export function renderExecutiveSummarySection(ctx: PdfRenderContext): void {
  const {
    doc,
    report,
    quotes,
    options,
    regProfile,
    effectivePolicies,
    primaryColor,
    clientMeta,
    brokerName,
    addHeader,
  } = ctx;
  let currentY = addHeader('Resumen Ejecutivo y Ficha Técnica');

  // Intermediary / Broker Banner
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, currentY, 182, 26, 2, 2, 'FD');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(brokerName, 18, currentY + 6.5);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  const broker = options?.brokerInfo;
  const line1 = [
    broker?.name ? `Técnico Analista Responsable: ${broker.name}` : 'Técnico Analista de Seguros',
    broker?.registrationNumber
      ? `Matrícula SFC: ${broker.registrationNumber}`
      : 'Inscripción Vigente SFC',
  ].join('  |  ');
  doc.text(line1, 18, currentY + 11.5);

  const line2 = [
    broker?.phone ? `Tel: ${broker.phone}` : null,
    broker?.email ? `Email: ${broker.email}` : null,
    broker?.address ? `Dir: ${broker.address}` : null,
    broker?.city ? `(${broker.city})` : null,
  ]
    .filter(Boolean)
    .join('  |  ');
  doc.text(line2 || 'Contacto comercial disponible', 18, currentY + 16);

  const line3 = `Vigencia Oferta: ${effectivePolicies.offerValidityDays} días calendario  |  Intermediación regulada por el Estatuto Orgánico del Sistema Financiero`;
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(line3, 18, currentY + 21);

  // If broker has logo, draw thumbnail on right of card
  const logoToUse = options?.brokerInfo?.logoUrl || options?.logoBase64;
  if (logoToUse) {
    try {
      const format =
        logoToUse.includes('image/jpeg') || logoToUse.includes('image/jpg') ? 'JPEG' : 'PNG';
      doc.addImage(logoToUse, format, 156, currentY + 3, 36, 20, undefined, 'FAST');
    } catch (_e) {
      // Ignore image embedding failure if logo format or base64 is unsupported
    }
  }

  currentY += 31;

  // Ficha Técnica del Riesgo / Copropiedad
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, currentY, 182, 24, 2, 2, 'FD');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Asegurado / Copropiedad: ${clientMeta.clientName.toUpperCase()}`, 18, currentY + 7);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Dirección del Riesgo: ${clientMeta.riskAddress} (${clientMeta.riskCity})  |  Ramo: ${regProfile.displayName}`,
    18,
    currentY + 13
  );
  doc.text(clientMeta.buildingDetails || `Marco Legal: ${regProfile.tagline}`, 18, currentY + 19);

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
    if (currentY > 235) {
      doc.addPage();
      currentY = addHeader('Resumen Ejecutivo (Cont.)');
    }

    const profile = findColombianInsurerProfile(q.insurerName);
    const [r, g, b] = hexToRgb(profile?.primaryColor || '#0033A0');
    const [ar, ag, ab] = hexToRgb(profile?.accentColor || '#38BDF8');

    // Insurer Corporate Brand Emblem
    doc.setFillColor(r, g, b);
    doc.roundedRect(14, currentY, 26, 12, 2, 2, 'F');
    doc.setFillColor(ar, ag, ab);
    doc.rect(14, currentY + 10.5, 26, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    const monogram = profile?.monogram || q.insurerName.slice(0, 4).toUpperCase();
    doc.text(monogram, 27, currentY + 7, { align: 'center' });

    // Insurer Corporate Identity Card
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(44, currentY, 152, 12, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(q.insurerName, 48, currentY + 5.5);

    const officialSub = profile?.officialName ? `(${profile.officialName})` : '';
    if (officialSub) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(officialSub.substring(0, 45), 50 + doc.getTextWidth(q.insurerName), currentY + 5.5);
    }

    const subDetails = [
      profile?.nit ? `NIT: ${profile.nit}` : null,
      profile?.marketPosition || 'Entidad Aseguradora Vigilada SFC',
    ]
      .filter(Boolean)
      .join('  |  ');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(subDetails, 48, currentY + 9.5);

    // Score Pill Badge
    doc.setFillColor(r, g, b);
    doc.roundedRect(158, currentY + 2.5, 34, 7, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(`Score: ${q.score || 0}/100`, 175, currentY + 7, { align: 'center' });

    currentY += 16;

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Enfoque Cliente (Beneficios):', 16, currentY);
    currentY += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const clientText = doc.splitTextToSize(
      q.clientAnalysis || 'Cobertura conforme a condiciones cotizadas.',
      175
    );
    doc.text(clientText, 16, currentY);
    currentY += clientText.length * 4 + 4;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Enfoque Técnico (Riesgos y Cláusulas):', 16, currentY);
    currentY += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const techText = doc.splitTextToSize(
      q.technicalAnalysis || 'Sin observaciones técnicas adicionales.',
      175
    );
    doc.text(techText, 16, currentY);
    currentY += techText.length * 4 + 8;
  });
}

/**
 * Renders Cuadro Chico (executive comparison summary table and surrounding presentation).
 */
export function renderCuadroChicoSection(ctx: PdfRenderContext): void {
  const { doc, options, regProfile, primaryColor, isCondensed, clientMeta, brokerName, addHeader } =
    ctx;

  if (!isCondensed) {
    doc.addPage();
  }
  let currentY = addHeader(
    isCondensed
      ? 'CUADRO COMPARATIVO RESUMIDO · VISIÓN EJECUTIVA CONDENSADA'
      : 'Cuadro Resumen Comparativo (Cuadro Chico)'
  );

  if (isCondensed) {
    // Intermediary / Broker Banner
    const broker = options?.brokerInfo;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, currentY, 182, 23, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(
      `INFORMACIÓN DEL TÉCNICO ANALISTA (INTERMEDIARIO) · ${brokerName}`,
      18,
      currentY + 5.5
    );

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);

    const line1 = [
      broker?.name ? `Técnico Analista: ${broker.name}` : 'Técnico Analista de Seguros',
      broker?.registrationNumber
        ? `Matrícula SFC: ${broker.registrationNumber}`
        : 'Inscripción Vigente SFC',
      broker?.phone ? `Tel: ${broker.phone}` : '',
      broker?.email ? `Email: ${broker.email}` : '',
    ]
      .filter(Boolean)
      .join('   |   ');
    doc.text(line1, 18, currentY + 11.5);

    const locStr =
      [broker?.address, broker?.city].filter(Boolean).join(', ') || 'Bogotá D.C., Colombia';
    const line2 = [
      broker?.website || 'https://correseguros.co/',
      locStr,
      'Acompañamiento técnico permanente y radicación de siniestros (Art. 1075 C.Co.)',
    ]
      .filter(Boolean)
      .join('   |   ');
    doc.text(line2, 18, currentY + 17.5);

    currentY += 26;

    // Client & Risk Summary Bar
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, currentY, 182, 9, 1.5, 1.5, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(
      `Cliente: ${clientMeta.clientName}   |   Ramo: ${regProfile.displayName}   |   Ubicación: ${clientMeta.riskAddress}`,
      18,
      currentY + 6
    );

    currentY += 12;
  }

  const getCuadroChicoValue = (q: PdfRenderContext['quotes'][0], keywords: string[]): string => {
    const coverages = q.coverages || [];
    const found = coverages.find((c) => {
      const name = `${c.name || ''} ${c.canonicalName || ''}`.toLowerCase();
      return keywords.some((kw) => name.includes(kw));
    });
    if (!found) return 'No cotizado';
    if (
      found.isPositive === false ||
      ['excluido', 'no incluida', 'no cotizado'].includes(String(found.value).toLowerCase())
    ) {
      return 'Excluido';
    }
    return formatCoverageValuePDF(found.value);
  };

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Resumen Ejecutivo de Parámetros Principales y Coberturas Clave', 14, currentY + 2);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const chicoIntro =
    'Síntesis ejecutiva de condiciones económicas, límites asegurados y deducibles para decisión rápida. ' +
    'En las páginas siguientes se detalla el alcance normativo y el desglose pormenorizado de cada amparo.';
  const splitChicoIntro = doc.splitTextToSize(chicoIntro, 182);
  doc.text(splitChicoIntro, 14, currentY + 7);

  currentY += 8 + splitChicoIntro.length * 3.5;

  renderCuadroChicoTable(ctx, currentY, getCuadroChicoValue);
}

/**
 * Renders Page 3: Dynamic multi-page coverage comparison matrix.
 */
export function renderCoverageMatrixSection(ctx: PdfRenderContext): void {
  const { doc, regProfile, addHeader } = ctx;
  doc.addPage();
  const currentY = addHeader(`Matriz Comparativa de Coberturas (${regProfile.displayName})`);
  renderCoverageMatrixTable(ctx, currentY);
}

/**
 * Renders Deductibles analysis and the pedagogical client guide box.
 */
export function renderDeductiblesSection(ctx: PdfRenderContext): void {
  const { doc, primaryColor, addHeader } = ctx;
  doc.addPage();
  let currentY = addHeader('Estructura de Deducibles y Guía Pedagógica');
  currentY = renderDeductiblesTable(ctx, currentY);

  // Cuadro Pedagógico para el Cliente sobre Deducibles en Colombia
  if (currentY > 200) {
    doc.addPage();
    currentY = addHeader('Guía Pedagógica de Deducibles para el Asegurado');
  }

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.roundedRect(14, currentY, 182, 60, 2, 2, 'FD');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
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
}

/**
 * Renders technical audit findings and risks matrix.
 */
export function renderRiskAuditSection(ctx: PdfRenderContext): void {
  const { doc, quotes, addHeader } = ctx;
  doc.addPage();
  let currentY = addHeader('Matriz de Hallazgos y Auditoría Técnica');

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
    const [ar, ag, ab] = hexToRgb(profile?.accentColor || '#38BDF8');
    doc.setFillColor(r, g, b);
    doc.roundedRect(14, currentY, 20, 8, 1.5, 1.5, 'F');
    doc.setFillColor(ar, ag, ab);
    doc.rect(14, currentY + 7, 20, 1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    const monogram = profile?.monogram || q.insurerName.slice(0, 4).toUpperCase();
    doc.text(monogram, 24, currentY + 5.2, {
      align: 'center',
    });

    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${q.insurerName} · Score Técnico: ${q.score}/100`, 38, currentY + 5.5);
    currentY += 10;

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
}

/**
 * Renders financial overview and applicable regulatory framework / compliance audit.
 */
export function renderEconomicAndRegulatorySection(ctx: PdfRenderContext): void {
  const { doc, quotes, regProfile, primaryColor, addHeader } = ctx;
  doc.addPage();
  let currentY = addHeader('Resumen Económico y Cumplimiento Normativo');
  currentY = renderFinancialTable(ctx, currentY);

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
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
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

    renderRegulatoryAuditTable(ctx, currentY);
  }
}

/**
 * Renders dedicated section for commercial policies and offer conditions.
 */
export function renderCommercialPoliciesSection(ctx: PdfRenderContext): void {
  const { doc, options, isCondensed, brokerName, addHeader } = ctx;
  doc.addPage();
  let policyY = addHeader(
    isCondensed
      ? 'POLÍTICAS COMERCIALES Y CONDICIONES DE LA OFERTA'
      : 'Políticas Comerciales y Condiciones de la Oferta'
  );

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Condiciones Comerciales de Cotizaciones por Aseguradora', 14, policyY + 2);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const commercialIntroText =
    'El presente cuadro consolida las condiciones comerciales, facilidades de financiación y requisitos de asegurabilidad estipulados en cada una de las propuestas evaluadas.';
  const splitIntro = doc.splitTextToSize(commercialIntroText, 182);
  doc.text(splitIntro, 14, policyY + 7);

  policyY += 8 + splitIntro.length * 4;

  // 1. Tabla Comparativa de Condiciones Comerciales Propuestas por Aseguradora
  policyY = renderCommercialConditionsTable(ctx, policyY);

  if (policyY > 195) {
    doc.addPage();
    policyY = addHeader('Políticas Comerciales del Corredor');
  }

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Políticas Generales y Procedimientos de Intermediación del Corredor', 14, policyY + 2);
  policyY += 6;

  policyY = renderBrokerCommercialPoliciesTable(ctx, policyY);

  let afterPolicyY = policyY;
  if (afterPolicyY > 235) {
    doc.addPage();
    afterPolicyY = addHeader('Políticas Comerciales · Respaldo y Contacto');
  }

  // Intermediary identification and regulatory notice box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, afterPolicyY, 182, 32, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`Intermediario Responsable: ${brokerName}`, 18, afterPolicyY + 7);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const brokerReg = options?.brokerInfo?.registrationNumber
    ? ` | Matrícula/Clave: ${options.brokerInfo.registrationNumber}`
    : '';
  const brokerEmail = options?.brokerInfo?.email ? ` | Email: ${options.brokerInfo.email}` : '';
  const brokerPhone = options?.brokerInfo?.phone ? ` | Tel: ${options.brokerInfo.phone}` : '';
  doc.text(
    `Contacto Técnico Analista:${brokerEmail}${brokerPhone}${brokerReg}`,
    18,
    afterPolicyY + 13
  );

  const legalNotice =
    'Superintendencia Financiera de Colombia: La actividad de intermediación de seguros se ejerce en cumplimiento del Estatuto Orgánico del Sistema Financiero (Decreto 663 de 1993) y la Circular Básica Jurídica. Las pólizas son contratos de seguro regidos por el Libro IV, Título V del Código de Comercio colombiano.';
  const splitNotice = doc.splitTextToSize(legalNotice, 174);
  doc.text(splitNotice, 18, afterPolicyY + 19);
}
