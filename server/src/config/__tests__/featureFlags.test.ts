import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FeatureFlagManager, DEFAULT_FEATURE_FLAGS } from '../featureFlags';

describe('FeatureFlagManager', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear individual feature env vars before each test
    const featureVars = [
      'USE_TEMPLATE_GRAPH_PIPELINE',
      'TEMPLATE_BBVA_V1',
      'TEMPLATE_SBS_V1',
      'TEMPLATE_MAPFRE_V1',
      'GRAPH_LEARNING_ENABLED',
      'FEATURE_FLAGS',
      'FEATURE_STRUCTURED_CLAUSE_EXTRACTION',
      'USE_UNIFIED_ENGINE',
      'FEATURE_USE_UNIFIED_COMPARISON_ENGINE',
    ];
    featureVars.forEach((v) => delete process.env[v]);
  });

  afterEach(() => {
    Object.keys(process.env).forEach((key) => {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    });
    Object.assign(process.env, originalEnv);
  });

  it('includes template/graph pipeline flags in defaults', () => {
    const manager = new FeatureFlagManager(DEFAULT_FEATURE_FLAGS);
    const flags = manager.getFlags();

    expect(flags).toHaveProperty('useTemplateGraphPipeline', false);
    expect(flags).toHaveProperty('templateBbvaV1', false);
    expect(flags).toHaveProperty('templateSbsV1', false);
    expect(flags).toHaveProperty('templateMapfreV1', false);
    expect(flags).toHaveProperty('graphLearningEnabled', false);
  });

  it('reads USE_TEMPLATE_GRAPH_PIPELINE from environment', () => {
    process.env.USE_TEMPLATE_GRAPH_PIPELINE = 'true';
    const manager = new FeatureFlagManager(DEFAULT_FEATURE_FLAGS);

    expect(manager.isEnabled('useTemplateGraphPipeline')).toBe(true);
  });

  it('reads per-template flags from environment', () => {
    process.env.TEMPLATE_BBVA_V1 = '1';
    process.env.TEMPLATE_SBS_V1 = 'true';
    process.env.TEMPLATE_MAPFRE_V1 = 'true';

    const manager = new FeatureFlagManager(DEFAULT_FEATURE_FLAGS);
    const flags = manager.getFlags();

    expect(flags.templateBbvaV1).toBe(true);
    expect(flags.templateSbsV1).toBe(true);
    expect(flags.templateMapfreV1).toBe(true);
  });

  it('reads GRAPH_LEARNING_ENABLED from environment', () => {
    process.env.GRAPH_LEARNING_ENABLED = 'true';
    const manager = new FeatureFlagManager(DEFAULT_FEATURE_FLAGS);

    expect(manager.isEnabled('graphLearningEnabled')).toBe(true);
  });

  it('allows JSON FEATURE_FLAGS to override new flags', () => {
    process.env.FEATURE_FLAGS = JSON.stringify({
      useTemplateGraphPipeline: true,
      templateBbvaV1: true,
      graphLearningEnabled: true,
    });

    const manager = new FeatureFlagManager(DEFAULT_FEATURE_FLAGS);
    const flags = manager.getFlags();

    expect(flags.useTemplateGraphPipeline).toBe(true);
    expect(flags.templateBbvaV1).toBe(true);
    expect(flags.graphLearningEnabled).toBe(true);
  });

  it('keeps existing feature env mapping working', () => {
    process.env.FEATURE_STRUCTURED_CLAUSE_EXTRACTION = 'false';
    const manager = new FeatureFlagManager(DEFAULT_FEATURE_FLAGS);

    expect(manager.isEnabled('structuredClauseExtraction')).toBe(false);
  });

  it('defaults useUnifiedComparisonEngine to true', () => {
    const manager = new FeatureFlagManager(DEFAULT_FEATURE_FLAGS);

    expect(manager.isEnabled('useUnifiedComparisonEngine')).toBe(true);
  });

  it('reads USE_UNIFIED_ENGINE env alias', () => {
    process.env.USE_UNIFIED_ENGINE = 'false';
    const manager = new FeatureFlagManager(DEFAULT_FEATURE_FLAGS);

    expect(manager.isEnabled('useUnifiedComparisonEngine')).toBe(false);
  });

  it('does not force useUnifiedComparisonEngine to false when env enables it', () => {
    process.env.USE_UNIFIED_ENGINE = 'true';
    const manager = new FeatureFlagManager(DEFAULT_FEATURE_FLAGS);

    expect(manager.isEnabled('useUnifiedComparisonEngine')).toBe(true);
  });
});
