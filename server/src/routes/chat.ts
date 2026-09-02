/**
 * Chat Routes v2.0
 * Endpoints for processing chat messages with database persistence
 */

import { Router } from 'express';
import {
  processChatMessage,
  generateSuggestedQuestions,
  getConversationHistory,
} from '../services/chatService';
import { chatRepository, ChatMessageDB } from '../repositories/chatRepository';
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
      resetTime: now + 60000, // 1 minute
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
 * Process a chat message and return response with citations
 * Body: { message, reportContext, threadId?, userId? }
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { message, reportContext, threadId } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'message is required',
      });
    }

    // Rate limiting
    const clientId = req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
    if (!checkRateLimit(clientId)) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please wait a minute.',
      });
    }

    console.log(`💬 [chatRoute] Message: "${message.substring(0, 50)}..."`);

    const userId = req.body.userId || 'anonymous';

    const result = await processChatMessage(message, reportContext, userId, threadId);

    console.log(
      `✅ [chatRoute] Response generated | Tokens: ${result.tokensUsed || 'unknown'} | Model: ${result.modelUsed}`
    );

    return res.json(result);
  })
);

/**
 * GET /api/chat/threads/report/:reportId
 * Get or create thread for a specific report and return messages
 */
router.get(
  '/threads/report/:reportId',
  asyncHandler(async (req, res) => {
    const reportId = req.params.reportId as string;
    const userId = String(req.query.userId || 'anonymous');

    console.log(`🔍 [chatRoute] Getting thread for report: ${reportId}, user: ${userId}`);

    // Get or create thread
    const thread = await chatRepository.getThreadByReport(userId, reportId);

    let threadId: string;
    let messages: ChatMessageDB[] = [];

    if (thread) {
      threadId = thread.id;
      messages = await chatRepository.getHistory(threadId, 50);
    } else {
      // Create new thread
      threadId = await chatRepository.createThread(userId, { id: reportId });
    }

    res.json({
      threadId,
      messages: messages.map((msg) => ({
        role: msg.role,
        text: msg.content,
        createdAt: msg.created_at,
        sourcesUsed: msg.sources_used,
        citations: msg.citations,
      })),
    });
  })
);

/**
 * GET /api/chat/threads/:id/messages
 * Get messages for a specific thread
 */
router.get(
  '/threads/:id/messages',
  asyncHandler(async (req, res) => {
    const threadId = req.params.id as string;
    const messages = await getConversationHistory(threadId, 50);

    res.json({ messages });
  })
);

/**
 * DELETE /api/chat/threads/:id
 * Archive a thread (soft delete)
 */
router.delete(
  '/threads/:id',
  asyncHandler(async (req, res) => {
    const threadId = req.params.id as string;

    await chatRepository.archiveThread(threadId);

    res.json({ success: true, message: 'Thread archived successfully' });
  })
);

/**
 * POST /api/chat/suggestions
 * Generate dynamic suggested questions based on report content
 */
router.post(
  '/suggestions',
  asyncHandler(async (req, res) => {
    const { reportContext } = req.body;

    const suggestions = generateSuggestedQuestions(reportContext);

    res.json({ suggestions });
  })
);

/**
 * GET /api/chat/threads
 * List chat threads for a user
 */
router.get(
  '/threads',
  asyncHandler(async (req, res) => {
    const userId = (req.query.userId as string) || 'anonymous';

    const threads = await chatRepository.listUserThreads(userId);

    res.json({ threads });
  })
);

export default router;
