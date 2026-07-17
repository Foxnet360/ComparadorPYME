/**
 * Feature Flag Service for Unified Comparison Engine
 * Supports gradual rollout with percentage-based activation
 */

import { featureFlags } from '../../config/featureFlags';

export interface RolloutConfig {
  percentage: number; // 0-100
  enabledUsers?: string[]; // Specific user IDs always enabled
}

/**
 * Deterministic hash of user ID for rollout bucketing (0-99). Shared by every
 * percentage rollout (engine + graph/template slices) — callers MUST reuse it;
 * divergent hashes would bucket the same user differently per flag.
 */
export function hashUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to positive percentage (0-99)
  return Math.abs(hash) % 100;
}

class UnifiedComparisonFeatureFlag {
  private rolloutConfig: RolloutConfig;

  constructor() {
    // Parse rollout percentage from environment (default: 100% for production)
    const rolloutPercentage = parseInt(process.env.USE_UNIFIED_ENGINE_ROLLOUT || '100', 10);
    this.rolloutConfig = {
      percentage: Math.min(100, Math.max(0, rolloutPercentage)),
      enabledUsers: process.env.USE_UNIFIED_ENGINE_USERS?.split(',') || [],
    };
  }

  /**
   * Check if the granular comparison schema v2 is enabled
   */
  isGranularComparisonSchemaEnabled(): boolean {
    return featureFlags.isEnabled('granularComparisonSchema');
  }

  /**
   * Check if unified comparison engine is enabled for this request
   */
  isEnabled(userId?: string): boolean {
    // Check main feature flag
    if (!featureFlags.isEnabled('useUnifiedComparisonEngine')) {
      return false;
    }

    // If user-specific override exists, always enable
    if (userId && this.rolloutConfig.enabledUsers?.includes(userId)) {
      return true;
    }

    // If rollout is 100%, enable for all
    if (this.rolloutConfig.percentage >= 100) {
      return true;
    }

    // If rollout is 0%, disable for all (except overrides)
    if (this.rolloutConfig.percentage <= 0) {
      return false;
    }

    // Percentage-based rollout using deterministic hash
    if (userId) {
      const hash = hashUserId(userId);
      return hash < this.rolloutConfig.percentage;
    }

    // No user ID, disable for safety
    return false;
  }

  /**
   * Get current rollout configuration
   */
  getRolloutConfig(): RolloutConfig {
    return { ...this.rolloutConfig };
  }

  /**
   * Update rollout percentage at runtime
   */
  updateRolloutPercentage(percentage: number): void {
    this.rolloutConfig.percentage = Math.min(100, Math.max(0, percentage));
    console.log(`🚩 [UnifiedComparison] Rollout percentage updated to ${percentage}%`);
  }

  /**
   * Add a user to the enabled users list
   */
  addEnabledUser(userId: string): void {
    if (!this.rolloutConfig.enabledUsers?.includes(userId)) {
      this.rolloutConfig.enabledUsers = [...(this.rolloutConfig.enabledUsers || []), userId];
      console.log(`🚩 [UnifiedComparison] Added user ${userId} to enabled list`);
    }
  }

  /**
   * Remove a user from the enabled users list
   */
  removeEnabledUser(userId: string): void {
    this.rolloutConfig.enabledUsers =
      this.rolloutConfig.enabledUsers?.filter((id) => id !== userId) || [];
    console.log(`🚩 [UnifiedComparison] Removed user ${userId} from enabled list`);
  }

  /**
   * Update the entire enabled users list
   */
  setEnabledUsers(userIds: string[]): void {
    this.rolloutConfig.enabledUsers = [...userIds];
    console.log(`🚩 [UnifiedComparison] Enabled users list updated (${userIds.length} users)`);
  }
}

export const unifiedComparisonFlag = new UnifiedComparisonFeatureFlag();

export default unifiedComparisonFlag;
