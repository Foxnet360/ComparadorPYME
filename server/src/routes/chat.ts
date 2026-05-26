/**
 * Chat Routes
 * Endpoint for processing chat messages with RAG
 */

import { Router } from 'express';
import { processChatMessage, generateSuggestedQuestions, getConversationHistory, getOrCreateThread } from '../services/chatService';
import { supabase } from '../config/database';
import { asyncHandler } from '../utils/asyncHandler';

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
router.post('/', asyncHandler(async (req, res) => {
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
    
    const userId = req.body.userId || 'anonymous';
    const threadId = req.body.threadId;
    
    const result = await processChatMessage(
        message,
        reportContext,
        useRAG !== false, // default to true
        userId,
        threadId
    );
    
    console.log(`✅ [chatRoute] Response generated | Tokens: ${result.tokensUsed || 'unknown'} | Model: ${result.modelUsed}`);
    
    res.json(result);
}));

/**
 * POST /api/chat/suggestions
 * Generate dynamic suggested questions based on report content
 */
router.post('/suggestions', asyncHandler(async (req, res) => {
    const { reportContext } = req.body;
    
    const suggestions = generateSuggestedQuestions(reportContext);
    
    res.json({ suggestions });
}));

/**
 * GET /api/chat/threads
 * List chat threads for a user
 */
router.get('/threads', asyncHandler(async (req, res) => {
    const userId = req.query.userId as string || 'anonymous';
    
    const { data, error } = await supabase
        .from('chat_threads')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
    
    if (error) throw error;
    
    res.json({ threads: data || [] });
}));

/**
 * GET /api/chat/threads/:id/messages
 * Get messages for a specific thread
 */
router.get('/threads/:id/messages', asyncHandler(async (req, res) => {
    const threadId = req.params.id;
    
    const messages = await getConversationHistory(threadId as string, 50);
    
    res.json({ messages });
}));

export default router;
