import { useAnalysis } from '../contexts/AnalysisContext';
import { useUI } from '../contexts/UIContext';
import { analyzeQuotesWithGemini } from '../services/geminiService';
import { storageService } from '../services/storageService';
import { AppStatus } from '../types';
import type { ComparisonReport as ReportType } from '../types';

export type AppView =
  | 'LANDING'
  | 'LOGIN'
  | 'REGISTER'
  | 'DASHBOARD'
  | 'ANALYZER'
  | 'REPORT'
  | 'CLIENTS'
  | 'ANALYTICS'
  | 'USERS'
  | 'PORTFOLIO'
  | 'RENEWAL_DETAIL';

/** Encapsulates the analyzer flow (analyze/reset/retry/view) on top of
 * AnalysisContext so pages and the app shell share one source of truth. */
export const useAnalysisFlow = () => {
  const {
    state,
    dispatch,
    addQuoteFiles,
    removeQuoteFile,
    addClauseFiles,
    removeClauseFile,
    reset,
  } = useAnalysis();
  const { setChatOpen } = useUI();

  /** Runs the comparison pipeline. Resolves to the view the router should
   * navigate to ('REPORT' on success), or null when the view must not change. */
  const analyze = async (): Promise<AppView | null> => {
    if (state.quoteFiles.length === 0) return null;
    dispatch({ type: 'SET_STATUS', payload: AppStatus.ANALYZING });

    try {
      const clientName = state.selectedClient?.name || 'Cliente Desconocido';
      // Pass clauseIds when using library mode
      const clauseIdsToUse = state.clauseMode === 'library' ? state.selectedClauseIds : undefined;
      const result = await analyzeQuotesWithGemini(
        state.quoteFiles,
        state.clauseFiles,
        clientName,
        (msg) => dispatch({ type: 'SET_STATUS_MESSAGE', payload: msg }),
        clauseIdsToUse,
        state.domain
      );
      // Save to history unconditionally and capture generated ID
      const savedId = await storageService.saveAnalysis(
        clientName,
        result,
        state.selectedClient?.id
      );

      if (savedId) {
        result.id = savedId;
        dispatch({ type: 'SET_REPORT', payload: { ...result, id: savedId } });
      } else {
        dispatch({ type: 'SET_REPORT', payload: result });
      }

      dispatch({ type: 'SET_STATUS', payload: AppStatus.COMPLETED });
      return 'REPORT';
    } catch (error: unknown) {
      console.error(error);
      dispatch({ type: 'SET_STATUS_MESSAGE', payload: '' }); // Clear status
      dispatch({ type: 'SET_STATUS', payload: AppStatus.ERROR });
      // Extract clean message
      const msg = error instanceof Error ? error.message : 'Hubo un problema desconocido.';
      dispatch({ type: 'SET_ERROR_MESSAGE', payload: msg });
      return null;
    }
  };

  /** Resets the analyzer state and closes the chat (view transitions stay
   * with the router). */
  const resetFlow = () => {
    reset();
    setChatOpen(false);
  };

  const retry = () => {
    dispatch({ type: 'SET_ERROR_MESSAGE', payload: '' });
    dispatch({ type: 'SET_STATUS_MESSAGE', payload: '' });
    dispatch({ type: 'SET_STATUS', payload: AppStatus.IDLE });
  };

  const viewReport = (existingReport: ReportType) => {
    dispatch({ type: 'SET_REPORT', payload: existingReport });
    dispatch({ type: 'SET_STATUS', payload: AppStatus.COMPLETED });
  };

  return {
    state,
    dispatch,
    addQuoteFiles,
    removeQuoteFile,
    addClauseFiles,
    removeClauseFile,
    analyze,
    resetFlow,
    retry,
    viewReport,
  };
};
