import React, { useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { Routes, Route, NavLink, useNavigate, Navigate } from 'react-router-dom';
import { AlertTriangle, BarChart3, Activity, BookOpen, Clock, Layers, PanelLeftClose, PanelLeft, Settings, Sun, Moon, Menu, X, LogOut, User, Users, Lock, Bell, Check, Eye, EyeOff, Plus, Trash2, ClipboardList } from 'lucide-react';
import IncidentsFeed from './pages/IncidentsFeed';
import IncidentDetail from './pages/IncidentDetail';
import AnomalyDashboard from './pages/AnomalyDashboard';
import Analytics from './pages/Analytics';
import RunbookDetail from './pages/RunbookDetail';
import SettingsPage from './pages/Settings';
import AuditTrail from './pages/AuditTrail';
import CustomDashboard from './pages/CustomDashboard';
import Login from './pages/Login';
import Onboarding from './components/Onboarding';
import GuideTour from './components/GuideTour';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import CommandPalette, { CommandHint } from './components/CommandPalette';
import { api } from './api';
import { useSettings } from './useSettings';
import { AuthProvider, useAuth } from './useAuth';
// useSettings also used in RunbooksList below

const navItems = [
  { to: '/', icon: AlertTriangle, label: 'Incidents', badge: 'open' as const, roles: ['admin', 'responder', 'viewer', 'custom'], perm: 'incidents:view' },
  { to: '/dashboard', icon: BarChart3, label: 'Dashboard', badge: null, roles: ['admin', 'responder', 'viewer', 'custom'], perm: 'analytics:view' },
  { to: '/anomalies', icon: Activity, label: 'Anomalies', badge: 'critical' as const, roles: ['admin', 'responder', 'custom'], perm: 'incidents:view' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics', badge: null, roles: ['admin', 'responder', 'viewer', 'custom'], perm: 'analytics:view' },
  { to: '/runbooks', icon: BookOpen, label: 'Runbooks', badge: null, roles: ['admin', 'responder', 'custom'], perm: 'runbooks:view' },
  { to: '/audit-trail', icon: ClipboardList, label: 'Audit Trail', badge: null, roles: ['admin', 'custom'], perm: 'audit:view' },
  { to: '/settings', icon: Settings, label: 'Settings', badge: null, roles: ['admin', 'responder', 'viewer', 'custom'], perm: null },
];

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

function ForcePasswordChange({ onDone, onLogout }: { onDone: () => void; onLogout: () => void }) {
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const submit = async () => {
    if (pw.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (pw !== confirm) { setError('Passwords do not match'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await api.changePassword(pw);
      if (res.error) { setError(res.error); setSaving(false); return; }
      onDone();
    } catch { setError('Failed to change password'); setSaving(false); }
  };

  return (
    <div className="flex items-center justify-center h-screen" style={{ background: 'var(--apple-bg)' }}>
      <div className="w-full max-w-sm p-8 rounded-[16px]" style={{ background: 'var(--apple-surface-1)', border: '1px solid var(--apple-border)' }}>
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: 'rgba(255, 159, 10, 0.15)' }}>
            <Lock className="w-6 h-6" style={{ color: 'var(--apple-orange)' }} />
          </div>
          <h2 className="text-[18px] font-semibold" style={{ color: 'var(--apple-text-primary)' }}>Change Your Password</h2>
          <p className="text-[13px] mt-1 text-center" style={{ color: 'var(--apple-text-tertiary)' }}>
            Your password was reset by an admin. Please set a new password to continue.
          </p>
        </div>
        <div className="space-y-3">
          <div className="relative">
            <input type={showPw ? 'text' : 'password'} placeholder="New password (min 6 chars)" value={pw} onChange={e => setPw(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()} className="apple-input w-full pr-9" autoFocus />
            <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-[4px] transition-all hover:opacity-70" style={{ color: 'var(--apple-text-tertiary)' }} tabIndex={-1}>
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="relative">
            <input type={showConfirm ? 'text' : 'password'} placeholder="Confirm new password" value={confirm} onChange={e => setConfirm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()} className="apple-input w-full pr-9" />
            <button type="button" onClick={() => setShowConfirm(p => !p)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-[4px] transition-all hover:opacity-70" style={{ color: 'var(--apple-text-tertiary)' }} tabIndex={-1}>
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {error && <p className="text-[12px] font-medium" style={{ color: 'var(--apple-red)' }}>{error}</p>}
          <button onClick={submit} disabled={saving || !pw || !confirm} className="apple-btn apple-btn-primary w-full">
            {saving ? 'Saving...' : 'Set New Password'}
          </button>
          <button onClick={onLogout} className="apple-btn apple-btn-secondary w-full text-[12px]">Sign Out Instead</button>
        </div>
      </div>
    </div>
  );
}

function AppShell() {
  const { user, loading: authLoading, logout, mustChangePassword, clearMustChangePassword, needsOnboarding, completeOnboarding, orgs, switchOrg } = useAuth();
  const [showGuideTour, setShowGuideTour] = useState(false);
  const navigate = useNavigate();
  const [counts, setCounts] = useState<{ open: number; critical: number }>({ open: 0, critical: 0 });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [teamName, setTeamName] = useState<string | null>(null);
  const { settings, updateSettings } = useSettings();

  // Notifications
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(() => {
    api.listNotifications().then((d: any) => {
      setNotifications(d.notifications || []);
      setUnreadCount(d.unreadCount || 0);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close notif dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    api.listTeams().then((d: any) => {
      const teams = d.teams || [];
      if (teams.length > 0) setTeamName(teams[0].name);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const fetchCounts = () => {
      api.listIncidents().then((data: any) => {
        const incs = data.incidents || [];
        setCounts({
          open: incs.filter((i: any) => i.status === 'open').length,
          critical: incs.filter((i: any) => i.analysis.severity === 'critical' && i.status !== 'resolved').length,
        });
      }).catch(() => {});
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, settings.autoRefreshInterval * 1000);
    return () => clearInterval(interval);
  }, [settings.autoRefreshInterval]);

  // Apply theme
  useEffect(() => {
    const apply = (theme: string) => {
      if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
      } else {
        document.documentElement.setAttribute('data-theme', theme);
      }
    };
    apply(settings.theme);
    if (settings.theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => apply('system');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [settings.theme]);

  // Auto-collapse on narrow screens
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setCollapsed(e.matches);
    handler(mq);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--apple-bg)', color: 'var(--apple-text-tertiary)' }}>
        <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--apple-surface-3)', borderTopColor: 'var(--apple-blue)' }} />
      </div>
    );
  }
  if (!user) return <Login />;

  if (mustChangePassword) return <ForcePasswordChange onDone={clearMustChangePassword} onLogout={logout} />;

  if (needsOnboarding) return <Onboarding user={user!} onComplete={() => { completeOnboarding(); setShowGuideTour(true); }} />;

  const sidebarContent = (mobile = false) => (
    <>
      <div className={`pt-5 pb-3 flex items-center ${(!mobile && collapsed) ? 'px-3 justify-center' : 'px-5 gap-2.5'}`}>
        <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: 'rgba(255, 159, 10, 0.15)' }}>
          <Layers className="w-[18px] h-[18px]" style={{ color: 'var(--apple-orange)' }} />
        </div>
        {(mobile || !collapsed) && (
          <div className="flex-1 min-w-0">
            <h1 className="text-[15px] font-semibold tracking-tight truncate" style={{ color: 'var(--apple-text-primary)' }}>
              Incident Analyzer
            </h1>
            <p className="text-[11px]" style={{ color: 'var(--apple-text-tertiary)' }}>AI-Powered Response</p>
          </div>
        )}
      </div>
      <nav className={`flex-1 space-y-0.5 ${(!mobile && collapsed) ? 'px-2' : 'px-3'}`} aria-label="Main navigation">
        {navItems.filter(item => {
          if (!item.roles.includes(user!.role)) return false;
          if (user!.role === 'custom' && item.perm) return user!.permissions?.includes(item.perm) ?? false;
          return true;
        }).map(({ to, icon: Icon, label, badge }) => {
          const badgeCount = badge === 'open' ? counts.open : badge === 'critical' ? counts.critical : 0;
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              title={(!mobile && collapsed) ? label : undefined}
              aria-label={label}
              onClick={() => mobile && setMobileOpen(false)}
              className={({ isActive }: { isActive: boolean }) =>
                `flex items-center ${(!mobile && collapsed) ? 'justify-center' : 'gap-2.5'} px-3 py-[7px] rounded-[8px] text-[13px] font-medium transition-all duration-200`
              }
              style={({ isActive }: { isActive: boolean }) => ({
                background: isActive ? 'var(--apple-surface-3)' : 'transparent',
                color: isActive ? 'var(--apple-text-primary)' : 'var(--apple-text-secondary)',
              })}
            >
              <Icon className="w-[16px] h-[16px] shrink-0" style={{ strokeWidth: 1.8 }} />
              {(mobile || !collapsed) && <span className="flex-1">{label}</span>}
              {(mobile || !collapsed) && badgeCount > 0 && (
                <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-semibold tabular-nums"
                  style={{
                    background: badge === 'critical' ? 'var(--apple-red)' : 'rgba(255, 159, 10, 0.2)',
                    color: badge === 'critical' ? 'white' : 'var(--apple-orange)',
                  }}>
                  {badgeCount}
                </span>
              )}
              {!mobile && collapsed && badgeCount > 0 && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full"
                  style={{ background: badge === 'critical' ? 'var(--apple-red)' : 'var(--apple-orange)' }} />
              )}
            </NavLink>
          );
        })}
      </nav>
      <div className={`py-3 flex flex-col gap-2 ${(!mobile && collapsed) ? 'px-2 items-center' : 'px-4'}`} style={{ borderTop: '1px solid var(--apple-border)' }}>
        {(mobile || !collapsed) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: 'var(--apple-green)' }} />
                <span className="text-[11px] font-medium" style={{ color: 'var(--apple-text-tertiary)' }}>
                  {settings.pagerdutyKey ? 'PagerDuty Connected' : 'PagerDuty Simulated'}
                </span>
              </div>
              {!mobile && <CommandHint />}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--apple-surface-3)' }}>
                  <User className="w-3 h-3" style={{ color: 'var(--apple-text-tertiary)', strokeWidth: 1.8 }} />
                </div>
                <span className="text-[11px] font-medium truncate" style={{ color: 'var(--apple-text-secondary)' }}>
                  {user!.displayName} <span style={{ color: 'var(--apple-text-tertiary)' }}>({user!.role})</span>
                </span>
              </div>
              <button onClick={() => { logout(); mobile && setMobileOpen(false); }} title="Sign out" aria-label="Sign out" className="p-1 rounded-[4px] transition-all hover:opacity-70" style={{ color: 'var(--apple-text-tertiary)' }}>
                <LogOut className="w-3 h-3" style={{ strokeWidth: 1.8 }} />
              </button>
            </div>
            {teamName && (
              <div className="flex items-center gap-1.5">
                <Users className="w-3 h-3 shrink-0" style={{ color: 'var(--apple-teal)', strokeWidth: 1.8 }} />
                <span className="text-[11px] font-medium truncate" style={{ color: 'var(--apple-text-tertiary)' }}>{teamName}</span>
              </div>
            )}
            {orgs.length > 1 && (
              <div className="flex items-center gap-1.5">
                <Layers className="w-3 h-3 shrink-0" style={{ color: 'var(--apple-indigo)', strokeWidth: 1.8 }} />
                <select
                  value={orgs.find(o => o.active)?.orgId || ''}
                  onChange={async (e) => {
                    const ok = await switchOrg(e.target.value);
                    if (ok) window.location.reload();
                  }}
                  className="text-[11px] font-medium bg-transparent border-none outline-none cursor-pointer truncate flex-1"
                  style={{ color: 'var(--apple-text-tertiary)' }}
                >
                  {orgs.map(o => (
                    <option key={o.orgId} value={o.orgId}>{o.orgName} ({o.role})</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
        {!mobile && (
          <>
            <div className="flex justify-center">
              <button
                onClick={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
                className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2'} rounded-full p-1 transition-all duration-300`}
                style={{ background: 'var(--apple-surface-2)', width: collapsed ? 32 : 120, height: 28 }}
                title={settings.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-label={settings.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                <div
                  className="w-[22px] h-[22px] rounded-full flex items-center justify-center transition-all duration-300 shrink-0"
                  style={{
                    background: 'var(--apple-blue)',
                    transform: !collapsed && settings.theme === 'light' ? 'translateX(90px)' : 'translateX(0)',
                  }}
                >
                  {settings.theme === 'dark'
                    ? <Moon className="w-3 h-3" style={{ color: 'white', strokeWidth: 2 }} />
                    : <Sun className="w-3 h-3" style={{ color: 'white', strokeWidth: 2 }} />
                  }
                </div>
                {!collapsed && (
                  <span className="text-[10px] font-medium" style={{ color: 'var(--apple-text-secondary)' }}>
                    {settings.theme === 'dark' ? 'Dark' : 'Light'}
                  </span>
                )}
              </button>
            </div>
            <button onClick={() => setCollapsed(prev => !prev)}
              className="flex items-center justify-center w-full py-1 rounded-[6px] transition-all duration-200"
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--apple-surface-1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              style={{ color: 'var(--apple-text-tertiary)' }} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              {collapsed ? <PanelLeft className="w-4 h-4" style={{ strokeWidth: 1.8 }} /> : <PanelLeftClose className="w-4 h-4" style={{ strokeWidth: 1.8 }} />}
            </button>
          </>
        )}
      </div>
    </>
  );

  return (
    <ToastProvider>
      {showGuideTour && <GuideTour onDone={() => setShowGuideTour(false)} />}
      <a href="#main-content" className="skip-nav">Skip to main content</a>
      <div className="flex h-screen" style={{ background: 'var(--apple-bg)' }}>
        {/* Mobile sidebar overlay */}
        <div className={`sidebar-overlay ${mobileOpen ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="overlay-backdrop" onClick={() => setMobileOpen(false)} />
          <div className="overlay-panel flex flex-col">
            {sidebarContent(true)}
          </div>
        </div>
        <aside className={`desktop-sidebar apple-glass flex flex-col border-r shrink-0 transition-all duration-300 ease-in-out ${collapsed ? 'w-[60px]' : 'w-[240px]'}`}
          style={{ borderColor: 'var(--apple-border)' }} role="navigation" aria-label="Main navigation">
          {sidebarContent(false)}
        </aside>
        <main id="main-content" className="flex-1 overflow-auto relative main-content" role="main" aria-label="Main content">
          {/* Mobile top bar */}
          <div className="mobile-topbar">
            <button onClick={() => setMobileOpen(true)} aria-label="Open navigation menu" className="p-2 rounded-[8px]" style={{ color: 'var(--apple-text-primary)' }}>
              <Menu className="w-5 h-5" style={{ strokeWidth: 1.8 }} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-[8px] flex items-center justify-center" style={{ background: 'rgba(255, 159, 10, 0.15)' }}>
                <Layers className="w-3.5 h-3.5" style={{ color: 'var(--apple-orange)' }} />
              </div>
              <span className="text-[14px] font-semibold" style={{ color: 'var(--apple-text-primary)' }}>Incidents</span>
            </div>
            <button onClick={() => { setNotifOpen(p => !p); if (!notifOpen) fetchNotifications(); }} aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`} className="relative p-2 rounded-[8px]" style={{ color: unreadCount > 0 ? 'var(--apple-orange)' : 'var(--apple-text-tertiary)' }}>
              <Bell className="w-[18px] h-[18px]" style={{ strokeWidth: 1.8 }} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] flex items-center justify-center rounded-full text-[9px] font-bold" style={{ background: 'var(--apple-red)', color: 'white' }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          </div>
          {/* Notification bell (desktop) */}
          <div ref={notifRef} className="absolute top-4 right-6 z-40" style={{ position: 'absolute' }}>
            <button
              onClick={() => { setNotifOpen(p => !p); if (!notifOpen) fetchNotifications(); }}
              className="relative p-2 rounded-[10px] transition-all hover:opacity-80"
              style={{ background: 'var(--apple-surface-2)' }}
              title="Notifications"
              aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
              aria-expanded={notifOpen}>
              <Bell className="w-[18px] h-[18px]" style={{ color: unreadCount > 0 ? 'var(--apple-orange)' : 'var(--apple-text-tertiary)', strokeWidth: 1.8 }} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] flex items-center justify-center rounded-full text-[9px] font-bold" style={{ background: 'var(--apple-red)', color: 'white' }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-[360px] max-h-[480px] rounded-[14px] overflow-hidden shadow-xl flex flex-col notif-dropdown" role="menu" aria-label="Notifications"
                style={{ background: 'var(--apple-bg)', border: '1px solid var(--apple-border)', boxShadow: '0 12px 40px rgba(0,0,0,0.4)' }}>
                <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--apple-border)' }}>
                  <p className="text-[14px] font-semibold" style={{ color: 'var(--apple-text-primary)' }}>Notifications</p>
                  {unreadCount > 0 && (
                    <button
                      onClick={async () => {
                        try { await api.markAllNotificationsRead(); } catch {}
                        fetchNotifications();
                      }}
                      className="text-[11px] font-medium transition-all hover:opacity-70"
                      style={{ color: 'var(--apple-blue)' }}>Mark all read</button>
                  )}
                </div>
                <div className="overflow-y-auto flex-1">
                  {notifications.filter((n: any) => !n.read).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Bell className="w-8 h-8 mb-2" style={{ color: 'var(--apple-surface-3)' }} />
                      <p className="text-[13px]" style={{ color: 'var(--apple-text-tertiary)' }}>All caught up!</p>
                    </div>
                  ) : (
                    notifications.filter((n: any) => !n.read).map((n: any) => (
                      <button
                        key={n.id}
                        onClick={async () => {
                          if (!n.read) {
                            try {
                              await api.markNotificationRead(n.id);
                            } catch {}
                            fetchNotifications();
                          }
                          if (n.link) { setNotifOpen(false); navigate(n.link); }
                        }}
                        className="flex items-start gap-3 w-full px-4 py-3 text-left transition-all duration-100 hover:opacity-80"
                        style={{ background: n.read ? 'transparent' : 'rgba(10, 132, 255, 0.04)', borderBottom: '1px solid var(--apple-border)' }}>
                        <div className="mt-0.5 w-2 h-2 rounded-full shrink-0" style={{ background: n.read ? 'transparent' : 'var(--apple-blue)' }} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium truncate" style={{ color: 'var(--apple-text-primary)' }}>{n.title}</p>
                          <p className="text-[12px] mt-0.5 line-clamp-2" style={{ color: 'var(--apple-text-tertiary)' }}>{n.body}</p>
                          <p className="text-[10px] mt-1" style={{ color: 'var(--apple-text-tertiary)' }}>
                            {new Date(n.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<IncidentsFeed />} />
              <Route path="/incidents/:id" element={<IncidentDetail />} />
              <Route path="/anomalies" element={<RoleGuard roles={['admin', 'responder']} userRole={user.role}><AnomalyDashboard /></RoleGuard>} />
              <Route path="/dashboard" element={<CustomDashboard />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/runbooks" element={<RoleGuard roles={['admin', 'responder']} userRole={user.role}><RunbooksList /></RoleGuard>} />
              <Route path="/runbooks/:id" element={<RoleGuard roles={['admin', 'responder']} userRole={user.role}><RunbookDetail /></RoleGuard>} />
              <Route path="/audit-trail" element={<RoleGuard roles={['admin']} userRole={user.role}><AuditTrail /></RoleGuard>} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </ErrorBoundary>
        </main>
        <CommandPalette />
      </div>
    </ToastProvider>
  );
}

function RoleGuard({ roles, userRole, children }: { roles: string[]; userRole: string; children: ReactNode }) {
  if (!roles.includes(userRole)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RunbooksList() {
  const [runbooks, setRunbooks] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [catFilter, setCatFilter] = React.useState<string | null>(null);
  const [tagFilter, setTagFilter] = React.useState<string | null>(null);
  const [rbPage, setRbPage] = React.useState(0);
  const { settings } = useSettings();
  const { hasPerm } = useAuth();
  const canManageRunbooks = hasPerm('runbooks:manage');
  const navigate = useNavigate();

  // Create runbook state
  const [showCreate, setShowCreate] = React.useState(false);
  const [rbName, setRbName] = React.useState('');
  const [rbDesc, setRbDesc] = React.useState('');
  const [rbCategory, setRbCategory] = React.useState('');
  const [rbTags, setRbTags] = React.useState('');
  const [rbTime, setRbTime] = React.useState(15);
  const [rbSteps, setRbSteps] = React.useState<{ title: string; description: string; command: string; expectedOutcome: string; isAutomatable: boolean }[]>([{ title: '', description: '', command: '', expectedOutcome: '', isAutomatable: false }]);
  const [rbSaving, setRbSaving] = React.useState(false);
  const [rbError, setRbError] = React.useState('');

  const resetForm = () => { setRbName(''); setRbDesc(''); setRbCategory(''); setRbTags(''); setRbTime(15); setRbSteps([{ title: '', description: '', command: '', expectedOutcome: '', isAutomatable: false }]); setRbError(''); };

  const handleCreate = async () => {
    if (!rbName.trim() || !rbCategory.trim()) { setRbError('Name and category are required'); return; }
    const validSteps = rbSteps.filter(s => s.title.trim());
    if (validSteps.length === 0) { setRbError('At least one step with a title is required'); return; }
    setRbSaving(true); setRbError('');
    const res = await api.createRunbook({
      name: rbName.trim(), description: rbDesc.trim(), category: rbCategory.trim(),
      tags: rbTags.split(',').map(t => t.trim()).filter(Boolean),
      estimatedTimeMinutes: rbTime,
      steps: validSteps.map(s => ({ ...s, title: s.title.trim(), description: s.description.trim(), command: s.command.trim(), expectedOutcome: s.expectedOutcome.trim() })),
    });
    setRbSaving(false);
    if (res?.error) { setRbError(res.error); return; }
    setRunbooks(prev => [res, ...prev]);
    resetForm(); setShowCreate(false);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this runbook?')) return;
    await api.deleteRunbook(id);
    setRunbooks(prev => prev.filter(r => r.id !== id));
  };

  const addStep = () => setRbSteps(prev => [...prev, { title: '', description: '', command: '', expectedOutcome: '', isAutomatable: false }]);
  const removeStep = (idx: number) => setRbSteps(prev => prev.filter((_, i) => i !== idx));
  const updateStep = (idx: number, field: string, value: any) => setRbSteps(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));

  React.useEffect(() => {
    import('./api').then(({ api }) =>
      api.listRunbooks().then((data: any) => {
        setRunbooks(data.runbooks || []);
        setLoading(false);
      })
    );
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-full" style={{ color: 'var(--apple-text-tertiary)' }}>
      <div className="w-5 h-5 border-2 rounded-full animate-spin mr-3" style={{ borderColor: 'var(--apple-surface-3)', borderTopColor: 'var(--apple-blue)' }} />
      Loading runbooks...
    </div>
  );

  if (!runbooks.length && !showCreate) return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--apple-surface-1)' }}>
        <BookOpen className="w-7 h-7" style={{ color: 'var(--apple-text-tertiary)', strokeWidth: 1.5 }} />
      </div>
      <p className="text-[17px] font-semibold tracking-tight" style={{ color: 'var(--apple-text-primary)' }}>No runbooks yet</p>
      <p className="text-[13px] mt-1 mb-4" style={{ color: 'var(--apple-text-tertiary)' }}>Create your first runbook or seed demo data</p>
      {canManageRunbooks && <button onClick={() => setShowCreate(true)} className="apple-btn apple-btn-primary flex items-center gap-1.5 text-[13px]"><Plus className="w-4 h-4" /> Create Runbook</button>}
    </div>
  );

  const hasFilter = catFilter || tagFilter;

  // Cross-filter: categories from tag-filtered, tags from category-filtered
  const forCat = runbooks.filter((rb: any) => !tagFilter || rb.tags.includes(tagFilter));
  const forTag = runbooks.filter((rb: any) => !catFilter || rb.category === catFilter);
  const categories = Array.from(new Set(forCat.map((rb: any) => rb.category)));
  const allTags = Array.from(new Set(forTag.flatMap((rb: any) => rb.tags || []))).sort();

  const filtered = runbooks
    .filter((rb: any) => !catFilter || rb.category === catFilter)
    .filter((rb: any) => !tagFilter || rb.tags.includes(tagFilter));

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="apple-title">Runbooks</h1>
        <p className="apple-subtitle">Pre-defined remediation procedures auto-matched to incidents.</p>
      </div>

      {/* Floating create button */}
      {canManageRunbooks && !showCreate && (
        <button onClick={() => { resetForm(); setShowCreate(true); }}
          className="fixed bottom-8 right-8 z-30 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
          style={{ background: 'var(--apple-blue)', color: 'white', boxShadow: '0 4px 20px rgba(10, 132, 255, 0.4)' }}
          title="Create Runbook">
          <Plus className="w-6 h-6" strokeWidth={2.5} />
        </button>
      )}

      {/* Create Runbook Form */}
      {showCreate && (
        <div className="apple-card mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-semibold" style={{ color: 'var(--apple-text-primary)' }}>New Runbook</h3>
            <button onClick={() => setShowCreate(false)} className="p-1 rounded-[6px] transition-all hover:opacity-70" style={{ color: 'var(--apple-text-tertiary)' }}><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--apple-text-secondary)' }}>Name</label>
              <input value={rbName} onChange={e => setRbName(e.target.value)} placeholder="e.g. Database Recovery" className="apple-input w-full text-[12px]" autoFocus />
            </div>
            <div>
              <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--apple-text-secondary)' }}>Category</label>
              <input value={rbCategory} onChange={e => setRbCategory(e.target.value)} placeholder="e.g. database, networking" className="apple-input w-full text-[12px]" />
            </div>
            <div className="col-span-2">
              <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--apple-text-secondary)' }}>Description</label>
              <input value={rbDesc} onChange={e => setRbDesc(e.target.value)} placeholder="What does this runbook address?" className="apple-input w-full text-[12px]" />
            </div>
            <div>
              <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--apple-text-secondary)' }}>Tags <span style={{ color: 'var(--apple-text-tertiary)' }}>(comma-separated)</span></label>
              <input value={rbTags} onChange={e => setRbTags(e.target.value)} placeholder="postgres, failover, backup" className="apple-input w-full text-[12px]" />
            </div>
            <div>
              <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--apple-text-secondary)' }}>Est. Time (min)</label>
              <input type="number" value={rbTime} onChange={e => setRbTime(Number(e.target.value) || 15)} min={1} className="apple-input w-full text-[12px]" />
            </div>
          </div>

          {/* Steps Builder */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-medium" style={{ color: 'var(--apple-text-secondary)' }}>Steps</label>
              <button onClick={addStep} className="text-[11px] font-medium flex items-center gap-1 transition-all hover:opacity-70" style={{ color: 'var(--apple-blue)' }}><Plus className="w-3 h-3" /> Add Step</button>
            </div>
            <div className="space-y-2">
              {rbSteps.map((step, idx) => (
                <div key={idx} className="p-3 rounded-[10px] space-y-2" style={{ background: 'var(--apple-surface-2)', border: '1px solid var(--apple-border)' }}>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: 'var(--apple-surface-3)', color: 'var(--apple-text-secondary)' }}>{idx + 1}</span>
                    <input value={step.title} onChange={e => updateStep(idx, 'title', e.target.value)} placeholder="Step title" className="apple-input flex-1 text-[12px]" />
                    {rbSteps.length > 1 && <button onClick={() => removeStep(idx)} className="p-1 rounded-[4px] transition-all hover:opacity-70" style={{ color: 'var(--apple-red)' }}><Trash2 className="w-3.5 h-3.5" /></button>}
                  </div>
                  <input value={step.description} onChange={e => updateStep(idx, 'description', e.target.value)} placeholder="Description (optional)" className="apple-input w-full text-[11px]" />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={step.command} onChange={e => updateStep(idx, 'command', e.target.value)} placeholder="Command (optional)" className="apple-input w-full text-[11px] font-mono" />
                    <input value={step.expectedOutcome} onChange={e => updateStep(idx, 'expectedOutcome', e.target.value)} placeholder="Expected outcome (optional)" className="apple-input w-full text-[11px]" />
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={step.isAutomatable} onChange={e => updateStep(idx, 'isAutomatable', e.target.checked)} className="rounded" />
                    <span className="text-[11px]" style={{ color: 'var(--apple-text-tertiary)' }}>Automatable</span>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {rbError && <p className="text-[11px] font-medium" style={{ color: 'var(--apple-red)' }}>{rbError}</p>}
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={rbSaving || !rbName.trim() || !rbCategory.trim()}
              className="apple-btn apple-btn-primary text-[12px] disabled:opacity-30">{rbSaving ? 'Creating...' : 'Create Runbook'}</button>
            <button onClick={() => setShowCreate(false)} className="apple-btn apple-btn-secondary text-[12px]">Cancel</button>
          </div>
        </div>
      )}

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-1.5 mb-6">
        {categories.map((c: string) => {
          const active = catFilter === c;
          return (
            <button key={c} onClick={() => setCatFilter(active ? null : c)}
              className="text-[11px] font-medium px-2.5 py-1 rounded-full transition-all duration-150"
              style={{
                background: active ? 'rgba(10, 132, 255, 0.15)' : 'var(--apple-surface-2)',
                color: active ? 'var(--apple-blue)' : 'var(--apple-text-tertiary)',
                outline: active ? '1.5px solid var(--apple-blue)' : '1.5px solid transparent',
                outlineOffset: '-1.5px',
              }}>{c}</button>
          );
        })}
        <span className="w-px h-4 mx-1" style={{ background: 'var(--apple-surface-3)' }} />
        {allTags.map((t: string) => {
          const active = tagFilter === t;
          return (
            <button key={t} onClick={() => setTagFilter(active ? null : t)}
              className="text-[11px] font-medium px-2.5 py-1 rounded-full transition-all duration-150"
              style={{
                background: active ? 'rgba(48, 209, 88, 0.12)' : 'var(--apple-surface-2)',
                color: active ? 'var(--apple-green)' : 'var(--apple-text-tertiary)',
                outline: active ? '1.5px solid var(--apple-green)' : '1.5px solid transparent',
                outlineOffset: '-1.5px',
              }}>{t}</button>
          );
        })}
        {hasFilter && (
          <button onClick={() => { setCatFilter(null); setTagFilter(null); }}
            className="text-[11px] font-medium px-2.5 py-1 rounded-full transition-all duration-150 ml-1"
            style={{ background: 'var(--apple-overlay-dim)', color: 'var(--apple-text-tertiary)' }}>
            ✕ Clear
          </button>
        )}
        <span className="ml-auto text-[11px] tabular-nums" style={{ color: 'var(--apple-text-tertiary)' }}>
          {filtered.length} of {runbooks.length}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.slice(rbPage * settings.tablePageSize, (rbPage + 1) * settings.tablePageSize).map((rb: any) => (
          <div key={rb.id} className="apple-card apple-card-hover cursor-pointer space-y-3 relative group" onClick={() => navigate(`/runbooks/${rb.id}`)}>
            {canManageRunbooks && (
              <button onClick={(e) => handleDelete(rb.id, e)}
                className="absolute top-3 right-3 p-1.5 rounded-[6px] opacity-0 group-hover:opacity-100 transition-all hover:!opacity-80"
                style={{ background: 'rgba(255, 69, 58, 0.1)', color: 'var(--apple-red)' }} title="Delete runbook">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <h3 className="text-[15px] font-semibold tracking-tight" style={{ color: 'var(--apple-text-primary)' }}>{rb.name}</h3>
            <p className="text-[13px] leading-relaxed" style={{ color: 'var(--apple-text-secondary)' }}>{rb.description}</p>
            <div className="flex items-center gap-2">
              <span className="apple-pill" style={{ background: 'rgba(10, 132, 255, 0.12)', color: 'var(--apple-blue)' }}>{rb.category}</span>
            </div>
            <div className="flex items-center gap-4 text-[12px]" style={{ color: 'var(--apple-text-tertiary)' }}>
              <span className="flex items-center gap-1"><Layers className="w-3 h-3" />{rb.steps.length} steps</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />~{rb.estimatedTimeMinutes}min</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {rb.tags.slice(0, 4).map((t: string) => (
                <span key={t} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--apple-surface-2)', color: 'var(--apple-text-tertiary)' }}>{t}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {filtered.length > settings.tablePageSize && (
        <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid var(--apple-border)' }}>
          <span className="text-[12px] tabular-nums" style={{ color: 'var(--apple-text-tertiary)' }}>
            {rbPage * settings.tablePageSize + 1}–{Math.min((rbPage + 1) * settings.tablePageSize, filtered.length)} of {filtered.length}
          </span>
          <div className="flex gap-1.5">
            <button disabled={rbPage === 0} onClick={() => setRbPage(p => p - 1)}
              className="text-[12px] font-medium px-3 py-1.5 rounded-[8px] transition-all duration-150 disabled:opacity-30"
              style={{ background: 'var(--apple-surface-2)', color: 'var(--apple-text-secondary)' }}>Previous</button>
            <button disabled={(rbPage + 1) * settings.tablePageSize >= filtered.length} onClick={() => setRbPage(p => p + 1)}
              className="text-[12px] font-medium px-3 py-1.5 rounded-[8px] transition-all duration-150 disabled:opacity-30"
              style={{ background: 'var(--apple-surface-2)', color: 'var(--apple-text-secondary)' }}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
