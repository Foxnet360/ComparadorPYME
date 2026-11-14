import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

interface UIContextType {
  chatOpen: boolean;
  showProfile: boolean;
  showClauseAdmin: boolean;
  clientSelectorOpen: boolean;
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  setChatOpen: (open: boolean) => void;
  setShowProfile: (show: boolean) => void;
  setShowClauseAdmin: (show: boolean) => void;
  setClientSelectorOpen: (open: boolean) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  clearToast: () => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const hasParam = (p: string) => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get(p) === '1';

  const [chatOpen, setChatOpen] = useState(hasParam('chat'));
  const [showProfile, setShowProfile] = useState(hasParam('profile'));
  const [showClauseAdmin, setShowClauseAdmin] = useState(hasParam('clauseAdmin'));
  const [clientSelectorOpen, setClientSelectorOpen] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearToast = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast(null);
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 5000);
  }, []);

  return (
    <UIContext.Provider
      value={{
        chatOpen,
        showProfile,
        showClauseAdmin,
        clientSelectorOpen,
        toast,
        setChatOpen,
        setShowProfile,
        setShowClauseAdmin,
        setClientSelectorOpen,
        showToast,
        clearToast,
      }}
    >
      {children}
    </UIContext.Provider>
  );
};

export const useUI = (): UIContextType => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};
