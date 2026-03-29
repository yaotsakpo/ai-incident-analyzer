import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Activity, AlertTriangle, Server, X, GripVertical, Columns, Rows } from 'lucide-react';
import { api } from '../api';
import Expandable from '../components/Expandable';
import { useSettings } from '../useSettings';

type SummaryFilter = 'active' | 'critical' | 'high' | 'unacked' | null;

const severityStyle: Record<string, { bg: string; color: string; pillBg: string }> = {
  critical: { bg: 'rgba(255, 69, 58, 0.08)', color: 'var(--apple-red)', pillBg: 'rgba(255, 69, 58, 0.15)' },
  high: { bg: 'rgba(255, 159, 10, 0.08)', color: 'var(--apple-orange)', pillBg: 'rgba(255, 159, 10, 0.15)' },
  medium: { bg: 'rgba(255, 214, 10, 0.08)', color: 'var(--apple-yellow)', pillBg: 'rgba(255, 214, 10, 0.15)' },
  low: { bg: 'rgba(10, 132, 255, 0.08)', color: 'var(--apple-blue)', pillBg: 'rgba(10, 132, 255, 0.15)' },
};

export default function AnomalyDashboard() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceFilter, setServiceFilter] = useState<string | null>(null);
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>(null);
  const [incSevFilter, setIncSevFilter] = useState<string | null>(null);
  const [incStatusFilter, setIncStatusFilter] = useState<string | null>(null);
  const [incPage, setIncPage] = useState(0);
  const [patternPage, setPatternPage] = useState(0);
  const [svcPage, setSvcPage] = useState(0);
  const { settings } = useSettings();
  const [serviceOrder, setServiceOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('anomaly-service-order');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const [panelOrder, setPanelOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('anomaly-panel-order');
      return saved ? JSON.parse(saved) : ['patterns', 'incidents'];
    } catch { return ['patterns', 'incidents']; }
  });
  const [panelLayout, setPanelLayout] = useState<'stacked' | 'side'>(() => {
    try {
      return (localStorage.getItem('anomaly-panel-layout') as 'stacked' | 'side') || 'stacked';
    } catch { return 'stacked'; }
  });
  const panelDragIdx = useRef<number | null>(null);
  const [panelDragOverIdx, setPanelDragOverIdx] = useState<number | null>(null);

  const [topPanelOrder, setTopPanelOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('anomaly-top-panel-order');
      return saved ? JSON.parse(saved) : ['summary', 'health'];
    } catch { return ['summary', 'health']; }
  });
  const [topPanelLayout, setTopPanelLayout] = useState<'stacked' | 'side'>(() => {
    try {
      return (localStorage.getItem('anomaly-top-panel-layout') as 'stacked' | 'side') || 'stacked';
    } catch { return 'stacked'; }
  });
  const topDragIdx = useRef<number | null>(null);
  const [topDragOverIdx, setTopDragOverIdx] = useState<number | null>(null);

  useEffect(() => {
    if (serviceOrder.length > 0) {
      localStorage.setItem('anomaly-service-order', JSON.stringify(serviceOrder));
    }
  }, [serviceOrder]);

  useEffect(() => {
    localStorage.setItem('anomaly-panel-order', JSON.stringify(panelOrder));
  }, [panelOrder]);

  useEffect(() => {
    localStorage.setItem('anomaly-top-panel-order', JSON.stringify(topPanelOrder));
  }, [topPanelOrder]);

  useEffect(() => {
    localStorage.setItem('anomaly-top-panel-layout', topPanelLayout);
  }, [topPanelLayout]);

  const handleTopDragStart = useCallback((idx: number) => {
    topDragIdx.current = idx;
  }, []);

  const handleTopDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setTopDragOverIdx(idx);
  }, []);

  const handleTopDrop = useCallback((idx: number) => {
    const from = topDragIdx.current;
    if (from === null || from === idx) {
      topDragIdx.current = null;
      setTopDragOverIdx(null);
      return;
    }
    const newOrder = [...topPanelOrder];
    const [moved] = newOrder.splice(from, 1);
    newOrder.splice(idx, 0, moved);
    setTopPanelOrder(newOrder);
    topDragIdx.current = null;
    setTopDragOverIdx(null);
  }, [topPanelOrder]);

  const handleTopDragEnd = useCallback(() => {
    topDragIdx.current = null;
    setTopDragOverIdx(null);
  }, []);

  useEffect(() => {
    localStorage.setItem('anomaly-panel-layout', panelLayout);
  }, [panelLayout]);

  const handlePanelDragStart = useCallback((idx: number) => {
    panelDragIdx.current = idx;
  }, []);

  const handlePanelDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setPanelDragOverIdx(idx);
  }, []);

  const handlePanelDrop = useCallback((idx: number) => {
    const from = panelDragIdx.current;
    if (from === null || from === idx) {
      panelDragIdx.current = null;
      setPanelDragOverIdx(null);
      return;
    }
    const newOrder = [...panelOrder];
    const [moved] = newOrder.splice(from, 1);
    newOrder.splice(idx, 0, moved);
    setPanelOrder(newOrder);
    panelDragIdx.current = null;
    setPanelDragOverIdx(null);
  }, [panelOrder]);

  const handlePanelDragEnd = useCallback(() => {
    panelDragIdx.current = null;
    setPanelDragOverIdx(null);
  }, []);

  useEffect(() => {
    api.listIncidents().then((data: any) => {
      setIncidents(data.incidents || []);
      setLoading(false);
    });
  }, []);

  // Build services map (safe even if empty)
  const services = useMemo(() => {
    const map = new Map<string, { total: number; critical: number; high: number; open: number }>();
    for (const inc of incidents) {
      const svc = inc.service || 'unknown';
      const existing = map.get(svc) || { total: 0, critical: 0, high: 0, open: 0 };
      existing.total++;
      if (inc.analysis.severity === 'critical') existing.critical++;
      if (inc.analysis.severity === 'high') existing.high++;
      if (inc.status === 'open') existing.open++;
      map.set(svc, existing);
    }
    return map;
  }, [incidents]);

  const serviceKeys = useMemo(() => Array.from(services.keys()), [services]);

  const orderedServices = useMemo(() => {
    if (serviceOrder.length === 0) return serviceKeys;
    const known = new Set(serviceKeys);
    const ordered = serviceOrder.filter(s => known.has(s));
    const remaining = serviceKeys.filter(s => !ordered.includes(s));
    return [...ordered, ...remaining];
  }, [serviceKeys, serviceOrder]);

  const handleDragStart = useCallback((idx: number) => {
    dragIdx.current = idx;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  }, []);

  const handleDrop = useCallback((idx: number) => {
    const from = dragIdx.current;
    if (from === null || from === idx) {
      dragIdx.current = null;
      setDragOverIdx(null);
      return;
    }
    const newOrder = [...orderedServices];
    const [moved] = newOrder.splice(from, 1);
    newOrder.splice(idx, 0, moved);
    setServiceOrder(newOrder);
    dragIdx.current = null;
    setDragOverIdx(null);
  }, [orderedServices]);

  const handleDragEnd = useCallback(() => {
    dragIdx.current = null;
    setDragOverIdx(null);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--apple-text-tertiary)' }}>
        <div className="w-5 h-5 border-2 rounded-full animate-spin mr-3" style={{ borderColor: 'var(--apple-surface-3)', borderTopColor: 'var(--apple-blue)' }} />
        Loading anomaly data...
      </div>
    );
  }

  if (!incidents.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5" style={{ background: 'var(--apple-surface-1)' }}>
          <Activity className="w-8 h-8" style={{ color: 'var(--apple-text-tertiary)', strokeWidth: 1.5 }} />
        </div>
        <p className="text-[20px] font-semibold tracking-tight" style={{ color: 'var(--apple-text-primary)' }}>No anomaly data</p>
        <p className="text-[14px] mt-1.5" style={{ color: 'var(--apple-text-tertiary)' }}>Seed incidents from the Incidents page to view anomaly analysis.</p>
      </div>
    );
  }

  const activeIncidents = incidents.filter((i: any) => i.status !== 'resolved');
  const criticalCount = incidents.filter((i: any) => i.analysis.severity === 'critical').length;
  const highCount = incidents.filter((i: any) => i.analysis.severity === 'high').length;
  const openCount = incidents.filter((i: any) => i.status === 'open').length;

  // Apply filters to get the scoped incident set for patterns + active list
  const scopedIncidents = incidents.filter((inc: any) => {
    if (serviceFilter && (inc.service || 'unknown') !== serviceFilter) return false;
    if (summaryFilter === 'active' && inc.status === 'resolved') return false;
    if (summaryFilter === 'critical' && inc.analysis.severity !== 'critical') return false;
    if (summaryFilter === 'high' && inc.analysis.severity !== 'high') return false;
    if (summaryFilter === 'unacked' && inc.status !== 'open') return false;
    return true;
  });

  const patternCounts = new Map<string, number>();
  for (const inc of scopedIncidents) {
    for (const p of inc.analysis.patterns) {
      patternCounts.set(p.name, (patternCounts.get(p.name) || 0) + p.occurrences);
    }
  }
  const topPatterns = Array.from(patternCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const scopedActive = scopedIncidents.filter((i: any) => i.status !== 'resolved');

  const hasFilter = serviceFilter !== null || summaryFilter !== null;
  const filterLabel = [
    serviceFilter,
    summaryFilter ? { active: 'Active', critical: 'Critical', high: 'High', unacked: 'Unacked' }[summaryFilter] : null,
  ].filter(Boolean).join(' · ');

  const toggleSummary = (key: SummaryFilter) => {
    setSummaryFilter(prev => prev === key ? null : key);
  };

  const toggleService = (svc: string) => {
    setServiceFilter(prev => prev === svc ? null : svc);
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="apple-title">Anomalies</h1>
        <p className="apple-subtitle">Service health overview and active anomalies.</p>
      </div>

      {/* Top layout toggle */}
      <div className="flex justify-end">
        <button
          onClick={() => setTopPanelLayout(l => l === 'stacked' ? 'side' : 'stacked')}
          className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-[8px] transition-all duration-200 hover:opacity-70"
          style={{ background: 'var(--apple-surface-2)', color: 'var(--apple-text-secondary)' }}>
          {topPanelLayout === 'stacked'
            ? <><Columns className="w-3.5 h-3.5" style={{ strokeWidth: 1.8 }} /> Side by side</>
            : <><Rows className="w-3.5 h-3.5" style={{ strokeWidth: 1.8 }} /> Stacked</>}
        </button>
      </div>

      {/* Draggable top panels: Summary + Service Health */}
      <div className={topPanelLayout === 'side' ? 'grid grid-cols-1 lg:grid-cols-2 gap-4 items-start' : 'space-y-8'}>
        {topPanelOrder.map((panelId, idx) => {
          const isDragOver = topDragOverIdx === idx;
          return (
            <div key={panelId}
              draggable
              onDragStart={() => handleTopDragStart(idx)}
              onDragOver={(e) => handleTopDragOver(e, idx)}
              onDrop={() => handleTopDrop(idx)}
              onDragEnd={handleTopDragEnd}
              style={{
                outline: isDragOver ? '2px dashed var(--apple-text-tertiary)' : '2px solid transparent',
                outlineOffset: '-2px',
                borderRadius: 14,
              }}>
              {panelId === 'summary' ? (
                <div className={topPanelLayout === 'side' ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-4 gap-3'}>
                  {([
                    { key: 'active' as SummaryFilter, label: 'Active', value: activeIncidents.length, color: 'var(--apple-orange)' },
                    { key: 'critical' as SummaryFilter, label: 'Critical', value: criticalCount, color: 'var(--apple-red)' },
                    { key: 'high' as SummaryFilter, label: 'High', value: highCount, color: 'var(--apple-orange)' },
                    { key: 'unacked' as SummaryFilter, label: 'Unacked', value: openCount, color: 'var(--apple-yellow)' },
                  ]).map(({ key, label, value, color }) => (
                    <div key={label}
                      className="apple-card text-center cursor-pointer transition-all duration-200 hover:scale-[1.02]"
                      onClick={() => toggleSummary(key)}
                      style={{
                        outline: summaryFilter === key ? `2px solid ${color}` : '2px solid transparent',
                        outlineOffset: '-2px',
                      }}>
                      <div className="apple-stat-label">{label}</div>
                      <div className="apple-stat-value" style={{ color }}>{value}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <Expandable title="Service Health" icon={<Server className="w-[18px] h-[18px]" style={{ color: 'var(--apple-text-tertiary)', strokeWidth: 1.8 }} />} count={services.size}>
                  <div className="space-y-3">
                    <div className={topPanelLayout === 'side' ? 'grid gap-3 grid-cols-1 md:grid-cols-2' : 'grid gap-3 md:grid-cols-2 lg:grid-cols-3'}>
                      {orderedServices.slice(svcPage * settings.tablePageSize, (svcPage + 1) * settings.tablePageSize).map((svc, svcIdx) => {
                        const globalIdx = svcPage * settings.tablePageSize + svcIdx;
                        const stats = services.get(svc)!;
                        const health = stats.critical > 0 ? 'critical' : stats.high > 0 ? 'high' : stats.open > 0 ? 'medium' : 'low';
                        const sty = severityStyle[health];
                        const isActive = serviceFilter === svc;
                        const isSvcDragOver = dragOverIdx === globalIdx;
                        return (
                          <div key={svc}
                            draggable
                            onDragStart={(e) => { e.stopPropagation(); handleDragStart(globalIdx); }}
                            onDragOver={(e) => { e.stopPropagation(); handleDragOver(e, globalIdx); }}
                            onDrop={(e) => { e.stopPropagation(); handleDrop(globalIdx); }}
                            onDragEnd={(e) => { e.stopPropagation(); handleDragEnd(); }}
                            className="p-4 rounded-[12px] transition-all duration-200 cursor-grab active:cursor-grabbing select-none"
                            onClick={() => toggleService(svc)}
                            style={{
                              background: sty.bg,
                              outline: isActive ? `2px solid ${sty.color}` : isSvcDragOver ? '2px dashed var(--apple-text-tertiary)' : '2px solid transparent',
                              outlineOffset: '-2px',
                              opacity: dragIdx.current === globalIdx ? 0.5 : 1,
                              transform: isSvcDragOver && !isActive ? 'scale(1.02)' : 'none',
                            }}>
                            <div className="flex items-center justify-between mb-2 gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <GripVertical className="w-3.5 h-3.5 shrink-0 opacity-30 hover:opacity-60 transition-opacity" style={{ color: 'var(--apple-text-tertiary)' }} />
                                <span className="text-[14px] font-semibold truncate" style={{ color: 'var(--apple-text-primary)' }}>{svc}</span>
                              </div>
                              <span className="apple-pill" style={{ background: sty.pillBg, color: sty.color }}>
                                {health}
                              </span>
                            </div>
                            <div className="flex gap-4 text-[12px] pl-[22px] flex-wrap" style={{ color: 'var(--apple-text-tertiary)' }}>
                              <span>{stats.total} incidents</span>
                              {stats.critical > 0 && <span style={{ color: 'var(--apple-red)' }}>{stats.critical} critical</span>}
                              {stats.open > 0 && <span style={{ color: 'var(--apple-yellow)' }}>{stats.open} open</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {orderedServices.length > settings.tablePageSize && (
                      <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid var(--apple-border)' }}>
                        <span className="text-[12px] tabular-nums" style={{ color: 'var(--apple-text-tertiary)' }}>
                          {svcPage * settings.tablePageSize + 1}–{Math.min((svcPage + 1) * settings.tablePageSize, orderedServices.length)} of {orderedServices.length}
                        </span>
                        <div className="flex gap-1.5">
                          <button disabled={svcPage === 0} onClick={() => setSvcPage(p => p - 1)}
                            className="text-[12px] font-medium px-3 py-1.5 rounded-[8px] transition-all duration-150 disabled:opacity-30"
                            style={{ background: 'var(--apple-surface-2)', color: 'var(--apple-text-secondary)' }}>Previous</button>
                          <button disabled={(svcPage + 1) * settings.tablePageSize >= orderedServices.length} onClick={() => setSvcPage(p => p + 1)}
                            className="text-[12px] font-medium px-3 py-1.5 rounded-[8px] transition-all duration-150 disabled:opacity-30"
                            style={{ background: 'var(--apple-surface-2)', color: 'var(--apple-text-secondary)' }}>Next</button>
                        </div>
                      </div>
                    )}
                  </div>
                </Expandable>
              )}
            </div>
          );
        })}
      </div>

      {/* Active filter indicator */}
      {hasFilter && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-[12px]" style={{ background: 'var(--apple-surface-2)' }}>
          <span className="text-[13px] font-medium" style={{ color: 'var(--apple-text-primary)' }}>
            Filtered: {filterLabel}
          </span>
          <span className="text-[12px] tabular-nums" style={{ color: 'var(--apple-text-tertiary)' }}>
            ({scopedIncidents.length} incident{scopedIncidents.length !== 1 ? 's' : ''})
          </span>
          <button onClick={() => { setServiceFilter(null); setSummaryFilter(null); }}
            className="ml-auto flex items-center gap-1 text-[12px] font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--apple-blue)' }}>
            <X className="w-3 h-3" /> Clear
          </button>
        </div>
      )}

      {/* Layout toggle */}
      <div className="flex justify-end">
        <button
          onClick={() => setPanelLayout(l => l === 'stacked' ? 'side' : 'stacked')}
          className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-[8px] transition-all duration-200 hover:opacity-70"
          style={{ background: 'var(--apple-surface-2)', color: 'var(--apple-text-secondary)' }}>
          {panelLayout === 'stacked'
            ? <><Columns className="w-3.5 h-3.5" style={{ strokeWidth: 1.8 }} /> Side by side</>
            : <><Rows className="w-3.5 h-3.5" style={{ strokeWidth: 1.8 }} /> Stacked</>}
        </button>
      </div>

      {/* Draggable panels */}
      <div className={panelLayout === 'side' ? 'grid grid-cols-1 lg:grid-cols-2 gap-4 items-start' : 'space-y-8'}>
        {panelOrder.map((panelId, idx) => {
          const isDragOver = panelDragOverIdx === idx;
          return (
            <div key={panelId}
              draggable
              onDragStart={() => handlePanelDragStart(idx)}
              onDragOver={(e) => handlePanelDragOver(e, idx)}
              onDrop={() => handlePanelDrop(idx)}
              onDragEnd={handlePanelDragEnd}
              style={{
                outline: isDragOver ? '2px dashed var(--apple-text-tertiary)' : '2px solid transparent',
                outlineOffset: '-2px',
                borderRadius: 14,
              }}>
              {panelId === 'patterns' ? (
                <Expandable title={`Top Error Patterns${hasFilter ? ' (filtered)' : ''}`} icon={<AlertTriangle className="w-[18px] h-[18px]" style={{ color: 'var(--apple-orange)', strokeWidth: 1.8 }} />} count={topPatterns.length}>
                  {topPatterns.length === 0 ? (
                    <p className="text-[13px] py-4 text-center" style={{ color: 'var(--apple-text-tertiary)' }}>No patterns match the current filter.</p>
                  ) : (
                    <div className="space-y-4">
                      {topPatterns.slice(patternPage * settings.tablePageSize, (patternPage + 1) * settings.tablePageSize).map(([name, count]) => {
                        const maxCount = topPatterns[0][1];
                        const pct = Math.round((count / maxCount) * 100);
                        return (
                          <div key={name}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[14px] font-medium" style={{ color: 'var(--apple-text-primary)' }}>{name}</span>
                              <span className="text-[12px] font-medium tabular-nums" style={{ color: 'var(--apple-text-tertiary)' }}>{count}</span>
                            </div>
                            <div className="w-full h-[6px] rounded-full" style={{ background: 'var(--apple-surface-2)' }}>
                              <div className="h-[6px] rounded-full transition-all duration-500" style={{ background: 'var(--apple-orange)', width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                      {topPatterns.length > settings.tablePageSize && (
                        <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid var(--apple-border)' }}>
                          <span className="text-[12px] tabular-nums" style={{ color: 'var(--apple-text-tertiary)' }}>
                            {patternPage * settings.tablePageSize + 1}–{Math.min((patternPage + 1) * settings.tablePageSize, topPatterns.length)} of {topPatterns.length}
                          </span>
                          <div className="flex gap-1.5">
                            <button disabled={patternPage === 0} onClick={() => setPatternPage(p => p - 1)}
                              className="text-[12px] font-medium px-3 py-1.5 rounded-[8px] transition-all duration-150 disabled:opacity-30"
                              style={{ background: 'var(--apple-surface-2)', color: 'var(--apple-text-secondary)' }}>Previous</button>
                            <button disabled={(patternPage + 1) * settings.tablePageSize >= topPatterns.length} onClick={() => setPatternPage(p => p + 1)}
                              className="text-[12px] font-medium px-3 py-1.5 rounded-[8px] transition-all duration-150 disabled:opacity-30"
                              style={{ background: 'var(--apple-surface-2)', color: 'var(--apple-text-secondary)' }}>Next</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Expandable>
              ) : (
                <Expandable title={`Active Incidents${hasFilter ? ' (filtered)' : ''}`} icon={<Activity className="w-[18px] h-[18px]" style={{ color: 'var(--apple-blue)', strokeWidth: 1.8 }} />} count={scopedActive.length}>
                  {(() => {
                    const hasIncFilter = incSevFilter || incStatusFilter;
                    const filtered = scopedActive
                      .filter((i: any) => !incSevFilter || i.analysis.severity === incSevFilter)
                      .filter((i: any) => !incStatusFilter || i.status === incStatusFilter);
                    // Cross-filter: severity pills from status-filtered, status pills from severity-filtered
                    const forSev = scopedActive
                      .filter((i: any) => !incStatusFilter || i.status === incStatusFilter);
                    const forStatus = scopedActive
                      .filter((i: any) => !incSevFilter || i.analysis.severity === incSevFilter);
                    const sevOrder = ['critical', 'high', 'medium', 'low'];
                    const sevs = sevOrder.filter(s => forSev.some((i: any) => i.analysis.severity === s));
                    const statuses = Array.from(new Set(forStatus.map((i: any) => i.status)));
                    const filtered2 = filtered
                      .sort((a: any, b: any) => {
                        const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
                        return (order[a.analysis.severity] ?? 4) - (order[b.analysis.severity] ?? 4);
                      });
                    return (
                      <div className="space-y-4">
                        {/* Filter pills */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {sevs.map(s => {
                            const c = severityStyle[s];
                            const active = incSevFilter === s;
                            return (
                              <button key={s} onClick={() => setIncSevFilter(active ? null : s)}
                                className="text-[11px] font-medium px-2.5 py-1 rounded-full transition-all duration-150"
                                style={{
                                  background: active ? c.pillBg : 'var(--apple-surface-2)',
                                  color: active ? c.color : 'var(--apple-text-tertiary)',
                                  outline: active ? `1.5px solid ${c.color}` : '1.5px solid transparent',
                                  outlineOffset: '-1.5px',
                                }}>{s}</button>
                            );
                          })}
                          <span className="w-px h-4 mx-1" style={{ background: 'var(--apple-surface-3)' }} />
                          {statuses.map(s => {
                            const active = incStatusFilter === s;
                            return (
                              <button key={s} onClick={() => setIncStatusFilter(active ? null : s)}
                                className="text-[11px] font-medium px-2.5 py-1 rounded-full transition-all duration-150"
                                style={{
                                  background: active ? 'rgba(10, 132, 255, 0.15)' : 'var(--apple-surface-2)',
                                  color: active ? 'var(--apple-blue)' : 'var(--apple-text-tertiary)',
                                  outline: active ? '1.5px solid var(--apple-blue)' : '1.5px solid transparent',
                                  outlineOffset: '-1.5px',
                                }}>{s}</button>
                            );
                          })}
                          {hasIncFilter && (
                            <button onClick={() => { setIncSevFilter(null); setIncStatusFilter(null); }}
                              className="text-[11px] font-medium px-2.5 py-1 rounded-full transition-all duration-150 ml-1"
                              style={{ background: 'var(--apple-overlay-dim)', color: 'var(--apple-text-tertiary)' }}>
                              ✕ Clear
                            </button>
                          )}
                        </div>

                        {/* Incident list */}
                        {filtered2.length === 0 ? (
                          <p className="text-[13px] py-4 text-center" style={{ color: 'var(--apple-text-tertiary)' }}>No incidents match the selected filters.</p>
                        ) : (
                          <div className="space-y-2">
                            {filtered2.slice(incPage * settings.tablePageSize, (incPage + 1) * settings.tablePageSize).map((inc: any) => {
                              const sty = severityStyle[inc.analysis.severity];
                              return (
                                <div key={inc.id} className="p-3.5 rounded-[10px] transition-all duration-200" style={{ background: sty.bg }}>
                                  <div className="flex items-center justify-between">
                                    <div className="min-w-0 flex-1">
                                      <span className="text-[14px] font-medium" style={{ color: 'var(--apple-text-primary)' }}>{inc.title}</span>
                                      <div className="flex items-center gap-3 text-[12px] mt-1" style={{ color: 'var(--apple-text-tertiary)' }}>
                                        <span>{inc.service}</span>
                                        <span>{inc.analysis.rootCause.category}</span>
                                        <span className="font-medium" style={{ color: sty.color }}>{inc.analysis.severity}</span>
                                      </div>
                                    </div>
                                    <span className="apple-pill shrink-0 ml-3" style={{ background: 'var(--apple-surface-2)', color: 'var(--apple-text-tertiary)' }}>
                                      {inc.status}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                            {filtered2.length > settings.tablePageSize && (
                              <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid var(--apple-border)' }}>
                                <span className="text-[12px] tabular-nums" style={{ color: 'var(--apple-text-tertiary)' }}>
                                  {incPage * settings.tablePageSize + 1}–{Math.min((incPage + 1) * settings.tablePageSize, filtered2.length)} of {filtered2.length}
                                </span>
                                <div className="flex gap-1.5">
                                  <button disabled={incPage === 0} onClick={() => setIncPage(p => p - 1)}
                                    className="text-[12px] font-medium px-3 py-1.5 rounded-[8px] transition-all duration-150 disabled:opacity-30"
                                    style={{ background: 'var(--apple-surface-2)', color: 'var(--apple-text-secondary)' }}>Previous</button>
                                  <button disabled={(incPage + 1) * settings.tablePageSize >= filtered2.length} onClick={() => setIncPage(p => p + 1)}
                                    className="text-[12px] font-medium px-3 py-1.5 rounded-[8px] transition-all duration-150 disabled:opacity-30"
                                    style={{ background: 'var(--apple-surface-2)', color: 'var(--apple-text-secondary)' }}>Next</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </Expandable>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
