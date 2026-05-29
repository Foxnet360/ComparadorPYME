/**
 * Chat Routes Integration Tests
 * Tests for the new v2.0 chat endpoints with database persistence
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import chatRoutes from '../chat';

// Create test app
const app = express();
app.use(express.json());
app.use('/api/chat', chatRoutes);

// Mock chat repository
vi.mock('../../repositories/chatRepository', () => ({
  chatRepository: {
    createThread: vi.fn(async (userId, reportContext) => 'thread-123'),
    getOrCreateThread: vi.fn(async (userId, reportId, reportContext) => 'thread-123'),
    getThreadByReport: vi.fn(async (userId, reportId) => null),
    saveMessage: vi.fn(async () => {}),
    getHistory: vi.fn(async (threadId, limit) => [
      {
        id: 'msg-1',
        thread_id: threadId,
        role: 'user',
        content: '¿Qué coberturas tiene AXA?',
        created_at: '2024-01-01T00:00:00Z'
      },
      {
        id: 'msg-2',
        thread_id: threadId,
        role: 'model',
        content: '📄 Según la cotización, AXA ofrece: Incendio, RCE, y Robo.',
        sources_used: [{ type: 'quote', insurer: 'AXA', relevance: 1.0 }],
        citations: [],
        model_used: 'gemini-2.5-flash-lite',
        tokens_input: 500,
        tokens_output: 100,
        latency_ms: 1200,
        created_at: '2024-01-01T00:00:01Z'
      }
    ]),
    archiveThread: vi.fn(async () => {}),
    listUserThreads: vi.fn(async (userId) => [
      {
        id: 'thread-123',
        user_id: userId,
        report_id: 'report-456',
        client_name: 'Test Client',
        insurer_names: ['AXA', 'MAPFRE'],
        title: 'Análisis: Test Client',
        status: 'active',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    ])
  }
}));

// Mock chat service
vi.mock('../../services/chatService', () => ({
  processChatMessage: vi.fn(async (message, reportContext, userId, threadId) => ({
    text: '📄 Según la cotización:\n\nAXA: Incendio - $500M (Ded: 10%)\n\n⚠️ Nota: Esta respuesta se basa en los datos de la cotización.',
    citations: [],
    tokensUsed: 600,
    modelUsed: 'gemini-2.5-flash-lite',
    source: 'direct'
  })),
  generateSuggestedQuestions: vi.fn(() => [
    '¿Qué coberturas incluye esta póliza?',
    '¿Cuál es el deducible promedio?',
    '¿Qué riesgos debo considerar?'
  ]),
  getConversationHistory: vi.fn(async (threadId, limit) => [
    { role: 'user', text: '¿Qué coberturas tiene AXA?' },
    { role: 'model', text: '📄 Según la cotización, AXA ofrece: Incendio, RCE, y Robo.' }
  ]),
  getOrCreateThread: vi.fn(async (userId, reportId) => 'thread-123')
}));

describe('Chat Routes v2.0', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/chat', () => {
    it('should process a message and return response with citations', async () => {
      const reportContext = {
        id: 'report-456',
        quotes: [
          {
            insurerName: 'AXA',
            coverages: [
              { name: 'Incendio', value: '$500M', deductible: '10%' }
            ]
          }
        ]
      };

      const response = await request(app)
        .post('/api/chat')
        .send({
          message: '¿Qué coberturas tiene AXA?',
          reportContext,
          userId: 'user-123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('text');
      expect(response.body).toHaveProperty('citations');
      expect(response.body).toHaveProperty('modelUsed');
      expect(response.body.text).toContain('📄');
    });

    it('should accept optional threadId', async () => {
      const reportContext = {
        id: 'report-456',
        quotes: []
      };

      const response = await request(app)
        .post('/api/chat')
        .send({
          message: 'Hola',
          reportContext,
          threadId: 'existing-thread-789',
          userId: 'user-123'
        });

      expect(response.status).toBe(200);
    });

    it('should return 400 if message is missing', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({
          reportContext: { id: 'report-456' }
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
    });

    it('should not require useRAG parameter (always on)', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({
          message: '¿Qué deducible tiene?',
          reportContext: { id: 'report-456', quotes: [] },
          userId: 'user-123'
        });

      expect(response.status).toBe(200);
      // Should work without useRAG parameter
      expect(response.body).toHaveProperty('text');
    });
  });

  describe('GET /api/chat/threads/report/:reportId', () => {
    it('should return thread and messages for existing report', async () => {
      const { chatRepository } = await import('../../repositories/chatRepository');
      
      // Mock existing thread
      vi.mocked(chatRepository.getThreadByReport).mockResolvedValueOnce({
        id: 'thread-123',
        user_id: 'user-123',
        report_id: 'report-456',
        client_name: 'Test Client',
        insurer_names: ['AXA'],
        title: 'Análisis: Test Client',
        status: 'active',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      } as any);

      const response = await request(app)
        .get('/api/chat/threads/report/report-456')
        .query({ userId: 'user-123' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('threadId', 'thread-123');
      expect(response.body).toHaveProperty('messages');
      expect(Array.isArray(response.body.messages)).toBe(true);
      expect(response.body.messages.length).toBeGreaterThan(0);
    });

    it('should create new thread if none exists', async () => {
      const { chatRepository } = await import('../../repositories/chatRepository');
      
      // Mock no existing thread
      vi.mocked(chatRepository.getThreadByReport).mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/chat/threads/report/report-new')
        .query({ userId: 'user-123' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('threadId');
      expect(response.body.messages).toEqual([]);
    });
  });

  describe('GET /api/chat/threads/:id/messages', () => {
    it('should return messages for a thread', async () => {
      const response = await request(app)
        .get('/api/chat/threads/thread-123/messages');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('messages');
      expect(Array.isArray(response.body.messages)).toBe(true);
    });
  });

  describe('DELETE /api/chat/threads/:id', () => {
    it('should archive a thread', async () => {
      const response = await request(app)
        .delete('/api/chat/threads/thread-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/chat/suggestions', () => {
    it('should return suggested questions', async () => {
      const reportContext = {
        quotes: [
          {
            insurerName: 'AXA',
            score: 85,
            coverages: [{ name: 'Incendio', value: '$500M' }]
          }
        ]
      };

      const response = await request(app)
        .post('/api/chat/suggestions')
        .send({ reportContext });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('suggestions');
      expect(Array.isArray(response.body.suggestions)).toBe(true);
      expect(response.body.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/chat/threads', () => {
    it('should list user threads', async () => {
      const response = await request(app)
        .get('/api/chat/threads')
        .query({ userId: 'user-123' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('threads');
      expect(Array.isArray(response.body.threads)).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    it('should return 429 after too many requests', async () => {
      // Make 21 requests rapidly
      const promises = [];
      for (let i = 0; i < 21; i++) {
        promises.push(
          request(app)
            .post('/api/chat')
            .send({
              message: `Test message ${i}`,
              reportContext: { id: 'report-456' }
            })
        );
      }

      const responses = await Promise.all(promises);
      
      // At least one should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});
