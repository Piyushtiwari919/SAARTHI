import React, { useState, useEffect, useCallback } from 'react';
import type { UserProfile, LoginCredentials, SignupData } from '../types/auth.ts';
import { authService } from '../services/auth.service.ts';
import { documentService } from '../services/document.service.ts';
import { AuthContext } from './AuthContext.ts';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    authService
      .getCurrentUser()
      .then((currentUser) => {
        if (isMounted) {
          setUser(currentUser);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setUser(null);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      documentService.clearCache();
      const session = await authService.login(credentials);
      setUser(session.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signup = useCallback(async (data: SignupData) => {
    setIsLoading(true);
    try {
      documentService.clearCache();
      const session = await authService.signup(data);
      setUser(session.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      documentService.clearCache();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
