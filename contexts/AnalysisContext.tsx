import React, { createContext, useContext, useState, useCallback } from 'react';
import { ComparisonReport, AppStatus, Client } from '../types';

interface AnalysisContextType {
  status: AppStatus;
  report: ComparisonReport | null;
  selectedClient: Client | null;
  quoteFiles: File[];
  clauseFiles: File[];
  clauseMode: 'library' | 'upload';
  selectedClauseIds: string[];
  statusMessage: string;
  errorMessage: string;
  setStatus: (status: AppStatus) => void;
  setReport: (report: ComparisonReport | null) => void;
  setSelectedClient: (client: Client | null) => void;
  addQuoteFiles: (files: File[]) => void;
  removeQuoteFile: (index: number) => void;
  addClauseFiles: (files: File[]) => void;
  removeClauseFile: (index: number) => void;
  setClauseMode: (mode: 'library' | 'upload') => void;
  setSelectedClauseIds: (ids: string[]) => void;
  setStatusMessage: (msg: string) => void;
  setErrorMessage: (msg: string) => void;
  reset: () => void;
}

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined);

export const AnalysisProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [report, setReport] = useState<ComparisonReport | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [quoteFiles, setQuoteFiles] = useState<File[]>([]);
  const [clauseFiles, setClauseFiles] = useState<File[]>([]);
  const [clauseMode, setClauseMode] = useState<'library' | 'upload'>('library');
  const [selectedClauseIds, setSelectedClauseIds] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const addQuoteFiles = useCallback((files: File[]) => {
    setQuoteFiles(prev => [...prev, ...files]);
  }, []);

  const removeQuoteFile = useCallback((index: number) => {
    setQuoteFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const addClauseFiles = useCallback((files: File[]) => {
    setClauseFiles(prev => [...prev, ...files]);
  }, []);

  const removeClauseFile = useCallback((index: number) => {
    setClauseFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const reset = useCallback(() => {
    setQuoteFiles([]);
    setClauseFiles([]);
    setSelectedClauseIds([]);
    setClauseMode('library');
    setReport(null);
    setSelectedClient(null);
    setStatus(AppStatus.IDLE);
    setStatusMessage('');
    setErrorMessage('');
  }, []);

  return (
    <AnalysisContext.Provider
      value={{
        status,
        report,
        selectedClient,
        quoteFiles,
        clauseFiles,
        clauseMode,
        selectedClauseIds,
        statusMessage,
        errorMessage,
        setStatus,
        setReport,
        setSelectedClient,
        addQuoteFiles,
        removeQuoteFile,
        addClauseFiles,
        removeClauseFile,
        setClauseMode,
        setSelectedClauseIds,
        setStatusMessage,
        setErrorMessage,
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
