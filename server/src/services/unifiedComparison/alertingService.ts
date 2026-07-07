/**
 * Alerting Service for Unified Engine
 * Monitors fallback rates and sends alerts when thresholds are exceeded
 */

import { getUnifiedEngineMetrics } from '../../repositories/analysisRepository';

export interface AlertConfig {
  fallbackRateThreshold: number; // Default: 5%
  processingTimeThreshold: number; // Default: 120000ms (2 minutes)
  errorRateThreshold: number; // Default: 10%
  checkIntervalMinutes: number; // Default: 15 minutes
  alertCooldownMinutes: number; // Default: 60 minutes
}

export interface Alert {
  id: string;
  type: 'fallback_rate' | 'processing_time' | 'error_rate' | 'system_health';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  details: Record<string, unknown>;
  timestamp: string;
  acknowledged: boolean;
}

const DEFAULT_CONFIG: AlertConfig = {
  fallbackRateThreshold: 5, // 5%
  processingTimeThreshold: 120000, // 2 minutes
  errorRateThreshold: 10, // 10%
  checkIntervalMinutes: 15,
  alertCooldownMinutes: 60,
};

class AlertingService {
  private config: AlertConfig;
  private lastAlerts: Map<string, Date> = new Map();
  private activeAlerts: Alert[] = [];

  constructor(config: Partial<AlertConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check metrics and generate alerts if thresholds exceeded
   */
  async checkMetrics(): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const now = new Date();

    try {
      // Get metrics for last hour
      const since = new Date(now.getTime() - 60 * 60 * 1000);
      const metrics = await getUnifiedEngineMetrics(since);

      // Check fallback rate
      if (metrics.fallbackRate > this.config.fallbackRateThreshold) {
        const alertId = `fallback-${now.toISOString().split('T')[0]}`;

        if (this.shouldSendAlert(alertId)) {
          const alert: Alert = {
            id: alertId,
            type: 'fallback_rate',
            severity: metrics.fallbackRate > 10 ? 'critical' : 'warning',
            message: `High fallback rate detected: ${metrics.fallbackRate}% (threshold: ${this.config.fallbackRateThreshold}%)`,
            details: {
              fallbackRate: metrics.fallbackRate,
              threshold: this.config.fallbackRateThreshold,
              totalComparisons: metrics.total,
              fallbackCount: metrics.fallback,
              unifiedCount: metrics.unified,
              legacyCount: metrics.legacy,
            },
            timestamp: now.toISOString(),
            acknowledged: false,
          };

          alerts.push(alert);
          this.recordAlert(alertId);
          this.logAlert(alert);
        }
      }

      // Check processing time
      if (metrics.avgProcessingTimeMs > this.config.processingTimeThreshold) {
        const alertId = `processing-time-${now.toISOString().split('T')[0]}`;

        if (this.shouldSendAlert(alertId)) {
          const alert: Alert = {
            id: alertId,
            type: 'processing_time',
            severity: metrics.avgProcessingTimeMs > 300000 ? 'critical' : 'warning',
            message: `High average processing time: ${metrics.avgProcessingTimeMs}ms (threshold: ${this.config.processingTimeThreshold}ms)`,
            details: {
              avgProcessingTimeMs: metrics.avgProcessingTimeMs,
              threshold: this.config.processingTimeThreshold,
              totalComparisons: metrics.total,
            },
            timestamp: now.toISOString(),
            acknowledged: false,
          };

          alerts.push(alert);
          this.recordAlert(alertId);
          this.logAlert(alert);
        }
      }

      // Check error rate (calculated from fallback + any errors)
      const errorRate =
        metrics.total > 0 ? Math.round((metrics.fallback / metrics.total) * 100) : 0;

      if (errorRate > this.config.errorRateThreshold) {
        const alertId = `error-rate-${now.toISOString().split('T')[0]}`;

        if (this.shouldSendAlert(alertId)) {
          const alert: Alert = {
            id: alertId,
            type: 'error_rate',
            severity: 'critical',
            message: `High error rate detected: ${errorRate}% (threshold: ${this.config.errorRateThreshold}%)`,
            details: {
              errorRate,
              threshold: this.config.errorRateThreshold,
              totalComparisons: metrics.total,
              failedComparisons: metrics.fallback,
            },
            timestamp: now.toISOString(),
            acknowledged: false,
          };

          alerts.push(alert);
          this.recordAlert(alertId);
          this.logAlert(alert);
        }
      }

      // Add to active alerts
      this.activeAlerts.push(...alerts);

      return alerts;
    } catch (error) {
      console.error(
        '❌ [Alerting] Failed to check metrics:',
        error instanceof Error ? error.message : String(error)
      );
      return [];
    }
  }

  /**
   * Check if we should send an alert (respect cooldown)
   */
  private shouldSendAlert(alertId: string): boolean {
    const lastAlert = this.lastAlerts.get(alertId);

    if (!lastAlert) {
      return true;
    }

    const cooldownMs = this.config.alertCooldownMinutes * 60 * 1000;
    const timeSinceLastAlert = Date.now() - lastAlert.getTime();

    return timeSinceLastAlert > cooldownMs;
  }

  /**
   * Record that we sent an alert
   */
  private recordAlert(alertId: string): void {
    this.lastAlerts.set(alertId, new Date());
  }

  /**
   * Log alert to console and potentially send to external systems
   */
  private logAlert(alert: Alert): void {
    const icon = alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : '🟢';

    console.log(`${icon} [ALERT] ${alert.type.toUpperCase()}`);
    console.log(`   Message: ${alert.message}`);
    console.log(`   Severity: ${alert.severity}`);
    console.log(`   Details:`, JSON.stringify(alert.details, null, 2));
    console.log(`   Time: ${alert.timestamp}`);

    // TODO: Send to external alerting systems
    // - Send email
    // - Send Slack notification
    // - Send PagerDuty alert
    // - Log to monitoring system
  }

  /**
   * Get active (unacknowledged) alerts
   */
  getActiveAlerts(): Alert[] {
    return this.activeAlerts.filter((a) => !a.acknowledged);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.activeAlerts.find((a) => a.id === alertId);

    if (alert) {
      alert.acknowledged = true;
      console.log(`✅ [Alerting] Alert ${alertId} acknowledged`);
      return true;
    }

    return false;
  }

  /**
   * Clear old alerts
   */
  clearOldAlerts(maxAgeHours: number = 24): void {
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    this.activeAlerts = this.activeAlerts.filter(
      (a) => new Date(a.timestamp) > cutoff || !a.acknowledged
    );
  }

  /**
   * Start periodic monitoring
   */
  startMonitoring(): void {
    console.log(
      `🚨 [Alerting] Starting monitoring (interval: ${this.config.checkIntervalMinutes} minutes)`
    );

    // Initial check
    this.checkMetrics();

    // Periodic checks
    setInterval(
      () => {
        this.checkMetrics();
      },
      this.config.checkIntervalMinutes * 60 * 1000
    );
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AlertConfig>): void {
    this.config = { ...this.config, ...config };
    console.log(`📝 [Alerting] Configuration updated:`, this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): AlertConfig {
    return { ...this.config };
  }
}

export const alertingService = new AlertingService();
export default alertingService;
