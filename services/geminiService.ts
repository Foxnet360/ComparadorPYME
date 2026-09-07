import { ComparisonReport } from '../types';
import {
  apiClient,
  ApiTimeoutError,
  SessionExpiredError,
  DEFAULT_API_TIMEOUT_MS,
} from './apiClient';

export const analyzeQuotesWithGemini = async (
  quoteFiles: File[],
  clauseFiles: File[],
  clientName: string,
  onStatusUpdate?: (status: string) => void,
  clauseIds?: string[],
  domain: string = 'pyme'
): Promise<ComparisonReport> => {
  const formData = new FormData();
  formData.append('clientName', clientName);
  formData.append('domain', domain);
  // AUTH-2: no userId here — the backend derives it from the Bearer token
  // that apiClient attaches, and rejects client-supplied userId with 400.

  if (onStatusUpdate) onStatusUpdate('Preparando archivos para envío...');

  quoteFiles.forEach((file) => formData.append('quotes', file));

  // NEW: Use clauseIds from library if provided, otherwise use uploaded files
  if (clauseIds && clauseIds.length > 0) {
    formData.append('clauseIds', JSON.stringify(clauseIds));
    if (onStatusUpdate) onStatusUpdate('Usando clausulados de biblioteca (optimizado)...');
  } else {
    clauseFiles.forEach((file) => formData.append('clauses', file));
  }

  if (onStatusUpdate) onStatusUpdate('Subiendo archivos al servidor seguro (Cloud Run)...');

  try {
    // ERR-3: the analysis call is bounded and cancellable — if the backend
    // stalls beyond the timeout, apiClient aborts the request.
    const response = await apiClient.fetch('/analyze', {
      method: 'POST',
      body: formData,
      timeoutMs: DEFAULT_API_TIMEOUT_MS,
    });

    if (onStatusUpdate) onStatusUpdate('Procesando con Gemini Advanced (RAG)...');

    const result = await response.json();
    return result as ComparisonReport;
  } catch (error) {
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

// Chat functionality is now handled by the backend API directly
// See components/ChatBot.tsx for the frontend implementation
