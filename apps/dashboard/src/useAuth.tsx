import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface User {
  id: string;
  orgId: string;
  username: string;
  displayName: string;
  role: 'viewer' | 'responder' | 'admin' | 'custom';
  permissions?: string[];
  email?: string;
  mustChangePassword?: boolean;
  onboardingComplete?: boolean;
}

interface OrgInfo {
  orgId: string;
  orgName: string;
  role: string;
  active: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  mustChangePassword: boolean;
  needsOnboarding: boolean;
  orgs: OrgInfo[];
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isRole: (...roles: string[]) => boolean;
  hasPerm: (perm: string) => boolean;
  updateUser: (partial: Partial<User>) => void;
  clearMustChangePassword: () => void;
  completeOnboarding: () => void;
  switchOrg: (orgId: string) => Promise<boolean>;
  refreshOrgs: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null, token: null, loading: true, mustChangePassword: false, needsOnboarding: false, orgs: [],
  login: async () => false, logout: () => {},
  isRole: () => false, hasPerm: () => false, updateUser: () => {}, clearMustChangePassword: () => {}, completeOnboarding: () => {},
  switchOrg: async () => false, refreshOrgs: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('auth-token'));
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [orgs, setOrgs] = useState<OrgInfo[]>([]);

  const refreshOrgs = useCallback(() => {
    if (!token) return;
    fetch('/api/auth/orgs', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { if (data.orgs) setOrgs(data.orgs); })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(u => { setUser(u); setMustChangePassword(!!u.mustChangePassword); setNeedsOnboarding(u.role === 'admin' && u.onboardingComplete === false); setLoading(false); refreshOrgs(); })
      .catch(() => { setToken(null); localStorage.removeItem('auth-token'); setLoading(false); });
  }, [token, refreshOrgs]);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      setUser(data.user);
      setToken(data.token);
      setMustChangePassword(!!data.mustChangePassword);
      setNeedsOnboarding(data.user.role === 'admin' && data.onboardingComplete === false);
      localStorage.setItem('auth-token', data.token);
      return true;
    } catch { return false; }
  }, []);

  const logout = useCallback(() => {
    if (token) {
      fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    }
    setUser(null);
    setToken(null);
    setMustChangePassword(false);
    localStorage.removeItem('auth-token');
  }, [token]);

  const isRole = useCallback((...roles: string[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  }, [user]);

  const ROLE_PERMS: Record<string, string[]> = {
    viewer: ['incidents:view', 'runbooks:view', 'analytics:view', 'teams:view'],
    responder: ['incidents:view', 'incidents:acknowledge', 'incidents:resolve', 'incidents:assign', 'incidents:escalate', 'incidents:create', 'runbooks:view', 'runbooks:manage', 'analytics:view', 'teams:view'],
    admin: ['incidents:view', 'incidents:acknowledge', 'incidents:resolve', 'incidents:assign', 'incidents:escalate', 'incidents:create', 'runbooks:view', 'runbooks:manage', 'analytics:view', 'teams:view', 'teams:manage', 'users:view', 'users:manage', 'integrations:view', 'integrations:manage', 'audit:view', 'settings:manage'],
  };

  const hasPerm = useCallback((perm: string) => {
    if (!user) return false;
    if (user.role === 'custom') return user.permissions?.includes(perm) ?? false;
    return ROLE_PERMS[user.role]?.includes(perm) ?? false;
  }, [user]);

  const updateUser = useCallback((partial: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...partial } : prev);
  }, []);

  const clearMustChangePassword = useCallback(() => {
    setMustChangePassword(false);
    setUser(prev => prev ? { ...prev, mustChangePassword: false } : prev);
  }, []);

  const completeOnboarding = useCallback(() => {
    setNeedsOnboarding(false);
    setUser(prev => prev ? { ...prev, onboardingComplete: true } : prev);
  }, []);

  const switchOrg = useCallback(async (orgId: string) => {
    if (!token) return false;
    try {
      const res = await fetch('/api/auth/switch-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orgId }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      setUser(data.user);
      setToken(data.token);
      localStorage.setItem('auth-token', data.token);
      refreshOrgs();
      return true;
    } catch { return false; }
  }, [token, refreshOrgs]);

  return (
    <AuthContext.Provider value={{ user, token, loading, mustChangePassword, needsOnboarding, orgs, login, logout, isRole, hasPerm, updateUser, clearMustChangePassword, completeOnboarding, switchOrg, refreshOrgs }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
