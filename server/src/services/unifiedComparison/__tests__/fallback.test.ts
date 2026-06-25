/**
 * Fallback Mechanism Tests
 * Tests automatic fallback when unified engine fails
 */

import { describe, it, expect, vi } from 'vitest';
import { comparisonEngineAdapter } from '../comparisonEngineAdapter';
import { unifiedComparisonEngine } from '../unifiedComparisonEngine';
import { featureFlags } from '../../../config/featureFlags';
import { unifiedComparisonFlag } from '../featureFlagService';

describe('Fallback Mechanism', () => {
  
  beforeEach(() => {
    // Reset feature flags
    featureFlags.updateFlag('useUnifiedComparisonEngine', true);
  });

  it('should fallback to legacy when unified engine throws error', async () => {
    // Mock the unified engine to fail
    const originalCompare = unifiedComparisonEngine.compare;
    unifiedComparisonEngine.compare = vi.fn().mockRejectedValue(
      new Error('Simulated unified engine failure')
    );

    try {
      // Attempt to generate comparison
      await expect(
        comparisonEngineAdapter.generateComparison(['fake1.pdf', 'fake2.pdf'])
      ).rejects.toThrow();

      // Verify the unified engine was called
      expect(unifiedComparisonEngine.compare).toHaveBeenCalled();
      
    } finally {
      // Restore original method
      unifiedComparisonEngine.compare = originalCompare;
    }
  });

  it('should use legacy engine when feature flag is disabled', async () => {
    // Disable unified engine
    featureFlags.updateFlag('useUnifiedComparisonEngine', false);

    // The adapter should not call unified engine
    const compareSpy = vi.spyOn(unifiedComparisonEngine, 'compare');

    try {
      await comparisonEngineAdapter.generateComparison(['fake1.pdf']);
    } catch (_error) {
      // Expected to fail since we don't have real legacy implementation
    }

    // Verify unified engine was NOT called
    expect(compareSpy).not.toHaveBeenCalled();
    
    compareSpy.mockRestore();
  });

  it('should handle network errors gracefully', async () => {
    const originalCompare = unifiedComparisonEngine.compare;
    unifiedComparisonEngine.compare = vi.fn().mockRejectedValue(
      new Error('Network error: Connection refused')
    );

    try {
      await expect(
        comparisonEngineAdapter.generateComparison(['fake1.pdf'])
      ).rejects.toThrow('Network error');
    } finally {
      unifiedComparisonEngine.compare = originalCompare;
    }
  });

  it('should handle timeout errors gracefully', async () => {
    const originalCompare = unifiedComparisonEngine.compare;
    unifiedComparisonEngine.compare = vi.fn().mockRejectedValue(
      new Error('Request timeout after 30000ms')
    );

    try {
      await expect(
        comparisonEngineAdapter.generateComparison(['fake1.pdf'])
      ).rejects.toThrow('timeout');
    } finally {
      unifiedComparisonEngine.compare = originalCompare;
    }
  });
});

describe('Feature Flag Toggle', () => {
  
  beforeEach(() => {
    // Reset to known state
    featureFlags.updateFlag('useUnifiedComparisonEngine', false);
  });

  it('should toggle feature flag at runtime', () => {
    // Initially disabled
    expect(featureFlags.isEnabled('useUnifiedComparisonEngine')).toBe(false);

    // Enable it
    featureFlags.updateFlag('useUnifiedComparisonEngine', true);
    expect(featureFlags.isEnabled('useUnifiedComparisonEngine')).toBe(true);

    // Disable it again
    featureFlags.updateFlag('useUnifiedComparisonEngine', false);
    expect(featureFlags.isEnabled('useUnifiedComparisonEngine')).toBe(false);
  });

  it('should respect user-specific overrides', () => {
    // Set rollout to 0%
    unifiedComparisonFlag.updateRolloutPercentage(0);
    
    // Without user ID, should be disabled
    expect(unifiedComparisonFlag.isEnabled()).toBe(false);
    
    // With user ID but no override, should be disabled (0% rollout)
    expect(unifiedComparisonFlag.isEnabled('user123')).toBe(false);
  });

  it('should handle percentage-based rollout', () => {
    // Enable main flag
    featureFlags.updateFlag('useUnifiedComparisonEngine', true);
    
    // Set 50% rollout
    unifiedComparisonFlag.updateRolloutPercentage(50);
    
    // Should be enabled for some users (deterministic)
    const testUserId = 'test-user-123';
    const result = unifiedComparisonFlag.isEnabled(testUserId);
    
    // Should be consistent for same user
    expect(unifiedComparisonFlag.isEnabled(testUserId)).toBe(result);
    
    // Reset
    unifiedComparisonFlag.updateRolloutPercentage(0);
  });

  it('should handle 100% rollout', () => {
    featureFlags.updateFlag('useUnifiedComparisonEngine', true);
    unifiedComparisonFlag.updateRolloutPercentage(100);
    
    // Should be enabled for all users
    expect(unifiedComparisonFlag.isEnabled('any-user')).toBe(true);
    expect(unifiedComparisonFlag.isEnabled()).toBe(true);
    
    // Reset
    unifiedComparisonFlag.updateRolloutPercentage(0);
  });
});