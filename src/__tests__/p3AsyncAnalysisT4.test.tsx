import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppStatus } from '../../types';
import { AnalysisProvider, UIProvider } from '../../contexts';

const mockFetch = vi.fn();

vi.mock('../../services/storageService', () => ({
  storageService: {
    getClients: vi.fn().mockResolvedValue([]),
    saveAnalysis: vi.fn().mockResolvedValue('saved-1'),
  },
}));

vi.mock('../../services/apiClient', async () => {
  const actual = await vi.importActual<typeof import('../../services/apiClient')>(
    '../../services/apiClient'
  );
  return {
    ...actual,
    apiClient: {
      fetch: (...args: unknown[]) => mockFetch(...args),
    },
  };
});

describe('P3-T4: Frontend Async 202 Polling & Cancellation Flow (S4)', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('handles HTTP 202 async job polling, reports stage progress, and resolves final ComparisonReport', async () => {
    const { analyzeQuotesWithGemini } = await import('../../services/geminiService');
    const stages: Array<{ stage?: string; progress?: number; message?: string }> = [];

    const finalReport = {
      quotes: [{ insurerName: 'SURA', priceAnnual: 4000000 }],
      recommendation: 'SURA recomendada',
      marketAnalysis: 'Mercado estable',
      deductibleComparison: [],
      timestamp: new Date().toISOString(),
      analysisVersion: '2.0',
    };

    mockFetch
      .mockResolvedValueOnce({
        status: 202,
        ok: true,
        json: async () => ({
          jobId: 'job-async-1',
          status: 'queued',
          progress: 5,
          statusUrl: '/api/analysis/jobs/job-async-1',
          eventsUrl: '/api/analysis/jobs/job-async-1/events',
          cancelUrl: '/api/analysis/jobs/job-async-1/cancel',
        }),
      })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          jobId: 'job-async-1',
          stage: 'parsing',
          progress: 35,
          message: 'Extrayendo tablas de cotizaciones...',
        }),
      })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          jobId: 'job-async-1',
          stage: 'completed',
          progress: 100,
          message: 'Análisis completado',
          result: finalReport,
        }),
      });

    const quoteFile = new File(['%PDF'], 'sura.pdf', { type: 'application/pdf' });
    const report = await analyzeQuotesWithGemini(
      [quoteFile],
      [],
      'Cliente Test',
      undefined,
      undefined,
      'pyme',
      'new',
      null,
      null,
      {
        onStageProgress: (p) => stages.push(p),
        pollIntervalMs: 5,
      }
    );

    expect(report.recommendation).toBe('SURA recomendada');
    expect(stages.some((s) => s.stage === 'parsing' && s.progress === 35)).toBe(true);
    expect(stages.some((s) => s.stage === 'completed' && s.progress === 100)).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      '/analyze',
      expect.objectContaining({
        headers: expect.objectContaining({ Prefer: 'respond-async' }),
      })
    );
  });

  it('renders real progress percentage and cancel button during AppStatus.ANALYZING in AnalyzerPage', async () => {
    const { default: AnalyzerPage } = await import('../../pages/AnalyzerPage');
    const { useAnalysis } = await import('../../contexts/AnalysisContext');

    const TriggerAnalyzing: React.FC = () => {
      const { dispatch } = useAnalysis();
      React.useEffect(() => {
        dispatch({ type: 'SET_STATUS', payload: AppStatus.ANALYZING });
        dispatch({ type: 'SET_PROGRESS', payload: 64 });
        dispatch({ type: 'SET_STATUS_MESSAGE', payload: 'Normalizando coberturas...' });
      }, [dispatch]);
      return <AnalyzerPage onAnalysisComplete={vi.fn()} />;
    };

    render(
      <UIProvider>
        <AnalysisProvider>
          <TriggerAnalyzing />
        </AnalysisProvider>
      </UIProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('64%')).toBeTruthy();
      expect(screen.getByRole('button', { name: /cancelar análisis/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /cancelar análisis/i }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /cancelar análisis/i })).toBeNull();
    });
  });
});
