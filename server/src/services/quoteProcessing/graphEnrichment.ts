/**
 * Graph Enrichment Module
 * Enriches raw extracted coverages with knowledge graph mappings when enabled.
 */

import { featureFlags } from '../../config/featureFlags';
import { coverageGraphService } from '../coverageGraphService';
import { GraphQueryResult } from '../../types/templateGraph';
import { RawCoverage } from '../coverageNormalizer';
import { GraphEnrichedCoverage } from './types';

/**
 * Enriches extracted raw coverages with coverage graph query results.
 */
export async function enrichRawCoveragesWithGraph(
  rawCoverages: RawCoverage[],
  insurer?: string,
  domain: string = 'pyme'
): Promise<GraphEnrichedCoverage[]> {
  if (!featureFlags.isEnabled('useTemplateGraphPipeline')) {
    return rawCoverages as GraphEnrichedCoverage[];
  }

  return Promise.all(
    rawCoverages.map(async (coverage) => {
      try {
        const graphResult: GraphQueryResult = await coverageGraphService.query(coverage.rawName, {
          insurer,
          domain,
        });

        if (graphResult.mappings.length === 0) {
          return coverage as GraphEnrichedCoverage;
        }

        const best = graphResult.mappings[0]!;
        return {
          ...coverage,
          graphConfidence: Math.round(best.confidence * 100),
          graphProvenance: best.provenance,
          isComposite: graphResult.composite,
          graphComponents: graphResult.components,
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `⚠️ [quoteProcessingService] Graph enrichment failed for "${coverage.rawName}": ${message}`
        );
        return coverage as GraphEnrichedCoverage;
      }
    })
  );
}
