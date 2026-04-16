import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export interface AuthUser {
  id: string;
  username: string;
  force_password_change: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** true while the initial /api/auth/me check is in flight */
  loading: boolean;
  /** true if user creation has not happened yet */
  setupRequired: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Call after a successful setup to re-check state */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);

  const checkSetup = useCallback(async () => {
    try {
      const res = await fetch('./api/auth/setup/status');
      if (res.ok) {
        const data = await res.json() as { setup_required: boolean };
        setSetupRequired(data.setup_required);
        return data.setup_required;
      }
    } catch {
      // network error – assume setup not required
    }
    return false;
  }, []);

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch('./api/auth/me', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json() as AuthUser;
        setUser(data);
        setSetupRequired(false);
        return;
      }
      if (res.status === 401) {
        setUser(null);
        // May need setup
        await checkSetup();
        return;
      }
    } catch {
      // Could not reach backend (e.g. no users exist yet / first run)
    }
    setUser(null);
    await checkSetup();
  }, [checkSetup]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchMe();
    setLoading(false);
  }, [fetchMe]);

  useEffect(() => {
    void (async () => {
      await fetchMe();
      setLoading(false);
    })();
  }, [fetchMe]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch('./api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? 'Login failed');
    }
    const data = await res.json() as AuthUser;
    setUser(data);
    setSetupRequired(false);
  }, []);

  const logout = useCallback(async () => {
    await fetch('./api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    });
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, setupRequired, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
