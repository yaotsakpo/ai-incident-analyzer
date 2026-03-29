import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, CheckCircle, Copy, ExternalLink, BookOpen, Terminal, Shield, Check, Share, Clock, Bell, Search as SearchIcon, MessageSquare, Send, User, Users, History, FileText } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { useAuth } from '../useAuth';
import { formatTimeAgo } from '../hooks/useTimeAgo';
import Expandable from '../components/Expandable';
import { useSSE } from '../useSSE';

const severityStyle: Record<string, { bg: string; color: string }> = {
  critical: { bg: 'rgba(255, 69, 58, 0.12)', color: 'var(--apple-red)' },
  high: { bg: 'rgba(255, 159, 10, 0.12)', color: 'var(--apple-orange)' },
  medium: { bg: 'rgba(255, 214, 10, 0.12)', color: 'var(--apple-yellow)' },
  low: { bg: 'rgba(10, 132, 255, 0.12)', color: 'var(--apple-blue)' },
};

const timelineBg: Record<string, string> = {
  'var(--apple-red)': 'rgba(255, 69, 58, 0.15)',
  'var(--apple-blue)': 'rgba(10, 132, 255, 0.15)',
  'var(--apple-green)': 'rgba(48, 209, 88, 0.15)',
  'var(--apple-yellow)': 'rgba(255, 214, 10, 0.15)',
  'var(--apple-purple)': 'rgba(191, 90, 242, 0.15)',
};

const statusStyle: Record<string, { color: string; bg: string; label: string }> = {
  open: { color: 'var(--apple-red)', bg: 'rgba(255, 69, 58, 0.15)', label: 'Open' },
  acknowledged: { color: 'var(--apple-yellow)', bg: 'rgba(255, 214, 10, 0.15)', label: 'Acknowledged' },
  investigating: { color: 'var(--apple-blue)', bg: 'rgba(10, 132, 255, 0.15)', label: 'Investigating' },
  resolved: { color: 'var(--apple-green)', bg: 'rgba(48, 209, 88, 0.15)', label: 'Resolved' },
};

export default function IncidentDetail() {
  const { id } = useParams<{ id: string }>();
  const [incident, setIncident] = useState<any>(null);
  const [runbook, setRunbook] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentAuthor] = useState(() => localStorage.getItem('comment-author') || 'On-Call Engineer');
  const [submittingComment, setSubmittingComment] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { isRole, hasPerm } = useAuth();
  const canWrite = hasPerm('incidents:acknowledge');
  const canAssign = hasPerm('incidents:assign');
  const canEscalate = hasPerm('incidents:escalate');

  // Team assignment
  const [teams, setTeams] = useState<any[]>([]);
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);
  const [assigningTeam, setAssigningTeam] = useState(false);
  const teamRef = useRef<HTMLDivElement>(null);

  // @mention autocomplete
  const [mentionUsers, setMentionUsers] = useState<any[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);
  const [mentionStart, setMentionStart] = useState(0);

  useEffect(() => {
    api.listUsers().then((u: any) => { if (Array.isArray(u)) setMentionUsers(u); }).catch(() => {});
    api.listTeams().then((data: any) => { if (Array.isArray(data)) setTeams(data); else if (data?.teams) setTeams(data.teams); }).catch(() => {});
  }, []);

  // Close team dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (teamRef.current && !teamRef.current.contains(e.target as Node)) setTeamDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleAssignTeam = async (teamId: string | null) => {
    if (!id) return;
    setAssigningTeam(true);
    try {
      const updated = await api.assignTeam(id, teamId);
      setIncident(updated);
      toast(teamId ? 'Team assigned' : 'Team unassigned', 'success');
    } catch { toast('Failed to assign team', 'error'); }
    setAssigningTeam(false);
    setTeamDropdownOpen(false);
  };

  const mentionFiltered = mentionQuery !== null
    ? mentionUsers.filter(u => u.displayName.toLowerCase().includes(mentionQuery.toLowerCase()) || u.username.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6)
    : [];

  const handleCommentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const cursor = e.target.selectionStart || 0;
    setCommentText(val);

    // Detect @mention: find the last '@' before cursor that isn't preceded by a word char
    const before = val.slice(0, cursor);
    const match = before.match(/(^|\s)@(\w*)$/);
    if (match) {
      setMentionQuery(match[2]);
      setMentionStart(before.lastIndexOf('@'));
      setMentionIdx(0);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (user: any) => {
    const before = commentText.slice(0, mentionStart);
    const after = commentText.slice((commentInputRef.current?.selectionStart || mentionStart) );
    // Find end of current mention query
    const afterAt = commentText.slice(mentionStart + 1);
    const queryEnd = afterAt.search(/\s|$/);
    const afterMention = commentText.slice(mentionStart + 1 + queryEnd);
    const inserted = `${before}@${user.username} ${afterMention}`;
    setCommentText(inserted);
    setMentionQuery(null);
    // Focus back
    setTimeout(() => {
      const pos = before.length + 1 + user.username.length + 1;
      commentInputRef.current?.focus();
      commentInputRef.current?.setSelectionRange(pos, pos);
    }, 0);
  };

  const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionQuery !== null && mentionFiltered.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(i => Math.min(i + 1, mentionFiltered.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(mentionFiltered[mentionIdx]); return; }
      if (e.key === 'Escape') { e.preventDefault(); setMentionQuery(null); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey && mentionQuery === null) { e.preventDefault(); submitComment(); }
  };

  const load = () => {
    if (!id) return;
    api.getIncident(id).then((data: any) => {
      setIncident(data);
      setComments(data.comments || []);
      if (data.runbook?.runbookId) {
        api.getRunbook(data.runbook.runbookId).then((rb: any) => setRunbook(rb));
      }
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, [id]);

  // SSE: live-update comments and incident status
  useSSE((event) => {
    if (event.type === 'incident:commented' && event.data?.incidentId === id) {
      setComments(prev => [...prev, event.data.comment]);
    }
    if (event.type === 'incident:updated' && event.data?.id === id) {
      setIncident(event.data);
    }
  });

  const submitComment = async () => {
    if (!commentText.trim() || !id) return;
    setSubmittingComment(true);
    try {
      await api.addComment(id, commentAuthor, commentText.trim());
      setCommentText('');
      // SSE will push the new comment, but also reload to be safe
      const data = await api.getIncident(id);
      setComments(data.comments || []);
    } catch { toast('Failed to add comment', 'error'); }
    setSubmittingComment(false);
  };

  const copyId = () => {
    navigator.clipboard.writeText(id || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const updateStatus = async (status: string) => {
    setUpdating(true);
    await api.updateIncidentStatus(id!, status);
    toast(`Incident ${status}`, 'success');
    load();
    setUpdating(false);
  };

  const escalate = async () => {
    setUpdating(true);
    await api.escalateIncident(id!);
    toast('Escalated to PagerDuty', 'info');
    load();
    setUpdating(false);
  };

  const completeStep = async (stepOrder: number) => {
    await api.completeRunbookStep(id!, stepOrder);
    toast('Step completed', 'success');
    load();
  };

  const exportPDF = () => {
    if (!incident) return;
    const a = incident.analysis;
    const html = `<!DOCTYPE html><html><head><title>Incident Report - ${incident.id}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#1c1c1e}
h1{font-size:22px;margin-bottom:4px}h2{font-size:16px;margin-top:28px;border-bottom:1px solid #e5e5ea;padding-bottom:6px}
.meta{color:#8e8e93;font-size:13px}.badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:12px;font-weight:600}
.sev-critical{background:#ffe5e3;color:#ff3b30}.sev-high{background:#fff3e0;color:#ff9f0a}.sev-medium{background:#fffde0;color:#c7a700}.sev-low{background:#e0f0ff;color:#0a84ff}
table{width:100%;border-collapse:collapse;margin-top:8px}th,td{text-align:left;padding:6px 10px;border-bottom:1px solid #e5e5ea;font-size:13px}th{font-weight:600;color:#8e8e93}
ul{padding-left:20px}li{margin-bottom:4px;font-size:13px}.footer{margin-top:40px;font-size:11px;color:#aeaeb2;text-align:center}</style></head><body>
<h1>${incident.title}</h1>
<p class="meta">ID: ${incident.id} &bull; Created: ${new Date(incident.createdAt).toLocaleString()} &bull; Status: ${incident.status}</p>
<p><span class="badge sev-${a.severity}">${a.severity.toUpperCase()}</span> &nbsp; Confidence: ${Math.round(a.confidence * 100)}%</p>
<h2>Summary</h2><p style="font-size:14px">${a.summary}</p>
<h2>Root Cause</h2>
<table><tr><th>Category</th><td>${a.rootCause.category}</td></tr><tr><th>Description</th><td>${a.rootCause.description}</td></tr></table>
<p style="font-size:13px;margin-top:8px"><strong>Evidence:</strong></p><ul>${a.rootCause.evidence.map((e: string) => `<li>${e}</li>`).join('')}</ul>
<h2>Recommendations</h2><ul>${a.recommendations.map((r: string) => `<li>${r}</li>`).join('')}</ul>
${incident.comments?.length ? `<h2>Activity (${incident.comments.length})</h2>${incident.comments.map((c: any) => `<p><strong>${c.author}</strong> <span class="meta">${new Date(c.createdAt).toLocaleString()}</span><br/>${c.text}</p>`).join('')}` : ''}
${incident.auditLog?.length ? `<h2>Audit Trail</h2><table><tr><th>User</th><th>Action</th><th>Details</th><th>Time</th></tr>${incident.auditLog.map((e: any) => `<tr><td>${e.username}</td><td>${e.action}</td><td>${e.fromValue ? e.fromValue + ' → ' + e.toValue : e.details || ''}</td><td>${new Date(e.timestamp).toLocaleString()}</td></tr>`).join('')}</table>` : ''}
<div class="footer">Generated ${new Date().toLocaleString()} &bull; AI Incident Analyzer</div></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (w) setTimeout(() => { w.print(); URL.revokeObjectURL(url); }, 500);
  };

  const copySummary = () => {
    if (!incident) return;
    const a = incident.analysis;
    const text = [
      `🚨 ${incident.title}`,
      `Status: ${incident.status} | Severity: ${a.severity}`,
      `Service: ${incident.service || 'unknown'}`,
      `Root Cause: ${a.rootCause.category} — ${a.rootCause.description}`,
      `Confidence: ${Math.round(a.confidence * 100)}% | Logs: ${a.analyzedLogs}`,
      a.recommendations.length ? `\nRecommendations:\n${a.recommendations.map((r: string, i: number) => `  ${i + 1}. ${r}`).join('\n')}` : '',
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text);
    toast('Summary copied to clipboard', 'success');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--apple-text-tertiary)' }}>
        <div className="w-5 h-5 border-2 rounded-full animate-spin mr-3" style={{ borderColor: 'var(--apple-surface-3)', borderTopColor: 'var(--apple-blue)' }} />
        Loading incident...
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="p-8">
        <Link to="/" className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors duration-200" style={{ color: 'var(--apple-blue)' }}>
          <ArrowLeft className="w-3.5 h-3.5" style={{ strokeWidth: 2 }} /> Back
        </Link>
        <div className="text-center py-20 text-[15px]" style={{ color: 'var(--apple-text-tertiary)' }}>Incident not found.</div>
      </div>
    );
  }

  const a = incident.analysis;
  const completedSteps = incident.runbook?.completedSteps || [];
  const sev = severityStyle[a.severity];
  const stat = statusStyle[incident.status];

  return (
    <div className="p-8 space-y-8">
      <Link to="/" className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors duration-200 hover:opacity-80" style={{ color: 'var(--apple-blue)' }}>
        <ArrowLeft className="w-3.5 h-3.5" style={{ strokeWidth: 2 }} /> Incidents
      </Link>

      {/* Header */}
      <div>
        <h1 className="apple-title mb-3">{incident.title}</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="apple-pill" style={{ background: stat.bg, color: stat.color }}>
            <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ background: stat.color }} />
            {stat.label}
          </span>
          <span className="apple-pill" style={{ background: sev.bg, color: sev.color }}>
            {a.severity}
          </span>
          {incident.service && (
            <span className="apple-pill" style={{ background: 'var(--apple-surface-2)', color: 'var(--apple-text-secondary)' }}>
              {incident.service}
            </span>
          )}
          <button onClick={copyId} className="apple-pill cursor-pointer transition-all duration-200 hover:opacity-70"
            style={{ background: 'var(--apple-surface-1)', color: 'var(--apple-text-tertiary)' }}>
            <Copy className="w-3 h-3 mr-1" style={{ strokeWidth: 1.8 }} />
            {copied ? 'Copied!' : id?.slice(0, 8)}
          </button>
          <button onClick={copySummary} className="apple-pill cursor-pointer transition-all duration-200 hover:opacity-70"
            style={{ background: 'rgba(10, 132, 255, 0.1)', color: 'var(--apple-blue)' }}>
            <Share className="w-3 h-3 mr-1" style={{ strokeWidth: 1.8 }} />
            Share Summary
          </button>
          <button onClick={exportPDF} className="apple-pill cursor-pointer transition-all duration-200 hover:opacity-70"
            style={{ background: 'rgba(48, 209, 88, 0.1)', color: 'var(--apple-green)' }}>
            <FileText className="w-3 h-3 mr-1" style={{ strokeWidth: 1.8 }} />
            Export PDF
          </button>

          {/* Team tag */}
          <div ref={teamRef} className="relative">
            <button
              onClick={() => canAssign && setTeamDropdownOpen(p => !p)}
              className="apple-pill cursor-pointer transition-all duration-200 hover:opacity-70"
              style={{
                background: incident.assignedTeamId ? 'rgba(191, 90, 242, 0.12)' : 'var(--apple-surface-2)',
                color: incident.assignedTeamId ? 'var(--apple-purple)' : 'var(--apple-text-tertiary)',
              }}>
              <Users className="w-3 h-3 mr-1" style={{ strokeWidth: 1.8 }} />
              {incident.assignedTeamName || 'Assign Team'}
            </button>
            {teamDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-56 rounded-[10px] overflow-hidden shadow-lg z-50"
                style={{ background: 'var(--apple-bg)', border: '1px solid var(--apple-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                {teams.length === 0 && (
                  <p className="px-3 py-3 text-[12px]" style={{ color: 'var(--apple-text-tertiary)' }}>No teams available</p>
                )}
                {teams.map((t: any) => (
                  <button key={t.id}
                    onClick={() => handleAssignTeam(t.id)}
                    disabled={assigningTeam}
                    className="flex items-center gap-2 w-full px-3 py-2 text-left transition-all duration-100 hover:opacity-80"
                    style={{
                      background: incident.assignedTeamId === t.id ? 'var(--apple-surface-3)' : 'transparent',
                    }}>
                    <Users className="w-3.5 h-3.5 shrink-0" style={{ color: incident.assignedTeamId === t.id ? 'var(--apple-purple)' : 'var(--apple-text-tertiary)', strokeWidth: 1.8 }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium truncate" style={{ color: 'var(--apple-text-primary)' }}>{t.name}</p>
                      <p className="text-[11px] truncate" style={{ color: 'var(--apple-text-tertiary)' }}>{t.members?.length || 0} members</p>
                    </div>
                    {incident.assignedTeamId === t.id && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--apple-purple)', strokeWidth: 2.5 }} />}
                  </button>
                ))}
                {incident.assignedTeamId && (
                  <>
                    <div style={{ borderTop: '1px solid var(--apple-border)' }} />
                    <button
                      onClick={() => handleAssignTeam(null)}
                      disabled={assigningTeam}
                      className="w-full px-3 py-2 text-[12px] font-medium text-left transition-all hover:opacity-80"
                      style={{ color: 'var(--apple-red)' }}>
                      Remove team
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons (responder + admin only) */}
      {canWrite && incident.status !== 'resolved' && (
        <div className="flex gap-2 flex-wrap">
          {incident.status === 'open' && (
            <button onClick={() => updateStatus('acknowledged')} disabled={updating}
              className="apple-btn" style={{ background: 'rgba(255, 214, 10, 0.12)', color: 'var(--apple-yellow)' }}>
              Acknowledge
            </button>
          )}
          {(incident.status === 'open' || incident.status === 'acknowledged') && (
            <button onClick={() => updateStatus('investigating')} disabled={updating}
              className="apple-btn apple-btn-primary">
              Investigate
            </button>
          )}
          <button onClick={() => updateStatus('resolved')} disabled={updating}
            className="apple-btn apple-btn-success">
            Resolve
          </button>
          {!incident.pagerduty && canEscalate && (
            <button onClick={escalate} disabled={updating}
              className="apple-btn apple-btn-danger">
              Escalate to PagerDuty
            </button>
          )}
        </div>
      )}

      {/* Timeline */}
      <Expandable title="Timeline" icon={<Clock className="w-[18px] h-[18px]" style={{ color: 'var(--apple-text-tertiary)', strokeWidth: 1.8 }} />}>
        <div className="relative pl-6">
          <div className="absolute left-[9px] top-2 bottom-2 w-px" style={{ background: 'var(--apple-surface-3)' }} />
          {(() => {
            const events: { time: string; label: string; icon: React.ReactNode; color: string }[] = [];
            events.push({ time: incident.createdAt, label: 'Incident created', icon: <AlertTriangle className="w-3 h-3" style={{ strokeWidth: 2 }} />, color: 'var(--apple-red)' });
            if (incident.analysis) {
              events.push({ time: incident.createdAt, label: `AI analysis completed — ${a.severity} severity, ${Math.round(a.confidence * 100)}% confidence`, icon: <SearchIcon className="w-3 h-3" style={{ strokeWidth: 2 }} />, color: 'var(--apple-blue)' });
            }
            if (incident.runbook) {
              events.push({ time: incident.createdAt, label: `Runbook matched — ${runbook?.name || 'Loading...'}`, icon: <BookOpen className="w-3 h-3" style={{ strokeWidth: 2 }} />, color: 'var(--apple-purple)' });
            }
            if (incident.pagerduty) {
              events.push({ time: incident.pagerduty.escalatedAt || incident.createdAt, label: `Escalated to PagerDuty — ${incident.pagerduty.incidentId}`, icon: <Bell className="w-3 h-3" style={{ strokeWidth: 2 }} />, color: 'var(--apple-green)' });
            }
            if (incident.status === 'acknowledged') {
              events.push({ time: incident.updatedAt || incident.createdAt, label: 'Incident acknowledged', icon: <Clock className="w-3 h-3" style={{ strokeWidth: 2 }} />, color: 'var(--apple-yellow)' });
            }
            if (incident.status === 'investigating') {
              events.push({ time: incident.updatedAt || incident.createdAt, label: 'Investigation started', icon: <SearchIcon className="w-3 h-3" style={{ strokeWidth: 2 }} />, color: 'var(--apple-blue)' });
            }
            if (incident.status === 'resolved') {
              events.push({ time: incident.updatedAt || incident.createdAt, label: 'Incident resolved', icon: <CheckCircle className="w-3 h-3" style={{ strokeWidth: 2 }} />, color: 'var(--apple-green)' });
            }
            const completedStepsList = incident.runbook?.completedSteps || [];
            if (completedStepsList.length > 0 && runbook) {
              events.push({ time: incident.updatedAt || incident.createdAt, label: `${completedStepsList.length} runbook step${completedStepsList.length > 1 ? 's' : ''} completed`, icon: <Check className="w-3 h-3" style={{ strokeWidth: 2.5 }} />, color: 'var(--apple-green)' });
            }
            return events.map((ev, i) => (
              <div key={i} className="relative flex items-start gap-3 pb-4 last:pb-0">
                <div className="absolute left-[-18px] w-[18px] h-[18px] rounded-full flex items-center justify-center"
                  style={{ background: timelineBg[ev.color] || 'var(--apple-surface-2)' }}>
                  <div style={{ color: ev.color }}>{ev.icon}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px]" style={{ color: 'var(--apple-text-primary)' }}>{ev.label}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--apple-text-tertiary)' }}>{formatTimeAgo(ev.time)}</p>
                </div>
              </div>
            ));
          })()}
        </div>
      </Expandable>

      {/* PagerDuty badge */}
      {incident.pagerduty && (
        <Expandable title="PagerDuty Integration" icon={<Shield className="w-[18px] h-[18px]" style={{ color: 'var(--apple-green)', strokeWidth: 1.8 }} />}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-[13px]" style={{ color: 'var(--apple-green)' }}>
              <span>Status: <strong>{incident.pagerduty.status}</strong></span>
              <span style={{ opacity: 0.3 }}>|</span>
              <span className="text-[12px]" style={{ color: 'var(--apple-text-tertiary)' }}>{incident.pagerduty.incidentId}</span>
            </div>
            {incident.pagerduty.htmlUrl && (
              <a href={incident.pagerduty.htmlUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-[12px] font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--apple-green)' }}>
                View <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </Expandable>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Confidence', value: `${Math.round(a.confidence * 100)}%`, color: 'var(--apple-blue)' },
          { label: 'Logs Analyzed', value: a.analyzedLogs, color: 'var(--apple-text-primary)' },
          { label: 'Patterns', value: a.patterns.length, color: 'var(--apple-orange)' },
          { label: 'Processing', value: `${a.processingTimeMs}ms`, color: 'var(--apple-green)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="apple-card text-center">
            <div className="apple-stat-label">{label}</div>
            <div className="apple-stat-value" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Root Cause */}
        <Expandable title="Root Cause" icon={<AlertTriangle className="w-[18px] h-[18px]" style={{ color: 'var(--apple-orange)', strokeWidth: 1.8 }} />}>
          <div className="space-y-4">
            <div className="px-3.5 py-2.5 rounded-[10px] text-[14px] font-semibold" style={{ background: 'rgba(255, 159, 10, 0.1)', color: 'var(--apple-orange)' }}>
              {a.rootCause.category}
            </div>
            <p className="text-[14px] leading-relaxed" style={{ color: 'var(--apple-text-secondary)' }}>{a.rootCause.description}</p>
            <div className="space-y-1.5">
              <div className="apple-stat-label" style={{ marginBottom: 4 }}>Evidence</div>
              {a.rootCause.evidence.map((e: string, i: number) => (
                <div key={i} className="text-[12px] font-mono px-3 py-2 rounded-[8px]" style={{ background: 'var(--apple-surface-2)', color: 'var(--apple-text-secondary)' }}>{e}</div>
              ))}
            </div>
          </div>
        </Expandable>

        {/* Recommendations */}
        <Expandable title="Recommendations" icon={<CheckCircle className="w-[18px] h-[18px]" style={{ color: 'var(--apple-green)', strokeWidth: 1.8 }} />} count={a.recommendations.length}>
          <ul className="space-y-3">
            {a.recommendations.map((rec: string, i: number) => (
              <li key={i} className="flex items-start gap-3 text-[14px] leading-relaxed" style={{ color: 'var(--apple-text-secondary)' }}>
                <span className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
                  style={{ background: 'var(--apple-surface-3)', color: 'var(--apple-text-secondary)' }}>{i + 1}</span>
                {rec}
              </li>
            ))}
          </ul>
        </Expandable>
      </div>

      {/* Patterns */}
      {a.patterns.length > 0 && (
        <Expandable title="Detected Patterns" icon={<AlertTriangle className="w-[18px] h-[18px]" style={{ color: 'var(--apple-orange)', strokeWidth: 1.8 }} />} count={a.patterns.length} defaultOpen={false}>
          <div className="grid gap-3 md:grid-cols-2">
            {a.patterns.map((p: any, i: number) => (
              <div key={i} className="p-3.5 rounded-[10px]" style={{ background: 'var(--apple-surface-2)' }}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[14px] font-medium" style={{ color: 'var(--apple-text-primary)' }}>{p.name}</span>
                  <span className="text-[12px] font-medium tabular-nums" style={{ color: 'var(--apple-orange)' }}>{p.occurrences}x</span>
                </div>
                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--apple-text-tertiary)' }}>{p.description}</p>
              </div>
            ))}
          </div>
        </Expandable>
      )}

      {/* Runbook */}
      {runbook && (
        <Expandable title={runbook.name} icon={<BookOpen className="w-[18px] h-[18px]" style={{ color: 'var(--apple-blue)', strokeWidth: 1.8 }} />} count={runbook.steps.length}>
          <div className="space-y-5">
            <div className="flex items-center gap-3 text-[12px]" style={{ color: 'var(--apple-text-tertiary)' }}>
              <span className="font-medium" style={{ color: 'var(--apple-blue)' }}>{Math.round((incident.runbook?.matchScore || 0) * 100)}% match</span>
              <span>~{runbook.estimatedTimeMinutes}min</span>
            </div>

            {incident.runbook?.matchReason && (
              <p className="text-[13px]" style={{ color: 'var(--apple-text-tertiary)' }}>{incident.runbook.matchReason}</p>
            )}

            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-medium" style={{ color: 'var(--apple-text-secondary)' }}>
                  {completedSteps.length} of {runbook.steps.length} steps completed
                </span>
                <span className="text-[12px] font-semibold tabular-nums" style={{ color: 'var(--apple-blue)' }}>
                  {Math.round((completedSteps.length / runbook.steps.length) * 100)}%
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--apple-surface-3)' }}>
                <div className="h-1.5 rounded-full transition-all duration-500" style={{
                  background: 'var(--apple-blue)',
                  width: `${(completedSteps.length / runbook.steps.length) * 100}%`
                }} />
              </div>
            </div>

            <div className="space-y-2">
              {runbook.steps.map((step: any) => {
                const completed = completedSteps.includes(step.order);
                return (
                  <div key={step.order} className="p-4 rounded-[12px] transition-all duration-200"
                    style={{ background: completed ? 'rgba(48, 209, 88, 0.06)' : 'var(--apple-surface-2)' }}>
                    <div className="flex items-start gap-3">
                      <button onClick={() => canWrite && !completed && completeStep(step.order)}
                        disabled={!canWrite}
                        className="mt-0.5 w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 transition-all duration-200"
                        style={completed ? {
                          background: 'var(--apple-green)',
                        } : {
                          border: '2px solid var(--apple-surface-3)',
                          background: 'transparent',
                          cursor: canWrite ? 'pointer' : 'default',
                        }}>
                        {completed && <Check className="w-3 h-3 text-white" style={{ strokeWidth: 3 }} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-medium" style={{
                            color: completed ? 'var(--apple-green)' : 'var(--apple-text-primary)',
                            textDecoration: completed ? 'line-through' : 'none',
                            opacity: completed ? 0.7 : 1,
                          }}>
                            Step {step.order + 1}: {step.title}
                          </span>
                          {step.isAutomatable && (
                            <span className="apple-pill" style={{ background: 'rgba(191, 90, 242, 0.12)', color: 'var(--apple-purple)' }}>auto</span>
                          )}
                        </div>
                        <p className="text-[13px] mt-1 leading-relaxed" style={{ color: 'var(--apple-text-tertiary)' }}>{step.description}</p>
                        {step.command && (
                          <div className="mt-2.5 flex items-center gap-2 px-3 py-2 rounded-[8px]" style={{ background: 'var(--apple-surface-2)' }}>
                            <Terminal className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--apple-text-tertiary)', strokeWidth: 1.8 }} />
                            <code className="text-[12px] font-mono truncate flex-1" style={{ color: 'var(--apple-green)' }}>{step.command}</code>
                            {canWrite && step.isAutomatable && !completed && (
                              <button
                                onClick={async () => {
                                  toast(`Executing: ${step.command}`, 'info');
                                  await new Promise(r => setTimeout(r, 1500));
                                  await completeStep(step.order);
                                  toast(`Command completed successfully`, 'success');
                                }}
                                className="text-[11px] font-semibold px-2.5 py-1 rounded-[6px] shrink-0 transition-all hover:opacity-80"
                                style={{ background: 'rgba(191, 90, 242, 0.15)', color: 'var(--apple-purple)' }}>
                                Run
                              </button>
                            )}
                          </div>
                        )}
                        {step.expectedOutcome && (
                          <p className="text-[11px] mt-1.5" style={{ color: 'var(--apple-text-tertiary)' }}>Expected: {step.expectedOutcome}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Expandable>
      )}

      {/* Audit Trail */}
      {incident.auditLog && incident.auditLog.length > 0 && (
        <Expandable title="Audit Trail" icon={<History className="w-[18px] h-[18px]" style={{ color: 'var(--apple-yellow)', strokeWidth: 1.8 }} />}>
          <div className="space-y-2">
            {incident.auditLog.map((entry: any) => (
              <div key={entry.id} className="flex items-start gap-3 py-2" style={{ borderBottom: '1px solid var(--apple-border)' }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: entry.action === 'status_change' ? 'rgba(10, 132, 255, 0.12)' : entry.action === 'commented' ? 'rgba(48, 209, 88, 0.12)' : 'var(--apple-surface-2)' }}>
                  {entry.action === 'status_change' ? <Clock className="w-3 h-3" style={{ color: 'var(--apple-blue)' }} /> :
                   entry.action === 'commented' ? <MessageSquare className="w-3 h-3" style={{ color: 'var(--apple-green)' }} /> :
                   <User className="w-3 h-3" style={{ color: 'var(--apple-text-tertiary)' }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[12px] font-semibold" style={{ color: 'var(--apple-text-primary)' }}>{entry.username}</span>
                    {entry.action === 'status_change' && (
                      <span className="text-[12px]" style={{ color: 'var(--apple-text-secondary)' }}>
                        changed status from <span className="font-medium">{entry.fromValue}</span> to <span className="font-medium">{entry.toValue}</span>
                      </span>
                    )}
                    {entry.action === 'commented' && (
                      <span className="text-[12px]" style={{ color: 'var(--apple-text-secondary)' }}>added a comment</span>
                    )}
                    {entry.action === 'escalated' && (
                      <span className="text-[12px]" style={{ color: 'var(--apple-text-secondary)' }}>escalated the incident</span>
                    )}
                    {entry.action === 'runbook_step' && (
                      <span className="text-[12px]" style={{ color: 'var(--apple-text-secondary)' }}>completed a runbook step</span>
                    )}
                  </div>
                  <span className="text-[10px]" style={{ color: 'var(--apple-text-tertiary)' }}>{formatTimeAgo(entry.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        </Expandable>
      )}

      {/* Comments / Collaboration Thread */}
      <div className="apple-card">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-[18px] h-[18px]" style={{ color: 'var(--apple-blue)', strokeWidth: 1.8 }} />
          <span className="apple-section-title">Activity</span>
          <span className="text-[12px] font-medium tabular-nums" style={{ color: 'var(--apple-text-tertiary)' }}>{comments.length}</span>
        </div>

        {comments.length > 0 && (
          <div className="space-y-3 mb-4 max-h-[400px] overflow-y-auto">
            {comments.map((c: any) => (
              <div key={c.id} className="flex gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'var(--apple-surface-2)' }}>
                  <User className="w-3.5 h-3.5" style={{ color: 'var(--apple-text-tertiary)', strokeWidth: 1.8 }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-semibold" style={{ color: 'var(--apple-text-primary)' }}>{c.author}</span>
                    <span className="text-[11px]" style={{ color: 'var(--apple-text-tertiary)' }}>{formatTimeAgo(c.createdAt)}</span>
                  </div>
                  <p className="text-[13px] mt-0.5 leading-relaxed" style={{ color: 'var(--apple-text-secondary)' }}>
                    {c.text.split(/(@\w+)/g).map((part: string, i: number) =>
                      part.startsWith('@') ? <span key={i} className="font-semibold" style={{ color: 'var(--apple-blue)' }}>{part}</span> : part
                    )}
                  </p>
                </div>
              </div>
            ))}
            <div ref={commentsEndRef} />
          </div>
        )}

        {comments.length === 0 && (
          <p className="text-[13px] mb-4" style={{ color: 'var(--apple-text-tertiary)' }}>No comments yet. Start the conversation.</p>
        )}

        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              ref={commentInputRef}
              value={commentText}
              onChange={handleCommentChange}
              onKeyDown={handleCommentKeyDown}
              onBlur={() => setTimeout(() => setMentionQuery(null), 150)}
              placeholder="Add a comment... (type @ to mention)"
              className="apple-input w-full"
              aria-label="Add a comment"
            />
            {mentionQuery !== null && mentionFiltered.length > 0 && (
              <div className="absolute bottom-full left-0 mb-1 w-64 rounded-[10px] overflow-hidden shadow-lg z-50 backdrop-blur-none"
                style={{ background: 'var(--apple-bg)', border: '1px solid var(--apple-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                {mentionFiltered.map((u: any, i: number) => (
                  <button
                    key={u.id}
                    onMouseDown={e => { e.preventDefault(); insertMention(u); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-left transition-all duration-100"
                    style={{
                      background: i === mentionIdx ? 'var(--apple-surface-3)' : 'transparent',
                    }}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-semibold"
                      style={{ background: 'var(--apple-surface-3)', color: 'var(--apple-text-secondary)' }}>
                      {u.displayName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium truncate" style={{ color: 'var(--apple-text-primary)' }}>{u.displayName}</p>
                      <p className="text-[11px] truncate" style={{ color: 'var(--apple-text-tertiary)' }}>@{u.username} · {u.role}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={submitComment}
            disabled={!commentText.trim() || submittingComment}
            className="apple-btn apple-btn-primary flex items-center gap-1.5"
            aria-label="Send comment"
          >
            <Send className="w-3.5 h-3.5" style={{ strokeWidth: 2 }} />
          </button>
        </div>
      </div>
    </div>
  );
}
