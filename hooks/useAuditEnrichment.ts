import { useState, useCallback } from 'react';
import { apiClient, SessionExpiredError } from '../services/apiClient';
import { EnrichedAlert, CrossInsurerRisk, QuoteAnalysis } from '../types';

export interface AuditEnrichmentState {
  enrichedAlerts: EnrichedAlert[];
  crossInsurerRisks: CrossInsurerRisk[];
  businessContextAnalysis: string;
  hasClauses: boolean;
  isLoading: boolean;
  error: string | null;
  isEnriched: boolean;
  progress: {
    current: number;
    total: number;
    percentage: number;
  } | null;
}

export const buildAuditEnrichmentCacheKey = (quotes: QuoteAnalysis[]): string => {
  const signature = quotes
    .map((q) =>
      [
        q.insurerName || '',
        q.policyName || '',
        q.priceAnnual ?? '',
        q.coverages?.length ?? 0,
        q.coverages?.[0]?.name || '',
      ].join(':')
    )
    .join('|');
  let hash = 0;
  for (let i = 0; i < signature.length; i += 1) {
    hash = (hash * 31 + signature.charCodeAt(i)) | 0;
  }
  return `audit-enrichment-${(hash >>> 0).toString(36)}-${quotes.length}`;
};

export const useAuditEnrichment = () => {
  const [state, setState] = useState<AuditEnrichmentState>({
    enrichedAlerts: [],
    crossInsurerRisks: [],
    businessContextAnalysis: '',
    hasClauses: false,
    isLoading: false,
    error: null,
    isEnriched: false,
    progress: null,
  });

  const enrich = useCallback(async (quotes: QuoteAnalysis[]) => {
    // Check sessionStorage for cached results
    const cacheKey = buildAuditEnrichmentCacheKey(quotes);
    const cached = sessionStorage.getItem(cacheKey);

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setState({
          ...parsed,
          isLoading: false,
          error: null,
          isEnriched: true,
          progress: null,
        });
        return;
      } catch (e) {
        console.warn('Failed to parse cached enrichment:', e);
      }
    }

    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
      progress: { current: 0, total: 0, percentage: 0 },
    }));

    try {
      const response = await apiClient.fetch('/audit/enrich', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ quotes }),
      });

      const result = await response.json();

      const newState: AuditEnrichmentState = {
        enrichedAlerts: result.enrichedAlerts || [],
        crossInsurerRisks: result.crossInsurerRisks || [],
        businessContextAnalysis: result.businessContextAnalysis || '',
        hasClauses: result.hasClauses || false,
        isLoading: false,
        error: null,
        isEnriched: true,
        progress: result.progress || null,
      };

      // Cache results
      sessionStorage.setItem(
        cacheKey,
        JSON.stringify({
          enrichedAlerts: newState.enrichedAlerts,
          crossInsurerRisks: newState.crossInsurerRisks,
          businessContextAnalysis: newState.businessContextAnalysis,
          hasClauses: newState.hasClauses,
        })
      );

      setState(newState);
    } catch (error) {
      console.error('Audit enrichment error:', error);
      const rawMessage = error instanceof Error ? error.message : 'Failed to enrich audit';
      const friendlyError =
        error instanceof SessionExpiredError
          ? 'Inicia sesión para enriquecer con clausulados.'
          : rawMessage.includes('413')
            ? 'El reporte es demasiado grande para enriquecer. Intenta con menos cotizaciones o recarga la página.'
            : rawMessage.includes('429')
              ? 'Demasiadas solicitudes. Espera un momento e intenta de nuevo.'
              : rawMessage;
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: friendlyError,
        isEnriched: false,
        progress: null,
      }));
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      enrichedAlerts: [],
      crossInsurerRisks: [],
      businessContextAnalysis: '',
      hasClauses: false,
      isLoading: false,
      error: null,
      isEnriched: false,
      progress: null,
    });
  }, []);

  return {
    ...state,
    enrich,
    reset,
  };
};

export default useAuditEnrichment;
