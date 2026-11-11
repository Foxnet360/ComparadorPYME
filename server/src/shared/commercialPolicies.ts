/**
 * Commercial Policies definition, defaults, and formatters for Insurance Broker Allies
 * Compliance: Código de Comercio de Colombia, Estatuto Orgánico del Sistema Financiero
 */

export interface CommercialPolicyItem {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
}

export interface CommercialPolicies {
  offerValidityDays: number;
  paymentConditions: string;
  inspectionRequirements: string;
  issuanceRequirements: string;
  claimsPolicy: string;
  intermediationScope: string;
  customNotes?: string;
}

export const DEFAULT_COMMERCIAL_POLICIES: CommercialPolicies = {
  offerValidityDays: 15,
  paymentConditions:
    'Pago de contado con descuento por pronto pago según aseguradora, o financiación en cuotas mensuales (hasta 10 meses) mediante débito automático o entidad bancaria autorizada.',
  inspectionRequirements:
    'Inspección previa de asegurabilidad obligatoria para bienes con valor asegurable superior a 500 SMMLV o inmuebles con antigüedad superior a 25 años.',
  issuanceRequirements:
    'Orden formal de expedición debidamente firmada por el tomador/representante legal, formulario SARLAFT vigente y copia del RUT actualizado.',
  claimsPolicy:
    'Aviso oportuno de siniestro dentro de los tres (3) días hábiles siguientes a la ocurrencia o conocimiento del hecho, conforme al artículo 1075 del Código de Comercio de Colombia.',
  intermediationScope:
    'Asesoría técnica integral e imparcial, acompañamiento en trámites de reclamaciones y revisión anual de coberturas frente a la evolución del riesgo asegurado.',
  customNotes:
    'Las primas y condiciones expuestas están sujetas a la verificación final de asegurabilidad, políticas de suscripción y no siniestralidad previa reportada.',
};

/**
 * Returns merged commercial policies, falling back to professional standard defaults
 * whenever fields are missing or empty.
 */
export function getEffectiveCommercialPolicies(
  configured?: Partial<CommercialPolicies> | null
): CommercialPolicies {
  if (!configured) {
    return { ...DEFAULT_COMMERCIAL_POLICIES };
  }

  return {
    offerValidityDays:
      typeof configured.offerValidityDays === 'number' && configured.offerValidityDays > 0
        ? configured.offerValidityDays
        : DEFAULT_COMMERCIAL_POLICIES.offerValidityDays,
    paymentConditions:
      configured.paymentConditions?.trim() || DEFAULT_COMMERCIAL_POLICIES.paymentConditions,
    inspectionRequirements:
      configured.inspectionRequirements?.trim() || DEFAULT_COMMERCIAL_POLICIES.inspectionRequirements,
    issuanceRequirements:
      configured.issuanceRequirements?.trim() || DEFAULT_COMMERCIAL_POLICIES.issuanceRequirements,
    claimsPolicy:
      configured.claimsPolicy?.trim() || DEFAULT_COMMERCIAL_POLICIES.claimsPolicy,
    intermediationScope:
      configured.intermediationScope?.trim() || DEFAULT_COMMERCIAL_POLICIES.intermediationScope,
    customNotes:
      configured.customNotes?.trim() || DEFAULT_COMMERCIAL_POLICIES.customNotes,
  };
}

/**
 * Formats policies into structured key-value items for display, PDF tables, and Excel sheets.
 */
export function getStructuredCommercialPolicyEntries(policies: CommercialPolicies): Array<{
  category: string;
  title: string;
  detail: string;
}> {
  return [
    {
      category: 'Vigencia de la Oferta',
      title: 'Plazo de Validez',
      detail: `${policies.offerValidityDays} días calendario a partir de la fecha de expedición de este informe`,
    },
    {
      category: 'Financiación y Pagos',
      title: 'Condiciones de Recaudo',
      detail: policies.paymentConditions,
    },
    {
      category: 'Suscripción e Inspección',
      title: 'Garantías Previas',
      detail: policies.inspectionRequirements,
    },
    {
      category: 'Emisión de Póliza',
      title: 'Requisitos Obligatorios',
      detail: policies.issuanceRequirements,
    },
    {
      category: 'Atención de Siniestros',
      title: 'Procedimiento de Reclamación',
      detail: policies.claimsPolicy,
    },
    {
      category: 'Servicio de Intermediación',
      title: 'Alcance del Asesor / Correduría',
      detail: policies.intermediationScope,
    },
    ...(policies.customNotes
      ? [
          {
            category: 'Notas Especiales',
            title: 'Disposiciones Particulares',
            detail: policies.customNotes,
          },
        ]
      : []),
  ];
}

export interface InsurerCommercialConditions {
  validezOferta?: string;
  formaPago?: string;
  inspeccionPrevia?: string;
  requisitosEmision?: string;
  otrasCondiciones?: string;
  [key: string]: string | undefined;
}

export const COMMERCIAL_CONDITION_FIELDS = [
  { key: 'validezOferta', label: 'Validez de la Oferta', placeholder: 'Ej: 30 días calendario' },
  { key: 'formaPago', label: 'Forma de Pago y Financiación', placeholder: 'Ej: Hasta 10 cuotas mensuales / Débito' },
  { key: 'inspeccionPrevia', label: 'Inspección Previa y Garantías', placeholder: 'Ej: Inspección virtual en 15 días' },
  { key: 'requisitosEmision', label: 'Requisitos de Emisión', placeholder: 'Ej: SARLAFT + RUT + Orden formal' },
  { key: 'otrasCondiciones', label: 'Otras Condiciones Comerciales', placeholder: 'Ej: Garantía de mantenimiento de tasa' },
] as const;

/**
 * Extracts commercial conditions per insurer from a comparison report or matrix.
 */
export function extractCommercialConditionsFromReport(report: any): Record<string, InsurerCommercialConditions> {
  const result: Record<string, InsurerCommercialConditions> = {};
  const quotes = report?.quotes || [];
  const insurers: string[] = quotes.map((q: any) => q.insurerName || q.name || 'Aseguradora');

  // Initialize with empty or existing commercialConditions
  insurers.forEach((ins) => {
    result[ins] = { ...(report?.commercialConditions?.[ins] || {}) };
  });

  const matrixRows = report?.matrix || [];
  if (Array.isArray(matrixRows) && matrixRows.length > 0) {
    matrixRows.forEach((row: any) => {
      const label = (row.label || '').toLowerCase();
      let matchedKey: keyof InsurerCommercialConditions | null = null;
      if (label.includes('validez')) matchedKey = 'validezOferta';
      else if (label.includes('pago') || label.includes('financiaci')) matchedKey = 'formaPago';
      else if (label.includes('inspecci') || label.includes('garantia')) matchedKey = 'inspeccionPrevia';
      else if (label.includes('emision') || label.includes('requisito')) matchedKey = 'requisitosEmision';
      else if (label.includes('otra') || label.includes('compromiso') || (row.section && String(row.section).includes('COMERCIAL'))) matchedKey = 'otrasCondiciones';

      if (matchedKey && Array.isArray(row.cells)) {
        row.cells.forEach((cell: any, idx: number) => {
          const insurer = insurers[idx];
          if (insurer && cell && cell.value) {
            if (!result[insurer]) {
              result[insurer] = {};
            }
            const target = result[insurer]!;
            if (!target[matchedKey]) {
              target[matchedKey] = cell.value;
            }
          }
        });
      }
    });
  }

  // Also fallback to quotes paymentTerms if formaPago is still empty
  quotes.forEach((q: any) => {
    const ins = q.insurerName || q.name;
    if (ins && q.paymentTerms) {
      if (!result[ins]) {
        result[ins] = {};
      }
      const target = result[ins]!;
      if (!target.formaPago) {
        target.formaPago = q.paymentTerms;
      }
    }
  });

  return result;
}

/**
 * Synchronizes edited commercial conditions back into the report and its matrix rows.
 */
export function applyCommercialConditionsToReport<T extends { matrix?: any[]; commercialConditions?: any; quotes?: any[] }>(
  report: T,
  conditions: Record<string, InsurerCommercialConditions>
): T {
  const quotes = report.quotes || [];
  const insurers: string[] = quotes.map((q: any) => q.insurerName || q.name || 'Aseguradora');
  const updatedReport = {
    ...report,
    commercialConditions: { ...(report.commercialConditions || {}), ...conditions },
  };

  const matrix = [...(report.matrix || [])];

  COMMERCIAL_CONDITION_FIELDS.forEach(({ key, label }) => {
    let rowIndex = matrix.findIndex(
      (r) =>
        r.label === label ||
        (r.section === 'CONDICIONES COMERCIALES' && (r.label || '').toLowerCase().includes(key.toLowerCase().slice(0, 5)))
    );

    const cells = insurers.map((ins) => ({
      value: conditions[ins]?.[key] || 'No especificado en cotización',
      isExcluded: false,
      isWinner: false,
    }));

    if (rowIndex >= 0) {
      matrix[rowIndex] = {
        ...matrix[rowIndex],
        label,
        section: 'CONDICIONES COMERCIALES',
        cells: cells.map((c, i) => ({
          ...(matrix[rowIndex].cells?.[i] || {}),
          value: c.value,
        })),
      };
    } else {
      matrix.push({
        type: 'data',
        id: `comm-${key}`,
        label,
        sectionId: 99,
        section: 'CONDICIONES COMERCIALES',
        cells,
      });
    }
  });

  updatedReport.matrix = matrix;
  return updatedReport;
}
