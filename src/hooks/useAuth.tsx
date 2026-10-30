import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { markCurrentDevicePasswordPassed } from '../utils/deviceTracker';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const checkAuth = async (): Promise<boolean> => {
    try {
      const localToken = localStorage.getItem('site_auth_token');
      const headers: Record<string, string> = {};
      if (localToken) {
        headers['Authorization'] = `Bearer ${localToken}`;
      }

      const response = await fetch('/api/auth/check', { 
        headers,
        signal: AbortSignal.timeout(4000)
      });
      if (response.ok) {
        const data = await response.json();
        setIsAuthenticated(!!data.authenticated);
        if (data.authenticated) {
          if (data.token) {
            localStorage.setItem('site_auth_token', data.token);
          }
          markCurrentDevicePasswordPassed();
        }
        return !!data.authenticated;
      }
    } catch (err) {
      console.warn('Auth check could not reach API endpoint, falling back to guest mode:', err);
    } finally {
      setIsLoading(false);
    }
    return false;
  };

  const login = async (password: string): Promise<boolean> => {
    setError(null);
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          localStorage.setItem('site_auth_token', data.token);
        }
        setIsAuthenticated(true);
        return true;
      } else {
        let errorMessage = 'Incorrect password';
        try {
          const data = await response.json();
          errorMessage = data.error || errorMessage;
        } catch (jsonErr) {
          errorMessage = `Server Error (${response.status}): Server returned an invalid response. If you just deployed, make sure the SITE_PASSWORD environment variable is correctly configured in your Vercel Dashboard.`;
        }
        setError(errorMessage);
        return false;
      }
    } catch (err) {
      setError('Connection error: Failed to reach the server. Please check your internet connection or deployment status.');
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      localStorage.removeItem('site_auth_token');
      // Vercel serverless function expects standard HTTP POST
      await fetch('/api/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsAuthenticated(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        error,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
