import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { CumplimientoCase } from '../types';

function formatCop(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'Por definir';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function safeSlug(text: string): string {
  return (text || 'slip_cumplimiento')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 50);
}

/**
 * Formats the Pre-policy (Slip) as clean plain text ready for Email or WhatsApp.
 */
export function formatPrepolicyForClipboard(caseRecord: CumplimientoCase): string {
  const p = caseRecord.prepolicy_data;
  const coveragesText =
    p.requiredCoverages.length > 0
      ? p.requiredCoverages
          .map(
            (c, idx) =>
              `${idx + 1}. ${c.name} | %: ${c.percentageOfContract || `${c.percentageNumeric ?? '-'}%`} | Valor Asegurado: ${formatCop(c.minimumAmount)} | Vigencia: ${c.validityRule || 'Según contrato'}`
          )
          .join('\n')
      : 'Sin amparos registrados';

  const pendingChecklist = (caseRecord.checklist_data || [])
    .filter((item) => item.required && item.status === 'pending')
    .map((item) => `- [Pendiente] ${item.label}`);

  const lines = [
    `SLIP DE SOLICITUD DE COTIZACIÓN — CUMPLIMIENTO Y FIANZAS (${p.caseType})`,
    `Caso: ${caseRecord.title}`,
    '',
    '1. TOMADOR / CONTRATISTA',
    `Razón Social / Nombre: ${p.contractor.name || 'Por definir'}`,
    `NIT / C.C.: ${p.contractor.nit || 'Por definir'}`,
    `Tipo: ${p.contractor.personType}`,
    p.contractor.city ? `Ciudad: ${p.contractor.city}` : null,
    p.contractor.address ? `Dirección: ${p.contractor.address}` : null,
    '',
    '2. ASEGURADO / BENEFICIARIO (CONTRATANTE)',
    `Entidad / Empresa: ${p.beneficiary.name || 'Por definir'}`,
    `NIT: ${p.beneficiary.nit || 'Por definir'}`,
    `Régimen Jurídico: ${p.legalRegime}`,
    '',
    '3. DATOS DEL CONTRATO / PROCESO',
    `Tipo de Contrato: ${p.contractType}`,
    `Número: ${p.contractNumber || 'Por definir'}`,
    `Valor del Contrato: ${formatCop(p.contractValue)}`,
    `Vigencia / Plazo: ${p.contractDuration || 'Por definir'}`,
    `Objeto: ${p.objectDescription || 'Por definir'}`,
    '',
    '4. GARANTÍAS Y AMPAROS SOLICITADOS',
    coveragesText,
  ];

  if (p.rceRequirement?.required) {
    lines.push(
      '',
      '5. RCE DERIVADA',
      `Cuantía: ${p.rceRequirement.amountDescription || formatCop(p.rceRequirement.amountCop)} | Subamparos: ${(p.rceRequirement.subcoverages || []).join(', ') || 'Estándar'}`
    );
  }

  if (pendingChecklist.length > 0) {
    lines.push('', 'DOCUMENTACIÓN PENDIENTE (CUPO / SARLAFT)', ...pendingChecklist);
  }

  return lines.filter((l): l is string => l !== null).join('\n');
}

/**
 * Generates and downloads a formatted PDF Slip for the Pre-policy case.
 */
export function exportPrepolicyToPdf(caseRecord: CumplimientoCase): void {
  const p = caseRecord.prepolicy_data;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFontSize(14);
  doc.text('SLIP DE SOLICITUD DE COTIZACIÓN — CUMPLIMIENTO Y FIANZAS', 14, 18);
  doc.setFontSize(10);
  doc.text(`Caso: ${caseRecord.title} (${p.caseType})`, 14, 25);

  autoTable(doc, {
    startY: 30,
    head: [['Sección', 'Campo', 'Detalle']],
    body: [
      ['Tomador / Contratista', 'Razón Social / Nombre', p.contractor.name || 'Por definir'],
      ['Tomador / Contratista', 'NIT / C.C.', p.contractor.nit || 'Por definir'],
      ['Tomador / Contratista', 'Tipo de Persona', p.contractor.personType],
      ['Asegurado / Beneficiario', 'Entidad Contratante', p.beneficiary.name || 'Por definir'],
      ['Asegurado / Beneficiario', 'NIT', p.beneficiary.nit || 'Por definir'],
      ['Contrato', 'Régimen / Tipo', `${p.legalRegime} · ${p.contractType}`],
      ['Contrato', '# Contrato / Proceso', p.contractNumber || 'Por definir'],
      ['Contrato', 'Valor del Contrato', formatCop(p.contractValue)],
      ['Contrato', 'Plazo / Vigencia', p.contractDuration || 'Por definir'],
      ['Contrato', 'Objeto', p.objectDescription || 'Por definir'],
    ],
    styles: { fontSize: 8.5 },
    headStyles: { fillColor: [67, 56, 202] },
  });

  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 110;
  autoTable(doc, {
    startY: finalY + 8,
    head: [['Amparo Solicitado', '% Contrato', 'Valor Asegurado', 'Vigencia + Adicionales']],
    body: p.requiredCoverages.map((c) => [
      c.name,
      c.percentageOfContract || (c.percentageNumeric !== null ? `${c.percentageNumeric}%` : '—'),
      formatCop(c.minimumAmount),
      c.validityRule || 'Según contrato',
    ]),
    styles: { fontSize: 8.5 },
    headStyles: { fillColor: [30, 41, 59] },
  });

  doc.save(`slip_${safeSlug(caseRecord.title)}.pdf`);
}

/**
 * Generates and downloads an editable Word (.docx) Slip for the Pre-policy case.
 */
export async function exportPrepolicyToDocx(caseRecord: CumplimientoCase): Promise<void> {
  const p = caseRecord.prepolicy_data;

  const makeRow = (cells: string[], bold = false) =>
    new TableRow({
      children: cells.map(
        (text) =>
          new TableCell({
            width: { size: Math.floor(100 / cells.length), type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [new TextRun({ text, bold, size: 20 })],
              }),
            ],
          })
      ),
    });

  const infoTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      makeRow(['Sección', 'Campo', 'Detalle'], true),
      makeRow(['Tomador', 'Razón Social / Nombre', p.contractor.name || 'Por definir']),
      makeRow(['Tomador', 'NIT / C.C.', p.contractor.nit || 'Por definir']),
      makeRow(['Tomador', 'Tipo de Persona', p.contractor.personType]),
      makeRow(['Beneficiario', 'Entidad Contratante', p.beneficiary.name || 'Por definir']),
      makeRow(['Beneficiario', 'NIT', p.beneficiary.nit || 'Por definir']),
      makeRow(['Contrato', 'Régimen / Tipo', `${p.legalRegime} · ${p.contractType}`]),
      makeRow(['Contrato', '# Contrato / Proceso', p.contractNumber || 'Por definir']),
      makeRow(['Contrato', 'Valor del Contrato', formatCop(p.contractValue)]),
      makeRow(['Contrato', 'Vigencia / Plazo', p.contractDuration || 'Por definir']),
      makeRow(['Contrato', 'Objeto', p.objectDescription || 'Por definir']),
    ],
  });

  const coveragesTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      makeRow(['Amparo', '% Contrato', 'Valor Asegurado', 'Vigencia + Adicionales'], true),
      ...p.requiredCoverages.map((c) =>
        makeRow([
          c.name,
          c.percentageOfContract ||
            (c.percentageNumeric !== null ? `${c.percentageNumeric}%` : '—'),
          formatCop(c.minimumAmount),
          c.validityRule || 'Según contrato',
        ])
      ),
    ],
  });

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: 'SLIP DE SOLICITUD DE COTIZACIÓN — CUMPLIMIENTO Y FIANZAS',
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({ text: `Caso: ${caseRecord.title} (${p.caseType})` }),
          new Paragraph({ text: '' }),
          infoTable,
          new Paragraph({ text: '' }),
          new Paragraph({
            text: 'GARANTÍAS Y AMPAROS SOLICITADOS',
            heading: HeadingLevel.HEADING_2,
          }),
          coveragesTable,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, `slip_${safeSlug(caseRecord.title)}.docx`);
}
