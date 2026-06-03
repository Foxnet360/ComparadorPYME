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
  useLegacyCoverageMatcher: false,
  useLegacyDeductibleParser: false,
  useLegacyChatOnlyRAG: false
};

class FeatureFlagManager {
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
    
    // Individual feature overrides
    const featureVars = [
      'STRUCTURED_CLAUSE_EXTRACTION',
      'SEMANTIC_COVERAGE_ONTOLOGY',
      'VARIABLE_COMPARISON_ENGINE',
      'DEDUCTIBLE_SEMANTIC_PARSER',
      'TRIPLE_SOURCE_CHAT',
      'LEARNING_ENGINE',
      'QUERY_EXPANSION',
      'HYBRID_SEARCH_V2',
      'USE_UNIFIED_COMPARISON_ENGINE'
    ];
    
    for (const varName of featureVars) {
      const envValue = process.env[`FEATURE_${varName}`];
      if (envValue !== undefined) {
        const key = varName.toLowerCase().replace(/_/g, '') as keyof FeatureFlags;
        (this.flags as any)[key] = envValue === 'true' || envValue === '1';
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
