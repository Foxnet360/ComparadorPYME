import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { UserProfile } from '../types';
import { authService } from '../services/authService';
import { storageService } from '../services/storageService';

interface AuthContextType {
  currentUser: UserProfile | null;
  /** True once the initial Supabase session resolution has finished. */
  bootstrapped: boolean;
  login: (user: UserProfile) => void;
  logout: () => void;
  updateUser: (user: UserProfile) => void;
}

import { DEMO_USER } from '../src/demoData';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isDemo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1';
  // ERR-4: the session is owned by the Supabase client via authService;
  // nothing is read from local storage.
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(isDemo ? DEMO_USER : null);
  const [bootstrapped, setBootstrapped] = useState(isDemo);

  useEffect(() => {
    if (isDemo) return;
    let cancelled = false;
    // ERR-4: wipe auth data persisted by legacy versions, then resolve the
    // existing Supabase session.
    void storageService.cleanupLegacyAuthStorage();
    void authService.getCurrentUser().then((user) => {
      if (cancelled) return;
      setCurrentUser(user);
      setBootstrapped(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isDemo]);

  const login = useCallback((user: UserProfile) => {
    setCurrentUser(user);
  }, []);

  const logout = useCallback(() => {
    void authService.signOut();
    setCurrentUser(null);
  }, []);

  const updateUser = useCallback((user: UserProfile) => {
    setCurrentUser(user);
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, bootstrapped, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
