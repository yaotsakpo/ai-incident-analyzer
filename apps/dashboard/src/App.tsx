import React, { useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { Routes, Route, NavLink, useNavigate, Navigate } from 'react-router-dom';
import { AlertTriangle, BarChart3, Activity, BookOpen, Layers, PanelLeftClose, PanelLeft, Settings, Sun, Moon, Menu, X, LogOut, User, Users, Lock, Bell, Check, Eye, EyeOff, ClipboardList } from 'lucide-react';
import IncidentsFeed from './pages/IncidentsFeed';
import IncidentDetail from './pages/IncidentDetail';
import AnomalyDashboard from './pages/AnomalyDashboard';
import Analytics from './pages/Analytics';
import RunbookDetail from './pages/RunbookDetail';
import RunbooksList from './pages/RunbooksList';
import SettingsPage from './pages/Settings';
import AuditTrail from './pages/AuditTrail';
import CustomDashboard from './pages/CustomDashboard';
import Login from './pages/Login';
import Onboarding from './components/Onboarding';
import GuideTour from './components/GuideTour';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import CommandPalette, { CommandHint } from './components/CommandPalette';
import ForcePasswordChange from './components/ForcePasswordChange';
import { api } from './api';
import { useSettings } from './useSettings';
import { AuthProvider, useAuth } from './useAuth';

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
                  PagerDuty Simulated
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
          <Routes>
            <Route path="/" element={<ErrorBoundary><IncidentsFeed /></ErrorBoundary>} />
            <Route path="/incidents/:id" element={<ErrorBoundary><IncidentDetail /></ErrorBoundary>} />
            <Route path="/anomalies" element={<ErrorBoundary><RoleGuard roles={['admin', 'responder']} userRole={user.role}><AnomalyDashboard /></RoleGuard></ErrorBoundary>} />
            <Route path="/dashboard" element={<ErrorBoundary><CustomDashboard /></ErrorBoundary>} />
            <Route path="/analytics" element={<ErrorBoundary><Analytics /></ErrorBoundary>} />
            <Route path="/runbooks" element={<ErrorBoundary><RoleGuard roles={['admin', 'responder']} userRole={user.role}><RunbooksList /></RoleGuard></ErrorBoundary>} />
            <Route path="/runbooks/:id" element={<ErrorBoundary><RoleGuard roles={['admin', 'responder']} userRole={user.role}><RunbookDetail /></RoleGuard></ErrorBoundary>} />
            <Route path="/audit-trail" element={<ErrorBoundary><RoleGuard roles={['admin']} userRole={user.role}><AuditTrail /></RoleGuard></ErrorBoundary>} />
            <Route path="/settings" element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
          </Routes>
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

