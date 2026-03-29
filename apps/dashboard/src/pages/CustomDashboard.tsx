import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BarChart3, Clock, AlertTriangle, Shield, Activity, Layers, GripVertical, RotateCcw, CheckCircle } from 'lucide-react';
import { api } from '../api';

type WidgetId = 'open_incidents' | 'mttr' | 'sla_status' | 'severity_breakdown' | 'top_services' | 'recent_activity';

interface WidgetDef {
  id: WidgetId;
  title: string;
  icon: React.ReactNode;
  size: 'sm' | 'md' | 'lg';
}

const WIDGET_DEFS: WidgetDef[] = [
  { id: 'open_incidents', title: 'Open Incidents', icon: <AlertTriangle className="w-4 h-4" style={{ color: 'var(--apple-orange)', strokeWidth: 1.8 }} />, size: 'sm' },
  { id: 'mttr', title: 'MTTR / MTTA', icon: <Clock className="w-4 h-4" style={{ color: 'var(--apple-blue)', strokeWidth: 1.8 }} />, size: 'sm' },
  { id: 'sla_status', title: 'SLA Status', icon: <Shield className="w-4 h-4" style={{ color: 'var(--apple-green)', strokeWidth: 1.8 }} />, size: 'sm' },
  { id: 'severity_breakdown', title: 'Severity Breakdown', icon: <BarChart3 className="w-4 h-4" style={{ color: 'var(--apple-purple)', strokeWidth: 1.8 }} />, size: 'md' },
  { id: 'top_services', title: 'Top Failing Services', icon: <Layers className="w-4 h-4" style={{ color: 'var(--apple-red)', strokeWidth: 1.8 }} />, size: 'md' },
  { id: 'recent_activity', title: 'Recent Activity', icon: <Activity className="w-4 h-4" style={{ color: 'var(--apple-teal)', strokeWidth: 1.8 }} />, size: 'lg' },
];

const STORAGE_KEY = 'custom-dashboard-layout';

function loadLayout(): WidgetId[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return WIDGET_DEFS.map(w => w.id);
}

function saveLayout(layout: WidgetId[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

function formatMs(ms: number | null | undefined): string {
  if (!ms) return '—';
  if (ms < 60000) return `${(ms / 1000).toFixed(0)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

export default function CustomDashboard() {
  const [layout, setLayout] = useState<WidgetId[]>(loadLayout);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [sla, setSla] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);

  useEffect(() => {
    Promise.all([
      api.listIncidents().then((d: any) => setIncidents(d.incidents || [])),
      api.getSLAMetrics().then((d: any) => setSla(d)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const updateLayout = useCallback((newLayout: WidgetId[]) => {
    setLayout(newLayout);
    saveLayout(newLayout);
  }, []);

  const handleDragStart = (idx: number) => {
    dragItem.current = idx;
  };

  const handleDragEnter = (idx: number) => {
    dragOver.current = idx;
  };

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOver.current === null) return;
    const newLayout = [...layout];
    const dragged = newLayout.splice(dragItem.current, 1)[0];
    newLayout.splice(dragOver.current, 0, dragged);
    dragItem.current = null;
    dragOver.current = null;
    updateLayout(newLayout);
  };

  const resetLayout = () => {
    updateLayout(WIDGET_DEFS.map(w => w.id));
  };

  const toggleWidget = (id: WidgetId) => {
    if (layout.includes(id)) {
      updateLayout(layout.filter(w => w !== id));
    } else {
      updateLayout([...layout, id]);
    }
  };

  // Computed data
  const openIncidents = incidents.filter(i => i.status === 'open');
  const ackedIncidents = incidents.filter(i => i.status === 'acknowledged');
  const resolvedIncidents = incidents.filter(i => i.status === 'resolved');
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  incidents.filter(i => i.status !== 'resolved').forEach(i => {
    const sev = i.analysis?.severity || 'medium';
    if (sev in severityCounts) severityCounts[sev as keyof typeof severityCounts]++;
  });

  const serviceCounts: Record<string, number> = {};
  incidents.filter(i => i.status !== 'resolved').forEach(i => {
    const svc = i.service || i.analysis?.rootCause?.category || 'unknown';
    serviceCounts[svc] = (serviceCounts[svc] || 0) + 1;
  });
  const topServices = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const avgAck = sla?.averageAckMs || null;
  const avgResolve = sla?.averageResolveMs || null;

  const recentIncidents = [...incidents].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 8);

  const renderWidget = (id: WidgetId) => {
    const def = WIDGET_DEFS.find(w => w.id === id);
    if (!def) return null;

    switch (id) {
      case 'open_incidents':
        return (
          <div className="space-y-3">
            <div className="flex items-baseline gap-3">
              <span className="apple-stat-value" style={{ color: openIncidents.length > 0 ? 'var(--apple-orange)' : 'var(--apple-green)' }}>{openIncidents.length}</span>
              <span className="text-[12px] font-medium" style={{ color: 'var(--apple-text-tertiary)' }}>open</span>
            </div>
            <div className="flex gap-4">
              <div>
                <p className="text-[11px]" style={{ color: 'var(--apple-text-tertiary)' }}>Acknowledged</p>
                <p className="text-[18px] font-bold tabular-nums" style={{ color: 'var(--apple-yellow)' }}>{ackedIncidents.length}</p>
              </div>
              <div>
                <p className="text-[11px]" style={{ color: 'var(--apple-text-tertiary)' }}>Resolved today</p>
                <p className="text-[18px] font-bold tabular-nums" style={{ color: 'var(--apple-green)' }}>
                  {resolvedIncidents.filter(i => {
                    const d = new Date(i.resolvedAt);
                    const now = new Date();
                    return d.toDateString() === now.toDateString();
                  }).length}
                </p>
              </div>
            </div>
          </div>
        );

      case 'mttr':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--apple-text-tertiary)' }}>Avg Ack Time</p>
                <p className="text-[22px] font-bold tabular-nums" style={{ color: 'var(--apple-blue)' }}>{formatMs(avgAck)}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--apple-text-tertiary)' }}>Avg Resolve Time</p>
                <p className="text-[22px] font-bold tabular-nums" style={{ color: 'var(--apple-teal)' }}>{formatMs(avgResolve)}</p>
              </div>
            </div>
            {sla?.p95AckMs && (
              <div className="flex gap-4 pt-2" style={{ borderTop: '1px solid var(--apple-border)' }}>
                <div>
                  <p className="text-[10px]" style={{ color: 'var(--apple-text-tertiary)' }}>P95 Ack</p>
                  <p className="text-[13px] font-semibold tabular-nums" style={{ color: 'var(--apple-text-secondary)' }}>{formatMs(sla.p95AckMs)}</p>
                </div>
                <div>
                  <p className="text-[10px]" style={{ color: 'var(--apple-text-tertiary)' }}>P95 Resolve</p>
                  <p className="text-[13px] font-semibold tabular-nums" style={{ color: 'var(--apple-text-secondary)' }}>{formatMs(sla.p95ResolveMs)}</p>
                </div>
              </div>
            )}
          </div>
        );

      case 'sla_status': {
        const breaches = sla?.breaches || 0;
        const total = sla?.totalIncidents || incidents.length;
        const compliance = total > 0 ? ((total - breaches) / total * 100).toFixed(1) : '100.0';
        return (
          <div className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="apple-stat-value" style={{ color: breaches === 0 ? 'var(--apple-green)' : 'var(--apple-red)' }}>{compliance}%</span>
              <span className="text-[12px] font-medium" style={{ color: 'var(--apple-text-tertiary)' }}>compliance</span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--apple-surface-3)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${compliance}%`, background: breaches === 0 ? 'var(--apple-green)' : 'var(--apple-orange)' }} />
            </div>
            <p className="text-[11px]" style={{ color: 'var(--apple-text-tertiary)' }}>
              {breaches} breach{breaches !== 1 ? 'es' : ''} out of {total} incidents
            </p>
          </div>
        );
      }

      case 'severity_breakdown':
        return (
          <div className="space-y-2.5">
            {(['critical', 'high', 'medium', 'low'] as const).map(sev => {
              const count = severityCounts[sev];
              const total = Object.values(severityCounts).reduce((a, b) => a + b, 0);
              const pct = total > 0 ? (count / total * 100) : 0;
              const colors: Record<string, string> = { critical: 'var(--apple-red)', high: 'var(--apple-orange)', medium: 'var(--apple-yellow)', low: 'var(--apple-text-tertiary)' };
              return (
                <div key={sev}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-medium capitalize" style={{ color: colors[sev] }}>{sev}</span>
                    <span className="text-[12px] font-semibold tabular-nums" style={{ color: 'var(--apple-text-secondary)' }}>{count}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--apple-surface-3)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: colors[sev] }} />
                  </div>
                </div>
              );
            })}
          </div>
        );

      case 'top_services':
        return (
          <div className="space-y-2">
            {topServices.length === 0 && (
              <p className="text-[12px] py-4 text-center" style={{ color: 'var(--apple-text-tertiary)' }}>No active incidents</p>
            )}
            {topServices.map(([svc, count], i) => (
              <div key={svc} className="flex items-center gap-2.5 py-1">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: 'var(--apple-surface-3)', color: 'var(--apple-text-secondary)' }}>{i + 1}</span>
                <span className="text-[13px] font-medium flex-1 truncate" style={{ color: 'var(--apple-text-primary)' }}>{svc}</span>
                <span className="text-[12px] font-semibold tabular-nums px-2 py-0.5 rounded-full" style={{ background: 'rgba(255, 69, 58, 0.1)', color: 'var(--apple-red)' }}>{count}</span>
              </div>
            ))}
          </div>
        );

      case 'recent_activity':
        return (
          <div className="space-y-1.5">
            {recentIncidents.length === 0 && (
              <p className="text-[12px] py-4 text-center" style={{ color: 'var(--apple-text-tertiary)' }}>No recent activity</p>
            )}
            {recentIncidents.map(inc => {
              const statusColors: Record<string, string> = { open: 'var(--apple-orange)', acknowledged: 'var(--apple-yellow)', resolved: 'var(--apple-green)' };
              return (
                <div key={inc.id} className="flex items-center gap-2.5 py-1.5 px-1 rounded-[6px] transition-all hover:opacity-80 cursor-default">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: statusColors[inc.status] || 'var(--apple-text-tertiary)' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium truncate" style={{ color: 'var(--apple-text-primary)' }}>{inc.title}</p>
                  </div>
                  <span className="text-[10px] font-medium shrink-0 tabular-nums" style={{ color: 'var(--apple-text-tertiary)' }}>
                    {new Date(inc.updatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--apple-text-tertiary)' }}>
        <div className="w-5 h-5 border-2 rounded-full animate-spin mr-3" style={{ borderColor: 'var(--apple-surface-3)', borderTopColor: 'var(--apple-blue)' }} />
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="apple-title">Dashboard</h1>
        <p className="apple-subtitle">Drag widgets to rearrange. Toggle visibility below.</p>
      </div>

      {/* Widget toggles + reset */}
      <div className="flex flex-wrap items-center gap-1.5 mb-6" role="group" aria-label="Toggle dashboard widgets">
        {WIDGET_DEFS.map(w => {
          const active = layout.includes(w.id);
          return (
            <button key={w.id} onClick={() => toggleWidget(w.id)}
              className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-full transition-all duration-150"
              style={{
                background: active ? 'rgba(10, 132, 255, 0.12)' : 'var(--apple-surface-2)',
                color: active ? 'var(--apple-blue)' : 'var(--apple-text-tertiary)',
                outline: active ? '1.5px solid var(--apple-blue)' : '1.5px solid transparent',
                outlineOffset: '-1.5px',
              }}
              aria-pressed={active}
              aria-label={`${active ? 'Hide' : 'Show'} ${w.title} widget`}>
              {active && <CheckCircle className="w-3 h-3" style={{ strokeWidth: 2 }} />}
              {w.title}
            </button>
          );
        })}
        <button onClick={resetLayout} className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-full transition-all duration-150 ml-auto"
          style={{ background: 'var(--apple-surface-2)', color: 'var(--apple-text-tertiary)' }} aria-label="Reset dashboard layout">
          <RotateCcw className="w-3 h-3" style={{ strokeWidth: 1.8 }} /> Reset
        </button>
      </div>

      {/* Draggable widget grid — rows of up to 3, each row adapts */}
      <div className="space-y-4">
        {Array.from({ length: Math.ceil(layout.length / 3) }, (_, rowIdx) => {
          const rowItems = layout.slice(rowIdx * 3, rowIdx * 3 + 3);
          return (
            <div key={rowIdx} className="flex gap-4 flex-col md:flex-row">
              {rowItems.map((id, localIdx) => {
                const globalIdx = rowIdx * 3 + localIdx;
                const def = WIDGET_DEFS.find(w => w.id === id);
                if (!def) return null;
                return (
                  <div
                    key={id}
                    className="apple-card relative group flex-1 min-w-0"
                    draggable
                    onDragStart={() => handleDragStart(globalIdx)}
                    onDragEnter={() => handleDragEnter(globalIdx)}
                    onDragEnd={handleDragEnd}
                    onDragOver={e => e.preventDefault()}
                    role="listitem"
                    aria-label={`${def.title} widget`}
                  >
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-60 transition-opacity cursor-grab active:cursor-grabbing" aria-hidden="true">
                      <GripVertical className="w-4 h-4" style={{ color: 'var(--apple-text-tertiary)' }} />
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      {def.icon}
                      <h3 className="text-[13px] font-semibold" style={{ color: 'var(--apple-text-primary)' }}>{def.title}</h3>
                    </div>
                    {renderWidget(id)}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {layout.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <BarChart3 className="w-10 h-10 mb-3" style={{ color: 'var(--apple-surface-3)' }} />
          <p className="text-[14px] font-medium" style={{ color: 'var(--apple-text-tertiary)' }}>No widgets visible</p>
          <p className="text-[12px] mt-1" style={{ color: 'var(--apple-text-tertiary)' }}>Toggle widgets above or reset to defaults.</p>
        </div>
      )}
    </div>
  );
}
