import React, { useEffect, useState, useRef } from 'react';
import { BarChart3, PieChart as PieChartIcon, GitBranch, Server as ServerIcon, Table2, X, ArrowUp, ArrowDown, Timer, ShieldAlert } from 'lucide-react';
import Expandable from '../components/Expandable';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { api } from '../api';
import { useSettings } from '../useSettings';

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'var(--apple-red)',
  high: 'var(--apple-orange)',
  medium: 'var(--apple-yellow)',
  low: 'var(--apple-blue)',
};

const STATUS_COLORS = ['var(--apple-red)', 'var(--apple-yellow)', 'var(--apple-blue)', 'var(--apple-green)'];

export default function Analytics() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [slaMetrics, setSlaMetrics] = useState<any>(null);
  const { settings } = useSettings();

  const tooltipStyle = settings.theme === 'dark'
    ? { background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, color: '#1c1c1e', fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', padding: '8px 14px' }
    : { background: '#ffffff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12, color: '#1c1c1e', fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', padding: '8px 14px' };
  const tableRef = useRef<HTMLDivElement>(null);
  const [tableSevFilter, setTableSevFilter] = useState<string | null>(null);
  const [tableStatusFilter, setTableStatusFilter] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

  const toggleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const applyFilter = (type: string, value: string) => {
    setFilters(prev => {
      const next = { ...prev };
      if (next[type] === value) { delete next[type]; } else { next[type] = value; }
      return next;
    });
    setPage(0);
    setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const hasFilters = Object.keys(filters).length > 0;

  useEffect(() => {
    Promise.all([api.listIncidents(), api.getSLAMetrics()]).then(([data, sla]: any[]) => {
      setIncidents(data.incidents || []);
      setSlaMetrics(sla);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--apple-text-tertiary)' }}>
        <div className="w-5 h-5 border-2 rounded-full animate-spin mr-3" style={{ borderColor: 'var(--apple-surface-3)', borderTopColor: 'var(--apple-blue)' }} />
        Loading analytics...
      </div>
    );
  }

  if (!incidents.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5" style={{ background: 'var(--apple-surface-1)' }}>
          <BarChart3 className="w-8 h-8" style={{ color: 'var(--apple-text-tertiary)', strokeWidth: 1.5 }} />
        </div>
        <p className="text-[20px] font-semibold tracking-tight" style={{ color: 'var(--apple-text-primary)' }}>No analytics data</p>
        <p className="text-[14px] mt-1.5" style={{ color: 'var(--apple-text-tertiary)' }}>Seed incidents from the Incidents page to view analytics.</p>
      </div>
    );
  }

  const filteredIncidents = hasFilters
    ? incidents.filter((inc: any) => {
        if (filters.severity && inc.analysis.severity !== filters.severity) return false;
        if (filters.status && inc.status !== filters.status) return false;
        if (filters.category && inc.analysis.rootCause.category !== filters.category) return false;
        if (filters.service && (inc.service || 'unknown') !== filters.service) return false;
        return true;
      })
    : incidents;

  const severityDist = ['critical', 'high', 'medium', 'low'].map(s => ({
    name: s,
    value: incidents.filter((i: any) => i.analysis.severity === s).length,
  }));

  const statusDist = ['open', 'acknowledged', 'investigating', 'resolved'].map(s => ({
    name: s,
    value: incidents.filter((i: any) => i.status === s).length,
  }));

  const categoryCounts = new Map<string, number>();
  for (const inc of filteredIncidents) {
    const cat = inc.analysis.rootCause.category;
    categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
  }
  const topCategories = Array.from(categoryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  const serviceCounts = new Map<string, number>();
  for (const inc of filteredIncidents) {
    const svc = inc.service || 'unknown';
    serviceCounts.set(svc, (serviceCounts.get(svc) || 0) + 1);
  }
  const byService = Array.from(serviceCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  const resolved = incidents.filter((i: any) => i.timeToResolveMs);
  const avgTTR = resolved.length > 0
    ? Math.round(resolved.reduce((sum: number, i: any) => sum + i.timeToResolveMs, 0) / resolved.length / 60000)
    : 0;

  const avgConfidence = Math.round(
    incidents.reduce((sum: number, i: any) => sum + i.analysis.confidence, 0) / incidents.length * 100
  );

  const pdLinked = incidents.filter((i: any) => i.pagerduty).length;
  const runbookMatched = incidents.filter((i: any) => i.runbook).length;

  const renderLabel = ({ name, value }: any) => value > 0 ? `${name}` : '';

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="apple-title">Analytics</h1>
        <p className="apple-subtitle">Incident trends, severity distribution, and resolution metrics.</p>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Total', value: incidents.length, color: 'var(--apple-text-primary)' },
          { label: 'Confidence', value: `${avgConfidence}%`, color: 'var(--apple-blue)' },
          { label: 'Avg TTR', value: avgTTR > 0 ? `${avgTTR}m` : 'N/A', color: 'var(--apple-green)' },
          { label: 'PagerDuty', value: pdLinked, color: 'var(--apple-purple)' },
          { label: 'Runbooks', value: runbookMatched, color: 'var(--apple-teal)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="apple-card text-center">
            <div className="apple-stat-label">{label}</div>
            <div className="apple-stat-value" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* SLA Metrics row */}
      {slaMetrics && (
        <div className="apple-card">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="w-[18px] h-[18px]" style={{ color: 'var(--apple-purple)', strokeWidth: 1.8 }} />
            <span className="apple-section-title">SLA / SLO Metrics</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: 'Avg Time to Ack', value: slaMetrics.avgTimeToAckMs > 0 ? `${Math.round(slaMetrics.avgTimeToAckMs / 60000)}m` : 'N/A', color: 'var(--apple-yellow)' },
              { label: 'Avg TTR', value: slaMetrics.avgTimeToResolveMs > 0 ? `${Math.round(slaMetrics.avgTimeToResolveMs / 60000)}m` : 'N/A', color: 'var(--apple-green)' },
              { label: 'P50 TTR', value: slaMetrics.p50TimeToResolveMs > 0 ? `${Math.round(slaMetrics.p50TimeToResolveMs / 60000)}m` : 'N/A', color: 'var(--apple-blue)' },
              { label: 'P95 TTR', value: slaMetrics.p95TimeToResolveMs > 0 ? `${Math.round(slaMetrics.p95TimeToResolveMs / 60000)}m` : 'N/A', color: 'var(--apple-orange)' },
              { label: 'SLA Breaches', value: slaMetrics.slaBreaches, color: slaMetrics.slaBreaches > 0 ? 'var(--apple-red)' : 'var(--apple-green)' },
              { label: 'Resolved', value: slaMetrics.totalResolved, color: 'var(--apple-green)' },
              { label: 'Acknowledged', value: slaMetrics.totalAcknowledged, color: 'var(--apple-yellow)' },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <div className="text-[11px] font-medium mb-1" style={{ color: 'var(--apple-text-tertiary)' }}>{label}</div>
                <div className="text-[18px] font-bold tabular-nums" style={{ color }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Severity distribution pie */}
        <Expandable title="Severity Distribution" icon={<PieChartIcon className="w-[18px] h-[18px]" style={{ color: 'var(--apple-orange)', strokeWidth: 1.8 }} />}>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={severityDist} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" strokeWidth={0}
                label={renderLabel} labelLine={false} cursor="pointer"
                onClick={(data: any) => data && applyFilter('severity', data.name)}>
                {severityDist.map((entry) => (
                  <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name]}
                    opacity={filters.severity && filters.severity !== entry.name ? 0.3 : 1}
                    style={{ cursor: 'pointer' }} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </Expandable>

        {/* Status distribution pie */}
        <Expandable title="Status Distribution" icon={<PieChartIcon className="w-[18px] h-[18px]" style={{ color: 'var(--apple-blue)', strokeWidth: 1.8 }} />}>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={statusDist} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" strokeWidth={0}
                label={renderLabel} labelLine={false} cursor="pointer"
                onClick={(data: any) => data && applyFilter('status', data.name)}>
                {statusDist.map((entry, i) => (
                  <Cell key={i} fill={STATUS_COLORS[i]}
                    opacity={filters.status && filters.status !== entry.name ? 0.3 : 1}
                    style={{ cursor: 'pointer' }} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </Expandable>

        {/* Top root cause categories bar chart */}
        <Expandable title="Root Cause Categories" icon={<GitBranch className="w-[18px] h-[18px]" style={{ color: 'var(--apple-orange)', strokeWidth: 1.8 }} />} count={topCategories.length}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={topCategories} layout="vertical" margin={{ left: 10, right: 10 }}>
              <XAxis type="number" tick={{ fill: 'var(--apple-text-tertiary)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fill: 'var(--apple-text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--apple-surface-1)' }} />
              <Bar dataKey="count" fill="var(--apple-orange)" radius={[0, 6, 6, 0]} barSize={16}
                cursor="pointer" onClick={(data: any) => data && applyFilter('category', data.name)} />
            </BarChart>
          </ResponsiveContainer>
        </Expandable>

        {/* Incidents by service bar chart */}
        <Expandable title="By Service" icon={<ServerIcon className="w-[18px] h-[18px]" style={{ color: 'var(--apple-blue)', strokeWidth: 1.8 }} />} count={byService.length}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byService} layout="vertical" margin={{ left: 10, right: 10 }}>
              <XAxis type="number" tick={{ fill: 'var(--apple-text-tertiary)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fill: 'var(--apple-text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--apple-surface-1)' }} />
              <Bar dataKey="count" fill="var(--apple-blue)" radius={[0, 6, 6, 0]} barSize={16}
                cursor="pointer" onClick={(data: any) => data && applyFilter('service', data.name)} />
            </BarChart>
          </ResponsiveContainer>
        </Expandable>
      </div>

      {/* Active filter indicator */}
      {hasFilters && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-[12px] flex-wrap" style={{ background: 'var(--apple-surface-2)' }}>
          <span className="text-[13px] font-medium" style={{ color: 'var(--apple-text-primary)' }}>Filters:</span>
          {Object.entries(filters).map(([type, value]) => (
            <button key={type} onClick={() => applyFilter(type, value)}
              className="text-[11px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1 transition-all duration-150"
              style={{ background: 'rgba(10, 132, 255, 0.15)', color: 'var(--apple-blue)' }}>
              {type}: {value} <X className="w-2.5 h-2.5" />
            </button>
          ))}
          <span className="text-[12px] tabular-nums" style={{ color: 'var(--apple-text-tertiary)' }}>
            ({filteredIncidents.length} incident{filteredIncidents.length !== 1 ? 's' : ''})
          </span>
          <button onClick={() => setFilters({})}
            className="ml-auto flex items-center gap-1 text-[12px] font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--apple-blue)' }}>
            <X className="w-3 h-3" /> Clear all
          </button>
        </div>
      )}

      {/* Detailed table */}
      <div ref={tableRef}>
      <Expandable title={hasFilters ? `Filtered Incidents` : 'All Incidents'} icon={<Table2 className="w-[18px] h-[18px]" style={{ color: 'var(--apple-text-tertiary)', strokeWidth: 1.8 }} />} count={filteredIncidents.length} defaultOpen={hasFilters}>
        {(() => {
          const hasTableFilter = tableSevFilter || tableStatusFilter;
          const totalPages = Math.ceil(filteredIncidents.length / settings.tablePageSize);
          if (page >= totalPages && page > 0) setPage(0);
          // Cross-filter for pills
          const forSev = filteredIncidents.filter((i: any) => !tableStatusFilter || i.status === tableStatusFilter);
          const forStatus = filteredIncidents.filter((i: any) => !tableSevFilter || i.analysis.severity === tableSevFilter);
          const sevOrder = ['critical', 'high', 'medium', 'low'];
          const sevs = sevOrder.filter(s => forSev.some((i: any) => i.analysis.severity === s));
          const statuses = Array.from(new Set(forStatus.map((i: any) => i.status)));

          let tableData = filteredIncidents
            .filter((i: any) => !tableSevFilter || i.analysis.severity === tableSevFilter)
            .filter((i: any) => !tableStatusFilter || i.status === tableStatusFilter);

          if (sortCol) {
            tableData = [...tableData].sort((a: any, b: any) => {
              let va: any, vb: any;
              switch (sortCol) {
                case 'title': va = a.title.toLowerCase(); vb = b.title.toLowerCase(); break;
                case 'service': va = (a.service || '').toLowerCase(); vb = (b.service || '').toLowerCase(); break;
                case 'severity': { const o: Record<string,number> = {critical:0,high:1,medium:2,low:3}; va = o[a.analysis.severity] ?? 4; vb = o[b.analysis.severity] ?? 4; break; }
                case 'status': va = a.status; vb = b.status; break;
                case 'confidence': va = a.analysis.confidence; vb = b.analysis.confidence; break;
                case 'pd': va = a.pagerduty ? 0 : 1; vb = b.pagerduty ? 0 : 1; break;
                case 'runbook': va = a.runbook ? 0 : 1; vb = b.runbook ? 0 : 1; break;
                default: return 0;
              }
              if (va < vb) return sortDir === 'asc' ? -1 : 1;
              if (va > vb) return sortDir === 'asc' ? 1 : -1;
              return 0;
            });
          }

          const SortIcon = ({ col }: { col: string }) => {
            if (sortCol !== col) return <ArrowDown className="w-3 h-3 opacity-0 group-hover:opacity-30 transition-opacity" />;
            return sortDir === 'asc'
              ? <ArrowUp className="w-3 h-3" style={{ color: 'var(--apple-blue)' }} />
              : <ArrowDown className="w-3 h-3" style={{ color: 'var(--apple-blue)' }} />;
          };

          return (
            <div className="space-y-4">
              {/* Filter pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {sevs.map(s => {
                  const c = SEVERITY_COLORS[s];
                  const active = tableSevFilter === s;
                  return (
                    <button key={s} onClick={() => setTableSevFilter(active ? null : s)}
                      className="text-[11px] font-medium px-2.5 py-1 rounded-full transition-all duration-150"
                      style={{
                        background: active ? c + '26' : 'var(--apple-surface-2)',
                        color: active ? c : 'var(--apple-text-tertiary)',
                        outline: active ? `1.5px solid ${c}` : '1.5px solid transparent',
                        outlineOffset: '-1.5px',
                      }}>{s}</button>
                  );
                })}
                <span className="w-px h-4 mx-1" style={{ background: 'var(--apple-surface-3)' }} />
                {statuses.map(s => {
                  const active = tableStatusFilter === s;
                  return (
                    <button key={s} onClick={() => setTableStatusFilter(active ? null : s)}
                      className="text-[11px] font-medium px-2.5 py-1 rounded-full transition-all duration-150"
                      style={{
                        background: active ? 'rgba(10, 132, 255, 0.15)' : 'var(--apple-surface-2)',
                        color: active ? 'var(--apple-blue)' : 'var(--apple-text-tertiary)',
                        outline: active ? '1.5px solid var(--apple-blue)' : '1.5px solid transparent',
                        outlineOffset: '-1.5px',
                      }}>{s}</button>
                  );
                })}
                {hasTableFilter && (
                  <button onClick={() => { setTableSevFilter(null); setTableStatusFilter(null); }}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-full transition-all duration-150 ml-1"
                    style={{ background: 'var(--apple-overlay-dim)', color: 'var(--apple-text-tertiary)' }}>
                    ✕ Clear
                  </button>
                )}
                <span className="ml-auto text-[11px] tabular-nums" style={{ color: 'var(--apple-text-tertiary)' }}>
                  {tableData.length} of {filteredIncidents.length}
                </span>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr style={{ color: 'var(--apple-text-tertiary)' }}>
                      {[
                        { key: 'title', label: 'Title' },
                        { key: 'service', label: 'Service' },
                        { key: 'severity', label: 'Severity' },
                        { key: 'status', label: 'Status' },
                        { key: 'confidence', label: 'Confidence' },
                        { key: 'pd', label: 'PD' },
                        { key: 'runbook', label: 'Runbook' },
                      ].map(({ key, label }, i, arr) => (
                        <th key={key}
                          className={`text-left pb-3 ${i < arr.length - 1 ? 'pr-4' : ''} font-medium cursor-pointer select-none group`}
                          onClick={() => toggleSort(key)}>
                          <div className="flex items-center gap-1">
                            {label}
                            <SortIcon col={key} />
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.slice(page * settings.tablePageSize, (page + 1) * settings.tablePageSize).map((inc: any, idx: number) => (
                      <tr key={inc.id} className="transition-colors duration-150"
                        style={{ borderTop: idx > 0 ? '1px solid var(--apple-border)' : 'none' }}>
                        <td className="py-3 pr-4 truncate max-w-[220px] font-medium" style={{ color: 'var(--apple-text-primary)' }}>{inc.title}</td>
                        <td className="py-3 pr-4" style={{ color: 'var(--apple-text-secondary)' }}>{inc.service || '–'}</td>
                        <td className="py-3 pr-4">
                          <span className="apple-pill" style={{ background: SEVERITY_COLORS[inc.analysis.severity] + '1A', color: SEVERITY_COLORS[inc.analysis.severity] }}>
                            {inc.analysis.severity}
                          </span>
                        </td>
                        <td className="py-3 pr-4" style={{ color: 'var(--apple-text-secondary)' }}>{inc.status}</td>
                        <td className="py-3 pr-4 tabular-nums font-medium" style={{ color: 'var(--apple-blue)' }}>{Math.round(inc.analysis.confidence * 100)}%</td>
                        <td className="py-3 pr-4" style={{ color: inc.pagerduty ? 'var(--apple-green)' : 'var(--apple-text-tertiary)' }}>
                          {inc.pagerduty ? inc.pagerduty.status : '–'}
                        </td>
                        <td className="py-3" style={{ color: inc.runbook ? 'var(--apple-blue)' : 'var(--apple-text-tertiary)' }}>
                          {inc.runbook ? 'Yes' : '–'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {tableData.length > settings.tablePageSize && (
                <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--apple-border)' }}>
                  <span className="text-[12px] tabular-nums" style={{ color: 'var(--apple-text-tertiary)' }}>
                    {page * settings.tablePageSize + 1}–{Math.min((page + 1) * settings.tablePageSize, tableData.length)} of {tableData.length}
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      disabled={page === 0}
                      onClick={() => setPage(p => p - 1)}
                      className="text-[12px] font-medium px-3 py-1.5 rounded-[8px] transition-all duration-150 disabled:opacity-30"
                      style={{ background: 'var(--apple-surface-2)', color: 'var(--apple-text-secondary)' }}>
                      Previous
                    </button>
                    <button
                      disabled={(page + 1) * settings.tablePageSize >= tableData.length}
                      onClick={() => setPage(p => p + 1)}
                      className="text-[12px] font-medium px-3 py-1.5 rounded-[8px] transition-all duration-150 disabled:opacity-30"
                      style={{ background: 'var(--apple-surface-2)', color: 'var(--apple-text-secondary)' }}>
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </Expandable>
      </div>
    </div>
  );
}
