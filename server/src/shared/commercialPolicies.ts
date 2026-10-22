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
    'Pago de contado con descuento por pronto pago según aseguradora, o financiación en cuotas mensuales (hasta 10 meses) mediante débito automático o entidad financiera aliada.',
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
