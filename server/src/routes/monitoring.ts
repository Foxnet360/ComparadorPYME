/**
 * Monitoring Routes
 * Endpoints for accuracy metrics, feedback, and performance tracking
 */

import { Router } from 'express';
import { monitoringService } from '../services/monitoringService';
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
 * GET /api/monitoring/dashboard
 * Get comprehensive monitoring dashboard data
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
    const { start, end } = req.query;
    
    const startDate = start as string || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = end as string || new Date().toISOString();
    
    const [accuracy, performance, feedback] = await Promise.all([
        monitoringService.getAccuracySummary(startDate, endDate),
        monitoringService.getPerformanceSummary(startDate, endDate),
        monitoringService.getFeedbackSummary(startDate, endDate)
    ]);
    
    res.json({
        period: { start: startDate, end: endDate },
        accuracy,
        performance,
        feedback,
        systemHealth: {
            status: 'operational',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            nodeVersion: process.version
        }
    });
}));

export default router;
