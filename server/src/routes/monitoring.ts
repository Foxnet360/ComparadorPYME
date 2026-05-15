/**
 * Monitoring Routes
 * Endpoints for accuracy metrics, feedback, and performance tracking
 */

import { Router } from 'express';
import { monitoringService } from '../services/monitoringService';

const router = Router();

/**
 * GET /api/monitoring/accuracy
 * Get accuracy metrics for date range
 */
router.get('/accuracy', async (req, res) => {
    try {
        const { start, end } = req.query;
        
        const startDate = start as string || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const endDate = end as string || new Date().toISOString();
        
        const summary = await monitoringService.getAccuracySummary(startDate, endDate);
        
        res.json({
            period: { start: startDate, end: endDate },
            metrics: summary
        });
    } catch (error) {
        console.error('❌ [monitoringRoute] Accuracy metrics error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to retrieve accuracy metrics'
        });
    }
});

/**
 * GET /api/monitoring/performance
 * Get performance metrics for date range
 */
router.get('/performance', async (req, res) => {
    try {
        const { start, end } = req.query;
        
        const startDate = start as string || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const endDate = end as string || new Date().toISOString();
        
        const summary = await monitoringService.getPerformanceSummary(startDate, endDate);
        
        res.json({
            period: { start: startDate, end: endDate },
            metrics: summary
        });
    } catch (error) {
        console.error('❌ [monitoringRoute] Performance metrics error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to retrieve performance metrics'
        });
    }
});

/**
 * GET /api/monitoring/feedback
 * Get user feedback summary
 */
router.get('/feedback', async (req, res) => {
    try {
        const { start, end } = req.query;
        
        const startDate = start as string || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const endDate = end as string || new Date().toISOString();
        
        const summary = await monitoringService.getFeedbackSummary(startDate, endDate);
        
        res.json({
            period: { start: startDate, end: endDate },
            feedback: summary
        });
    } catch (error) {
        console.error('❌ [monitoringRoute] Feedback summary error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to retrieve feedback summary'
        });
    }
});

/**
 * POST /api/monitoring/feedback
 * Submit user feedback
 */
router.post('/feedback', async (req, res) => {
    try {
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
    } catch (error) {
        console.error('❌ [monitoringRoute] Feedback submission error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to collect feedback'
        });
    }
});

/**
 * POST /api/monitoring/accuracy
 * Record accuracy metric (internal use)
 */
router.post('/accuracy', async (req, res) => {
    try {
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
    } catch (error) {
        console.error('❌ [monitoringRoute] Accuracy recording error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to record accuracy'
        });
    }
});

/**
 * GET /api/monitoring/dashboard
 * Get comprehensive monitoring dashboard data
 */
router.get('/dashboard', async (req, res) => {
    try {
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
    } catch (error) {
        console.error('❌ [monitoringRoute] Dashboard error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to retrieve dashboard data'
        });
    }
});

export default router;