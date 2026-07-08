import { ComparisonReport } from '../types';
import { apiClient } from './apiClient';

export const analyzeQuotesWithGemini = async (
  quoteFiles: File[],
  clauseFiles: File[],
  clientName: string,
  onStatusUpdate?: (status: string) => void,
  clauseIds?: string[] // NEW: Support for clause IDs from library
): Promise<ComparisonReport> => {
  const formData = new FormData();
  formData.append('clientName', clientName);

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
    const response = await apiClient.fetch('/analyze', {
      method: 'POST',
      body: formData,
    });

    if (onStatusUpdate) onStatusUpdate('Procesando con Gemini Advanced (RAG)...');

    const result = await response.json();
    return result as ComparisonReport;
  } catch (error) {
    console.error('API Error:', error);

    const rawMessage = error instanceof Error ? error.message : String(error);

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
