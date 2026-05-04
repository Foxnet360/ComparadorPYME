/**
 * Chat Routes
 * Endpoint for processing chat messages with RAG
 */

import { Router } from 'express';
import { processChatMessage, generateSuggestedQuestions } from '../services/chatService';

const router = Router();

// Simple rate limiting map (in production, use Redis)
const rateLimitMap: Map<string, { count: number; resetTime: number }> = new Map();
const MAX_REQUESTS_PER_MINUTE = 20;

/**
 * Check rate limit for a client
 */
const checkRateLimit = (clientId: string): boolean => {
    const now = Date.now();
    const clientData = rateLimitMap.get(clientId);
    
    if (!clientData || now > clientData.resetTime) {
        rateLimitMap.set(clientId, {
            count: 1,
            resetTime: now + 60000 // 1 minute
        });
        return true;
    }
    
    if (clientData.count >= MAX_REQUESTS_PER_MINUTE) {
        return false;
    }
    
    clientData.count++;
    return true;
};

/**
 * POST /api/chat
 * Process a chat message and return response with optional RAG citations
 */
router.post('/', async (req, res) => {
    try {
        const { message, reportContext, useRAG, history } = req.body;
        
        if (!message || typeof message !== 'string') {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'message is required'
            });
        }
        
        // Rate limiting
        const clientId = req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
        if (!checkRateLimit(clientId)) {
            return res.status(429).json({
                error: 'Too Many Requests',
                message: 'Rate limit exceeded. Please wait a minute.'
            });
        }
        
        console.log(`💬 [chatRoute] Message: "${message.substring(0, 50)}..." | RAG: ${useRAG !== false}`);
        
        const result = await processChatMessage(
            message,
            reportContext,
            useRAG !== false, // default to true
            history || []
        );
        
        console.log(`✅ [chatRoute] Response generated | Tokens: ${result.tokensUsed || 'unknown'} | Model: ${result.modelUsed}`);
        
        res.json(result);
    } catch (error) {
        console.error('❌ [chatRoute] Chat error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to process chat message'
        });
    }
});

/**
 * POST /api/chat/suggestions
 * Generate dynamic suggested questions based on report content
 */
router.post('/suggestions', async (req, res) => {
    try {
        const { reportContext } = req.body;
        
        const suggestions = generateSuggestedQuestions(reportContext);
        
        res.json({ suggestions });
    } catch (error) {
        console.error('❌ [chatRoute] Suggestions error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to generate suggestions'
        });
    }
});

export default router;
