import { CoverageVariables } from '../types/analysis';
import { coverageOntology } from './coverageOntology';

export interface VariableComparison {
  groupName: string;
  groupId: string;
  variables: Array<{
    insurerName: string;
    rawName: string;
    insuredAmount?: {
      value: number;
      currency: string;
      rawText: string;
    };
    deductible?: {
      components: Array<{
        type: string;
        value: number;
        currency?: string;
      }>;
      normalized: {
        minAmount: number;
        maxAmount: number;
        percentage: number;
      };
      rawText: string;
    };
    sublimit?: {
      value: number;
      type: string;
      rawText: string;
    };
    exclusions: string[];
    conditions: string[];
    confidence: number;
  }>;
  analysis: {
    bestInsuredAmount?: string;
    bestDeductible?: string;
    mostComprehensive?: string;
    bestPrice?: string;
  };
  exclusiveCoverages: Array<{
    insurerName: string;
    rawName: string;
  }>;
}

export interface ComparisonWeights {
  insuredAmount: number;
  deductible: number;
  exclusions: number;
  price: number;
}

const DEFAULT_WEIGHTS: ComparisonWeights = {
  insuredAmount: 0.25,
  deductible: 0.25,
  exclusions: 0.25,
  price: 0.25
};

export const variableComparator = {
  /**
   * Compare variables across quotes for similar coverages
   */
  async compareQuotes(
    quotes: Array<{
      insurerName: string;
      coverages: CoverageVariables[];
    }>,
    weights: ComparisonWeights = DEFAULT_WEIGHTS
  ): Promise<VariableComparison[]> {
    console.log(`🔍 [VariableComparator] Comparing ${quotes.length} quotes...`);
    
    // Group coverages by semantic similarity
    const allCoverages = quotes.flatMap(q => 
      q.coverages.map(c => ({
        ...c,
        insurerName: q.insurerName
      }))
    );
    
    const groups = await coverageOntology.groupCoverages(
      allCoverages.map(c => ({
        name: c.rawName || c.displayName || 'Unknown',
        insurerName: c.insurerName
      }))
    );
    
    const comparisons: VariableComparison[] = [];
    
    for (const group of groups) {
      const groupId = await this.getGroupId(group.groupName);
      
      // Find full coverage data for each item in group
      const coverageVariables = group.coverages.map(gc => {
        const fullCoverage = allCoverages.find(c => 
          c.insurerName === gc.insurerName && 
          (c.rawName === gc.name || c.displayName === gc.name)
        );
        
        return {
          insurerName: gc.insurerName,
          rawName: gc.name,
          insuredAmount: fullCoverage?.insuredAmount,
          deductible: fullCoverage?.deductible,
          sublimit: fullCoverage?.sublimit,
          exclusions: fullCoverage?.exclusions || [],
          conditions: fullCoverage?.conditions || [],
          confidence: gc.confidence
        };
      });
      
      // Identify exclusive coverages
      const exclusiveCoverages = this.findExclusiveCoverages(
        group.coverages,
        allCoverages
      );
      
      // Analyze best values
      const analysis = this.analyzeGroup(coverageVariables, weights);
      
      comparisons.push({
        groupName: group.groupName,
        groupId,
        variables: coverageVariables,
        analysis,
        exclusiveCoverages
      });
    }
    
    // Add ungrouped coverages as exclusive
    const groupedNames = new Set(groups.flatMap(g => g.coverages.map(c => `${c.insurerName}-${c.name}`)));
    const ungrouped = allCoverages.filter(c => !groupedNames.has(`${c.insurerName}-${c.rawName || c.displayName}`));
    
    for (const coverage of ungrouped) {
      comparisons.push({
        groupName: coverage.displayName || coverage.rawName || 'Unclassified',
        groupId: 'unclassified',
        variables: [{
          insurerName: coverage.insurerName,
          rawName: coverage.rawName || coverage.displayName || '',
          insuredAmount: coverage.insuredAmount,
          deductible: coverage.deductible,
          sublimit: coverage.sublimit,
          exclusions: coverage.exclusions || [],
          conditions: coverage.conditions || [],
          confidence: 0.5
        }],
        analysis: {},
        exclusiveCoverages: [{
          insurerName: coverage.insurerName,
          rawName: coverage.rawName || coverage.displayName || ''
        }]
      });
    }
    
    return comparisons;
  },

  /**
   * Find coverages that are exclusive to one insurer
   */
  findExclusiveCoverages(
    groupCoverages: Array<{ name: string; insurerName: string }>,
    allCoverages: Array<CoverageVariables & { insurerName: string }>
  ): Array<{ insurerName: string; rawName: string }> {
    const insurers = [...new Set(groupCoverages.map(c => c.insurerName))];
    
    if (insurers.length <= 1) return [];
    
    const exclusive: Array<{ insurerName: string; rawName: string }> = [];
    
    for (const coverage of groupCoverages) {
      const otherInsurers = insurers.filter(i => i !== coverage.insurerName);
      const hasInOthers = otherInsurers.some(oi => 
        groupCoverages.some(c => c.insurerName === oi)
      );
      
      if (!hasInOthers) {
        exclusive.push({
          insurerName: coverage.insurerName,
          rawName: coverage.name
        });
      }
    }
    
    return exclusive;
  },

  /**
   * Analyze which insurer has best values for each variable
   */
  analyzeGroup(
    variables: Array<{
      insurerName: string;
      insuredAmount?: { value: number };
      deductible?: { normalized: { minAmount: number } };
      exclusions: string[];
    }>,
    weights: ComparisonWeights
  ): {
    bestInsuredAmount?: string;
    bestDeductible?: string;
    mostComprehensive?: string;
    bestPrice?: string;
  } {
    const analysis: {
      bestInsuredAmount?: string;
      bestDeductible?: string;
      mostComprehensive?: string;
      bestPrice?: string;
    } = {};
    
    // Best insured amount (highest)
    const withAmount = variables.filter(v => v.insuredAmount?.value);
    if (withAmount.length > 0) {
      const best = withAmount.reduce((a, b) => 
        (a.insuredAmount?.value || 0) > (b.insuredAmount?.value || 0) ? a : b
      );
      analysis.bestInsuredAmount = best.insurerName;
    }
    
    // Best deductible (lowest)
    const withDeductible = variables.filter(v => v.deductible?.normalized?.minAmount !== undefined);
    if (withDeductible.length > 0) {
      const best = withDeductible.reduce((a, b) => 
        (a.deductible?.normalized?.minAmount || Infinity) < (b.deductible?.normalized?.minAmount || Infinity) ? a : b
      );
      analysis.bestDeductible = best.insurerName;
    }
    
    // Most comprehensive (fewest exclusions)
    const withExclusions = variables.filter(v => v.exclusions);
    if (withExclusions.length > 0) {
      const best = withExclusions.reduce((a, b) => 
        (a.exclusions?.length || Infinity) < (b.exclusions?.length || Infinity) ? a : b
      );
      analysis.mostComprehensive = best.insurerName;
    }
    
    return analysis;
  },

  /**
   * Get group ID from group name
   */
  async getGroupId(groupName: string): Promise<string> {
    const nodes = coverageOntology.findNodesByName(groupName);
    return nodes.length > 0 ? nodes[0].id : 'unknown';
  },

  /**
   * Generate comparison matrix for frontend
   */
  generateComparisonMatrix(
    comparisons: VariableComparison[]
  ): Array<{
    variable: string;
    [insurer: string]: any;
  }> {
    const insurers = [...new Set(
      comparisons.flatMap(c => c.variables.map(v => v.insurerName))
    )];
    
    const matrix: Array<{
      variable: string;
      [insurer: string]: any;
    }> = [];
    
    for (const comparison of comparisons) {
      const row: any = {
        variable: comparison.groupName,
        groupId: comparison.groupId
      };
      
      for (const insurer of insurers) {
        const variable = comparison.variables.find(v => v.insurerName === insurer);
        
        if (variable) {
          row[insurer] = {
            insuredAmount: variable.insuredAmount,
            deductible: variable.deductible,
            sublimit: variable.sublimit,
            exclusions: variable.exclusions,
            confidence: variable.confidence
          };
        } else {
          row[insurer] = null;
        }
      }
      
      matrix.push(row);
    }
    
    return matrix;
  }
};

export default variableComparator;
