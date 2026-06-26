import { useState, useEffect, useCallback, useRef } from 'react';
import { QuoteAnalysis, DeductibleAnalysis, ContextualRisk, WarrantyCompliance, LegalOpinion } from '../types';

interface AdvancedAnalysisState {
  deductibleAnalysis: DeductibleAnalysis[] | null;
  inverseCheck: unknown | null;
  contextualRisk: ContextualRisk | null;
  warrantyCompliance: WarrantyCompliance | null;
  legalOpinion: LegalOpinion[] | null;
  loading: boolean;
  error: string | null;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

// Cache configuration
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const analysisCache = new Map<string, CacheEntry>();

/**
 * Generate a simple hash for a quote object
 */
function getQuoteHash(quote: QuoteAnalysis): string {
  const key = `${quote.insurerName}-${quote.coverages.map(c => c.name).join(',')}-${quote.coverages.map(c => c.deductible).join(',')}`;
  return key;
}

/**
 * Fetch with exponential backoff retry
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // Don't retry on 4xx errors (client errors)
      if (response.status >= 400 && response.status < 500) {
        return response;
      }
      
      // Retry on 5xx errors and network failures
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries) {
        // Exponential backoff: delay * 2^attempt + jitter
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Get cached data if valid, otherwise null
 */
function getCachedData(cacheKey: string): unknown | null {
  const entry = analysisCache.get(cacheKey);
  if (entry && Date.now() - entry.timestamp < CACHE_DURATION_MS) {
    return entry.data;
  }
  analysisCache.delete(cacheKey);
  return null;
}

/**
 * Set data in cache
 */
function setCachedData(cacheKey: string, data: unknown): void {
  analysisCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });
}

/**
 * Hook to fetch advanced analysis data for a quote
 * Note: Most advanced analysis data now comes bundled with /api/analyze response
 * This hook is useful for re-fetching or getting additional analysis
 */
export const useAdvancedAnalysis = (quote: QuoteAnalysis | null) => {
  const [state, setState] = useState<AdvancedAnalysisState>({
    deductibleAnalysis: null,
    inverseCheck: null,
    contextualRisk: null,
    warrantyCompliance: null,
    legalOpinion: null,
    loading: false,
    error: null
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchAdvancedAnalysis = useCallback(async () => {
    if (!quote) return;

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    // If data already exists in quote, use it
    if (quote.deductibleAnalysis || quote.contextualRisk || quote.warrantyCompliance || quote.legalOpinion) {
      setState(prev => ({
        ...prev,
        deductibleAnalysis: quote.deductibleAnalysis || null,
        contextualRisk: quote.contextualRisk || null,
        warrantyCompliance: quote.warrantyCompliance || null,
        legalOpinion: quote.legalOpinion || null,
        loading: false
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const quoteHash = getQuoteHash(quote);

      // Define analysis endpoints with their cache keys
      const analysisCalls = [
        {
          type: 'deductible-risk',
          cacheKey: `${quoteHash}:deductible-risk`,
          fetchFn: () => fetchWithRetry(
            `${API_BASE_URL}/analysis/deductible-risk`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                coverageName: quote.coverages[0]?.name || 'General',
                quoteDeductible: quote.coverages[0]?.deductible || '10%',
                insuredAmount: parseFloat(quote.coverages[0]?.value?.replace(/[^\d]/g, '') || '0')
              }),
              signal
            }
          )
        },
        {
          type: 'inverse-check',
          cacheKey: `${quoteHash}:inverse-check`,
          fetchFn: () => fetchWithRetry(
            `${API_BASE_URL}/analysis/inverse-check`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                quote: {
                  insurerName: quote.insurerName,
                  coverages: quote.coverages
                },
                insurerName: quote.insurerName
              }),
              signal
            }
          )
        }
      ];

      // Check cache first for each analysis type
      const cachedResults = analysisCalls.map(call => ({
        ...call,
        cached: getCachedData(call.cacheKey)
      }));

      // Only fetch what isn't cached
      const fetchPromises = cachedResults
        .filter(item => !item.cached)
        .map(async (item) => {
          try {
            const response = await item.fetchFn();
            const data = await response.json().catch(() => null);
            setCachedData(item.cacheKey, data);
            return { type: item.type, data };
          } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
              throw error;
            }
            return { type: item.type, data: null, error };
          }
        });

      const fetchedResults = await Promise.allSettled(fetchPromises);

      // Combine cached and fetched results
      const results = cachedResults.map(item => {
        if (item.cached) {
          return { type: item.type, data: item.cached };
        }
        const fetched = fetchedResults.find(
          (r): r is PromiseFulfilledResult<{type: string; data: unknown}> => 
            r.status === 'fulfilled' && r.value.type === item.type
        );
        return fetched?.value || { type: item.type, data: null };
      });

      const deductibleResult = results.find(r => r.type === 'deductible-risk');
      const inverseResult = results.find(r => r.type === 'inverse-check');

      if (signal.aborted) return;

      setState({
        deductibleAnalysis: deductibleResult?.data || null,
        inverseCheck: inverseResult?.data || null,
        contextualRisk: quote.contextualRisk || null,
        warrantyCompliance: quote.warrantyCompliance || null,
        legalOpinion: quote.legalOpinion || null,
        loading: false,
        error: null
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Error fetching advanced analysis'
      }));
    }
  }, [quote]);

  useEffect(() => {
    if (quote) {
      fetchAdvancedAnalysis();
    }
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [quote, fetchAdvancedAnalysis]);

  return {
    ...state,
    refetch: fetchAdvancedAnalysis
  };
};
