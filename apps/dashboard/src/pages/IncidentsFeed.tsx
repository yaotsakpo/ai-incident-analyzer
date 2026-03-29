import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Search, RefreshCw, ChevronDown, X, Download } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { useAuth } from '../useAuth';
import { useSettings } from '../useSettings';
import { useTimeAgo } from '../hooks/useTimeAgo';
import { useSSE } from '../useSSE';
import IncidentRow from '../components/IncidentRow';
import type { Incident, Team } from '../types';

function exportCSV(incidents: Incident[]) {
  const headers = ['ID', 'Title', 'Service', 'Severity', 'Status', 'Category', 'Confidence', 'Created', 'Resolved', 'Time to Resolve (min)'];
  const rows = incidents.map((inc) => [
    inc.id,
    `"${inc.title.replace(/"/g, '""')}"`,
    inc.service || '',
    inc.analysis?.severity || '',
    inc.status,
    inc.analysis?.rootCause?.category || '',
    inc.analysis ? Math.round(inc.analysis.confidence * 100) + '%' : '',
    inc.createdAt,
    inc.resolvedAt || '',
    inc.timeToResolveMs ? Math.round(inc.timeToResolveMs / 60000) : '',
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `incidents-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function IncidentsFeed() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState<string>(searchParams.get('status') || 'all');
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const { settings } = useSettings();
  const { isRole, hasPerm } = useAuth();
  const isAdmin = isRole('admin');
  const canSeed = hasPerm('settings:manage');
  const canAck = hasPerm('incidents:acknowledge');
  const canResolve = hasPerm('incidents:resolve');
  const [severityFilter, setSeverityFilter] = useState<string>(() => {
    return searchParams.get('severity') || (() => {
      try {
        const s = JSON.parse(localStorage.getItem('app-settings') || '{}');
        return s.defaultSeverityFilter || 'all';
      } catch { return 'all'; }
    })();
  });
  const [serviceFilter, setServiceFilter] = useState<string>(searchParams.get('service') || 'all');
  const [teamScope, setTeamScope] = useState<string>(searchParams.get('teamScope') || 'all');
  const [teams, setTeams] = useState<Team[]>([]);
  const [dateRange, setDateRange] = useState<string>(searchParams.get('range') || 'all');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [focusIdx, setFocusIdx] = useState(-1);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const prevCriticalIdsRef = useRef<Set<string>>(new Set());
  const navigate = useNavigate();
  const { toast } = useToast();
  const refreshRef = useRef<ReturnType<typeof setInterval>>();
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.listTeams().then((d: { teams?: Team[] }) => { if (d.teams) setTeams(d.teams); }).catch(() => {});
  }, []);

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    api.listIncidents(teamScope !== 'all' ? teamScope : undefined).then((data: { incidents?: Incident[] }) => {
      const incs = data.incidents || [];
      setIncidents(incs);
      setLoading(false);
      setLastRefresh(new Date());

      // Browser notification for new critical incidents
      const currentCritIds = new Set<string>(incs.filter((i) => i.analysis?.severity === 'critical' && i.status !== 'resolved').map((i) => i.id as string));
      const prevCritIds = prevCriticalIdsRef.current;
      if (prevCritIds.size > 0) {
        const newCritIds = Array.from(currentCritIds).filter(id => !prevCritIds.has(id));
        if (newCritIds.length > 0 && settings.notifyOnCritical) {
          toast(`${newCritIds.length} new critical incident${newCritIds.length > 1 ? 's' : ''}!`, 'error');
          // Play alert sound
          try {
            const ctx = new AudioContext();
            const playTone = (freq: number, start: number, dur: number) => {
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = 'sine';
              osc.frequency.value = freq;
              gain.gain.setValueAtTime(0.18, ctx.currentTime + start);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
              osc.connect(gain).connect(ctx.destination);
              osc.start(ctx.currentTime + start);
              osc.stop(ctx.currentTime + start + dur);
            };
            playTone(880, 0, 0.15);
            playTone(1100, 0.18, 0.15);
            playTone(880, 0.36, 0.2);
          } catch {}
          if (Notification.permission === 'granted') {
            new Notification('Critical Incident', { body: `${newCritIds.length} new critical incident(s) detected` });
          }
        }
      }
      prevCriticalIdsRef.current = currentCritIds;
    });
  }, [toast, teamScope, settings.notifyOnCritical]);

  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
    load();
    refreshRef.current = setInterval(() => load(true), settings.autoRefreshInterval * 1000);
    return () => clearInterval(refreshRef.current);
  }, [load, settings.autoRefreshInterval]);

  // Reload when team scope changes
  useEffect(() => { load(true); }, [teamScope]);

  // SSE real-time updates — reload on any incident event
  useSSE((event) => {
    if (event.type === 'incident:created' || event.type === 'incident:updated') {
      load(true);
    }
  });

  // Persist filters to URL
  useEffect(() => {
    const params: Record<string, string> = {};
    if (filter !== 'all') params.status = filter;
    if (severityFilter !== 'all') params.severity = severityFilter;
    if (serviceFilter !== 'all') params.service = serviceFilter;
    if (dateRange !== 'all') params.range = dateRange;
    if (teamScope !== 'all') params.teamScope = teamScope;
    if (search) params.q = search;
    setSearchParams(params, { replace: true });
  }, [filter, severityFilter, serviceFilter, dateRange, search, setSearchParams]);

  const quickAction = async (e: React.MouseEvent, incId: string, status: import('@incident-analyzer/shared').IncidentStatus, label: string) => {
    e.stopPropagation();
    await api.updateIncidentStatus(incId, status);
    toast(`Incident ${label.toLowerCase()}`, 'success');
    load(true);
  };

  const handleSeed = async () => {
    setSeeding(true);
    await api.seed();
    toast('Demo data seeded', 'success');
    load();
    setSeeding(false);
  };

  // Derive unique services
  const services = useMemo(() => {
    const s = new Set<string>();
    incidents.forEach((i) => { if (i.service) s.add(i.service); });
    return Array.from(s).sort();
  }, [incidents]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const rangeMs: Record<string, number> = { '1h': 3600000, '6h': 21600000, '24h': 86400000, '7d': 604800000, '30d': 2592000000 };
    return incidents.filter((inc) => {
      if (filter !== 'all' && inc.status !== filter) return false;
      if (severityFilter !== 'all' && inc.analysis?.severity !== severityFilter) return false;
      if (serviceFilter !== 'all' && inc.service !== serviceFilter) return false;
      if (dateRange !== 'all' && rangeMs[dateRange]) {
        if (now - new Date(inc.createdAt).getTime() > rangeMs[dateRange]) return false;
      }
      if (search && !inc.title.toLowerCase().includes(search.toLowerCase()) &&
          !inc.service?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [incidents, filter, severityFilter, serviceFilter, dateRange, search]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [filter, severityFilter, serviceFilter, dateRange, search]);

  const pageSize = settings.tablePageSize;
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginatedList = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const counts = {
    all: incidents.length,
    open: incidents.filter((i) => i.status === 'open').length,
    acknowledged: incidents.filter((i) => i.status === 'acknowledged').length,
    investigating: incidents.filter((i) => i.status === 'investigating').length,
    resolved: incidents.filter((i) => i.status === 'resolved').length,
  };

  // Live timestamps
  const dates = useMemo(() => filtered.map((i) => i.createdAt), [filtered]);
  const timeAgoMap = useTimeAgo(dates);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'j') {
        e.preventDefault();
        setFocusIdx(prev => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === 'k') {
        e.preventDefault();
        setFocusIdx(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && focusIdx >= 0 && filtered[focusIdx]) {
        e.preventDefault();
        navigate(`/incidents/${filtered[focusIdx].id}`);
      } else if (e.key === 'a' && canAck && focusIdx >= 0 && filtered[focusIdx]) {
        const inc = filtered[focusIdx];
        if (inc.status === 'open') {
          api.updateIncidentStatus(inc.id, 'acknowledged').then(() => {
            toast('Incident acknowledged', 'success');
            load(true);
          });
        }
      } else if (e.key === 'r' && canResolve && focusIdx >= 0 && filtered[focusIdx]) {
        const inc = filtered[focusIdx];
        if (inc.status !== 'resolved') {
          api.updateIncidentStatus(inc.id, 'resolved').then(() => {
            toast('Incident resolved', 'success');
            load(true);
          });
        }
      } else if (e.key === 'x' && focusIdx >= 0 && filtered[focusIdx]) {
        const incId = filtered[focusIdx].id;
        setSelected(prev => {
          const next = new Set(prev);
          if (next.has(incId)) next.delete(incId); else next.add(incId);
          return next;
        });
      } else if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'Escape') {
        setSelected(new Set());
        setFocusIdx(-1);
        searchRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [focusIdx, filtered, navigate, toast, load]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusIdx >= 0 && listRef.current) {
      const el = listRef.current.children[focusIdx] as HTMLElement;
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [focusIdx]);

  // Bulk actions
  const bulkAck = async () => {
    const ids = [...selected].filter(id => {
      const inc = incidents.find((i) => i.id === id);
      return inc && inc.status === 'open';
    });
    await Promise.all(ids.map(id => api.updateIncidentStatus(id, 'acknowledged')));
    toast(`${ids.length} incident${ids.length > 1 ? 's' : ''} acknowledged`, 'success');
    setSelected(new Set());
    load(true);
  };

  const bulkResolve = async () => {
    const ids = [...selected].filter(id => {
      const inc = incidents.find((i) => i.id === id);
      return inc && inc.status !== 'resolved';
    });
    await Promise.all(ids.map(id => api.updateIncidentStatus(id, 'resolved')));
    toast(`${ids.length} incident${ids.length > 1 ? 's' : ''} resolved`, 'success');
    setSelected(new Set());
    load(true);
  };

  const toggleSelect = (e: React.MouseEvent, incId: string) => {
    e.stopPropagation();
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(incId)) next.delete(incId); else next.add(incId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--apple-text-tertiary)' }}>
        <div className="w-5 h-5 border-2 rounded-full animate-spin mr-3" style={{ borderColor: 'var(--apple-surface-3)', borderTopColor: 'var(--apple-blue)' }} />
        Loading incidents...
      </div>
    );
  }

  if (!incidents.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5" style={{ background: 'var(--apple-surface-1)' }}>
          <AlertTriangle className="w-8 h-8" style={{ color: 'var(--apple-text-tertiary)', strokeWidth: 1.5 }} />
        </div>
        <p className="text-[20px] font-semibold tracking-tight" style={{ color: 'var(--apple-text-primary)' }}>No incidents yet</p>
        <p className="text-[14px] mt-1.5 mb-6" style={{ color: 'var(--apple-text-tertiary)' }}>
          {canSeed ? 'Seed the database with realistic data to get started.' : 'No incidents have been created yet. Contact an admin to seed demo data.'}
        </p>
        {canSeed && (
          <button onClick={handleSeed} disabled={seeding} className="apple-btn apple-btn-primary">
            {seeding ? 'Seeding...' : 'Seed Demo Data'}
          </button>
        )}
      </div>
    );
  }

  const hasActiveFilters = severityFilter !== 'all' || serviceFilter !== 'all' || dateRange !== 'all' || teamScope !== 'all';

  return (
    <div className="p-8">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="apple-title">Incidents</h1>
          <p className="apple-subtitle">{incidents.length} total incidents</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--apple-text-tertiary)' }}>
            <RefreshCw className="w-3 h-3" style={{ strokeWidth: 2 }} />
            {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          {canSeed && (
            <button onClick={handleSeed} disabled={seeding} className="apple-btn apple-btn-secondary">
              {seeding ? 'Seeding...' : 'Re-seed'}
            </button>
          )}
        </div>
      </div>

      {/* Search + Status Filters */}
      <div className="flex items-center gap-4 mb-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--apple-text-tertiary)', strokeWidth: 1.8 }} />
          <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search incidents...  ( / )"
            className="apple-input !pl-10" />
        </div>
        <div className="apple-segmented">
          {(['all', 'open', 'acknowledged', 'investigating', 'resolved'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)} className={filter === s ? 'active' : ''}>
              {s.charAt(0).toUpperCase() + s.slice(1)} {counts[s] > 0 && <span style={{ opacity: 0.5 }}>{counts[s]}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Advanced filters row */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative">
          <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}
            className="apple-input !pr-8 !py-1.5 !text-[12px] appearance-none cursor-pointer" style={{ minWidth: 130 }}>
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" style={{ color: 'var(--apple-text-tertiary)' }} />
        </div>
        <div className="relative">
          <select value={serviceFilter} onChange={e => setServiceFilter(e.target.value)}
            className="apple-input !pr-8 !py-1.5 !text-[12px] appearance-none cursor-pointer" style={{ minWidth: 150 }}>
            <option value="all">All Services</option>
            {services.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" style={{ color: 'var(--apple-text-tertiary)' }} />
        </div>
        <div className="relative">
          <select value={teamScope} onChange={e => setTeamScope(e.target.value)}
            className="apple-input !pr-8 !py-1.5 !text-[12px] appearance-none cursor-pointer" style={{ minWidth: 120 }}>
            <option value="all">All Teams</option>
            <option value="mine">My Teams</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" style={{ color: 'var(--apple-text-tertiary)' }} />
        </div>
        <div className="relative">
          <select value={dateRange} onChange={e => setDateRange(e.target.value)}
            className="apple-input !pr-8 !py-1.5 !text-[12px] appearance-none cursor-pointer" style={{ minWidth: 120 }}>
            <option value="all">All Time</option>
            <option value="1h">Last 1 hour</option>
            <option value="6h">Last 6 hours</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" style={{ color: 'var(--apple-text-tertiary)' }} />
        </div>
        {hasActiveFilters && (
          <button onClick={() => { setSeverityFilter('all'); setServiceFilter('all'); setDateRange('all'); setTeamScope('all'); }}
            className="flex items-center gap-1 text-[12px] font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--apple-blue)' }}>
            <X className="w-3 h-3" /> Clear filters
          </button>
        )}
        <div className="flex-1" />
        <button onClick={() => exportCSV(filtered)} title="Export CSV"
          className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-[8px] transition-all duration-200 hover:opacity-70"
          style={{ background: 'var(--apple-surface-2)', color: 'var(--apple-text-secondary)' }}>
          <Download className="w-3.5 h-3.5" style={{ strokeWidth: 1.8 }} /> Export
        </button>
        <div className="text-[11px] flex items-center gap-3" style={{ color: 'var(--apple-text-tertiary)' }}>
          <span><kbd className="px-1 py-0.5 rounded" style={{ background: 'var(--apple-surface-2)' }}>j</kbd><kbd className="px-1 py-0.5 rounded ml-0.5" style={{ background: 'var(--apple-surface-2)' }}>k</kbd> navigate</span>
          {canAck && <span><kbd className="px-1 py-0.5 rounded" style={{ background: 'var(--apple-surface-2)' }}>a</kbd> ack</span>}
          {canResolve && <span><kbd className="px-1 py-0.5 rounded" style={{ background: 'var(--apple-surface-2)' }}>r</kbd> resolve</span>}
          <span><kbd className="px-1 py-0.5 rounded" style={{ background: 'var(--apple-surface-2)' }}>x</kbd> select</span>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 px-4 py-2.5 rounded-[12px]" style={{ background: 'var(--apple-surface-2)' }}>
          <span className="text-[13px] font-medium" style={{ color: 'var(--apple-text-primary)' }}>
            {selected.size} selected
          </span>
          {canAck && <button onClick={bulkAck} className="apple-btn" style={{ background: 'rgba(255, 214, 10, 0.12)', color: 'var(--apple-yellow)', padding: '5px 12px', fontSize: 12 }}>
            Acknowledge All
          </button>}
          {canResolve && <button onClick={bulkResolve} className="apple-btn apple-btn-success" style={{ padding: '5px 12px', fontSize: 12 }}>
            Resolve All
          </button>}
          <button onClick={() => setSelected(new Set())} className="apple-btn apple-btn-secondary" style={{ padding: '5px 12px', fontSize: 12 }}>
            Clear
          </button>
        </div>
      )}

      {/* Incident list */}
      <div className="space-y-2" ref={listRef}>
        {paginatedList.map((inc, idx: number) => (
          <IncidentRow
            key={inc.id}
            inc={inc}
            isFocused={idx === focusIdx}
            isSelected={selected.has(inc.id)}
            timeAgo={timeAgoMap.get(inc.createdAt) || ''}
            canAck={canAck}
            canResolve={canResolve}
            onNavigate={(id) => navigate(`/incidents/${id}`)}
            onToggleSelect={toggleSelect}
            onQuickAction={quickAction}
          />
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-[14px]" style={{ color: 'var(--apple-text-tertiary)' }}>No incidents match your filters.</div>
        )}
      </div>

      {/* Pagination */}
      {filtered.length > pageSize && (
        <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid var(--apple-border)' }}>
          <span className="text-[12px] tabular-nums" style={{ color: 'var(--apple-text-tertiary)' }}>
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length}
          </span>
          <div className="flex gap-1.5">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
              className="text-[12px] font-medium px-3 py-1.5 rounded-[8px] transition-all duration-150 disabled:opacity-30"
              style={{ background: 'var(--apple-surface-2)', color: 'var(--apple-text-secondary)' }}>Previous</button>
            <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
              className="text-[12px] font-medium px-3 py-1.5 rounded-[8px] transition-all duration-150 disabled:opacity-30"
              style={{ background: 'var(--apple-surface-2)', color: 'var(--apple-text-secondary)' }}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
