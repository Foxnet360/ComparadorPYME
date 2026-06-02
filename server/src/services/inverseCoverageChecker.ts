/**
 * Inverse Coverage Checker
 * Detects coverages that are mandatory in clause documents but omitted in quotes
 */

import { supabase } from '../config/database';
import { ragRetrievalService } from './ragRetrievalService';
import { insurerNameNormalizer } from './insurerNameNormalizer';

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
const MANDATORY_COVERAGES = [
  'incendio (edificio y contenidos)',
  'responsabilidad civil (rce)',
  'lucro cesante'
];

export const inverseCoverageChecker = {
  /**
   * Check for coverages present in clause but missing in quote
   */
  checkMissingCoverages: async (
    quote: any,
    insurerName: string
  ): Promise<InverseCheckSummary> => {
    const normalizedInsurer = insurerNameNormalizer.normalize(insurerName);
    console.log(`🔍 [inverseCoverageChecker] Checking missing coverages for ${insurerName} (normalized: ${normalizedInsurer})...`);
    
    // Get coverages from quote
    const quoteCoverageNames = (quote.coverages || []).map((c: any) => 
      (c.canonicalName || c.name).toLowerCase()
    );
    
    // Extract coverages from clause document
    const clauseCoverages = await extractClauseCoverages(normalizedInsurer);
    
    const results: InverseCoverageResult[] = [];
    let mandatoryMissingCount = 0;
    let optionalMissingCount = 0;
    
    for (const clauseCoverage of clauseCoverages) {
      const existsInQuote = quoteCoverageNames.some((name: string) => 
        isSameCoverage(name, clauseCoverage.name)
      );
      
      if (!existsInQuote) {
        const isMandatory = clauseCoverage.isMandatory || 
          MANDATORY_COVERAGES.some(mc => isSameCoverage(mc, clauseCoverage.name));
        
        const result: InverseCoverageResult = {
          coverageName: clauseCoverage.name,
          isMandatory,
          existsInClause: true,
          existsInQuote: false,
          status: isMandatory ? 'MANDATORY_MISSING' : 'OPTIONAL_MISSING',
          alertLevel: isMandatory ? 'CRITICAL' : 'INFO',
          clauseReference: clauseCoverage.reference
        };
        
        results.push(result);
        
        if (isMandatory) {
          mandatoryMissingCount++;
        } else {
          optionalMissingCount++;
        }
      }
    }
    
    console.log(`✅ [inverseCoverageChecker] Found ${mandatoryMissingCount} mandatory missing, ${optionalMissingCount} optional missing`);
    
    return {
      results,
      mandatoryMissingCount,
      optionalMissingCount,
      totalClauseCoverages: clauseCoverages.length
    };
  }
};

/**
 * Extract coverages from clause document
 */
async function extractClauseCoverages(insurerName: string): Promise<Array<{
  name: string;
  isMandatory: boolean;
  reference?: string;
}>> {
  try {
    const normalizedInsurer = insurerNameNormalizer.normalize(insurerName);
    // First try to get from clause_coverages table via documents and insurers
    const { data: cachedCoverages } = await supabase
      .from('clause_coverages')
      .select('*, documents!inner(id, insurers!inner(name))')
      .eq('documents.insurers.name', normalizedInsurer)
      .order('extracted_at', { ascending: false })
      .limit(50);
    
    if (cachedCoverages && cachedCoverages.length > 0) {
      return (cachedCoverages as any[]).map(c => ({
        name: c.coverage_name,
        isMandatory: c.is_mandatory,
        reference: `Page ${c.page_number}`
      }));
    }
    
    // Fallback: Search for coverage sections in clause document
    const searchTerms = [
      'coberturas',
      'amparos',
      'garantías'
    ];
    
    const allCoverages: Array<{name: string; isMandatory: boolean; reference?: string}> = [];
    
    for (const term of searchTerms) {
      try {
        const clauses = await ragRetrievalService.search(term, {
          insurerName: normalizedInsurer,
          sectionType: 'COBERTURA',
          limit: 5
        });
        
        for (const clause of clauses) {
          // Extract coverage names from chunk
          const coverageMatches = clause.content.match(/(?:cobertura|amparo|garantía)[\s:]+([^\n.]+)/gi);
          if (coverageMatches) {
            for (const match of coverageMatches) {
              const name = match.replace(/(?:cobertura|amparo|garantía)[\s:]+/i, '').trim();
              if (name && name.length > 3) {
                allCoverages.push({
                  name,
                  isMandatory: false,
                  reference: `Page ${clause.pageNumber}`
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
    const unique = allCoverages.filter((c, i, arr) => 
      arr.findIndex(t => isSameCoverage(t.name, c.name)) === i
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
function getExpectedCoverages(): Array<{name: string; isMandatory: boolean; reference?: string}> {
  return [
    { name: 'Incendio (Edificio y Contenidos)', isMandatory: true },
    { name: 'Lucro Cesante', isMandatory: true },
    { name: 'Responsabilidad Civil (RCE)', isMandatory: true },
    { name: 'Sustracción / Hurto', isMandatory: false },
    { name: 'Equipo Eléctrico y Electrónico', isMandatory: false },
    { name: 'Rotura de Maquinaria', isMandatory: false },
    { name: 'Vidrios Planos', isMandatory: false },
    { name: 'Transporte de Mercancías', isMandatory: false },
    { name: 'Transporte de Valores', isMandatory: false }
  ];
}

/**
 * Check if two coverage names are the same
 */
function isSameCoverage(name1: string, name2: string): boolean {
  const normalize = (s: string) => 
    s.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  
  const n1 = normalize(name1);
  const n2 = normalize(name2);
  
  return n1 === n2 || n1.includes(n2) || n2.includes(n1);
}

export default inverseCoverageChecker;
