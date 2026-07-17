/**
 * Feature Flags Configuration
 * Controls activation of new architecture components
 */

export interface FeatureFlags {
  // Core features
  structuredClauseExtraction: boolean;
  semanticCoverageOntology: boolean;
  variableComparisonEngine: boolean;
  deductibleSemanticParser: boolean;
  tripleSourceChat: boolean;
  learningEngine: boolean;
  queryExpansion: boolean;
  hybridSearchV2: boolean;

  // Multimodal V2 extraction (deprecated runtime opt-out; false forces legacy)
  enableMultimodalExtraction: boolean;

  // Template + graph pipeline (new)
  useTemplateGraphPipeline: boolean;
  templateBbvaV1: boolean;
  templateSbsV1: boolean;
  templateMapfreV1: boolean;
  graphLearningEnabled: boolean;

  // Auto-extraction pipeline
  autoExtractStructuredClauses: boolean;

  // Unified Comparison Engine
  useUnifiedComparisonEngine: boolean;
  granularComparisonSchema: boolean;

  // Unified graph canonicalization + template hint slices (master switches).
  // Percentage rollouts are evaluated per request via the *_ROLLOUT env vars
  // declared in UNIFIED_SLICE_ROLLOUT_ENV below.
  useUnifiedGraphCanonicalization: boolean;
  useUnifiedTemplateHints: boolean;
  useUnifiedTemplateHintsBbva: boolean;
  useUnifiedTemplateHintsSbs: boolean;
  useUnifiedTemplateHintsMapfre: boolean;

  // Backward compatibility
  useLegacyCoverageMatcher: boolean;
  useLegacyDeductibleParser: boolean;
  useLegacyChatOnlyRAG: boolean;
}

// Check if Redis is configured
const redisAvailable = !!process.env.REDIS_URL;

// Default configuration - all new features enabled (with dependency checks)
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  structuredClauseExtraction: true,
  semanticCoverageOntology: true,
  variableComparisonEngine: true,
  deductibleSemanticParser: true,
  tripleSourceChat: true,
  learningEngine: redisAvailable, // Only enable if Redis is configured
  queryExpansion: true,
  hybridSearchV2: true,

  // Multimodal V2 extraction: default true; set ENABLE_MULTIMODAL_EXTRACTION=false for emergency legacy-only fallback
  enableMultimodalExtraction: true,

  // Template + graph pipeline (disabled by default for safe rollout)
  useTemplateGraphPipeline: false,
  templateBbvaV1: false,
  templateSbsV1: false,
  templateMapfreV1: false,
  graphLearningEnabled: false,

  // Auto-extraction pipeline (disabled by default for safe rollout)
  autoExtractStructuredClauses: false,

  // Unified Comparison Engine (enabled by default).
  // - USE_UNIFIED_ENGINE=true  (default) routes /api/analyze through the unified
  //   single-call engine first and falls back to the legacy per-quote pipeline
  //   only when the unified engine fails.
  // - USE_UNIFIED_ENGINE=false forces the legacy per-quote pipeline for every
  //   request.
  // Rollback: set USE_UNIFIED_ENGINE=false in the environment (or revert the
  // feature-flag commit) and redeploy. No database migration is required.
  useUnifiedComparisonEngine: true,
  // Granular comparison schema (disabled by default).
  // - GRANULAR_COMPARISON_SCHEMA=true enables the section-aware v2 schema with
  //   sub-rows and derived per-cell confidence.
  // - GRANULAR_COMPARISON_SCHEMA=false keeps the legacy four-row v1 schema.
  // Rollback: set GRANULAR_COMPARISON_SCHEMA=false. Cached v1 results without
  // schemaVersion continue to render through the legacy path.
  granularComparisonSchema: true,

  // Unified graph/template slices (disabled by default for safe rollout).
  // Rollback: set the boolean env var to false and/or the matching *_ROLLOUT
  // percentage to 0. No redeploy is required for rollout-only changes.
  useUnifiedGraphCanonicalization: false,
  useUnifiedTemplateHints: false,
  useUnifiedTemplateHintsBbva: false,
  useUnifiedTemplateHintsSbs: false,
  useUnifiedTemplateHintsMapfre: false,

  // Backward compatibility flags (for gradual migration)
  useLegacyCoverageMatcher: false,
  useLegacyDeductibleParser: false,
  useLegacyChatOnlyRAG: false,
};

// Development configuration - for testing
export const DEVELOPMENT_FLAGS: FeatureFlags = {
  ...DEFAULT_FEATURE_FLAGS,
  learningEngine: false, // Disable in dev to avoid side effects
  granularComparisonSchema: true, // Keep disabled by default until verified
};

// Production rollout configuration - gradual activation
export const PRODUCTION_ROLLOUT_FLAGS: FeatureFlags = {
  ...DEFAULT_FEATURE_FLAGS,
  structuredClauseExtraction: true,
  semanticCoverageOntology: true,
  variableComparisonEngine: true,
  deductibleSemanticParser: true,
  tripleSourceChat: true,
  learningEngine: true,
  queryExpansion: true,
  hybridSearchV2: true,
  useTemplateGraphPipeline: false,
  templateBbvaV1: false,
  templateSbsV1: false,
  templateMapfreV1: false,
  graphLearningEnabled: false,
  useUnifiedGraphCanonicalization: false,
  useUnifiedTemplateHints: false,
  useUnifiedTemplateHintsBbva: false,
  useUnifiedTemplateHintsSbs: false,
  useUnifiedTemplateHintsMapfre: false,
  useLegacyCoverageMatcher: false,
  useLegacyDeductibleParser: false,
  useLegacyChatOnlyRAG: false,
  granularComparisonSchema: true,
};

// Maps recognized env var names to FeatureFlags keys. Fixes the old key
// derivation bug (lowercase + strip underscores did not match camelCase keys).
const ENV_FLAG_MAP: Record<string, keyof FeatureFlags> = {
  FEATURE_STRUCTURED_CLAUSE_EXTRACTION: 'structuredClauseExtraction',
  FEATURE_SEMANTIC_COVERAGE_ONTOLOGY: 'semanticCoverageOntology',
  FEATURE_VARIABLE_COMPARISON_ENGINE: 'variableComparisonEngine',
  FEATURE_DEDUCTIBLE_SEMANTIC_PARSER: 'deductibleSemanticParser',
  FEATURE_TRIPLE_SOURCE_CHAT: 'tripleSourceChat',
  FEATURE_LEARNING_ENGINE: 'learningEngine',
  FEATURE_QUERY_EXPANSION: 'queryExpansion',
  FEATURE_HYBRID_SEARCH_V2: 'hybridSearchV2',
  ENABLE_MULTIMODAL_EXTRACTION: 'enableMultimodalExtraction',
  // Legacy alias kept for backward compatibility; prefer USE_UNIFIED_ENGINE.
  FEATURE_USE_UNIFIED_COMPARISON_ENGINE: 'useUnifiedComparisonEngine',
  // Canonical env name for the unified comparison engine toggle.
  // See DEFAULT_FEATURE_FLAGS.useUnifiedComparisonEngine for usage/rollback docs.
  USE_UNIFIED_ENGINE: 'useUnifiedComparisonEngine',
  GRANULAR_COMPARISON_SCHEMA: 'granularComparisonSchema',
  FEATURE_AUTO_EXTRACT_STRUCTURED_CLAUSES: 'autoExtractStructuredClauses',
  USE_TEMPLATE_GRAPH_PIPELINE: 'useTemplateGraphPipeline',
  TEMPLATE_BBVA_V1: 'templateBbvaV1',
  TEMPLATE_SBS_V1: 'templateSbsV1',
  TEMPLATE_MAPFRE_V1: 'templateMapfreV1',
  GRAPH_LEARNING_ENABLED: 'graphLearningEnabled',
  USE_UNIFIED_GRAPH_CANONICALIZATION: 'useUnifiedGraphCanonicalization',
  USE_UNIFIED_TEMPLATE_HINTS: 'useUnifiedTemplateHints',
  USE_UNIFIED_TEMPLATE_HINTS_BBVA: 'useUnifiedTemplateHintsBbva',
  USE_UNIFIED_TEMPLATE_HINTS_SBS: 'useUnifiedTemplateHintsSbs',
  USE_UNIFIED_TEMPLATE_HINTS_MAPFRE: 'useUnifiedTemplateHintsMapfre',
};

/**
 * Env var names for the request-time percentage rollouts (0-100) of the
 * unified graph/template slices. Re-read on every evaluation so rollout
 * changes take effect without a redeploy.
 */
export const UNIFIED_SLICE_ROLLOUT_ENV = {
  graphCanonicalization: 'USE_UNIFIED_GRAPH_CANONICALIZATION_ROLLOUT',
  templateHints: 'USE_UNIFIED_TEMPLATE_HINTS_ROLLOUT',
  templateHintsBbva: 'USE_UNIFIED_TEMPLATE_HINTS_BBVA_ROLLOUT',
  templateHintsSbs: 'USE_UNIFIED_TEMPLATE_HINTS_SBS_ROLLOUT',
  templateHintsMapfre: 'USE_UNIFIED_TEMPLATE_HINTS_MAPFRE_ROLLOUT',
} as const;

export type UnifiedSliceRolloutKey = keyof typeof UNIFIED_SLICE_ROLLOUT_ENV;

/** Parse a rollout env value to an integer clamped to 0-100 (default 0). */
export function parseRolloutPercentage(raw: string | undefined): number {
  if (raw === undefined) {
    return 0;
  }
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return Math.min(100, Math.max(0, parsed));
}

/** Current rollout percentage for a slice, read from process.env at call time. */
export function getUnifiedSliceRolloutPercentage(slice: UnifiedSliceRolloutKey): number {
  return parseRolloutPercentage(process.env[UNIFIED_SLICE_ROLLOUT_ENV[slice]]);
}

export class FeatureFlagManager {
  private flags: FeatureFlags;

  constructor(flags: FeatureFlags = DEFAULT_FEATURE_FLAGS) {
    this.flags = { ...flags };

    // Override from environment variables if present
    this.loadFromEnvironment();

    // Log feature flags on startup
    this.logFeatureFlags();
  }

  private logFeatureFlags(): void {
    console.log('🚩 [FeatureFlags] Configuration:');
    const flags = this.getFlags();
    Object.entries(flags).forEach(([key, value]) => {
      const status = value ? '✅' : '❌';
      console.log(`   ${status} ${key}: ${value}`);
    });

    // Log any auto-disabled features
    if (!redisAvailable && flags.learningEngine) {
      console.warn(
        '⚠️ [FeatureFlags] learningEngine was disabled because REDIS_URL is not configured'
      );
    }
  }

  private loadFromEnvironment(): void {
    const envFlags = process.env.FEATURE_FLAGS;
    if (envFlags) {
      try {
        const parsed = JSON.parse(envFlags);
        this.flags = { ...this.flags, ...parsed };
      } catch (error) {
        console.error('❌ [FeatureFlags] Failed to parse FEATURE_FLAGS:', error);
      }
    }

    // Individual feature overrides via explicit env var → key mapping.
    for (const [envName, flagKey] of Object.entries(ENV_FLAG_MAP)) {
      const envValue = process.env[envName];
      if (envValue !== undefined) {
        this.flags[flagKey] = envValue === 'true' || envValue === '1';
      }
    }
  }

  isEnabled(feature: keyof FeatureFlags): boolean {
    return this.flags[feature];
  }

  getFlags(): FeatureFlags {
    return { ...this.flags };
  }

  updateFlag(feature: keyof FeatureFlags, enabled: boolean): void {
    this.flags[feature] = enabled;
    console.log(`🚩 [FeatureFlags] ${feature} = ${enabled}`);
  }

  // Check if any legacy mode is active
  isLegacyMode(): boolean {
    return (
      this.flags.useLegacyCoverageMatcher ||
      this.flags.useLegacyDeductibleParser ||
      this.flags.useLegacyChatOnlyRAG
    );
  }
}

export const featureFlags = new FeatureFlagManager();

export default featureFlags;
