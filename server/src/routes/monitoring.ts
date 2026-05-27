/**
 * Monitoring Routes
 * Endpoints for accuracy metrics, feedback, and performance tracking
 */

import { Router } from 'express';
import { monitoringService } from '../services/monitoringService';
import { alertingService } from '../services/unifiedComparison/alertingService';
import { errorTrackingService } from '../services/unifiedComparison/errorTrackingService';
import { getUnifiedEngineMetrics } from '../repositories/analysisRepository';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * GET /api/monitoring/accuracy
 * Get accuracy metrics for date range
 */
router.get('/accuracy', asyncHandler(async (req, res) => {
    const { start, end } = req.query;
    
    const startDate = start as string || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = end as string || new Date().toISOString();
    
    const summary = await monitoringService.getAccuracySummary(startDate, endDate);
    
    res.json({
        period: { start: startDate, end: endDate },
        metrics: summary
    });
}));

/**
 * GET /api/monitoring/performance
 * Get performance metrics for date range
 */
router.get('/performance', asyncHandler(async (req, res) => {
    const { start, end } = req.query;
    
    const startDate = start as string || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = end as string || new Date().toISOString();
    
    const summary = await monitoringService.getPerformanceSummary(startDate, endDate);
    
    res.json({
        period: { start: startDate, end: endDate },
        metrics: summary
    });
}));

/**
 * GET /api/monitoring/feedback
 * Get user feedback summary
 */
router.get('/feedback', asyncHandler(async (req, res) => {
    const { start, end } = req.query;
    
    const startDate = start as string || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = end as string || new Date().toISOString();
    
    const summary = await monitoringService.getFeedbackSummary(startDate, endDate);
    
    res.json({
        period: { start: startDate, end: endDate },
        feedback: summary
    });
}));

/**
 * POST /api/monitoring/feedback
 * Submit user feedback
 */
router.post('/feedback', asyncHandler(async (req, res) => {
    const { feature, rating, comment, userId } = req.body;
    
    if (!feature || !rating) {
        return res.status(400).json({
            error: 'Bad Request',
            message: 'feature and rating are required'
        });
    }
    
    await monitoringService.collectFeedback({
        feature,
        rating,
        comment,
        userId
    });
    
    res.json({
        success: true,
        message: 'Feedback collected successfully'
    });
}));

/**
 * POST /api/monitoring/accuracy
 * Record accuracy metric (internal use)
 */
router.post('/accuracy', asyncHandler(async (req, res) => {
    const { type, coverageName, extractedValue, correctValue, isCorrect } = req.body;
    
    if (type === 'extraction') {
        await monitoringService.recordExtractionAccuracy(
            coverageName,
            extractedValue,
            correctValue,
            isCorrect
        );
    } else if (type === 'deductible') {
        await monitoringService.recordDeductibleAccuracy(
            req.body.rawText,
            req.body.parsedResult,
            isCorrect,
            req.body.errorType
        );
    }
    
    res.json({ success: true });
}));

/**
 * GET /api/monitoring/unified-engine
 * Get unified comparison engine metrics
 */
router.get('/unified-engine', asyncHandler(async (req, res) => {
    const { days } = req.query;
    
    const since = new Date(Date.now() - (parseInt(days as string) || 7) * 24 * 60 * 60 * 1000);
    
    const metrics = await getUnifiedEngineMetrics(since);
    
    res.json({
        period: { since: since.toISOString(), until: new Date().toISOString() },
        metrics
    });
}));

/**
 * GET /api/monitoring/engine-comparison
 * Get unified vs legacy engine comparison metrics
 */
router.get('/engine-comparison', asyncHandler(async (req, res) => {
    const { start, end } = req.query;
    
    const startDate = start as string || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = end as string || new Date().toISOString();
    
    const metrics = await monitoringService.getEngineComparisonMetrics(startDate, endDate);
    
    res.json({
        period: { start: startDate, end: endDate },
        metrics
    });
}));

/**
 * GET /api/monitoring/alerts
 * Get active alerts
 */
router.get('/alerts', asyncHandler(async (req, res) => {
    const alerts = alertingService.getActiveAlerts();
    
    res.json({
        alerts,
        count: alerts.length
    });
}));

/**
 * POST /api/monitoring/alerts/check
 * Manually trigger alert check
 */
router.post('/alerts/check', asyncHandler(async (req, res) => {
    const alerts = await alertingService.checkMetrics();
    
    res.json({
        alerts,
        count: alerts.length,
        message: alerts.length > 0 ? `${alerts.length} alert(s) generated` : 'No alerts'
    });
}));

/**
 * POST /api/monitoring/alerts/:id/acknowledge
 * Acknowledge an alert
 */
router.post('/alerts/:id/acknowledge', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const success = alertingService.acknowledgeAlert(id as string);
    
    if (success) {
        res.json({ success: true, message: `Alert ${id} acknowledged` });
    } else {
        res.status(404).json({ success: false, message: 'Alert not found' });
    }
}));

/**
 * GET /api/monitoring/alerts/config
 * Get alerting configuration
 */
router.get('/alerts/config', asyncHandler(async (req, res) => {
    const config = alertingService.getConfig();
    
    res.json({ config });
}));

/**
 * PUT /api/monitoring/alerts/config
 * Update alerting configuration
 */
router.put('/alerts/config', asyncHandler(async (req, res) => {
    const { fallbackRateThreshold, processingTimeThreshold, errorRateThreshold, checkIntervalMinutes, alertCooldownMinutes } = req.body;
    
    alertingService.updateConfig({
        fallbackRateThreshold,
        processingTimeThreshold,
        errorRateThreshold,
        checkIntervalMinutes,
        alertCooldownMinutes
    });
    
    res.json({ success: true, config: alertingService.getConfig() });
}));

/**
 * GET /api/monitoring/errors
 * Get unified engine error tracking
 */
router.get('/errors', asyncHandler(async (req, res) => {
    const { start, end, category } = req.query;
    
    const startDate = start as string || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = end as string || new Date().toISOString();
    
    let errors;
    if (category) {
        errors = await errorTrackingService.getErrorsByCategory(category as any, startDate, endDate);
    } else {
        // Get summary
        const summary = await errorTrackingService.getErrorSummary(startDate, endDate);
        res.json({
            period: { start: startDate, end: endDate },
            summary
        });
        return;
    }
    
    res.json({
        period: { start: startDate, end: endDate },
        errors
    });
}));

/**
 * POST /api/monitoring/errors/:id/resolve
 * Mark an error as resolved
 */
router.post('/errors/:id/resolve', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { resolution } = req.body;
    
    const success = await errorTrackingService.resolveError(id as string, (resolution as string) || 'Resolved manually');
    
    if (success) {
        res.json({ success: true, message: `Error ${id} resolved` });
    } else {
        res.status(404).json({ success: false, message: 'Error not found' });
    }
}));

/**
 * GET /api/monitoring/dashboard
 * Get comprehensive monitoring dashboard data
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
    const { start, end } = req.query;
    
    const startDate = start as string || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = end as string || new Date().toISOString();
    
    const [accuracy, performance, feedback, engineComparison, errorSummary] = await Promise.all([
        monitoringService.getAccuracySummary(startDate, endDate),
        monitoringService.getPerformanceSummary(startDate, endDate),
        monitoringService.getFeedbackSummary(startDate, endDate),
        monitoringService.getEngineComparisonMetrics(startDate, endDate),
        errorTrackingService.getErrorSummary(startDate, endDate)
    ]);
    
    const alerts = alertingService.getActiveAlerts();
    
    res.json({
        period: { start: startDate, end: endDate },
        accuracy,
        performance,
        feedback,
        engineComparison,
        errors: errorSummary,
        alerts: {
            active: alerts,
            count: alerts.length
        },
        systemHealth: {
            status: 'operational',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            nodeVersion: process.version
        }
    });
}));

export default router;
