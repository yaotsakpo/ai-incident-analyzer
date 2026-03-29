import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, AlertTriangle, Activity, BarChart3, BookOpen, ArrowRight, Command } from 'lucide-react';
import { api } from '../api';

interface CommandItem {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  action: () => void;
  group: string;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [incidents, setIncidents] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      inputRef.current?.focus();
      api.listIncidents().then((data: any) => setIncidents(data.incidents || []));
    }
  }, [open]);

  const go = useCallback((path: string) => {
    navigate(path);
    setOpen(false);
  }, [navigate]);

  const pages: CommandItem[] = [
    { id: 'nav-incidents', label: 'Incidents', sublabel: 'View all incidents', icon: <AlertTriangle className="w-4 h-4" style={{ strokeWidth: 1.8 }} />, action: () => go('/'), group: 'Navigate' },
    { id: 'nav-anomalies', label: 'Anomalies', sublabel: 'Service health overview', icon: <Activity className="w-4 h-4" style={{ strokeWidth: 1.8 }} />, action: () => go('/anomalies'), group: 'Navigate' },
    { id: 'nav-analytics', label: 'Analytics', sublabel: 'Charts and metrics', icon: <BarChart3 className="w-4 h-4" style={{ strokeWidth: 1.8 }} />, action: () => go('/analytics'), group: 'Navigate' },
    { id: 'nav-runbooks', label: 'Runbooks', sublabel: 'Remediation procedures', icon: <BookOpen className="w-4 h-4" style={{ strokeWidth: 1.8 }} />, action: () => go('/runbooks'), group: 'Navigate' },
  ];

  const incidentItems: CommandItem[] = incidents
    .filter((inc: any) => inc.status !== 'resolved')
    .slice(0, 8)
    .map((inc: any) => ({
      id: `inc-${inc.id}`,
      label: inc.title,
      sublabel: `${inc.analysis.severity} · ${inc.service || 'unknown'} · ${inc.status}`,
      icon: <ArrowRight className="w-4 h-4" style={{ strokeWidth: 1.8 }} />,
      action: () => go(`/incidents/${inc.id}`),
      group: 'Open Incidents',
    }));

  const allItems = [...pages, ...incidentItems];

  const filtered = query.trim()
    ? allItems.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        (item.sublabel || '').toLowerCase().includes(query.toLowerCase())
      )
    : allItems;

  useEffect(() => {
    setSelected(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filtered[selected]) {
      filtered[selected].action();
    }
  };

  if (!open) return null;

  let lastGroup = '';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={() => setOpen(false)}>
      <div className="fixed inset-0" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} />
      <div
        className="relative w-full max-w-lg rounded-[16px] overflow-hidden"
        style={{ background: 'var(--apple-glass-bg)', backdropFilter: 'blur(40px)', boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--apple-border)' }}>
          <Search className="w-4 h-4 shrink-0" style={{ color: 'var(--apple-text-tertiary)' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search incidents, pages..."
            className="flex-1 bg-transparent text-[15px] outline-none"
            style={{ color: 'var(--apple-text-primary)' }}
          />
          <kbd className="px-1.5 py-0.5 rounded-[5px] text-[11px] font-medium"
            style={{ background: 'var(--apple-surface-2)', color: 'var(--apple-text-tertiary)' }}>
            ESC
          </kbd>
        </div>

        <div className="max-h-[320px] overflow-auto py-2">
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-[13px]" style={{ color: 'var(--apple-text-tertiary)' }}>
              No results for "{query}"
            </div>
          )}
          {filtered.map((item, i) => {
            const showGroup = item.group !== lastGroup;
            lastGroup = item.group;
            return (
              <React.Fragment key={item.id}>
                {showGroup && (
                  <div className="px-4 pt-3 pb-1 text-[11px] font-medium uppercase tracking-wider"
                    style={{ color: 'var(--apple-text-tertiary)' }}>
                    {item.group}
                  </div>
                )}
                <button
                  className="w-full flex items-center gap-3 px-4 py-2 text-left transition-colors duration-100"
                  style={{
                    background: i === selected ? 'var(--apple-surface-2)' : 'transparent',
                    color: 'var(--apple-text-primary)',
                  }}
                  onClick={item.action}
                  onMouseEnter={() => setSelected(i)}
                >
                  <div className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0"
                    style={{ background: 'var(--apple-overlay-dim)' }}>
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate">{item.label}</div>
                    {item.sublabel && (
                      <div className="text-[11px] truncate" style={{ color: 'var(--apple-text-tertiary)' }}>{item.sublabel}</div>
                    )}
                  </div>
                </button>
              </React.Fragment>
            );
          })}
        </div>

        <div className="px-4 py-2 flex items-center gap-4 text-[11px]"
          style={{ borderTop: '1px solid var(--apple-border)', color: 'var(--apple-text-tertiary)' }}>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded-[4px]" style={{ background: 'var(--apple-surface-2)' }}>↑↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded-[4px]" style={{ background: 'var(--apple-surface-2)' }}>↵</kbd> open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded-[4px]" style={{ background: 'var(--apple-surface-2)' }}>esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}

export function CommandHint() {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] cursor-pointer transition-all duration-200 hover:opacity-80"
      style={{ background: 'var(--apple-surface-1)', color: 'var(--apple-text-tertiary)' }}
      onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}>
      <Command className="w-3 h-3" style={{ strokeWidth: 2 }} />
      <span className="text-[11px] font-medium">K</span>
    </div>
  );
}
