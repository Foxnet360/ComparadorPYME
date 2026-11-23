import { ComparisonReport } from '../types';
import type { AnalysisMode, Client, RenewalAnalysisContext } from '../types';
import {
  apiClient,
  ApiTimeoutError,
  SessionExpiredError,
  ANALYZE_API_TIMEOUT_MS,
} from './apiClient';

export class AnalysisCancelledError extends Error {
  constructor(message = 'Análisis cancelado por el usuario.') {
    super(message);
    this.name = 'AnalysisCancelledError';
  }
}

export interface AnalyzeStageProgress {
  stage?: string;
  progress?: number;
  message?: string;
}

export interface AnalyzeQuotesOptions {
  onStageProgress?: (progress: AnalyzeStageProgress) => void;
  signal?: AbortSignal;
  pollIntervalMs?: number;
  preferAsync?: boolean;
}

interface AsyncJobAcceptedResponse {
  jobId: string;
  status?: string;
  progress?: number;
  statusUrl?: string;
  eventsUrl?: string;
  cancelUrl?: string;
}

interface AsyncJobSnapshot {
  jobId: string;
  stage: 'queued' | 'parsing' | 'matching' | 'auditing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  message?: string;
  result?: ComparisonReport;
  error?: string;
}

function waitWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AnalysisCancelledError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new AnalysisCancelledError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function pollAsyncAnalysisJob(
  accepted: AsyncJobAcceptedResponse,
  options?: AnalyzeQuotesOptions,
  onStatusUpdate?: (status: string) => void
): Promise<ComparisonReport> {
  const statusUrl = accepted.statusUrl || `/analysis/jobs/${accepted.jobId}`;
  const cancelUrl = accepted.cancelUrl || `/analysis/jobs/${accepted.jobId}/cancel`;
  const pollIntervalMs = Math.max(5, options?.pollIntervalMs ?? 1200);

  if (options?.onStageProgress) {
    options.onStageProgress({
      stage: accepted.status || 'queued',
      progress: accepted.progress ?? 5,
      message: 'Análisis en cola...',
    });
  }

  let cancelRequested = false;
  const triggerCancel = () => {
    if (cancelRequested) return;
    cancelRequested = true;
    void apiClient.fetch(cancelUrl, { method: 'POST' }).catch(() => undefined);
  };

  if (options?.signal) {
    if (options.signal.aborted) {
      triggerCancel();
      throw new AnalysisCancelledError();
    }
    options.signal.addEventListener('abort', triggerCancel, { once: true });
  }

  try {
    // Poll job status with bounded intervals; backend cleans up temp files cleanly
    for (;;) {
      if (options?.signal?.aborted) {
        triggerCancel();
        throw new AnalysisCancelledError();
      }

      const pollRes = await apiClient.fetch(statusUrl, {
        method: 'GET',
        signal: options?.signal,
      });
      const snapshot = (await pollRes.json()) as AsyncJobSnapshot;

      if (snapshot.message && onStatusUpdate) {
        onStatusUpdate(snapshot.message);
      }
      if (options?.onStageProgress) {
        options.onStageProgress({
          stage: snapshot.stage,
          progress: snapshot.progress,
          message: snapshot.message,
        });
      }

      if (snapshot.stage === 'completed' && snapshot.result) {
        return snapshot.result;
      }
      if (snapshot.stage === 'cancelled') {
        throw new AnalysisCancelledError(snapshot.message || 'Análisis cancelado por el usuario.');
      }
      if (snapshot.stage === 'failed') {
        throw new Error(snapshot.error || snapshot.message || 'Error en el análisis.');
      }

      await waitWithSignal(pollIntervalMs, options?.signal);
    }
  } finally {
    options?.signal?.removeEventListener('abort', triggerCancel);
  }
}

export const analyzeQuotesWithGemini = async (
  quoteFiles: File[],
  clauseFiles: File[],
  clientName: string,
  onStatusUpdate?: (status: string) => void,
  clauseIds?: string[],
  domain: string = 'pyme',
  // Renewal mode (renovacion-polizas, R5.1/R5.4): optional — when absent the
  // request is byte-identical to the NEW-mode contract (XC-3). AUTH-2: the
  // backend still derives ownership from the session; these fields only
  // discriminate the analysis type and link portfolio rows.
  analysisMode: AnalysisMode = 'new',
  renewalContext?: RenewalAnalysisContext | null,
  selectedClient?: Client | null,
  options?: AnalyzeQuotesOptions
): Promise<ComparisonReport> => {
  const formData = new FormData();
  formData.append('clientName', clientName);
  formData.append('domain', domain);
  if (selectedClient) {
    formData.append('clientProfile', JSON.stringify(selectedClient));
    if (selectedClient.industry) {
      formData.append('clientActivity', selectedClient.industry);
    }
    const loc = [selectedClient.address, selectedClient.city, selectedClient.department]
      .filter(Boolean)
      .join(', ');
    if (loc) {
      formData.append('clientLocation', loc);
    }
  }
  // AUTH-2: no userId here — the backend derives it from the Bearer token
  // that apiClient attaches, and rejects client-supplied userId with 400.

  if (analysisMode === 'renewal' && renewalContext) {
    formData.append('analysisType', 'renewal');
    formData.append('policyId', renewalContext.policyId);
    formData.append('renewalId', renewalContext.renewalId);
  }

  if (onStatusUpdate) onStatusUpdate('Preparando archivos para envío...');

  quoteFiles.forEach((file) => formData.append('quotes', file));

  // Support both library clauses and supplemental uploaded clauses simultaneously
  if (clauseIds && clauseIds.length > 0) {
    formData.append('clauseIds', JSON.stringify(clauseIds));
    if (onStatusUpdate) onStatusUpdate('Usando clausulados de biblioteca (optimizado)...');
  }
  if (clauseFiles && clauseFiles.length > 0) {
    clauseFiles.forEach((file) => formData.append('clauses', file));
    if (onStatusUpdate) onStatusUpdate('Adjuntando clausulados adicionales subidos...');
  }

  if (onStatusUpdate) onStatusUpdate('Subiendo archivos al servidor seguro (Cloud Run)...');

  try {
    // ERR-3: the analysis call is bounded and cancellable — if the backend
    // stalls beyond the timeout, apiClient aborts the request.
    const preferAsync = options?.preferAsync !== false;
    const response = await apiClient.fetch('/analyze', {
      method: 'POST',
      body: formData,
      timeoutMs: ANALYZE_API_TIMEOUT_MS,
      signal: options?.signal,
      ...(preferAsync ? { headers: { Prefer: 'respond-async' } } : {}),
    });

    if (response.status === 202) {
      const accepted = (await response.json()) as AsyncJobAcceptedResponse;
      return await pollAsyncAnalysisJob(accepted, options, onStatusUpdate);
    }

    if (onStatusUpdate) onStatusUpdate('Procesando con Gemini Advanced (RAG)...');

    const result = await response.json();
    return result as ComparisonReport;
  } catch (error) {
    if (error instanceof AnalysisCancelledError) {
      throw error;
    }
    if (options?.signal?.aborted) {
      throw new AnalysisCancelledError();
    }
    console.error('API Error:', error);

    if (error instanceof ApiTimeoutError) {
      throw new Error(
        'El análisis excedió el tiempo máximo permitido. Intenta de nuevo o sube menos archivos a la vez.'
      );
    }

    const rawMessage = error instanceof Error ? error.message : String(error);

    if (error instanceof SessionExpiredError) {
      // Preserve the typed error so callers can prompt login.
      throw error;
    }

    if (rawMessage.includes('Sesión expirada')) {
      throw new Error('Sesión expirada. Por favor inicia sesión nuevamente.');
    }

    throw new Error(
      rawMessage || 'Error al analizar las cotizaciones. Inténtalo de nuevo más tarde.'
    );
  }
};

/**
 * Appends one or more late-arriving quote PDFs to an existing comparison.
 */
export const appendQuotesToComparison = async (
  analysisId: string,
  quoteFiles: File[],
  domain: string = 'pyme'
): Promise<ComparisonReport> => {
  const formData = new FormData();
  formData.append('domain', domain);
  quoteFiles.forEach((file) => {
    formData.append('quotes', file);
  });

  const response = await apiClient.fetch(`/analysis/${analysisId}/quotes`, {
    method: 'POST',
    body: formData,
    timeoutMs: ANALYZE_API_TIMEOUT_MS,
  });

  return (await response.json()) as ComparisonReport;
};

// Chat functionality is now handled by the backend API directly
// See components/ChatBot.tsx for the frontend implementation
