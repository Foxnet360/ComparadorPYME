import React, { createContext, useContext, useState, useCallback } from 'react';
import { UserProfile } from '../types';
import { storageService } from '../services/storageService';

interface AuthContextType {
  currentUser: UserProfile | null;
  login: (user: UserProfile) => void;
  logout: () => void;
  updateUser: (user: UserProfile) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    return storageService.getCurrentUser();
  });

  const login = useCallback((user: UserProfile) => {
    setCurrentUser(user);
  }, []);

  const logout = useCallback(() => {
    storageService.logout();
    setCurrentUser(null);
  }, []);

  const updateUser = useCallback((user: UserProfile) => {
    setCurrentUser(user);
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, updateUser }}>
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
