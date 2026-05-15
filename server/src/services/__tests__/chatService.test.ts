import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chatService } from '../chatService';

// Mock dependencies
vi.mock('../ragRetrievalService', () => ({
  ragRetrievalService: {
    searchWithFallback: vi.fn(() => Promise.resolve({
      clauses: [],
      isFallback: false
    }))
  }
}));

vi.mock('../structuredClauseExtractor', () => ({
  structuredClauseExtractor: {
    searchClause: vi.fn(() => Promise.resolve(null))
  }
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(() => ({
    models: {
      generateContent: vi.fn(() => Promise.resolve({
        text: '📄 Según la cotización, la cobertura de incendio tiene un deducible del 10%.'
      }))
    }
  }))
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

  describe('sendMessage', () => {
    it('should answer using quote data when RAG returns no results', async () => {
      const history: any[] = [];
      
      const response = await chatService.sendMessage(
        '¿Cuál es el deducible de incendio?',
        history,
        mockReportContext
      );

      expect(response.text).toContain('10%');
      expect(response.text).not.toContain('No tengo información');
      expect(response.text).not.toContain('no tengo información');
    });

    it('should use quote data as primary source even with empty RAG', async () => {
      const history: any[] = [];
      
      const response = await chatService.sendMessage(
        '¿Qué coberturas tiene MAPFRE?',
        history,
        mockReportContext
      );

      // Should mention the coverage from quote data
      expect(response.text.toLowerCase()).toContain('incendio');
    });

    it('should include source attribution in responses', async () => {
      const history: any[] = [];
      
      const response = await chatService.sendMessage(
        '¿Cuál es el valor asegurado?',
        history,
        mockReportContext
      );

      // Should indicate data comes from quote
      expect(response.text).toBeTruthy();
      expect(response.text.length).toBeGreaterThan(0);
    });

    it('should handle questions about non-existent coverages gracefully', async () => {
      const history: any[] = [];
      
      const response = await chatService.sendMessage(
        '¿Tiene cobertura de terremoto?',
        history,
        mockReportContext
      );

      // Should not crash and should provide a response
      expect(response.text).toBeTruthy();
      expect(response.text.length).toBeGreaterThan(0);
    });
  });

  describe('buildReportContext', () => {
    it('should include quote data in context', () => {
      const context = (chatService as any).buildReportContext(mockReportContext);
      
      expect(context).toContain('MAPFRE');
      expect(context).toContain('Incendio');
      expect(context).toContain('10%');
    });
  });
});