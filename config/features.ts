/**
 * Feature Flags Configuration
 * 
 * Controls which advanced analysis features are enabled.
 * Set via environment variables at build time.
 */

export const FEATURES = {
  /**
   * Enable advanced analysis tab and features
   * When true: shows "Análisis Avanzado" tab with clause validation, 
   * deductible risk, contextual analysis, and legal opinions
   * When false: only basic analysis is shown (backward compatible)
   */
  ADVANCED_ANALYSIS: import.meta.env.VITE_ENABLE_ADVANCED_ANALYSIS === 'true',
  
  /**
   * Enable clause coverage validation metrics in dashboard
   * Shows verified/phantom/missing coverage counts
   */
  CLAUSE_VALIDATION: import.meta.env.VITE_ENABLE_ADVANCED_ANALYSIS === 'true',
  
  /**
   * Enable deductible risk analysis visualization
   * Shows risk gauges for each deductible
   */
  DEDUCTIBLE_RISK: import.meta.env.VITE_ENABLE_ADVANCED_ANALYSIS === 'true',
  
  /**
   * Enable contextual risk analysis
   * Shows risk cards based on client profile and exclusions
   */
  CONTEXTUAL_RISK: import.meta.env.VITE_ENABLE_ADVANCED_ANALYSIS === 'true',
  
  /**
   * Enable warranty compliance dashboard
   * Shows compliance analysis for special conditions
   */
  WARRANTY_COMPLIANCE: import.meta.env.VITE_ENABLE_ADVANCED_ANALYSIS === 'true',
  
  /**
   * Enable legal opinions and negotiation points
   * Shows AI-generated legal analysis and negotiation suggestions
   */
  LEGAL_OPINION: import.meta.env.VITE_ENABLE_ADVANCED_ANALYSIS === 'true',
  
  /**
   * Enable multimodal PDF extraction using Gemini 2.5 Pro vision
   * When true: uses File API + vision for better table extraction
   * When false: uses legacy text-based extraction
   * Default: true (V2 deployed at 100%)
   */
  MULTIMODAL_EXTRACTION: import.meta.env.VITE_ENABLE_MULTIMODAL_EXTRACTION !== 'false',
};

/**
 * Check if any advanced analysis feature is enabled
 */
export const isAdvancedAnalysisEnabled = (): boolean => {
  return FEATURES.ADVANCED_ANALYSIS;
};

/**
 * Check if a specific feature is enabled
 */
export const isFeatureEnabled = (feature: keyof typeof FEATURES): boolean => {
  return FEATURES[feature] ?? false;
};