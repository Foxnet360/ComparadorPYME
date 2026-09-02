import { useState, useCallback } from 'react';
import { CorrectionQueue } from '../services/correctionQueue';
import { apiClient } from '../services/apiClient';

interface CorrectionInput {
  rawName: string;
  insurerName: string;
  systemMapping: string;
  userCorrection: string;
  correctionType?: 'coverage_mapping' | 'deductible' | 'exclusion' | 'value';
  quoteId?: string;
  rawTextSnippet?: string;
  aiJustification?: string;
  pageNumber?: number;
}

interface CorrectionResult {
  success: boolean;
  id?: string;
  error?: string;
  offline?: boolean;
}

interface UseOptimisticCorrectionReturn {
  pendingCorrections: Map<string, CorrectionInput>;
  submitCorrection: (correction: CorrectionInput) => Promise<CorrectionResult>;
  isPending: (rawName: string, insurerName: string) => boolean;
}

/**
 * Hook para manejar correcciones con estado optimista.
 * Actualiza la UI inmediatamente y maneja la sincronización con el backend.
 */
export function useOptimisticCorrection(): UseOptimisticCorrectionReturn {
  const [pendingCorrections, setPendingCorrections] = useState<Map<string, CorrectionInput>>(
    new Map()
  );

  const generateCorrectionId = (rawName: string, insurerName: string): string => {
    return `${insurerName}::${rawName}::${Date.now()}`;
  };

  const submitCorrection = useCallback(
    async (correction: CorrectionInput): Promise<CorrectionResult> => {
      const correctionId = generateCorrectionId(correction.rawName, correction.insurerName);

      // Agregar a pending
      setPendingCorrections((prev) => {
        const next = new Map(prev);
        next.set(correctionId, correction);
        return next;
      });

      try {
        // Check if online
        if (!navigator.onLine) {
          // Save to offline queue
          const queueId = CorrectionQueue.add({
            ...correction,
            correctionType: correction.correctionType || 'coverage_mapping',
          });

          // Remover de pending
          setPendingCorrections((prev) => {
            const next = new Map(prev);
            next.delete(correctionId);
            return next;
          });

          return { success: true, id: queueId, offline: true };
        }

        // Goes through apiClient so the request carries the Bearer token;
        // /api/analysis/correction requires authentication (AUTH-1).
        // apiClient.fetch throws on non-2xx responses.
        const response = await apiClient.fetch('/analysis/correction', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...correction,
            correctionType: correction.correctionType || 'coverage_mapping',
          }),
        });

        const data = await response.json();

        // Remover de pending
        setPendingCorrections((prev) => {
          const next = new Map(prev);
          next.delete(correctionId);
          return next;
        });

        return { success: true, id: data.id };
      } catch (error) {
        // If network error, save to queue
        if (!navigator.onLine || (error instanceof Error && error.message.includes('fetch'))) {
          const queueId = CorrectionQueue.add({
            ...correction,
            correctionType: correction.correctionType || 'coverage_mapping',
          });

          // Remover de pending
          setPendingCorrections((prev) => {
            const next = new Map(prev);
            next.delete(correctionId);
            return next;
          });

          return { success: true, id: queueId, offline: true };
        }

        // Remover de pending
        setPendingCorrections((prev) => {
          const next = new Map(prev);
          next.delete(correctionId);
          return next;
        });

        return {
          success: false,
          error: error instanceof Error ? error.message : 'Error desconocido',
        };
      }
    },
    []
  );

  const isPending = useCallback(
    (rawName: string, insurerName: string): boolean => {
      const key = `${insurerName}::${rawName}`;
      for (const [id] of pendingCorrections) {
        if (id.startsWith(key)) {
          return true;
        }
      }
      return false;
    },
    [pendingCorrections]
  );

  return {
    pendingCorrections,
    submitCorrection,
    isPending,
  };
}
