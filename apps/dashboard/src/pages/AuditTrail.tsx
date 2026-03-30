import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Filter, RefreshCw, Search, User, Shield, Users, Key } from 'lucide-react';
import { api } from '../api';
import type { AuditLogEntry } from '../types';

const CATEGORIES = [
  { value: '', label: 'All', icon: ClipboardList, color: 'var(--apple-text-secondary)' },
  { value: 'integration', label: 'Integrations', icon: Shield, color: 'var(--apple-purple)' },
  { value: 'user', label: 'Users', icon: User, color: 'var(--apple-green)' },
  { value: 'team', label: 'Teams', icon: Users, color: 'var(--apple-teal)' },
  { value: 'auth', label: 'Auth', icon: Key, color: 'var(--apple-orange)' },
];

const ACTION_LABELS: Record<string, string> = {
  integration_updated: 'Integration Updated',
  user_created: 'User Created',
  password_reset: 'Password Reset',
  team_created: 'Team Created',
  team_deleted: 'Team Deleted',
  member_added: 'Member Added',
  member_removed: 'Member Removed',
};

const CAT_COLORS: Record<string, string> = {
  integration: 'var(--apple-purple)',
  user: 'var(--apple-green)',
  team: 'var(--apple-teal)',
  auth: 'var(--apple-orange)',
};

export default function AuditTrail() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const fetchEntries = useCallback(async (cat?: string) => {
    setLoading(true);
    setPage(1); // Reset to first page on category change
    try {
      const data = await api.getAuditLog(200, cat || undefined);
      if (data?.entries) setEntries(data.entries);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchEntries(category); }, [category, fetchEntries]);

  // Reset to first page when search changes
  useEffect(() => { setPage(1); }, [search]);

  const filtered = search.trim()
    ? entries.filter(e =>
        (e.details || '').toLowerCase().includes(search.toLowerCase()) ||
        (e.username || '').toLowerCase().includes(search.toLowerCase()) ||
        (e.action || '').toLowerCase().includes(search.toLowerCase())
      )
    : entries;

  // Pagination
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginatedEntries = filtered.slice((page - 1) * pageSize, page * pageSize);
  const startEntry = (page - 1) * pageSize + 1;
  const endEntry = Math.min(page * pageSize, filtered.length);

  const grouped = paginatedEntries.reduce<Record<string, AuditLogEntry[]>>((acc, e) => {
    const day = new Date(e.createdAt).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    (acc[day] = acc[day] || []).push(e);
    return acc;
  }, {});

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="apple-title">Audit Trail</h1>
        <p className="apple-subtitle">Track all administrative actions — who did what, and when.</p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Category pills */}
        {CATEGORIES.map(cat => {
          const active = category === cat.value;
          const Icon = cat.icon;
          return (
            <button key={cat.value} onClick={() => setCategory(cat.value)}
              className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-full transition-all duration-150"
              style={{
                background: active ? `color-mix(in srgb, ${cat.color} 15%, transparent)` : 'var(--apple-surface-2)',
                color: active ? cat.color : 'var(--apple-text-tertiary)',
                outline: active ? `1.5px solid ${cat.color}` : '1.5px solid transparent',
                outlineOffset: '-1.5px',
              }}>
              <Icon className="w-3.5 h-3.5" /> {cat.label}
            </button>
          );
        })}

        <div className="flex-1" />

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--apple-text-tertiary)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search entries..."
            className="apple-input text-[12px] pl-8 pr-3 py-1.5 w-[200px]" />
        </div>

        {/* Refresh */}
        <button onClick={() => fetchEntries(category)}
          className="p-2 rounded-[8px] transition-all hover:opacity-70"
          style={{ background: 'var(--apple-surface-2)', color: 'var(--apple-text-tertiary)' }} title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4">
        <span className="text-[12px] tabular-nums" style={{ color: 'var(--apple-text-tertiary)' }}>
          {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
          {filtered.length > 0 && (
            <span className="ml-1">(showing {startEntry}-{endEntry})</span>
          )}
        </span>
        {search && (
          <button onClick={() => setSearch('')} className="text-[11px] font-medium transition-all hover:opacity-70" style={{ color: 'var(--apple-blue)' }}>
            Clear search
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--apple-surface-3)', borderTopColor: 'var(--apple-blue)' }} />
        </div>
      ) : paginatedEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--apple-surface-1)' }}>
            <ClipboardList className="w-7 h-7" style={{ color: 'var(--apple-text-tertiary)', strokeWidth: 1.5 }} />
          </div>
          <p className="text-[17px] font-semibold tracking-tight" style={{ color: 'var(--apple-text-primary)' }}>
            {search ? 'No matching entries' : 'No audit entries yet'}
          </p>
          <p className="text-[13px] mt-1" style={{ color: 'var(--apple-text-tertiary)' }}>
            {search ? 'Try a different search term' : 'Actions like integration changes, user creation, and team updates will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([day, dayEntries]) => (
            <div key={day}>
              <h3 className="text-[12px] font-semibold uppercase tracking-wider mb-3 px-1" style={{ color: 'var(--apple-text-tertiary)' }}>{day}</h3>
              <div className="space-y-1">
                {dayEntries.map((e: AuditLogEntry) => {
                  const color = CAT_COLORS[e.category] || 'var(--apple-text-tertiary)';
                  return (
                    <div key={e.id} className="flex items-start gap-4 px-4 py-3 rounded-[12px] transition-all"
                      style={{ background: 'var(--apple-surface-1)' }}>
                      {/* Timeline dot */}
                      <div className="flex flex-col items-center pt-1">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-semibold" style={{ color: 'var(--apple-text-primary)' }}>
                            {e.details || e.action}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-[4px] font-semibold uppercase tracking-wide"
                            style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
                            {e.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[12px] font-medium" style={{ color: 'var(--apple-text-secondary)' }}>
                            @{e.username}
                          </span>
                          <span className="text-[11px]" style={{ color: 'var(--apple-text-tertiary)' }}>·</span>
                          <span className="text-[11px]" style={{ color: 'var(--apple-text-tertiary)' }}>
                            {ACTION_LABELS[e.action] || e.action}
                          </span>
                        </div>
                      </div>

                      {/* Timestamp */}
                      <span className="text-[11px] tabular-nums shrink-0 pt-0.5" style={{ color: 'var(--apple-text-tertiary)' }}>
                        {new Date(e.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Pagination */}
          {filtered.length > pageSize && (
            <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid var(--apple-border)' }}>
              <span className="text-[12px] tabular-nums" style={{ color: 'var(--apple-text-tertiary)' }}>
                {startEntry}–{endEntry} of {filtered.length}
              </span>
              <div className="flex gap-1.5">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="text-[12px] font-medium px-3 py-1.5 rounded-[8px] transition-all duration-150 disabled:opacity-30"
                  style={{ background: 'var(--apple-surface-2)', color: 'var(--apple-text-secondary)' }}>Previous</button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="text-[12px] font-medium px-3 py-1.5 rounded-[8px] transition-all duration-150 disabled:opacity-30"
                  style={{ background: 'var(--apple-surface-2)', color: 'var(--apple-text-secondary)' }}>Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
