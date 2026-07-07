import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { ComparisonReport, AppStatus, Client } from '../types';
import { CorrectionQueue } from '../services/correctionQueue';

// Types for corrections
export interface Correction {
  id: string;
  rawName: string;
  insurerName: string;
  systemMapping: string;
  userCorrection: string;
  correctionType: 'coverage_mapping' | 'deductible' | 'exclusion' | 'value';
  quoteId?: string;
  rawTextSnippet?: string;
  aiJustification?: string;
  pageNumber?: number;
  status: 'pending' | 'success' | 'error';
  timestamp: number;
}

// Types for cell notes
export interface CellNote {
  cellId: string;
  content: string;
  timestamp: number;
}

// PDF Viewer state
export interface PdfViewerState {
  pdfUrl: string;
  targetPage: number;
  searchText?: string;
  title: string;
  isOpen: boolean;
  mode: 'drawer' | 'modal' | 'fullscreen';
}

// Audit progress
export interface AuditProgress {
  totalDiscrepancies: number;
  resolvedDiscrepancies: number;
  totalInverseAlerts: number;
  resolvedInverseAlerts: number;
  totalLowConfidence: number;
  resolvedLowConfidence: number;
}

// Analysis state
interface AnalysisState {
  status: AppStatus;
  report: ComparisonReport | null;
  selectedClient: Client | null;
  quoteFiles: File[];
  clauseFiles: File[];
  clauseMode: 'library' | 'upload';
  selectedClauseIds: string[];
  statusMessage: string;
  errorMessage: string;
  // UX Improvements state
  corrections: Correction[];
  cellNotes: Record<string, CellNote>;
  pdfViewer: PdfViewerState | null;
  auditProgress: AuditProgress;
  isOnline: boolean;
}

// Action types
type AnalysisAction =
  | { type: 'SET_STATUS'; payload: AppStatus }
  | { type: 'SET_REPORT'; payload: ComparisonReport | null }
  | { type: 'SET_SELECTED_CLIENT'; payload: Client | null }
  | { type: 'ADD_QUOTE_FILES'; payload: File[] }
  | { type: 'REMOVE_QUOTE_FILE'; payload: number }
  | { type: 'ADD_CLAUSE_FILES'; payload: File[] }
  | { type: 'REMOVE_CLAUSE_FILE'; payload: number }
  | { type: 'SET_CLAUSE_MODE'; payload: 'library' | 'upload' }
  | { type: 'SET_SELECTED_CLAUSE_IDS'; payload: string[] }
  | { type: 'SET_STATUS_MESSAGE'; payload: string }
  | { type: 'SET_ERROR_MESSAGE'; payload: string }
  | { type: 'ADD_CORRECTION'; payload: Correction }
  | {
      type: 'UPDATE_CORRECTION_STATUS';
      payload: { id: string; status: 'pending' | 'success' | 'error' };
    }
  | { type: 'SET_CELL_NOTE'; payload: CellNote }
  | { type: 'DELETE_CELL_NOTE'; payload: string }
  | { type: 'OPEN_PDF_VIEWER'; payload: PdfViewerState }
  | { type: 'CLOSE_PDF_VIEWER' }
  | { type: 'UPDATE_AUDIT_PROGRESS'; payload: Partial<AuditProgress> }
  | { type: 'SET_ONLINE_STATUS'; payload: boolean }
  | { type: 'RESET' };

// Initial state
const initialState: AnalysisState = {
  status: AppStatus.IDLE,
  report: null,
  selectedClient: null,
  quoteFiles: [],
  clauseFiles: [],
  clauseMode: 'library',
  selectedClauseIds: [],
  statusMessage: '',
  errorMessage: '',
  corrections: [],
  cellNotes: {},
  pdfViewer: null,
  auditProgress: {
    totalDiscrepancies: 0,
    resolvedDiscrepancies: 0,
    totalInverseAlerts: 0,
    resolvedInverseAlerts: 0,
    totalLowConfidence: 0,
    resolvedLowConfidence: 0,
  },
  isOnline: navigator.onLine,
};

// Reducer
function analysisReducer(state: AnalysisState, action: AnalysisAction): AnalysisState {
  switch (action.type) {
    case 'SET_STATUS':
      return { ...state, status: action.payload };
    case 'SET_REPORT':
      return { ...state, report: action.payload };
    case 'SET_SELECTED_CLIENT':
      return { ...state, selectedClient: action.payload };
    case 'ADD_QUOTE_FILES':
      return { ...state, quoteFiles: [...state.quoteFiles, ...action.payload] };
    case 'REMOVE_QUOTE_FILE':
      return { ...state, quoteFiles: state.quoteFiles.filter((_, i) => i !== action.payload) };
    case 'ADD_CLAUSE_FILES':
      return { ...state, clauseFiles: [...state.clauseFiles, ...action.payload] };
    case 'REMOVE_CLAUSE_FILE':
      return { ...state, clauseFiles: state.clauseFiles.filter((_, i) => i !== action.payload) };
    case 'SET_CLAUSE_MODE':
      return { ...state, clauseMode: action.payload };
    case 'SET_SELECTED_CLAUSE_IDS':
      return { ...state, selectedClauseIds: action.payload };
    case 'SET_STATUS_MESSAGE':
      return { ...state, statusMessage: action.payload };
    case 'SET_ERROR_MESSAGE':
      return { ...state, errorMessage: action.payload };
    case 'ADD_CORRECTION':
      return { ...state, corrections: [...state.corrections, action.payload] };
    case 'UPDATE_CORRECTION_STATUS':
      return {
        ...state,
        corrections: state.corrections.map((c) =>
          c.id === action.payload.id ? { ...c, status: action.payload.status } : c
        ),
      };
    case 'SET_CELL_NOTE':
      return {
        ...state,
        cellNotes: { ...state.cellNotes, [action.payload.cellId]: action.payload },
      };
    case 'DELETE_CELL_NOTE': {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [action.payload]: _, ...remainingNotes } = state.cellNotes;
      return { ...state, cellNotes: remainingNotes };
    }
    case 'OPEN_PDF_VIEWER':
      return { ...state, pdfViewer: action.payload };
    case 'CLOSE_PDF_VIEWER':
      return { ...state, pdfViewer: null };
    case 'UPDATE_AUDIT_PROGRESS':
      return { ...state, auditProgress: { ...state.auditProgress, ...action.payload } };
    case 'SET_ONLINE_STATUS':
      return { ...state, isOnline: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

// Context type
interface AnalysisContextType {
  state: AnalysisState;
  dispatch: React.Dispatch<AnalysisAction>;
  // Convenience methods
  addQuoteFiles: (files: File[]) => void;
  removeQuoteFile: (index: number) => void;
  addClauseFiles: (files: File[]) => void;
  removeClauseFile: (index: number) => void;
  reset: () => void;
}

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined);

export const AnalysisProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(analysisReducer, initialState);

  const addQuoteFiles = useCallback((files: File[]) => {
    dispatch({ type: 'ADD_QUOTE_FILES', payload: files });
  }, []);

  const removeQuoteFile = useCallback((index: number) => {
    dispatch({ type: 'REMOVE_QUOTE_FILE', payload: index });
  }, []);

  const addClauseFiles = useCallback((files: File[]) => {
    dispatch({ type: 'ADD_CLAUSE_FILES', payload: files });
  }, []);

  const removeClauseFile = useCallback((index: number) => {
    dispatch({ type: 'REMOVE_CLAUSE_FILE', payload: index });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  // Listen for online/offline events and sync queue when back online
  React.useEffect(() => {
    const handleOnline = async () => {
      dispatch({ type: 'SET_ONLINE_STATUS', payload: true });

      // Check if there are pending corrections in the queue
      const pendingCount = CorrectionQueue.getCount();
      if (pendingCount > 0) {
        await CorrectionQueue.sync();
      }
    };

    const handleOffline = () => dispatch({ type: 'SET_ONLINE_STATUS', payload: false });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync check
    if (navigator.onLine) {
      handleOnline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AnalysisContext.Provider
      value={{
        state,
        dispatch,
        addQuoteFiles,
        removeQuoteFile,
        addClauseFiles,
        removeClauseFile,
        reset,
      }}
    >
      {children}
    </AnalysisContext.Provider>
  );
};

export const useAnalysis = (): AnalysisContextType => {
  const context = useContext(AnalysisContext);
  if (!context) {
    throw new Error('useAnalysis must be used within an AnalysisProvider');
  }
  return context;
};

// Hook for corrections
export const useCorrections = () => {
  const { state, dispatch } = useAnalysis();

  const addCorrection = useCallback(
    (correction: Correction) => {
      dispatch({ type: 'ADD_CORRECTION', payload: correction });
    },
    [dispatch]
  );

  const updateCorrectionStatus = useCallback(
    (id: string, status: 'pending' | 'success' | 'error') => {
      dispatch({ type: 'UPDATE_CORRECTION_STATUS', payload: { id, status } });
    },
    [dispatch]
  );

  const getPendingCorrections = useCallback(() => {
    return state.corrections.filter((c) => c.status === 'pending');
  }, [state.corrections]);

  return {
    corrections: state.corrections,
    addCorrection,
    updateCorrectionStatus,
    getPendingCorrections,
  };
};

// Hook for cell notes
export const useCellNotes = () => {
  const { state, dispatch } = useAnalysis();

  const setCellNote = useCallback(
    (cellId: string, content: string) => {
      dispatch({
        type: 'SET_CELL_NOTE',
        payload: { cellId, content, timestamp: Date.now() },
      });
    },
    [dispatch]
  );

  const deleteCellNote = useCallback(
    (cellId: string) => {
      dispatch({ type: 'DELETE_CELL_NOTE', payload: cellId });
    },
    [dispatch]
  );

  const getCellNote = useCallback(
    (cellId: string) => {
      return state.cellNotes[cellId] || null;
    },
    [state.cellNotes]
  );

  return {
    cellNotes: state.cellNotes,
    setCellNote,
    deleteCellNote,
    getCellNote,
  };
};

// Hook for PDF viewer
export const usePdfViewer = () => {
  const { state, dispatch } = useAnalysis();

  const openPdfViewer = useCallback(
    (payload: Omit<PdfViewerState, 'isOpen'>) => {
      dispatch({
        type: 'OPEN_PDF_VIEWER',
        payload: { ...payload, isOpen: true },
      });
    },
    [dispatch]
  );

  const closePdfViewer = useCallback(() => {
    dispatch({ type: 'CLOSE_PDF_VIEWER' });
  }, [dispatch]);

  return {
    pdfViewer: state.pdfViewer,
    openPdfViewer,
    closePdfViewer,
  };
};

// Hook for audit progress
export const useAuditProgress = () => {
  const { state, dispatch } = useAnalysis();

  const updateProgress = useCallback(
    (progress: Partial<AuditProgress>) => {
      dispatch({ type: 'UPDATE_AUDIT_PROGRESS', payload: progress });
    },
    [dispatch]
  );

  const getProgressPercentage = useCallback(() => {
    const {
      totalDiscrepancies,
      resolvedDiscrepancies,
      totalInverseAlerts,
      resolvedInverseAlerts,
      totalLowConfidence,
      resolvedLowConfidence,
    } = state.auditProgress;
    const total = totalDiscrepancies + totalInverseAlerts + totalLowConfidence;
    const resolved = resolvedDiscrepancies + resolvedInverseAlerts + resolvedLowConfidence;
    return total === 0 ? 100 : Math.round((resolved / total) * 100);
  }, [state.auditProgress]);

  return {
    auditProgress: state.auditProgress,
    updateProgress,
    getProgressPercentage,
  };
};
