/**
 * Quote→Policy promotion mapping (renovacion-polizas PR-2, task 1.9, Q4).
 *
 * Pure function: given an analysis_history row, the winning quote index and
 * the broker's confirmations, build the whitelisted CreatePolicyInput.
 *
 * Auto-carried from the quote: insurer, premium, coverages, deductibles,
 * ramo (analysis domain), source_analysis_id. The broker MUST confirm:
 * client_id, policy_number, start/end dates, and the per-ramo insured
 * object. provenance is recorded as 'analysis' (R1.3); persistence stays
 * minimal (R1.4) because the mapper only emits repository-whitelisted keys.
 */

import { ValidationError } from '../errors';
import type { AnalysisHistoryRecord } from '../repositories/analysisRepository';
import type { CreatePolicyInput, PolicyRamo } from '../repositories/policyRepository';
import { POLICY_RAMOS } from '../repositories/policyRepository';
import type { CoverageItem } from '../types';

export class PromoteError extends ValidationError {}

export interface PromoteConfirmations {
  client_id: string;
  policy_number: string;
  start_date: string;
  end_date: string;
  insured: Record<string, unknown>;
}

/**
 * Q4: per-ramo insured object the broker must confirm — extraction cannot
 * know it. autos→plate/model/value; pyme/copropiedades→suma_asegurada (the
 * IPC flag is optional); salud/vida_grupo→headcount & carencias date;
 * transporte/casco/equipo→asset id; cumplimiento→contract; hogar→address.
 */
export const RAMO_INSURED_REQUIREMENTS: Record<PolicyRamo, readonly string[]> = {
  autos: ['plate', 'model', 'value'],
  pyme: ['suma_asegurada'],
  copropiedades: ['suma_asegurada'],
  salud: ['headcount', 'carencias_date'],
  vida_grupo: ['headcount', 'carencias_date'],
  transporte: ['asset_id'],
  casco: ['asset_id'],
  equipo: ['asset_id'],
  cumplimiento: ['contract'],
  hogar: ['address'],
};

function fail(message: string, field?: string): never {
  throw new PromoteError(message, field ? [{ field, message }] : []);
}

export function buildPromotedPolicyInput(
  analysis: AnalysisHistoryRecord,
  quoteIndex: number,
  confirmations: PromoteConfirmations
): CreatePolicyInput {
  const quotes = analysis.analysis_result?.quotes;
  if (!Array.isArray(quotes) || quotes.length === 0) {
    fail('Analysis has no quotes to promote');
  }

  const quote = quotes[quoteIndex];
  if (!quote) {
    fail(`quote_index ${quoteIndex} is out of range (${quotes.length} quotes)`, 'quote_index');
  }

  const ramo = analysis.domain ?? '';
  if (!(POLICY_RAMOS as readonly string[]).includes(ramo)) {
    fail(`Analysis domain '${ramo}' is not a supported ramo`, 'ramo');
  }

  const insured = confirmations.insured ?? {};
  for (const field of RAMO_INSURED_REQUIREMENTS[ramo as PolicyRamo]) {
    if (insured[field] === undefined || insured[field] === null || insured[field] === '') {
      fail(`insured.${field} is required for ramo ${ramo}`, `confirmations.insured.${field}`);
    }
  }

  const coverages = (quote.coverages ?? []) as CoverageItem[];
  const deductibles = coverages
    .filter((coverage) => coverage.deductible !== undefined && coverage.deductible !== '')
    .map((coverage) => ({ coverage: coverage.name, deductible: coverage.deductible }));

  return {
    client_id: confirmations.client_id,
    ramo,
    insurer: quote.insurerName,
    policy_number: confirmations.policy_number,
    premium: quote.priceAnnual ?? null,
    start_date: confirmations.start_date,
    end_date: confirmations.end_date,
    coverages,
    deductibles,
    provenance: 'analysis',
    source_analysis_id: analysis.id ?? null,
    ramo_details: { insured },
  };
}
