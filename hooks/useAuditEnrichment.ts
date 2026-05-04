import { useState, useCallback } from 'react';
import { API_BASE_URL } from '../services/apiConfig';
import { EnrichedAlert, CrossInsurerRisk } from '../types';

export interface AuditEnrichmentState {
  enrichedAlerts: EnrichedAlert[];
  crossInsurerRisks: CrossInsurerRisk[];
  businessContextAnalysis: string;
  hasClauses: boolean;
  isLoading: boolean;
  error: string | null;
  isEnriched: boolean;
}

export const useAuditEnrichment = () => {
  const [state, setState] = useState<AuditEnrichmentState>({
    enrichedAlerts: [],
    crossInsurerRisks: [],
    businessContextAnalysis: '',
    hasClauses: false,
    isLoading: false,
    error: null,
    isEnriched: false
  });

  const enrich = useCallback(async (quotes: any[]) => {
    // Check sessionStorage for cached results
    const cacheKey = `audit-enrichment-${quotes.map(q => q.insurerName).join('-')}`;
    const cached = sessionStorage.getItem(cacheKey);
    
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setState({
          ...parsed,
          isLoading: false,
          error: null,
          isEnriched: true
        });
        return;
      } catch (e) {
        console.warn('Failed to parse cached enrichment:', e);
      }
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`${API_BASE_URL}/audit/enrich`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ quotes })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }

      const result = await response.json();
      
      const newState: AuditEnrichmentState = {
        enrichedAlerts: result.enrichedAlerts || [],
        crossInsurerRisks: result.crossInsurerRisks || [],
        businessContextAnalysis: result.businessContextAnalysis || '',
        hasClauses: result.hasClauses || false,
        isLoading: false,
        error: null,
        isEnriched: true
      };

      // Cache results
      sessionStorage.setItem(cacheKey, JSON.stringify({
        enrichedAlerts: newState.enrichedAlerts,
        crossInsurerRisks: newState.crossInsurerRisks,
        businessContextAnalysis: newState.businessContextAnalysis,
        hasClauses: newState.hasClauses
      }));

      setState(newState);
    } catch (error) {
      console.error('Audit enrichment error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to enrich audit',
        isEnriched: false
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
      isEnriched: false
    });
  }, []);

  return {
    ...state,
    enrich,
    reset
  };
};

export default useAuditEnrichment;
