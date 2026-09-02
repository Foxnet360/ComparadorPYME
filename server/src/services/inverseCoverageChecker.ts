/**
 * Inverse Coverage Checker
 * Detects coverages that are mandatory in clause documents but omitted in quotes
 */

import { supabase } from '../config/database';
import { ragRetrievalService } from './ragRetrievalService';
import { getCanonicalCoverageNames } from '../config/domainConstants';
import { ParsedQuote } from './quoteParser';

export interface InverseCoverageResult {
  coverageName: string;
  isMandatory: boolean;
  existsInClause: boolean;
  existsInQuote: boolean;
  status: 'PRESENT' | 'MANDATORY_MISSING' | 'OPTIONAL_MISSING';
  alertLevel?: 'CRITICAL' | 'INFO';
  clauseReference?: string;
}

export interface InverseCheckSummary {
  results: InverseCoverageResult[];
  mandatoryMissingCount: number;
  optionalMissingCount: number;
  totalClauseCoverages: number;
}

// Expected mandatory coverages for PYME policies
function getMandatoryCoverageNames(): string[] {
  const canonical = getCanonicalCoverageNames();
  // Canonical order is stable: Incendio, Lucro Cesante, ..., Responsabilidad Civil (RCE) at index 5
  const mandatoryIndices = [0, 1, 5];
  return mandatoryIndices.map((i) => canonical[i]?.toLowerCase()).filter((name): name is string => Boolean(name));
}

export const inverseCoverageChecker = {
  /**
   * Check for coverages present in clause but missing in quote
   */
  checkMissingCoverages: async (
    quote: ParsedQuote,
    insurerName: string
  ): Promise<InverseCheckSummary> => {
    console.log(`🔍 [inverseCoverageChecker] Checking missing coverages for ${insurerName}...`);

    // Get coverages from quote
    const quoteCoverageNames = (quote.coverages || []).map((c) =>
      (c.canonicalName || c.name).toLowerCase()
    );

    // Extract coverages from clause document
    const clauseCoverages = await extractClauseCoverages(insurerName);

    const results: InverseCoverageResult[] = [];
    let mandatoryMissingCount = 0;
    let optionalMissingCount = 0;

    for (const clauseCoverage of clauseCoverages) {
      const existsInQuote = quoteCoverageNames.some((name: string) =>
        isSameCoverage(name, clauseCoverage.name)
      );

      if (!existsInQuote) {
        const isMandatory =
          clauseCoverage.isMandatory ||
          getMandatoryCoverageNames().some((mc) => isSameCoverage(mc, clauseCoverage.name));

        const result: InverseCoverageResult = {
          coverageName: clauseCoverage.name,
          isMandatory,
          existsInClause: true,
          existsInQuote: false,
          status: isMandatory ? 'MANDATORY_MISSING' : 'OPTIONAL_MISSING',
          alertLevel: isMandatory ? 'CRITICAL' : 'INFO',
          clauseReference: clauseCoverage.reference,
        };

        results.push(result);

        if (isMandatory) {
          mandatoryMissingCount++;
        } else {
          optionalMissingCount++;
        }
      }
    }

    console.log(
      `✅ [inverseCoverageChecker] Found ${mandatoryMissingCount} mandatory missing, ${optionalMissingCount} optional missing`
    );

    return {
      results,
      mandatoryMissingCount,
      optionalMissingCount,
      totalClauseCoverages: clauseCoverages.length,
    };
  },
};

/**
 * Extract coverages from clause document
 */
async function extractClauseCoverages(insurerName: string): Promise<
  Array<{
    name: string;
    isMandatory: boolean;
    reference?: string;
  }>
> {
  try {
    // First try to get from clause_coverages table via documents and insurers
    const { data: cachedCoverages } = await supabase
      .from('clause_coverages')
      .select('*, documents!inner(id, insurers!inner(name))')
      .eq('documents.insurers.name', insurerName)
      .order('extracted_at', { ascending: false })
      .limit(50);

    if (cachedCoverages && cachedCoverages.length > 0) {
      return (cachedCoverages as Array<Record<string, unknown>>).map((c) => ({
        name: c.coverage_name as string,
        isMandatory: c.is_mandatory as boolean,
        reference: `Page ${c.page_number}`,
      }));
    }

    // Fallback: Search for coverage sections in clause document
    const searchTerms = ['coberturas', 'amparos', 'garantías'];

    const allCoverages: Array<{ name: string; isMandatory: boolean; reference?: string }> = [];

    for (const term of searchTerms) {
      try {
        const clauses = await ragRetrievalService.search(term, {
          insurerName,
          sectionType: 'COBERTURA',
          limit: 5,
        });

        for (const clause of clauses) {
          // Extract coverage names from chunk
          const coverageMatches = clause.content.match(
            /(?:cobertura|amparo|garantía)[\s:]+([^\n.]+)/gi
          );
          if (coverageMatches) {
            for (const match of coverageMatches) {
              const name = match.replace(/(?:cobertura|amparo|garantía)[\s:]+/i, '').trim();
              if (name && name.length > 3) {
                allCoverages.push({
                  name,
                  isMandatory: false,
                  reference: `Page ${clause.pageNumber}`,
                });
              }
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️ Error searching for ${term}:`, error);
      }
    }

    // If still no coverages, return expected list as fallback
    if (allCoverages.length === 0) {
      return getExpectedCoverages();
    }

    // Remove duplicates
    const unique = allCoverages.filter(
      (c, i, arr) => arr.findIndex((t) => isSameCoverage(t.name, c.name)) === i
    );

    return unique;
  } catch (error) {
    console.error('❌ [inverseCoverageChecker] Error extracting clause coverages:', error);
    return getExpectedCoverages();
  }
}

/**
 * Get expected coverages as fallback
 */
function getExpectedCoverages(): Array<{ name: string; isMandatory: boolean; reference?: string }> {
  const canonical = getCanonicalCoverageNames();
  const mandatory = new Set(getMandatoryCoverageNames());
  return canonical.slice(0, 9).map((name) => ({
    name,
    isMandatory: mandatory.has(name.toLowerCase()),
  }));
}

/**
 * Check if two coverage names are the same
 */
function isSameCoverage(name1: string, name2: string): boolean {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

  const n1 = normalize(name1);
  const n2 = normalize(name2);

  return n1 === n2 || n1.includes(n2) || n2.includes(n1);
}

export default inverseCoverageChecker;
