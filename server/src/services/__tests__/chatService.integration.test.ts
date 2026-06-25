/**
 * Chat Service Integration Tests
 * Tests for full flow, conversation isolation, RAG always-on, and source attribution
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../repositories/chatRepository', () => ({
  chatRepository: {
    createThread: vi.fn(async (_userId, _reportContext) => `thread-${Date.now()}`),
    getOrCreateThread: vi.fn(async (_userId, reportId, _reportContext) => `thread-${reportId}`),
    getThreadByReport: vi.fn(async (userId, reportId) => {
      // Simulate thread exists for report-1, not for report-2
      if (reportId === 'report-1') {
        return {
          id: 'thread-report-1',
          user_id: userId,
          report_id: reportId,
          client_name: 'Cliente A',
          status: 'active'
        };
      }
      return null;
    }),
    saveMessage: vi.fn(async () => {}),
    getHistory: vi.fn(async (threadId, _limit) => {
      // Return different history for different threads
      if (threadId === 'thread-report-1') {
        return [
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
            content: '📄 Según la cotización, AXA tiene Incendio y RCE.',
            sources_used: [{ type: 'quote', insurer: 'AXA', relevance: 1.0 }],
            created_at: '2024-01-01T00:00:01Z'
          }
        ];
      }
      return [];
    }),
    archiveThread: vi.fn(async () => {}),
    listUserThreads: vi.fn(async () => [])
  }
}));

vi.mock('../ragRetrievalService', () => ({
  ragRetrievalService: {
    search: vi.fn(async () => [
      {
        id: 'chunk-1',
        insurerName: 'AXA',
        content: 'Cobertura de incendio con deducible del 10%',
        pageNumber: 5,
        similarity: 0.85
      }
    ]),
    reRankResults: vi.fn(async (query, results) => results)
  }
}));

vi.mock('../structuredClauseExtractor', () => ({
  structuredClauseExtractor: {
    searchClause: vi.fn(async (insurerName) => {
      if (insurerName === 'AXA') {
        return {
          insurer: 'AXA',
          coverages: [
            {
              name: 'Incendio',
              description: 'Cubre daños por incendio',
              deductible: { rawText: '10%', components: [{ type: 'percentage', value: 10 }] },
              sourcePage: 5
            }
          ]
        };
      }
      return null;
    })
  }
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class MockGoogleGenAI {
    models = {
      generateContent: vi.fn(() => Promise.resolve({
        text: '📄 Según la cotización:\n\nAXA: Incendio - $500M (Ded: 10%)\n\n📋 Según clausulado:\n\nDeducible: 10% sobre el valor del siniestro'
      }))
    };
  }
}));

import { processChatMessage, getConversationHistory, getOrCreateThread } from '../chatService';

describe('Chat Service Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('6.1 Full flow: send message → persist → reload history', () => {
    it('should save user message and model response to database', async () => {
      const { chatRepository } = await import('../../repositories/chatRepository');
      
      const reportContext = {
        id: 'report-123',
        quotes: [
          {
            insurerName: 'AXA',
            coverages: [
              { name: 'Incendio', value: '$500M', deductible: '10%' }
            ]
          }
        ]
      };

      const response = await processChatMessage(
        '¿Qué coberturas tiene AXA?',
        reportContext,
        'user-123'
      );

      // Verify response
      expect(response).toHaveProperty('text');
      expect(response).toHaveProperty('citations');
      expect(response).toHaveProperty('modelUsed');
      
      // Verify messages were saved
      expect(chatRepository.saveMessage).toHaveBeenCalledTimes(2); // user + model
      
      // Verify user message was saved
      expect(chatRepository.saveMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          role: 'user',
          content: '¿Qué coberturas tiene AXA?'
        })
      );
      
      // Verify model response was saved with metadata
      expect(chatRepository.saveMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          role: 'model',
          sources_used: expect.any(Array),
          model_used: expect.any(String)
        })
      );
    });

    it('should reload conversation history from database', async () => {
      const history = await getConversationHistory('thread-report-1', 10);
      
      expect(history).toHaveLength(2);
      expect(history[0].role).toBe('user');
      expect(history[0].text).toContain('AXA');
      expect(history[1].role).toBe('model');
      expect(history[1].text).toContain('AXA');
    });
  });

  describe('6.2 Conversation isolation: two reports, messages do not mix', () => {
    it('should create separate threads for different reports', async () => {
      const reportContext1 = { id: 'report-1', quotes: [{ insurerName: 'AXA' }] };
      const reportContext2 = { id: 'report-2', quotes: [{ insurerName: 'MAPFRE' }] };

      const threadId1 = await getOrCreateThread('user-123', 'report-1', reportContext1);
      const threadId2 = await getOrCreateThread('user-123', 'report-2', reportContext2);

      expect(threadId1).toBe('thread-report-1');
      expect(threadId2).toBe('thread-report-2');
      expect(threadId1).not.toBe(threadId2);
    });

    it('should return different history for different reports', async () => {
      const history1 = await getConversationHistory('thread-report-1', 10);
      const history2 = await getConversationHistory('thread-report-2', 10);

      // Report 1 has existing messages
      expect(history1.length).toBeGreaterThan(0);
      
      // Report 2 is new (empty)
      expect(history2).toHaveLength(0);
    });

    it('should not leak messages between threads', async () => {
      const { chatRepository } = await import('../../repositories/chatRepository');
      
      // Simulate message in thread 1
      await chatRepository.saveMessage('thread-report-1', {
        role: 'user',
        content: 'Mensaje secreto del cliente A'
      });

      // Get history for thread 2
      const history2 = await getConversationHistory('thread-report-2', 10);
      
      // Should not contain message from thread 1
      const hasLeakedMessage = history2.some(msg => 
        msg.text.includes('secreto')
      );
      expect(hasLeakedMessage).toBe(false);
    });
  });

  describe('6.3 RAG always-on: clause search performed on every question', () => {
    it('should search structured clauses even without explicit RAG toggle', async () => {
      const { structuredClauseExtractor } = await import('../structuredClauseExtractor');
      
      const reportContext = {
        id: 'report-123',
        quotes: [
          {
            insurerName: 'AXA',
            coverages: [
              { name: 'Incendio', value: '$500M', deductible: '10%' }
            ]
          }
        ]
      };

      await processChatMessage(
        '¿Qué cubre el incendio?',
        reportContext,
        'user-123'
      );

      // Verify structured clause search was called
      expect(structuredClauseExtractor.searchClause).toHaveBeenCalled();
    });

    it('should search RAG chunks even without explicit RAG toggle', async () => {
      const { ragRetrievalService } = await import('../ragRetrievalService');
      
      const reportContext = {
        id: 'report-123',
        quotes: [
          {
            insurerName: 'AXA',
            coverages: [
              { name: 'Incendio', value: '$500M', deductible: '10%' }
            ]
          }
        ]
      };

      await processChatMessage(
        '¿Qué deducible tiene incendio?',
        reportContext,
        'user-123'
      );

      // Verify RAG search was called
      expect(ragRetrievalService.search).toHaveBeenCalled();
    });
  });

  describe('6.4 Source attribution: response includes source labels', () => {
    it('should include quote source attribution when using quote data', async () => {
      const reportContext = {
        id: 'report-123',
        quotes: [
          {
            insurerName: 'AXA',
            coverages: [
              { name: 'Incendio', value: '$500M', deductible: '10%' }
            ]
          }
        ]
      };

      const response = await processChatMessage(
        '¿Qué coberturas tiene AXA?',
        reportContext,
        'user-123'
      );

      // Should contain quote source indicator
      expect(response.text).toContain('📄');
      expect(response.source).toBe('direct');
    });

    it('should save source metadata to database', async () => {
      const { chatRepository } = await import('../../repositories/chatRepository');
      
      const reportContext = {
        id: 'report-123',
        quotes: [
          {
            insurerName: 'AXA',
            coverages: [
              { name: 'Incendio', value: '$500M', deductible: '10%' }
            ]
          }
        ]
      };

      await processChatMessage(
        '¿Qué deducible tiene incendio?',
        reportContext,
        'user-123'
      );

      // Verify model response was saved with sources
      const lastCall = vi.mocked(chatRepository.saveMessage).mock.calls.pop();
      expect(lastCall).toBeDefined();
      
      const messageData = lastCall![1] as any;
      expect(messageData.sources_used).toBeDefined();
      expect(Array.isArray(messageData.sources_used)).toBe(true);
    });
  });
});
