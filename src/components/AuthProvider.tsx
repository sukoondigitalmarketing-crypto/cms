import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { API_CONFIG } from '../config';
import { getAuthToken, setAuthToken, clearAuthToken } from '../services/api';
import { normalizeRole } from '../rbac';

interface User {
  uid: string;
  id: number;
  email: string;
  name: string;
  role: string;
  status: string;
  mustChangePwd: boolean;
  backdateLimit: number;
  effectivePermissions?: any;
}

const normalizeUser = (user: any): User => ({
  ...user,
  role: normalizeRole(user?.role),
});

interface AuthContextType {
  user: User | null;
  isAuthReady: boolean;
  login: (email: string, password: string, name?: string, role?: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Check for existing session on mount
    const storedToken = getAuthToken();
    if (storedToken) {
      setToken(storedToken);
      fetchCurrentUser(storedToken);
    } else {
      setIsAuthReady(true);
    }
  }, []);

  const fetchCurrentUser = async (authToken: string) => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(normalizeUser(data.user));
      } else {
        // Invalid token
        clearAuthToken();
        setToken(null);
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to fetch current user:', error);
      clearAuthToken();
      setToken(null);
      setUser(null);
    } finally {
      setIsAuthReady(true);
    }
  };

  const login = async (email: string, password: string, name?: string, role?: string, rememberMe: boolean = true) => {
    const url = `${API_CONFIG.BASE_URL}/auth/login`;
    console.log(`[Auth] Attempting login at: ${url}`);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, name, role })
      });

      console.log(`[Auth] Response Status: ${response.status}`);

      if (!response.ok) {
        let errorMsg = 'Login failed';
        try {
          const error = await response.json();
          errorMsg = error.error || errorMsg;
        } catch (e) {
          const text = await response.text();
          console.error('[Auth] Received non-JSON error response:', text.substring(0, 100));
          errorMsg = `Server error (${response.status}). Please check console.`;
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      setToken(data.token);
      setUser(normalizeUser(data.user));
      setAuthToken(data.token, rememberMe);
      console.log('[Auth] Login successful');
    } catch (error) {
      console.error('[Auth] Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await fetch(`${API_CONFIG.BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setToken(null);
      setUser(null);
      clearAuthToken();
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthReady, login, logout }}>
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
