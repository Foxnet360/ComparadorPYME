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

  // Unified Comparison Engine (disabled by default for safe rollout)
  useUnifiedComparisonEngine: false,

  // Backward compatibility flags (for gradual migration)
  useLegacyCoverageMatcher: false,
  useLegacyDeductibleParser: false,
  useLegacyChatOnlyRAG: false
};

// Development configuration - for testing
export const DEVELOPMENT_FLAGS: FeatureFlags = {
  ...DEFAULT_FEATURE_FLAGS,
  learningEngine: false, // Disable in dev to avoid side effects
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
  useLegacyCoverageMatcher: false,
  useLegacyDeductibleParser: false,
  useLegacyChatOnlyRAG: false
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
  FEATURE_USE_UNIFIED_COMPARISON_ENGINE: 'useUnifiedComparisonEngine',
  FEATURE_AUTO_EXTRACT_STRUCTURED_CLAUSES: 'autoExtractStructuredClauses',
  USE_TEMPLATE_GRAPH_PIPELINE: 'useTemplateGraphPipeline',
  TEMPLATE_BBVA_V1: 'templateBbvaV1',
  TEMPLATE_SBS_V1: 'templateSbsV1',
  TEMPLATE_MAPFRE_V1: 'templateMapfreV1',
  GRAPH_LEARNING_ENABLED: 'graphLearningEnabled',
};

export class FeatureFlagManager {
  private flags: FeatureFlags;
  
  constructor(flags: FeatureFlags = DEFAULT_FEATURE_FLAGS) {
    this.flags = { ...flags };
    
    // Override from environment variables if present
    this.loadFromEnvironment();
    
    // Force useUnifiedComparisonEngine to false to prevent regressions in production
    this.flags.useUnifiedComparisonEngine = false;
    
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
      console.warn('⚠️ [FeatureFlags] learningEngine was disabled because REDIS_URL is not configured');
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
        (this.flags as any)[flagKey] = envValue === 'true' || envValue === '1';
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
    (this.flags as any)[feature] = enabled;
    console.log(`🚩 [FeatureFlags] ${feature} = ${enabled}`);
  }
  
  // Check if any legacy mode is active
  isLegacyMode(): boolean {
    return this.flags.useLegacyCoverageMatcher || 
           this.flags.useLegacyDeductibleParser || 
           this.flags.useLegacyChatOnlyRAG;
  }
}

export const featureFlags = new FeatureFlagManager();

export default featureFlags;
