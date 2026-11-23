import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

import { createGracefulShutdown } from '../index';
import {
  createCampaignScheduler,
  startCampaignScheduler,
  stopCampaignScheduler,
} from '../services/campaignScheduler';
import { processChatMessage } from '../services/chatService';
import { chatRepository } from '../repositories/chatRepository';
import { getGenAI } from '../services/geminiClient';

vi.mock('../repositories/chatRepository', () => ({
  chatRepository: {
    verifyThreadOwnership: vi.fn(async () => true),
    getThread: vi.fn(async () => ({ id: 't1', user_id: 'u1', report_context: {} })),
    saveMessage: vi.fn(async () => ({ id: 'm1' })),
    getHistory: vi.fn(async () => []),
  },
}));

vi.mock('../services/ragRetrievalService', () => ({
  ragRetrievalService: { retrieveRelevantChunks: vi.fn(async () => []) },
}));

vi.mock('../services/structuredClauseExtractor', () => ({
  structuredClauseExtractor: { queryStructuredClauses: vi.fn(async () => []) },
}));

describe('P1 Backend Shutdown & Gemini Centralization (T3 / S3a)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stopCampaignScheduler();
  });

  it('graceful shutdown stops scheduler, closes server, and exits once on signal', async () => {
    const close = vi.fn((cb?: (err?: Error) => void) => cb?.());
    const stopScheduler = vi.fn();
    const exitFn = vi.fn();

    const shutdown = createGracefulShutdown({
      server: { close } as never,
      stopScheduler,
      exitFn,
      timeoutMs: 5000,
    });

    await shutdown('SIGTERM');
    await shutdown('SIGINT');

    expect(stopScheduler).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(exitFn).toHaveBeenCalledWith(0);
  });

  it('stopCampaignScheduler stops active cron task and allows clean restart', () => {
    const stopSpy = vi.fn();
    const handle = createCampaignScheduler({
      enabled: true,
      schedule: '0 6 * * *',
      tick: async () => {},
      lock: { acquire: async () => false, release: async () => {} },
      scheduleFn: () => ({ stop: stopSpy }),
    });
    expect(handle).not.toBeNull();
    handle?.stop();
    expect(stopSpy).toHaveBeenCalledTimes(1);

    const disabled = startCampaignScheduler({ CAMPAIGN_SCHEDULER_ENABLED: 'false' });
    expect(disabled).toBeNull();
    stopCampaignScheduler();
  });

  it('centralizes getGenAI() and Gemini model defaults in env.ts across runtime services and routes', () => {
    const serverRoot = join(__dirname, '..');
    const getGenAiConsumers = [
      'services/unifiedComparison/unifiedComparisonEngine.ts',
      'services/unifiedComparison/deepClauseValidator.ts',
      'services/clauseSearchStore.ts',
      'services/healthCheckService.ts',
    ];
    for (const rel of getGenAiConsumers) {
      const text = readFileSync(join(serverRoot, rel), 'utf8');
      expect(text).not.toMatch(/new GoogleGenAI\s*\(/);
      expect(text).toContain('getGenAI');
    }

    const noHardcodedModels = [
      'services/unifiedComparison/unifiedComparisonEngine.ts',
      'services/unifiedComparison/deepClauseValidator.ts',
      'services/chatService.ts',
      'services/twoStageExtraction/globalStructureExtractor.ts',
      'services/twoStageExtraction/focalizedCoverageExtractor.ts',
      'services/semanticMatcher.ts',
      'routes/monitoring.ts',
      'routes/comparisonRoutes.ts',
    ];
    for (const rel of noHardcodedModels) {
      const text = readFileSync(join(serverRoot, rel), 'utf8');
      expect(text).not.toMatch(/gemini-4-hydrogen|gemini-3\.8-flash/);
    }

    const indexSource = readFileSync(join(serverRoot, 'index.ts'), 'utf8');
    expect(indexSource).toContain('SIGTERM');
    expect(indexSource).toContain('SIGINT');
  });

  it('chatService captures real Gemini usageMetadata token counts when returned', async () => {
    const generateContent = vi.fn(async () => ({
      text: '📄 Respuesta precisa de prueba.',
      usageMetadata: {
        promptTokenCount: 321,
        candidatesTokenCount: 123,
        totalTokenCount: 444,
      },
    }));
    const ai = getGenAI();
    vi.spyOn(ai.models, 'generateContent').mockImplementation(generateContent as never);

    const res = await processChatMessage('¿Qué cubre?', { quotes: [] }, 'u1', 'thread-1');

    expect(res.tokensUsed).toBe(444);
    expect(chatRepository.saveMessage).toHaveBeenLastCalledWith(
      'thread-1',
      expect.objectContaining({
        role: 'model',
        tokens_input: 321,
        tokens_output: 123,
      })
    );
  });
});
