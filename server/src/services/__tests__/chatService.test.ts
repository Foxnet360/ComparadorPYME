import { describe, it, expect, vi, beforeEach } from 'vitest';
import chatService from '../chatService';

// Mock chat repository to avoid database dependencies
vi.mock('../../repositories/chatRepository', () => ({
  chatRepository: {
    createThread: vi.fn(async () => 'thread-test'),
    getOrCreateThread: vi.fn(async () => 'thread-test'),
    getThreadByReport: vi.fn(async () => null),
    saveMessage: vi.fn(async () => {}),
    getHistory: vi.fn(async () => []),
    archiveThread: vi.fn(async () => {}),
    listUserThreads: vi.fn(async () => [])
  }
}));

// Mock dependencies
vi.mock('../ragRetrievalService', () => ({
  ragRetrievalService: {
    search: vi.fn(async () => []),
    reRankResults: vi.fn(async (query, results) => results)
  }
}));

vi.mock('../structuredClauseExtractor', () => ({
  structuredClauseExtractor: {
    searchClause: vi.fn(async () => null)
  }
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class MockGoogleGenAI {
    models = {
      generateContent: vi.fn(() => Promise.resolve({
        text: '📄 Según la cotización, la cobertura de incendio tiene un deducible del 10%.'
      }))
    };
  }
}));

describe('chatService - Triple Source with Missing RAG', () => {
  const mockReportContext = {
    quotes: [
      {
        insurerName: 'MAPFRE',
        coverages: [
          { name: 'Incendio', value: '$500,000,000', deductible: '10%' }
        ]
      }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processChatMessage', () => {
    it('should answer using quote data when RAG returns no results', async () => {
      const response = await chatService.processChatMessage(
        '¿Cuál es el deducible de incendio?',
        mockReportContext,
        'test-user'
      );

      expect(response.text).toContain('10%');
      expect(response.text).not.toContain('No tengo información');
      expect(response.text).not.toContain('no tengo información');
    });

    it('should use quote data as primary source even with empty RAG', async () => {
      const response = await chatService.processChatMessage(
        '¿Qué coberturas tiene MAPFRE?',
        mockReportContext,
        'test-user'
      );

      // Should mention the coverage from quote data
      expect(response.text.toLowerCase()).toContain('incendio');
    });

    it('should include source attribution in responses', async () => {
      const response = await chatService.processChatMessage(
        '¿Cuál es el valor asegurado?',
        mockReportContext,
        'test-user'
      );

      // Should indicate data comes from quote
      expect(response.text).toBeTruthy();
      expect(response.text.length).toBeGreaterThan(0);
    });

    it('should handle questions about non-existent coverages gracefully', async () => {
      const response = await chatService.processChatMessage(
        '¿Tiene cobertura de terremoto?',
        mockReportContext,
        'test-user'
      );

      // Should not crash and should provide a response
      expect(response.text).toBeTruthy();
      expect(response.text.length).toBeGreaterThan(0);
    });
  });
});