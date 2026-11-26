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
import { COLOMBIA_SMMLV_2026 } from './colombianCalendar';
import type {
  CumplimientoCase,
  CumplimientoPrepolicyData,
  CumplimientoRequiredCoverageItem,
} from '../types';

function formatCop(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'Por definir';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatUsd(valueCop: number | null | undefined, trm: number | null | undefined): string {
  if (
    typeof valueCop !== 'number' ||
    Number.isNaN(valueCop) ||
    typeof trm !== 'number' ||
    trm <= 0
  ) {
    return 'USD —';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(valueCop / trm);
}

function formatAmountByCurrency(
  valueCop: number | null | undefined,
  p: CumplimientoPrepolicyData
): string {
  const mode = p.displayCurrency || 'COP';
  if (mode === 'USD') return formatUsd(valueCop, p.trmValue);
  if (mode === 'BOTH') return `${formatCop(valueCop)} (${formatUsd(valueCop, p.trmValue)})`;
  return formatCop(valueCop);
}

function formatCoverageDates(cov: CumplimientoRequiredCoverageItem): string {
  if (cov.estimatedStartDate && cov.estimatedEndDate) {
    const base = `${cov.estimatedStartDate} al ${cov.estimatedEndDate}`;
    return cov.validityRule ? `${base} (${cov.validityRule})` : base;
  }
  return cov.validityRule || 'Según contrato';
}

function formatPhaseLabel(phase?: string | null): string {
  if (phase === 'POST_CONTRACTUAL') return 'Post-contractual';
  if (phase === 'PRECONTRACTUAL') return 'Precontractual';
  return 'Contractual';
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
              `${idx + 1}. ${c.name} [${formatPhaseLabel(c.phase)}] | %: ${c.percentageOfContract || `${c.percentageNumeric ?? '-'}%`} | Valor: ${formatAmountByCurrency(c.minimumAmount, p)} | Vigencia: ${formatCoverageDates(c)}`
          )
          .join('\n')
      : 'Sin amparos registrados';

  const pendingChecklist = (caseRecord.checklist_data || [])
    .filter((item) => item.required && item.status === 'pending')
    .map((item) => `- [Pendiente] ${item.label}`);

  const lines = [
    `SLIP DE SOLICITUD DE COTIZACIÓN — CUMPLIMIENTO Y FIANZAS (${p.caseType})`,
    `Caso: ${caseRecord.title}`,
    `Moneda: ${p.displayCurrency || 'COP'}${p.trmValue ? ` | TRM: ${formatCop(p.trmValue)}` : ''} | SMMLV 2026: ${formatCop(p.smmlvValue || COLOMBIA_SMMLV_2026)}`,
    '',
    '1. TOMADOR / CONTRATISTA',
    `Razón Social / Nombre: ${p.contractor.name || 'Por definir'}`,
    `NIT / C.C.: ${p.contractor.nit || 'Por definir'}`,
    `Tipo: ${p.contractor.personType}`,
    p.contractor.address ? `Dirección: ${p.contractor.address}` : null,
    p.contractor.phone || p.contractor.contactPhone
      ? `Teléfono: ${p.contractor.phone || p.contractor.contactPhone}`
      : null,
    p.contractor.city ? `Ciudad: ${p.contractor.city}` : null,
    '',
    '2. ASEGURADO / BENEFICIARIO (CONTRATANTE)',
    `Entidad / Empresa: ${p.beneficiary.name || 'Por definir'}`,
    `NIT: ${p.beneficiary.nit || 'Por definir'}`,
    `Régimen Jurídico: ${p.legalRegime}`,
    p.beneficiary.address ? `Dirección: ${p.beneficiary.address}` : null,
    p.beneficiary.phone ? `Teléfono: ${p.beneficiary.phone}` : null,
    p.beneficiary.city ? `Ciudad: ${p.beneficiary.city}` : null,
    '',
    '3. DATOS DEL CONTRATO / PROCESO',
    `Tipo de Contrato: ${p.contractType}`,
    `Número: ${p.contractNumber || 'Por definir'}`,
    `Valor del Contrato: ${formatAmountByCurrency(p.contractValue, p)}`,
    `Vigencia Contrato: ${p.contractStartDate && p.contractEndDate ? `${p.contractStartDate} al ${p.contractEndDate}` : p.contractDuration || 'Por definir'} (${p.contractDuration || 'Plazo contractual'})`,
    `Objeto: ${p.objectDescription || 'Por definir'}`,
    '',
    '4. GARANTÍAS DE CUMPLIMIENTO SOLICITADAS',
    coveragesText,
  ];

  if (p.rceRequirement?.required) {
    const rce = p.rceRequirement;
    const smmlv = p.smmlvValue || COLOMBIA_SMMLV_2026;
    const rceCop = rce.amountCop ?? (rce.amountSmmlv ? rce.amountSmmlv * smmlv : null);
    const activeAdds = (rce.additionalCoverages || [])
      .filter((a) => a.included)
      .map((a) => (a.sublimitSmmlv ? `${a.label} (${a.sublimitSmmlv} SMMLV)` : a.label));
    lines.push(
      '',
      '5. RCE DERIVADA (INDEPENDIENTE — SMMLV)',
      `Cuantía: ${rce.amountSmmlv ? `${rce.amountSmmlv} SMMLV` : '—'} (${formatAmountByCurrency(rceCop, p)})`,
      `Vigencia RCE: ${rce.startDate && rce.endDate ? `${rce.startDate} al ${rce.endDate}` : rce.validityRule || 'Vigencia contractual'}`,
      `Amparo Básico: ${rce.basicPloIncluded !== false ? 'Predios, Labores y Operaciones (PLO)' : 'No especificado'}`,
      `Amparos Adicionales: ${activeAdds.length > 0 ? activeAdds.join(', ') : (rce.subcoverages || []).join(', ') || 'Estándar'}`
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

  doc.setFontSize(13);
  doc.text('SLIP DE SOLICITUD DE COTIZACIÓN — CUMPLIMIENTO Y FIANZAS', 14, 16);
  doc.setFontSize(9.5);
  doc.text(
    `Caso: ${caseRecord.title} (${p.caseType}) | Moneda: ${p.displayCurrency || 'COP'}${p.trmValue ? ` · TRM: ${formatCop(p.trmValue)}` : ''}`,
    14,
    22
  );

  autoTable(doc, {
    startY: 27,
    head: [['Sección', 'Campo', 'Detalle']],
    body: [
      ['Tomador / Contratista', 'Razón Social / Nombre', p.contractor.name || 'Por definir'],
      ['Tomador / Contratista', 'NIT / C.C.', p.contractor.nit || 'Por definir'],
      ['Tomador / Contratista', 'Tipo de Persona', p.contractor.personType],
      [
        'Tomador / Contratista',
        'Dirección / Teléfono',
        [p.contractor.address, p.contractor.phone || p.contractor.contactPhone, p.contractor.city]
          .filter(Boolean)
          .join(' · ') || 'Por definir',
      ],
      ['Asegurado / Beneficiario', 'Entidad Contratante', p.beneficiary.name || 'Por definir'],
      ['Asegurado / Beneficiario', 'NIT', p.beneficiary.nit || 'Por definir'],
      [
        'Asegurado / Beneficiario',
        'Dirección / Teléfono',
        [p.beneficiary.address, p.beneficiary.phone, p.beneficiary.city]
          .filter(Boolean)
          .join(' · ') || 'Por definir',
      ],
      ['Contrato', 'Régimen / Tipo', `${p.legalRegime} · ${p.contractType}`],
      ['Contrato', '# Contrato / Proceso', p.contractNumber || 'Por definir'],
      ['Contrato', 'Valor del Contrato', formatAmountByCurrency(p.contractValue, p)],
      [
        'Contrato',
        'Vigencia (Fechas)',
        `${p.contractStartDate && p.contractEndDate ? `${p.contractStartDate} al ${p.contractEndDate}` : 'Por definir'} (${p.contractDuration || '-'})`,
      ],
      ['Contrato', 'Objeto', p.objectDescription || 'Por definir'],
    ],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [67, 56, 202] },
  });

  let nextY =
    ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 110) + 6;
  autoTable(doc, {
    startY: nextY,
    head: [['Amparo Cumplimiento', 'Fase', '%', 'Valor Asegurado', 'Vigencia (Fechas)']],
    body: p.requiredCoverages.map((c) => [
      c.name,
      formatPhaseLabel(c.phase),
      c.percentageOfContract || (c.percentageNumeric !== null ? `${c.percentageNumeric}%` : '—'),
      formatAmountByCurrency(c.minimumAmount, p),
      formatCoverageDates(c),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 41, 59] },
  });

  if (p.rceRequirement?.required) {
    const rce = p.rceRequirement;
    const smmlv = p.smmlvValue || COLOMBIA_SMMLV_2026;
    const rceCop = rce.amountCop ?? (rce.amountSmmlv ? rce.amountSmmlv * smmlv : null);
    nextY =
      ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 180) + 6;

    autoTable(doc, {
      startY: nextY,
      head: [['RCE Derivada (Independiente)', 'Cuantía SMMLV', 'Equivalente', 'Vigencia']],
      body: [
        [
          rce.basicPloIncluded !== false ? 'Amparo Básico: PLO' : 'RCE Derivada',
          rce.amountSmmlv ? `${rce.amountSmmlv} SMMLV` : '—',
          formatAmountByCurrency(rceCop, p),
          rce.startDate && rce.endDate
            ? `${rce.startDate} al ${rce.endDate}`
            : rce.validityRule || 'Vigencia contractual',
        ],
        ...(rce.additionalCoverages || [])
          .filter((a) => a.included)
          .map((a) => [
            `Adicional: ${a.label}`,
            a.sublimitSmmlv ? `${a.sublimitSmmlv} SMMLV` : 'Incluido',
            a.sublimitSmmlv
              ? formatAmountByCurrency(a.sublimitSmmlv * smmlv, p)
              : 'Según límite básico',
            'Igual a PLO',
          ]),
      ],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [15, 118, 110] },
    });
  }

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
                children: [new TextRun({ text, bold, size: 19 })],
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
      makeRow([
        'Tomador',
        'Dirección / Teléfono',
        [p.contractor.address, p.contractor.phone || p.contractor.contactPhone, p.contractor.city]
          .filter(Boolean)
          .join(' · ') || 'Por definir',
      ]),
      makeRow(['Beneficiario', 'Entidad Contratante', p.beneficiary.name || 'Por definir']),
      makeRow(['Beneficiario', 'NIT', p.beneficiary.nit || 'Por definir']),
      makeRow([
        'Beneficiario',
        'Dirección / Teléfono',
        [p.beneficiary.address, p.beneficiary.phone, p.beneficiary.city]
          .filter(Boolean)
          .join(' · ') || 'Por definir',
      ]),
      makeRow(['Contrato', 'Régimen / Tipo', `${p.legalRegime} · ${p.contractType}`]),
      makeRow(['Contrato', '# Contrato / Proceso', p.contractNumber || 'Por definir']),
      makeRow(['Contrato', 'Valor del Contrato', formatAmountByCurrency(p.contractValue, p)]),
      makeRow([
        'Contrato',
        'Vigencia (Fechas)',
        `${p.contractStartDate && p.contractEndDate ? `${p.contractStartDate} al ${p.contractEndDate}` : 'Por definir'} (${p.contractDuration || '-'})`,
      ]),
      makeRow(['Contrato', 'Objeto', p.objectDescription || 'Por definir']),
    ],
  });

  const coveragesTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      makeRow(['Amparo', 'Fase', '% Contrato', 'Valor Asegurado', 'Vigencia (Fechas)'], true),
      ...p.requiredCoverages.map((c) =>
        makeRow([
          c.name,
          formatPhaseLabel(c.phase),
          c.percentageOfContract ||
            (c.percentageNumeric !== null ? `${c.percentageNumeric}%` : '—'),
          formatAmountByCurrency(c.minimumAmount, p),
          formatCoverageDates(c),
        ])
      ),
    ],
  });

  const children: Array<Paragraph | Table> = [
    new Paragraph({
      text: 'SLIP DE SOLICITUD DE COTIZACIÓN — CUMPLIMIENTO Y FIANZAS',
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({
      text: `Caso: ${caseRecord.title} (${p.caseType}) | Moneda: ${p.displayCurrency || 'COP'}${p.trmValue ? ` · TRM: ${formatCop(p.trmValue)}` : ''}`,
    }),
    new Paragraph({ text: '' }),
    infoTable,
    new Paragraph({ text: '' }),
    new Paragraph({
      text: 'GARANTÍAS DE CUMPLIMIENTO SOLICITADAS',
      heading: HeadingLevel.HEADING_2,
    }),
    coveragesTable,
  ];

  if (p.rceRequirement?.required) {
    const rce = p.rceRequirement;
    const smmlv = p.smmlvValue || COLOMBIA_SMMLV_2026;
    const rceCop = rce.amountCop ?? (rce.amountSmmlv ? rce.amountSmmlv * smmlv : null);
    children.push(
      new Paragraph({ text: '' }),
      new Paragraph({
        text: 'RCE DERIVADA (INDEPENDIENTE — SMMLV)',
        heading: HeadingLevel.HEADING_2,
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          makeRow(['Cobertura RCE', 'Cuantía SMMLV', 'Equivalente', 'Vigencia'], true),
          makeRow([
            rce.basicPloIncluded !== false ? 'Amparo Básico: PLO' : 'RCE Derivada',
            rce.amountSmmlv ? `${rce.amountSmmlv} SMMLV` : '—',
            formatAmountByCurrency(rceCop, p),
            rce.startDate && rce.endDate
              ? `${rce.startDate} al ${rce.endDate}`
              : rce.validityRule || 'Vigencia contractual',
          ]),
          ...(rce.additionalCoverages || [])
            .filter((a) => a.included)
            .map((a) =>
              makeRow([
                `Adicional: ${a.label}`,
                a.sublimitSmmlv ? `${a.sublimitSmmlv} SMMLV` : 'Incluido',
                a.sublimitSmmlv
                  ? formatAmountByCurrency(a.sublimitSmmlv * smmlv, p)
                  : 'Según límite básico',
                'Igual a PLO',
              ])
            ),
        ],
      })
    );
  }

  const doc = new Document({
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, `slip_${safeSlug(caseRecord.title)}.docx`);
}
