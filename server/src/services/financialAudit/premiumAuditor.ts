/**
 * Financial Audit Service for Insurance Quotes
 * Validates the arithmetic consistency of premium breakdowns:
 * Net Premium + Expedition Fees + Taxes (IVA) + Other Charges == Total Payable
 */

import { PremiumAuditResult } from '../../types/claimSimulation';

export interface AuditPremiumOptions {
  toleranceCOP?: number;
}

/**
 * Validates whether the reported components of a premium match the declared total payable.
 * Handles rounding variances gracefully with a default tolerance of $1.000 COP.
 */
export function auditPremiumEquation(
  premium: {
    netPremium?: number | null;
    fees?: number | null;
    taxes?: number | null;
    otherCharges?: number | null;
    totalPayable?: number | null;
    currency?: string;
  } | undefined | null,
  insurerName: string = 'Aseguradora',
  options: AuditPremiumOptions = {}
): PremiumAuditResult {
  const tolerance = options.toleranceCOP ?? 1000;

  if (!premium || typeof premium.totalPayable !== 'number' || premium.totalPayable <= 0) {
    return {
      insurerName,
      isValid: true,
      skipped: true,
      expectedTotal: 0,
      actualTotal: 0,
      discrepancy: 0,
      tolerance,
      breakdown: {
        netPremium: 0,
        fees: 0,
        taxes: 0,
      },
      explanation: 'Desglose de prima no disponible o cotización sin valor total liquidado.',
    };
  }

  const net = premium.netPremium ?? 0;
  const fees = premium.fees ?? 0;
  const taxes = premium.taxes ?? 0;
  const other = premium.otherCharges ?? 0;
  const actualTotal = premium.totalPayable;

  // Expected Total calculation
  const expectedTotal = net + fees + taxes + other;
  const discrepancy = Math.abs(expectedTotal - actualTotal);
  const isValid = discrepancy <= tolerance;

  let alert: PremiumAuditResult['alert'] = undefined;
  let explanation: string | undefined = undefined;

  if (!isValid) {
    const isHigher = actualTotal > expectedTotal;
    const diffFormatted = Math.round(discrepancy).toLocaleString('es-CO');
    const actualFormatted = Math.round(actualTotal).toLocaleString('es-CO');
    const expectedFormatted = Math.round(expectedTotal).toLocaleString('es-CO');

    explanation = isHigher
      ? `El total a pagar ($${actualFormatted} COP) supera en $${diffFormatted} COP la suma de componentes ($${expectedFormatted} COP). Posible inclusión de estampillas departamentales, asistencias especiales o cargos no desglosados.`
      : `El total a pagar ($${actualFormatted} COP) es menor en $${diffFormatted} COP que la suma de componentes ($${expectedFormatted} COP). Posible aplicación de descuentos comerciales o retenciones tributarias.`;

    alert = {
      level: 'WARNING',
      title: `Discrepancia contable en prima de ${insurerName}`,
      description: explanation,
    };
  }

  return {
    insurerName,
    isValid,
    skipped: false,
    expectedTotal,
    actualTotal,
    discrepancy,
    tolerance,
    breakdown: {
      netPremium: net,
      fees,
      taxes,
      otherCharges: other > 0 ? other : undefined,
    },
    explanation,
    alert,
  };
}
