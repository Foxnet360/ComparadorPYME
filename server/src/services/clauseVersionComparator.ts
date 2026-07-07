/**
 * Clause Version Comparator
 * Compares versions of clause documents to detect contractual changes
 */

import { supabase } from '../config/database';
import { getDomainConstants } from '../config/domainConstants';

export interface ClauseVersionDiff {
  type: 'DEDUCTIBLE' | 'EXCLUSION' | 'COVERAGE' | 'CONDITION';
  coverageName?: string;
  oldValue?: string;
  newValue?: string;
  impact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  description: string;
}

export interface VersionComparisonResult {
  oldVersion: string;
  newVersion: string;
  insurerName: string;
  productName: string;
  diffs: ClauseVersionDiff[];
  favorableCount: number;
  unfavorableCount: number;
  neutralCount: number;
  comparisonDate: string;
}

interface ClauseCoverageRow {
  coverage_name: string;
  deductible_text: string;
  exclusions?: string[];
}

export const clauseVersionComparator = {
  /**
   * Compare two versions of a clause document
   */
  compareVersions: async (
    oldDocumentId: string,
    newDocumentId: string
  ): Promise<VersionComparisonResult> => {
    console.log(
      `🔍 [clauseVersionComparator] Comparing versions ${oldDocumentId} vs ${newDocumentId}...`
    );

    // Fetch documents
    const { data: oldDoc } = await supabase
      .from('documents')
      .select('*')
      .eq('id', oldDocumentId)
      .single();

    const { data: newDoc } = await supabase
      .from('documents')
      .select('*')
      .eq('id', newDocumentId)
      .single();

    const oldDocTyped = oldDoc as Record<string, unknown> | null;
    const newDocTyped = newDoc as Record<string, unknown> | null;

    if (!oldDocTyped || !newDocTyped) {
      throw new Error('One or both documents not found');
    }

    // Fetch clause coverages for both
    const { data: oldCoverages } = await supabase
      .from('clause_coverages')
      .select('*')
      .eq('document_id', oldDocumentId);

    const { data: newCoverages } = await supabase
      .from('clause_coverages')
      .select('*')
      .eq('document_id', newDocumentId);

    const diffs: ClauseVersionDiff[] = [];

    // Compare coverages
    const oldCoverageMap = new Map(
      ((oldCoverages ?? []) as Array<Record<string, unknown>>).map((c) => [
        (c.coverage_name as string).toLowerCase(),
        c as unknown as ClauseCoverageRow,
      ])
    );
    const newCoverageMap = new Map(
      ((newCoverages ?? []) as Array<Record<string, unknown>>).map((c) => [
        (c.coverage_name as string).toLowerCase(),
        c as unknown as ClauseCoverageRow,
      ])
    );

    // Check for new coverages
    for (const [name, newCov] of newCoverageMap) {
      const oldCov = oldCoverageMap.get(name);

      if (!oldCov) {
        // New coverage added
        diffs.push({
          type: 'COVERAGE',
          coverageName: newCov.coverage_name,
          newValue: 'Added',
          impact: 'POSITIVE',
          description: `Nueva cobertura agregada: ${newCov.coverage_name}`,
        });
      } else {
        // Compare deductible changes
        if (oldCov.deductible_text !== newCov.deductible_text) {
          const oldDed = parseDeductibleAmount(oldCov.deductible_text);
          const newDed = parseDeductibleAmount(newCov.deductible_text);

          diffs.push({
            type: 'DEDUCTIBLE',
            coverageName: newCov.coverage_name,
            oldValue: oldCov.deductible_text,
            newValue: newCov.deductible_text,
            impact: newDed > oldDed ? 'NEGATIVE' : 'POSITIVE',
            description: `Deducible cambió de "${oldCov.deductible_text}" a "${newCov.deductible_text}"`,
          });
        }

        // Compare exclusions
        const oldExclusions = oldCov.exclusions || [];
        const newExclusions = newCov.exclusions || [];

        const addedExclusions = newExclusions.filter((e: string) => !oldExclusions.includes(e));
        const removedExclusions = oldExclusions.filter((e: string) => !newExclusions.includes(e));

        for (const exclusion of addedExclusions) {
          diffs.push({
            type: 'EXCLUSION',
            coverageName: newCov.coverage_name,
            newValue: exclusion,
            impact: 'NEGATIVE',
            description: `Nueva exclusión agregada: ${exclusion}`,
          });
        }

        for (const exclusion of removedExclusions) {
          diffs.push({
            type: 'EXCLUSION',
            coverageName: newCov.coverage_name,
            oldValue: exclusion,
            impact: 'POSITIVE',
            description: `Exclusión eliminada: ${exclusion}`,
          });
        }
      }
    }

    // Check for removed coverages
    for (const [name, oldCov] of oldCoverageMap) {
      if (!newCoverageMap.has(name)) {
        diffs.push({
          type: 'COVERAGE',
          coverageName: oldCov.coverage_name,
          oldValue: 'Removed',
          impact: 'NEGATIVE',
          description: `Cobertura eliminada: ${oldCov.coverage_name}`,
        });
      }
    }

    // Calculate summary
    const favorableCount = diffs.filter((d) => d.impact === 'POSITIVE').length;
    const unfavorableCount = diffs.filter((d) => d.impact === 'NEGATIVE').length;
    const neutralCount = diffs.filter((d) => d.impact === 'NEUTRAL').length;

    console.log(`✅ [clauseVersionComparator] Found ${diffs.length} differences`);

    return {
      oldVersion: (oldDocTyped.version as string | undefined) || 'unknown',
      newVersion: (newDocTyped.version as string | undefined) || 'unknown',
      insurerName: (oldDocTyped.insurer_name as string | undefined) || 'Unknown',
      productName: (oldDocTyped.product_name as string | undefined) || 'Unknown',
      diffs,
      favorableCount,
      unfavorableCount,
      neutralCount,
      comparisonDate: new Date().toISOString(),
    };
  },

  /**
   * Get version history for a clause document
   */
  getVersionHistory: async (insurerName: string, productName?: string) => {
    let query = supabase
      .from('documents')
      .select('*, insurers!inner(name)')
      .eq('insurers.name', insurerName);

    if (productName) {
      query = query.eq('product_name', productName);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return ((data ?? []) as Array<Record<string, unknown>>).map((d) => ({
      ...d,
      insurer_name: (d.insurers as Record<string, unknown> | undefined)?.name,
    }));
  },
};

/**
 * Parse deductible amount for comparison
 */
function parseDeductibleAmount(deductibleText: string): number {
  if (!deductibleText) return 0;

  const text = deductibleText.toLowerCase();

  // Percentage
  const percentMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (percentMatch) {
    return parseFloat(percentMatch[1]);
  }

  // SMMLV
  const smmlvMatch = text.match(/(\d+)\s*(?:smmlv|sm)/);
  if (smmlvMatch) {
    return parseFloat(smmlvMatch[1]) * getDomainConstants().smmlv; // Convert to COP
  }

  // Fixed amount
  const fixedMatch = text.match(/[$\s]*(\d+(?:[.,]\d+)*)/);
  if (fixedMatch) {
    const cleaned = fixedMatch[1].replace(/[.,]/g, '');
    return parseFloat(cleaned);
  }

  return 0;
}

export default clauseVersionComparator;
