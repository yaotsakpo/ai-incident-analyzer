import React from 'react';
import { AlertTriangle, Clock, CheckCircle, Search, Database, Shield, Wifi, HardDrive, Zap, Bug, ChevronRight, BookOpen, Bell, Check, CheckSquare, Square } from 'lucide-react';
import type { Incident, IncidentStatus } from '@incident-analyzer/shared';

const severityStyle: Record<string, { bg: string; color: string }> = {
  critical: { bg: 'rgba(255, 69, 58, 0.12)', color: 'var(--apple-red)' },
  high: { bg: 'rgba(255, 159, 10, 0.12)', color: 'var(--apple-orange)' },
  medium: { bg: 'rgba(255, 214, 10, 0.12)', color: 'var(--apple-yellow)' },
  low: { bg: 'rgba(10, 132, 255, 0.12)', color: 'var(--apple-blue)' },
};

const statusStyle: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  open: { icon: <AlertTriangle className="w-[14px] h-[14px]" style={{ strokeWidth: 1.8 }} />, color: 'var(--apple-red)', bg: 'rgba(255, 69, 58, 0.12)' },
  acknowledged: { icon: <Clock className="w-[14px] h-[14px]" style={{ strokeWidth: 1.8 }} />, color: 'var(--apple-yellow)', bg: 'rgba(255, 214, 10, 0.12)' },
  investigating: { icon: <Search className="w-[14px] h-[14px]" style={{ strokeWidth: 1.8 }} />, color: 'var(--apple-blue)', bg: 'rgba(10, 132, 255, 0.12)' },
  resolved: { icon: <CheckCircle className="w-[14px] h-[14px]" style={{ strokeWidth: 1.8 }} />, color: 'var(--apple-green)', bg: 'rgba(48, 209, 88, 0.12)' },
};

const categoryIcon: Record<string, React.ReactNode> = {
  'Database Connectivity': <Database className="w-3.5 h-3.5" style={{ strokeWidth: 1.6 }} />,
  'Memory Exhaustion': <Zap className="w-3.5 h-3.5" style={{ strokeWidth: 1.6 }} />,
  'Network/Timeout': <Wifi className="w-3.5 h-3.5" style={{ strokeWidth: 1.6 }} />,
  'Authentication/Authorization': <Shield className="w-3.5 h-3.5" style={{ strokeWidth: 1.6 }} />,
  'Storage/Disk': <HardDrive className="w-3.5 h-3.5" style={{ strokeWidth: 1.6 }} />,
  'Rate Limiting': <AlertTriangle className="w-3.5 h-3.5" style={{ strokeWidth: 1.6 }} />,
};

interface IncidentRowProps {
  inc: Incident;
  isFocused: boolean;
  isSelected: boolean;
  timeAgo: string;
  canAck: boolean;
  canResolve: boolean;
  onNavigate: (id: string) => void;
  onToggleSelect: (e: React.MouseEvent, id: string) => void;
  onQuickAction: (e: React.MouseEvent, id: string, status: IncidentStatus, label: string) => void;
}

export default function IncidentRow({ inc, isFocused, isSelected, timeAgo, canAck, canResolve, onNavigate, onToggleSelect, onQuickAction }: IncidentRowProps) {
  const sev = severityStyle[inc.analysis?.severity] || severityStyle['medium'];
  const stat = statusStyle[inc.status];

  return (
    <div onClick={() => onNavigate(inc.id)}
      className="apple-card apple-card-hover cursor-pointer group transition-all duration-150"
      style={isFocused ? { boxShadow: '0 0 0 1px var(--apple-blue)', background: 'var(--apple-surface-2)' } : {}}>
      <div className="flex items-center gap-4">
        <button onClick={(e) => onToggleSelect(e, inc.id)}
          className="shrink-0 transition-all duration-150" style={{ color: isSelected ? 'var(--apple-blue)' : 'var(--apple-text-tertiary)' }}>
          {isSelected
            ? <CheckSquare className="w-[18px] h-[18px]" style={{ strokeWidth: 1.8 }} />
            : <Square className="w-[18px] h-[18px] opacity-0 group-hover:opacity-100 transition-opacity" style={{ strokeWidth: 1.8 }} />
          }
        </button>
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ background: stat.bg }}>
          <div style={{ color: stat.color }}>{stat.icon}</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-1">
            <h3 className="text-[15px] font-medium truncate" style={{ color: 'var(--apple-text-primary)' }}>{inc.title}</h3>
            <span className="apple-pill shrink-0" style={{ background: sev.bg, color: sev.color }}>
              {inc.analysis?.severity || 'unknown'}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[12px]" style={{ color: 'var(--apple-text-tertiary)' }}>
            <span className="flex items-center gap-1" style={{ color: 'var(--apple-text-secondary)' }}>
              {categoryIcon[inc.analysis?.rootCause?.category] || <Bug className="w-3 h-3" />}
              {inc.analysis?.rootCause?.category || 'Unknown'}
            </span>
            {inc.service && (
              <span className="px-2 py-0.5 rounded-full" style={{ background: 'var(--apple-surface-2)', color: 'var(--apple-text-secondary)' }}>
                {inc.service}
              </span>
            )}
            <span>{timeAgo}</span>
            {inc.pagerduty && (
              <span className="flex items-center gap-1" style={{ color: 'var(--apple-green)' }}>
                <Bell className="w-3 h-3" /> PD
              </span>
            )}
            {inc.runbook && (
              <span className="flex items-center gap-1" style={{ color: 'var(--apple-blue)' }}>
                <BookOpen className="w-3 h-3" /> Runbook
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0 mr-1">
          <div className="text-[13px] font-medium tabular-nums" style={{ color: 'var(--apple-text-secondary)' }}>
            {Math.round((inc.analysis?.confidence || 0) * 100)}%
          </div>
          <div className="text-[11px]" style={{ color: 'var(--apple-text-tertiary)' }}>{inc.analysis?.analyzedLogs || 0} logs</div>
        </div>
        {inc.status !== 'resolved' && (canAck || canResolve) && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {inc.status === 'open' && canAck && (
              <button onClick={(e) => onQuickAction(e, inc.id, 'acknowledged', 'Acknowledged')}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110"
                style={{ background: 'rgba(255, 214, 10, 0.15)' }} title="Acknowledge (a)">
                <Clock className="w-3.5 h-3.5" style={{ color: 'var(--apple-yellow)', strokeWidth: 2 }} />
              </button>
            )}
            {canResolve && <button onClick={(e) => onQuickAction(e, inc.id, 'resolved', 'Resolved')}
              className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110"
              style={{ background: 'rgba(48, 209, 88, 0.15)' }} title="Resolve (r)">
              <Check className="w-3.5 h-3.5" style={{ color: 'var(--apple-green)', strokeWidth: 2.5 }} />
            </button>}
          </div>
        )}
        <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--apple-text-tertiary)', strokeWidth: 1.8 }} />
      </div>
    </div>
  );
}

export { severityStyle, statusStyle, categoryIcon };
