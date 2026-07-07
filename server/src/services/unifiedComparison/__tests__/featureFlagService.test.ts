import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { unifiedComparisonFlag } from '../featureFlagService';
import { featureFlags } from '../../../config/featureFlags';

describe('UnifiedComparisonFeatureFlag', () => {
  beforeEach(() => {
    featureFlags.updateFlag('granularComparisonSchema', false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports granular comparison schema as disabled by default', () => {
    expect(unifiedComparisonFlag.isGranularComparisonSchemaEnabled()).toBe(false);
  });

  it('reports granular comparison schema as enabled when flag is on', () => {
    featureFlags.updateFlag('granularComparisonSchema', true);
    expect(unifiedComparisonFlag.isGranularComparisonSchemaEnabled()).toBe(true);
  });
});
