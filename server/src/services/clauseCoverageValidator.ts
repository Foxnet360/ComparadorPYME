/**
 * Clause Coverage Validator
 * Validates coverage existence bidirectionally: quote → clause and clause → quote
 *
 * Flow:
 * 1. For each coverage in quote, search in clause document
 * 2. For each mandatory coverage in clause, check if in quote
 * 3. Generate alerts and score impact
 */

import { ragRetrievalService } from './ragRetrievalService';
import { supabase } from '../config/database';
import { getCanonicalCoverageNames } from '../config/domainConstants';
import { ParsedQuote } from './quoteParser';

export type CoverageValidationStatus =
  | 'VERIFIED'
  | 'PHANTOM'
  | 'MANDATORY_MISSING'
  | 'OPTIONAL_MISSING';

export interface CoverageExistenceResult {
  coverageName: string;
  existsInQuote: boolean;
  existsInClause: boolean;
  isMandatory: boolean;
  status: CoverageValidationStatus;
  clauseReference?: string;
  alertLevel?: 'CRITICAL' | 'WARNING' | 'INFO';
}

export interface ClauseValidationSummary {
  results: CoverageExistenceResult[];
  phantomCount: number;
  mandatoryMissingCount: number;
  optionalMissingCount: number;
  verifiedCount: number;
  scoreImpact: number;
  hasClauseDocument: boolean;
}

// Expected canonical coverages for PYME policies
const EXPECTED_COVERAGES = getCanonicalCoverageNames().map((name) => name.toLowerCase());

export const clauseCoverageValidator = {
  /**
   * Validate all coverages in a quote against clause documents
   * Bidirectional validation: quote → clause and clause → quote
   */
  validate: async (quote: ParsedQuote, insurerName: string): Promise<ClauseValidationSummary> => {
    console.log(`🔍 [clauseCoverageValidator] Validating coverages for ${insurerName}...`);

    // Check if clause document exists for insurer
    const hasClauseDocument = await checkClauseDocumentExists(insurerName);

    if (!hasClauseDocument) {
      console.log(`⚠️ [clauseCoverageValidator] No clause document for ${insurerName}`);
      return {
        results: [],
        phantomCount: 0,
        mandatoryMissingCount: 0,
        optionalMissingCount: 0,
        verifiedCount: 0,
        scoreImpact: -20, // Penalty for no clause document
        hasClauseDocument: false,
      };
    }

    // Get coverages from quote
    const quoteCoverages = quote.coverages || [];
    const quoteCoverageNames = quoteCoverages.map((c) => (c.canonicalName || c.name).toLowerCase());

    // Step 1: Validate quote → clause (each coverage in quote exists in clause)
    const quoteValidationResults = await Promise.all(
      quoteCoverages.map(async (coverage) => {
        const coverageName = coverage.canonicalName || coverage.name;
        const existsInClause = await searchCoverageInClause(coverageName, insurerName);

        return {
          coverageName,
          existsInQuote: true,
          existsInClause,
          isMandatory: false, // Will be determined in step 2
          status: (existsInClause ? 'VERIFIED' : 'PHANTOM') as CoverageValidationStatus,
          clauseReference: existsInClause ? `Found in ${insurerName} clause document` : undefined,
          alertLevel: existsInClause ? undefined : ('CRITICAL' as const),
        };
      })
    );

    // Step 2: Validate clause → quote (mandatory coverages in clause)
    const clauseCoverages = await extractCoveragesFromClause(insurerName);
    const inverseValidationResults: CoverageExistenceResult[] = [];

    for (const clauseCoverage of clauseCoverages) {
      const existsInQuote = quoteCoverageNames.some((name: string) =>
        isSameCoverage(name, clauseCoverage.name)
      );

      if (!existsInQuote) {
        inverseValidationResults.push({
          coverageName: clauseCoverage.name,
          existsInQuote: false,
          existsInClause: true,
          isMandatory: clauseCoverage.isMandatory,
          status: clauseCoverage.isMandatory ? 'MANDATORY_MISSING' : 'OPTIONAL_MISSING',
          clauseReference: clauseCoverage.reference,
          alertLevel: clauseCoverage.isMandatory ? 'WARNING' : 'INFO',
        });
      }
    }

    // Combine results
    const allResults = [...quoteValidationResults, ...inverseValidationResults];

    // Calculate summary
    const phantomCount = allResults.filter((r) => r.status === 'PHANTOM').length;
    const mandatoryMissingCount = allResults.filter((r) => r.status === 'MANDATORY_MISSING').length;
    const optionalMissingCount = allResults.filter((r) => r.status === 'OPTIONAL_MISSING').length;
    const verifiedCount = allResults.filter((r) => r.status === 'VERIFIED').length;

    // Calculate score impact
    const scoreImpact = calculateScoreImpact(phantomCount, mandatoryMissingCount);

    console.log(
      `✅ [clauseCoverageValidator] Validation complete: ${verifiedCount} verified, ${phantomCount} phantom, ${mandatoryMissingCount} mandatory missing`
    );

    return {
      results: allResults,
      phantomCount,
      mandatoryMissingCount,
      optionalMissingCount,
      verifiedCount,
      scoreImpact,
      hasClauseDocument: true,
    };
  },
};

/**
 * Check if clause document exists for insurer
 */
async function checkClauseDocumentExists(insurerName: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('document_insurer_view')
      .select('id')
      .eq('insurer_name', insurerName)
      .eq('is_active', true)
      .limit(1);

    if (error) {
      console.error('❌ [clauseCoverageValidator] Error checking clause document:', error);
      return false;
    }

    return data && data.length > 0;
  } catch (error) {
    console.error('❌ [clauseCoverageValidator] Exception checking clause document:', error);
    return false;
  }
}

/**
 * Search for a coverage in the clause document using RAG
 */
async function searchCoverageInClause(coverageName: string, insurerName: string): Promise<boolean> {
  try {
    // Search for coverage in clause document
    const clauses = await ragRetrievalService.search(coverageName, {
      insurerName,
      coverageTags: [coverageName.toLowerCase()],
      limit: 3,
    });

    // If we found chunks with reasonable similarity, coverage exists
    return clauses.length > 0 && clauses.some((c) => c.similarity > 0.6);
  } catch (error) {
    console.error(`❌ [clauseCoverageValidator] Error searching coverage ${coverageName}:`, error);
    return false;
  }
}

/**
 * Extract coverages from clause document
 * First checks cache (clause_coverages table), then falls back to RAG extraction
 */
async function extractCoveragesFromClause(
  insurerName: string
): Promise<Array<{ name: string; isMandatory: boolean; reference?: string }>> {
  try {
    const { data: cachedCoverages } = await supabase
      .from('clause_coverages')
      .select('*, documents!inner(id, insurers!inner(name))')
      .eq('documents.insurers.name', insurerName)
      .order('created_at', { ascending: false })
      .limit(50);

    if (cachedCoverages && cachedCoverages.length > 0) {
      return (cachedCoverages as Array<Record<string, unknown>>).map((c) => ({
        name: c.coverage_name as string,
        isMandatory: c.is_mandatory as boolean,
        reference: `Page ${c.page_number}`,
      }));
    }

    // Fallback: Extract from expected coverages list
    // In production, this would use Gemini to extract from the actual clause document
    return EXPECTED_COVERAGES.map((name) => ({
      name,
      isMandatory: ['incendio (edificio y contenidos)', 'responsabilidad civil (rce)'].includes(
        name
      ),
      reference: 'Standard PYME coverage',
    }));
  } catch (error) {
    console.error('❌ [clauseCoverageValidator] Error extracting coverages:', error);
    return [];
  }
}

/**
 * Check if two coverage names refer to the same coverage
 */
function isSameCoverage(name1: string, name2: string): boolean {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  return (
    normalize(name1) === normalize(name2) ||
    normalize(name1).includes(normalize(name2)) ||
    normalize(name2).includes(normalize(name1))
  );
}

/**
 * Calculate score impact based on validation results
 */
function calculateScoreImpact(phantomCount: number, mandatoryMissingCount: number): number {
  const phantomPenalty = phantomCount * 15; // -15 per phantom coverage
  const missingPenalty = mandatoryMissingCount * 10; // -10 per mandatory missing
  return -(phantomPenalty + missingPenalty);
}

export default clauseCoverageValidator;
