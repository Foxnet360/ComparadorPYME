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
import { AuthenticatedRequest, requireUser } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * AUTH-2: Derive user from authenticated session strictly.
 * Client-supplied userId query/body is rejected to prevent IDOR and impersonation.
 */
const resolveUserId = (req: AuthenticatedRequest): string => {
  return req.user?.id || 'anonymous';
};

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

    const userId = resolveUserId(req as AuthenticatedRequest);

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
    const userId = resolveUserId(req as AuthenticatedRequest);

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
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;

    if (userId) {
      const thread = await chatRepository.getThread(threadId);
      if (thread && thread.user_id && thread.user_id !== userId && authReq.user?.role !== 'super_admin') {
        res.status(403).json({ error: 'Forbidden: thread does not belong to you' });
        return;
      }
    }

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
    const authReq = req as AuthenticatedRequest;
    const userId = requireUser(authReq);

    const thread = await chatRepository.getThread(threadId);
    if (thread && thread.user_id && thread.user_id !== userId && authReq.user?.role !== 'super_admin') {
      res.status(403).json({ error: 'Forbidden: thread does not belong to you' });
      return;
    }

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
    const userId = resolveUserId(req as AuthenticatedRequest);

    const threads = await chatRepository.listUserThreads(userId);

    res.json({ threads });
  })
);

export default router;
