import React, { useState, useEffect } from 'react';
import { Bell, Palette, Shield, Save, Check, Eye, EyeOff, Slack, Globe, Cpu, Zap, Lock, Users, Plus, Trash2, UserPlus, User, Pencil, KeyRound, Copy } from 'lucide-react';
import Expandable from '../components/Expandable';
import { useSettings, defaults, AppSettings } from '../useSettings';
import { useAuth } from '../useAuth';
import { api } from '../api';
import UserManagement from '../components/settings/UserManagement';

export default function Settings() {
  const { settings, updateSettings } = useSettings();
  const { user, isRole, hasPerm, updateUser } = useAuth();
  const isAdmin = isRole('admin');
  const canManageIntegrations = hasPerm('integrations:manage');
  const canViewIntegrations = hasPerm('integrations:view');
  const canManageTeams = hasPerm('teams:manage');
  const canManageUsers = hasPerm('users:manage');
  const canManageSettings = hasPerm('settings:manage');
  const [showKey, setShowKey] = useState(false);

  // Profile editing
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.displayName || '');
  const [savingName, setSavingName] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState(user?.username || '');
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState('');

  // Integration settings (server-side, admin-only)
  const [pdKey, setPdKey] = useState('');
  const [slackWebhook, setSlackWebhook] = useState('');
  const [slackChannel, setSlackChannel] = useState('#incidents');
  const [slackEnabled, setSlackEnabled] = useState(false);
  const [jiraUrl, setJiraUrl] = useState('');
  const [jiraProject, setJiraProject] = useState('INC');
  const [jiraToken, setJiraToken] = useState('');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraEnabled, setJiraEnabled] = useState(false);
  const [opsgenieKey, setOpsgenieKey] = useState('');
  const [opsgenieEnabled, setOpsgenieEnabled] = useState(false);
  const [aiProvider, setAiProvider] = useState<'openai' | 'anthropic' | 'local'>('openai');
  const [aiKey, setAiKey] = useState('');
  const [aiModel, setAiModel] = useState('gpt-4');
  const [aiEnabled, setAiEnabled] = useState(false);
  const [intSaving, setIntSaving] = useState(false);
  const [intSaved, setIntSaved] = useState(false);

  // Team management state (admin-only)
  const [teams, setTeams] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [addMemberTeamId, setAddMemberTeamId] = useState<string | null>(null);
  const [addMemberUserId, setAddMemberUserId] = useState('');
  const [addMemberRole, setAddMemberRole] = useState('member');

  // Per-team integration overrides
  const [overrideTeamId, setOverrideTeamId] = useState<string | null>(null);
  const [overrideSlackChannel, setOverrideSlackChannel] = useState('');
  const [overrideSlackMention, setOverrideSlackMention] = useState('');
  const [overrideJiraProject, setOverrideJiraProject] = useState('');
  const [overrideJiraIssueType, setOverrideJiraIssueType] = useState('');
  const [overrideOpsgenieTeam, setOverrideOpsgenieTeam] = useState('');
  const [overrideOpsgeniePriority, setOverrideOpsgeniePriority] = useState('');
  const [overridePdEscalation, setOverridePdEscalation] = useState('');
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [overrideSaved, setOverrideSaved] = useState(false);

  const refreshData = () => {
    api.listTeams().then((d: any) => { if (d.teams) setTeams(d.teams); }).catch(() => {});
    api.listUsers().then((u: any) => { if (Array.isArray(u)) setAllUsers(u); }).catch(() => {});
  };

  useEffect(() => {
    if (!canManageTeams && !canManageUsers) return;
    refreshData();
  }, [canManageTeams, canManageUsers]);

  useEffect(() => {
    if (!canViewIntegrations) return;
    api.getIntegrationSettings().then((s: any) => {
      if (s.error) return;
      if (s.slack) { setSlackWebhook(s.slack.webhookUrl || ''); setSlackChannel(s.slack.channel || '#incidents'); setSlackEnabled(!!s.slack.enabled); }
      if (s.jira) { setJiraUrl(s.jira.baseUrl || ''); setJiraProject(s.jira.projectKey || 'INC'); setJiraToken(s.jira.apiToken || ''); setJiraEmail(s.jira.email || ''); setJiraEnabled(!!s.jira.enabled); }
      if (s.opsgenie) { setOpsgenieKey(s.opsgenie.apiKey || ''); setOpsgenieEnabled(!!s.opsgenie.enabled); }
      if (s.ai) { setAiProvider(s.ai.provider || 'openai'); setAiKey(s.ai.apiKey || ''); setAiModel(s.ai.model || 'gpt-4'); setAiEnabled(!!s.ai.enabled); }
      if (s.pagerduty) { setPdKey(s.pagerduty.routingKey || ''); }
    }).catch(() => {});
  }, [canViewIntegrations]);

  const saveIntegrations = async () => {
    setIntSaving(true);
    await api.updateIntegrationSettings({
      pagerduty: { routingKey: pdKey, autoTriggerSeverities: [] },
      slack: { webhookUrl: slackWebhook, channel: slackChannel, enabled: slackEnabled },
      jira: { baseUrl: jiraUrl, projectKey: jiraProject, apiToken: jiraToken, email: jiraEmail, enabled: jiraEnabled },
      opsgenie: { apiKey: opsgenieKey, enabled: opsgenieEnabled },
      ai: { provider: aiProvider, apiKey: aiKey, model: aiModel, enabled: aiEnabled },
    });
    setIntSaving(false);
    setIntSaved(true);
    setTimeout(() => setIntSaved(false), 2000);
  };

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    updateSettings({ [key]: value });
  };

  const handleReset = () => {
    updateSettings(defaults);
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="apple-title">Settings</h1>
        <p className="apple-subtitle">
          {canManageSettings
            ? 'Manage your preferences and team integrations.'
            : 'Manage your personal preferences.'}
        </p>
        {user && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[12px] font-medium px-2.5 py-1 rounded-[6px]" style={{ background: 'var(--apple-surface-2)', color: 'var(--apple-text-secondary)' }}>
              Signed in as <strong>{user.displayName}</strong>
            </span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize" style={{
              background: user.role === 'admin' ? 'rgba(191, 90, 242, 0.15)' : user.role === 'responder' ? 'rgba(10, 132, 255, 0.15)' : 'var(--apple-surface-2)',
              color: user.role === 'admin' ? 'var(--apple-purple)' : user.role === 'responder' ? 'var(--apple-blue)' : 'var(--apple-text-tertiary)',
            }}>{user.role}</span>
          </div>
        )}
      </div>

      {/* Integrations (admin-only) */}
      {canViewIntegrations ? (
      <Expandable title="Integrations" icon={<Shield className="w-[18px] h-[18px]" style={{ color: 'var(--apple-purple)', strokeWidth: 1.8 }} />}>
        <div className="space-y-6">
          {/* PagerDuty */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" style={{ color: 'var(--apple-green)', strokeWidth: 1.8 }} />
              <p className="text-[13px] font-semibold" style={{ color: 'var(--apple-text-primary)' }}>PagerDuty</p>
              <div className="flex items-center gap-1.5 ml-auto">
                <div className="w-2 h-2 rounded-full" style={{ background: 'var(--apple-green)' }} />
                <span className="text-[11px] font-medium" style={{ color: 'var(--apple-green)' }}>Simulated</span>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={pdKey}
                  onChange={e => setPdKey(e.target.value)}
                  placeholder="PagerDuty API key..."
                  className="w-full px-3.5 py-2.5 rounded-[10px] text-[13px] outline-none transition-all duration-200 focus:ring-2"
                  style={{
                    background: 'var(--apple-surface-2)',
                    color: 'var(--apple-text-primary)',
                    border: '1px solid var(--apple-border)',
                    caretColor: 'var(--apple-blue)',
                  }}
                />
                <button
                  onClick={() => setShowKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
                  style={{ color: 'var(--apple-text-tertiary)' }}>
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--apple-text-tertiary)' }}>
              Used for escalation and incident synchronization. Stored locally in your browser.
            </p>
          </div>

          <div style={{ borderTop: '1px solid var(--apple-border)' }} />

          {/* AI Analysis */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4" style={{ color: 'var(--apple-teal)', strokeWidth: 1.8 }} />
              <p className="text-[13px] font-semibold" style={{ color: 'var(--apple-text-primary)' }}>AI Analysis</p>
              <button onClick={() => setAiEnabled(!aiEnabled)} className="w-[44px] h-[26px] rounded-full transition-all duration-200 relative ml-auto" style={{ background: aiEnabled ? 'var(--apple-green)' : 'var(--apple-surface-3)' }}>
                <div className="absolute top-[3px] w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200" style={{ left: aiEnabled ? 20 : 3 }} />
              </button>
            </div>
            <div className="flex gap-2">
              {(['openai', 'anthropic', 'local'] as const).map(p => (
                <button key={p} onClick={() => setAiProvider(p)} className="text-[12px] font-medium px-3 py-1.5 rounded-[8px] capitalize transition-all" style={{ background: aiProvider === p ? 'var(--apple-blue)' : 'var(--apple-surface-2)', color: aiProvider === p ? 'white' : 'var(--apple-text-tertiary)' }}>{p}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: 'var(--apple-text-secondary)' }}>API Key</label>
                <input value={aiKey} onChange={e => setAiKey(e.target.value)} type="password" placeholder="sk-..." className="apple-input w-full" />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: 'var(--apple-text-secondary)' }}>Model</label>
                <input value={aiModel} onChange={e => setAiModel(e.target.value)} placeholder="gpt-4" className="apple-input w-full" />
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--apple-border)' }} />

          {/* Slack */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Slack className="w-4 h-4" style={{ color: 'var(--apple-yellow)', strokeWidth: 1.8 }} />
              <p className="text-[13px] font-semibold" style={{ color: 'var(--apple-text-primary)' }}>Slack</p>
              <button onClick={() => setSlackEnabled(!slackEnabled)} className="w-[44px] h-[26px] rounded-full transition-all duration-200 relative ml-auto" style={{ background: slackEnabled ? 'var(--apple-green)' : 'var(--apple-surface-3)' }}>
                <div className="absolute top-[3px] w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200" style={{ left: slackEnabled ? 20 : 3 }} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: 'var(--apple-text-secondary)' }}>Webhook URL</label>
                <input value={slackWebhook} onChange={e => setSlackWebhook(e.target.value)} type="password" placeholder="https://hooks.slack.com/services/..." className="apple-input w-full" />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: 'var(--apple-text-secondary)' }}>Channel</label>
                <input value={slackChannel} onChange={e => setSlackChannel(e.target.value)} placeholder="#incidents" className="apple-input w-full" />
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--apple-border)' }} />

          {/* Jira */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4" style={{ color: 'var(--apple-blue)', strokeWidth: 1.8 }} />
              <p className="text-[13px] font-semibold" style={{ color: 'var(--apple-text-primary)' }}>Jira</p>
              <button onClick={() => setJiraEnabled(!jiraEnabled)} className="w-[44px] h-[26px] rounded-full transition-all duration-200 relative ml-auto" style={{ background: jiraEnabled ? 'var(--apple-green)' : 'var(--apple-surface-3)' }}>
                <div className="absolute top-[3px] w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200" style={{ left: jiraEnabled ? 20 : 3 }} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: 'var(--apple-text-secondary)' }}>Base URL</label>
                <input value={jiraUrl} onChange={e => setJiraUrl(e.target.value)} placeholder="https://company.atlassian.net" className="apple-input w-full" />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: 'var(--apple-text-secondary)' }}>Project Key</label>
                <input value={jiraProject} onChange={e => setJiraProject(e.target.value)} placeholder="INC" className="apple-input w-full" />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: 'var(--apple-text-secondary)' }}>Email</label>
                <input value={jiraEmail} onChange={e => setJiraEmail(e.target.value)} placeholder="you@company.com" className="apple-input w-full" />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: 'var(--apple-text-secondary)' }}>API Token</label>
                <input value={jiraToken} onChange={e => setJiraToken(e.target.value)} type="password" placeholder="Your Jira API token" className="apple-input w-full" />
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--apple-border)' }} />

          {/* OpsGenie */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4" style={{ color: 'var(--apple-red)', strokeWidth: 1.8 }} />
              <p className="text-[13px] font-semibold" style={{ color: 'var(--apple-text-primary)' }}>OpsGenie</p>
              <button onClick={() => setOpsgenieEnabled(!opsgenieEnabled)} className="w-[44px] h-[26px] rounded-full transition-all duration-200 relative ml-auto" style={{ background: opsgenieEnabled ? 'var(--apple-green)' : 'var(--apple-surface-3)' }}>
                <div className="absolute top-[3px] w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200" style={{ left: opsgenieEnabled ? 20 : 3 }} />
              </button>
            </div>
            <div>
              <label className="block text-[12px] font-medium mb-1" style={{ color: 'var(--apple-text-secondary)' }}>API Key</label>
              <input value={opsgenieKey} onChange={e => setOpsgenieKey(e.target.value)} type="password" placeholder="OpsGenie API key" className="apple-input w-full" />
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--apple-border)', paddingTop: 4 }} />

          {/* Save button */}
          <button onClick={saveIntegrations} disabled={intSaving} className="flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-[13px] font-semibold transition-all duration-200 hover:opacity-90" style={{ background: 'var(--apple-purple)', color: 'white' }}>
            {intSaved ? <><Check className="w-4 h-4" /> Saved</> : <><Save className="w-4 h-4" /> {intSaving ? 'Saving...' : 'Save Integrations'}</>}
          </button>
        </div>
      </Expandable>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3.5 rounded-[12px]" style={{ background: 'var(--apple-surface-2)', border: '1px solid var(--apple-border)' }}>
          <Lock className="w-4 h-4" style={{ color: 'var(--apple-text-tertiary)' }} />
          <p className="text-[13px]" style={{ color: 'var(--apple-text-secondary)' }}>
            Team integrations are managed by administrators. Contact your admin to configure Slack, Jira, OpsGenie, or AI providers.
          </p>
        </div>
      )}

      {/* Team Management (admin-only) */}
      {canManageTeams && (
      <Expandable title="Team Management" icon={<Users className="w-[18px] h-[18px]" style={{ color: 'var(--apple-teal)', strokeWidth: 1.8 }} />}>
        <div className="space-y-5">
          {/* Create team */}
          <div className="space-y-2">
            <p className="text-[13px] font-medium" style={{ color: 'var(--apple-text-primary)' }}>Create New Team</p>
            <div className="flex gap-2">
              <input value={newTeamName} onChange={e => setNewTeamName(e.target.value)} placeholder="Team name" className="apple-input flex-1" />
              <input value={newTeamDesc} onChange={e => setNewTeamDesc(e.target.value)} placeholder="Description (optional)" className="apple-input flex-1" />
              <button
                disabled={!newTeamName.trim()}
                onClick={async () => {
                  const t = await api.createTeam(newTeamName.trim(), newTeamDesc.trim());
                  if (t && !t.error) { setTeams(prev => [...prev, t]); setNewTeamName(''); setNewTeamDesc(''); }
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-[12px] font-semibold transition-all hover:opacity-90 disabled:opacity-30"
                style={{ background: 'var(--apple-teal)', color: 'white' }}>
                <Plus className="w-3.5 h-3.5" /> Create
              </button>
            </div>
          </div>

          {/* Team list */}
          {teams.length === 0 ? (
            <p className="text-[12px] py-4 text-center" style={{ color: 'var(--apple-text-tertiary)' }}>No teams yet. Create one above.</p>
          ) : (
            <div className="space-y-3">
              {teams.map((team: any) => (
                <div key={team.id} className="rounded-[10px] p-4 space-y-3" style={{ background: 'var(--apple-surface-2)', border: '1px solid var(--apple-border)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[14px] font-semibold" style={{ color: 'var(--apple-text-primary)' }}>{team.name}</p>
                      {team.description && <p className="text-[11px] mt-0.5" style={{ color: 'var(--apple-text-tertiary)' }}>{team.description}</p>}
                    </div>
                    <button
                      onClick={async () => {
                        await api.deleteTeam(team.id);
                        setTeams(prev => prev.filter(t => t.id !== team.id));
                      }}
                      className="p-1.5 rounded-[6px] transition-all hover:opacity-70"
                      style={{ color: 'var(--apple-red)' }} title="Delete team">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Members */}
                  <div>
                    <p className="text-[11px] font-medium mb-1.5" style={{ color: 'var(--apple-text-secondary)' }}>Members ({team.members?.length || 0})</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(team.members || []).map((m: any) => {
                        const memberUser = allUsers.find((u: any) => u.id === m.userId);
                        return (
                          <div key={m.userId} className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px]" style={{ background: 'var(--apple-surface-3)' }}>
                            <span style={{ color: 'var(--apple-text-primary)' }}>{memberUser?.displayName || m.userId}</span>
                            {m.role === 'owner' ? (
                              <span className="font-semibold capitalize" style={{ color: 'var(--apple-purple)' }}>owner</span>
                            ) : (
                              <select
                                value={m.role}
                                onChange={async (e) => {
                                  const updated = await api.updateTeamMemberRole(team.id, m.userId, e.target.value);
                                  if (updated && !updated.error) setTeams(prev => prev.map(t => t.id === team.id ? updated : t));
                                }}
                                className="font-semibold capitalize bg-transparent border-none outline-none cursor-pointer text-[11px] pr-1"
                                style={{ color: m.role === 'admin' ? 'var(--apple-blue)' : 'var(--apple-text-tertiary)' }}
                              >
                                <option value="member">member</option>
                                <option value="admin">admin</option>
                                <option value="owner">owner</option>
                              </select>
                            )}
                            {m.role !== 'owner' && (
                              <button
                                onClick={async () => {
                                  const updated = await api.removeTeamMember(team.id, m.userId);
                                  if (updated && !updated.error) setTeams(prev => prev.map(t => t.id === team.id ? updated : t));
                                }}
                                className="ml-0.5 hover:opacity-70" style={{ color: 'var(--apple-red)' }}>×</button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Add member */}
                  {addMemberTeamId === team.id ? (
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--apple-text-secondary)' }}>User</label>
                        <select value={addMemberUserId} onChange={e => setAddMemberUserId(e.target.value)} className="apple-input w-full text-[12px]">
                          <option value="">Select user...</option>
                          {allUsers.filter((u: any) => !(team.members || []).some((m: any) => m.userId === u.id)).map((u: any) => (
                            <option key={u.id} value={u.id}>{u.displayName} ({u.role})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--apple-text-secondary)' }}>Role</label>
                        <select value={addMemberRole} onChange={e => setAddMemberRole(e.target.value)} className="apple-input text-[12px]">
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <button
                        disabled={!addMemberUserId}
                        onClick={async () => {
                          const updated = await api.addTeamMember(team.id, addMemberUserId, addMemberRole);
                          if (updated && !updated.error) {
                            setTeams(prev => prev.map(t => t.id === team.id ? updated : t));
                            setAddMemberUserId(''); setAddMemberTeamId(null);
                          }
                        }}
                        className="px-3 py-2 rounded-[8px] text-[12px] font-semibold transition-all hover:opacity-90 disabled:opacity-30"
                        style={{ background: 'var(--apple-blue)', color: 'white' }}>Add</button>
                      <button
                        onClick={() => { setAddMemberTeamId(null); setAddMemberUserId(''); }}
                        className="px-3 py-2 rounded-[8px] text-[12px] font-medium transition-all hover:opacity-70"
                        style={{ background: 'var(--apple-surface-3)', color: 'var(--apple-text-secondary)' }}>Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddMemberTeamId(team.id)}
                      className="flex items-center gap-1.5 text-[11px] font-medium transition-all hover:opacity-70"
                      style={{ color: 'var(--apple-blue)' }}>
                      <UserPlus className="w-3.5 h-3.5" /> Add member
                    </button>
                  )}

                  {/* Per-team integration overrides */}
                  <div style={{ borderTop: '1px solid var(--apple-border)', paddingTop: 12, marginTop: 4 }}>
                    {overrideTeamId === team.id ? (
                      <div className="space-y-2.5">
                        <p className="text-[11px] font-semibold" style={{ color: 'var(--apple-text-secondary)' }}>Integration Routing Overrides</p>
                        <p className="text-[10px]" style={{ color: 'var(--apple-text-tertiary)' }}>
                          Override where this team's alerts are routed. Leave blank to use org defaults.
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-medium mb-0.5" style={{ color: 'var(--apple-text-tertiary)' }}>Slack Channel</label>
                            <input value={overrideSlackChannel} onChange={e => setOverrideSlackChannel(e.target.value)} placeholder={slackChannel || '#incidents'} className="apple-input w-full text-[11px]" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium mb-0.5" style={{ color: 'var(--apple-text-tertiary)' }}>Slack Mention Group</label>
                            <input value={overrideSlackMention} onChange={e => setOverrideSlackMention(e.target.value)} placeholder="@team-handle" className="apple-input w-full text-[11px]" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium mb-0.5" style={{ color: 'var(--apple-text-tertiary)' }}>Jira Project Key</label>
                            <input value={overrideJiraProject} onChange={e => setOverrideJiraProject(e.target.value)} placeholder={jiraProject || 'INC'} className="apple-input w-full text-[11px]" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium mb-0.5" style={{ color: 'var(--apple-text-tertiary)' }}>Jira Issue Type</label>
                            <select value={overrideJiraIssueType} onChange={e => setOverrideJiraIssueType(e.target.value)} className="apple-input w-full text-[11px]">
                              <option value="">Org default</option>
                              <option value="Bug">Bug</option>
                              <option value="Task">Task</option>
                              <option value="Incident">Incident</option>
                              <option value="Story">Story</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium mb-0.5" style={{ color: 'var(--apple-text-tertiary)' }}>OpsGenie Team</label>
                            <input value={overrideOpsgenieTeam} onChange={e => setOverrideOpsgenieTeam(e.target.value)} placeholder="Default routing" className="apple-input w-full text-[11px]" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium mb-0.5" style={{ color: 'var(--apple-text-tertiary)' }}>OpsGenie Priority</label>
                            <select value={overrideOpsgeniePriority} onChange={e => setOverrideOpsgeniePriority(e.target.value)} className="apple-input w-full text-[11px]">
                              <option value="">Org default</option>
                              <option value="P1">P1 — Critical</option>
                              <option value="P2">P2 — High</option>
                              <option value="P3">P3 — Moderate</option>
                              <option value="P4">P4 — Low</option>
                              <option value="P5">P5 — Informational</option>
                            </select>
                          </div>
                          <div className="col-span-2">
                            <label className="block text-[10px] font-medium mb-0.5" style={{ color: 'var(--apple-text-tertiary)' }}>PagerDuty Escalation Policy ID</label>
                            <input value={overridePdEscalation} onChange={e => setOverridePdEscalation(e.target.value)} placeholder="e.g. PABC123" className="apple-input w-full text-[11px]" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            disabled={overrideSaving}
                            onClick={async () => {
                              setOverrideSaving(true);
                              await api.updateTeamIntegrationOverrides(team.id, {
                                slackChannel: overrideSlackChannel || undefined,
                                slackMentionGroup: overrideSlackMention || undefined,
                                jiraProjectKey: overrideJiraProject || undefined,
                                jiraIssueType: overrideJiraIssueType || undefined,
                                opsgenieTeamName: overrideOpsgenieTeam || undefined,
                                opsgeniePriority: (overrideOpsgeniePriority || undefined) as 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | undefined,
                                pagerdutyEscalationPolicyId: overridePdEscalation || undefined,
                              });
                              setOverrideSaving(false);
                              setOverrideSaved(true);
                              setTimeout(() => setOverrideSaved(false), 2000);
                              // Refresh teams to show updated overrides
                              api.listTeams().then((d: any) => { if (d.teams) setTeams(d.teams); }).catch(() => {});
                            }}
                            className="px-3 py-1.5 rounded-[6px] text-[11px] font-semibold transition-all hover:opacity-90 disabled:opacity-30"
                            style={{ background: 'var(--apple-purple)', color: 'white' }}>
                            {overrideSaved ? 'Saved!' : overrideSaving ? 'Saving...' : 'Save Overrides'}
                          </button>
                          <button
                            onClick={() => { setOverrideTeamId(null); setOverrideSlackChannel(''); setOverrideSlackMention(''); setOverrideJiraProject(''); setOverrideJiraIssueType(''); setOverrideOpsgenieTeam(''); setOverrideOpsgeniePriority(''); setOverridePdEscalation(''); }}
                            className="px-3 py-1.5 rounded-[6px] text-[11px] font-medium transition-all hover:opacity-70"
                            style={{ background: 'var(--apple-surface-3)', color: 'var(--apple-text-secondary)' }}>
                            Cancel
                          </button>
                          {(overrideSlackChannel || overrideSlackMention || overrideJiraProject || overrideJiraIssueType || overrideOpsgenieTeam || overrideOpsgeniePriority || overridePdEscalation) && (
                            <button
                              onClick={async () => {
                                setOverrideSaving(true);
                                await api.updateTeamIntegrationOverrides(team.id, {});
                                setOverrideSaving(false);
                                setOverrideSlackChannel(''); setOverrideSlackMention(''); setOverrideJiraProject(''); setOverrideJiraIssueType(''); setOverrideOpsgenieTeam(''); setOverrideOpsgeniePriority(''); setOverridePdEscalation('');
                                setOverrideSaved(true);
                                setTimeout(() => setOverrideSaved(false), 2000);
                                api.listTeams().then((d: any) => { if (d.teams) setTeams(d.teams); }).catch(() => {});
                              }}
                              className="px-3 py-1.5 rounded-[6px] text-[11px] font-medium transition-all hover:opacity-70"
                              style={{ color: 'var(--apple-red)' }}>
                              Clear All
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          {team.integrationOverrides?.slackChannel && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(191, 90, 242, 0.12)', color: 'var(--apple-purple)' }}>
                              Slack: {team.integrationOverrides.slackChannel}
                            </span>
                          )}
                          {team.integrationOverrides?.jiraProjectKey && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(10, 132, 255, 0.12)', color: 'var(--apple-blue)' }}>
                              Jira: {team.integrationOverrides.jiraProjectKey}
                            </span>
                          )}
                          {team.integrationOverrides?.slackMentionGroup && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(191, 90, 242, 0.08)', color: 'var(--apple-purple)' }}>
                              Mention: {team.integrationOverrides.slackMentionGroup}
                            </span>
                          )}
                          {team.integrationOverrides?.jiraIssueType && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(10, 132, 255, 0.08)', color: 'var(--apple-blue)' }}>
                              Issue: {team.integrationOverrides.jiraIssueType}
                            </span>
                          )}
                          {team.integrationOverrides?.opsgenieTeamName && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255, 69, 58, 0.12)', color: 'var(--apple-red)' }}>
                              OpsGenie: {team.integrationOverrides.opsgenieTeamName}
                            </span>
                          )}
                          {team.integrationOverrides?.opsgeniePriority && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255, 69, 58, 0.08)', color: 'var(--apple-red)' }}>
                              Priority: {team.integrationOverrides.opsgeniePriority}
                            </span>
                          )}
                          {team.integrationOverrides?.pagerdutyEscalationPolicyId && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(48, 209, 88, 0.12)', color: 'var(--apple-green)' }}>
                              PD Policy: {team.integrationOverrides.pagerdutyEscalationPolicyId}
                            </span>
                          )}
                          {!team.integrationOverrides?.slackChannel && !team.integrationOverrides?.slackMentionGroup && !team.integrationOverrides?.jiraProjectKey && !team.integrationOverrides?.jiraIssueType && !team.integrationOverrides?.opsgenieTeamName && !team.integrationOverrides?.opsgeniePriority && !team.integrationOverrides?.pagerdutyEscalationPolicyId && (
                            <span className="text-[10px]" style={{ color: 'var(--apple-text-tertiary)' }}>Using org defaults</span>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setOverrideTeamId(team.id);
                            setOverrideSlackChannel(team.integrationOverrides?.slackChannel || '');
                            setOverrideSlackMention(team.integrationOverrides?.slackMentionGroup || '');
                            setOverrideJiraProject(team.integrationOverrides?.jiraProjectKey || '');
                            setOverrideJiraIssueType(team.integrationOverrides?.jiraIssueType || '');
                            setOverrideOpsgenieTeam(team.integrationOverrides?.opsgenieTeamName || '');
                            setOverrideOpsgeniePriority(team.integrationOverrides?.opsgeniePriority || '');
                            setOverridePdEscalation(team.integrationOverrides?.pagerdutyEscalationPolicyId || '');
                            setOverrideSaved(false);
                          }}
                          className="flex items-center gap-1 text-[10px] font-medium transition-all hover:opacity-70"
                          style={{ color: 'var(--apple-purple)' }}>
                          <Zap className="w-3 h-3" /> Routing
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Expandable>
      )}

      {/* User Management — admin password reset */}
      {canManageUsers && (
        <UserManagement teams={teams} allUsers={allUsers} onRefresh={refreshData} />
      )}

      {/* Notifications */}
      <Expandable title="Notifications" icon={<Bell className="w-[18px] h-[18px]" style={{ color: 'var(--apple-orange)', strokeWidth: 1.8 }} />}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium" style={{ color: 'var(--apple-text-primary)' }}>Critical Incident Alerts</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--apple-text-tertiary)' }}>Get notified when a critical incident is detected</p>
            </div>
            <button
              onClick={() => update('notifyOnCritical', !settings.notifyOnCritical)}
              className="w-[44px] h-[26px] rounded-full transition-all duration-200 relative"
              style={{ background: settings.notifyOnCritical ? 'var(--apple-green)' : 'var(--apple-surface-3)' }}>
              <div className="absolute top-[3px] w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200"
                style={{ left: settings.notifyOnCritical ? 20 : 3 }} />
            </button>
          </div>

          <div className="flex items-center justify-between" style={{ borderTop: '1px solid var(--apple-border)', paddingTop: 16 }}>
            <div>
              <p className="text-[13px] font-medium" style={{ color: 'var(--apple-text-primary)' }}>Escalation Alerts</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--apple-text-tertiary)' }}>Get notified when an incident is escalated</p>
            </div>
            <button
              onClick={() => update('notifyOnEscalation', !settings.notifyOnEscalation)}
              className="w-[44px] h-[26px] rounded-full transition-all duration-200 relative"
              style={{ background: settings.notifyOnEscalation ? 'var(--apple-green)' : 'var(--apple-surface-3)' }}>
              <div className="absolute top-[3px] w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200"
                style={{ left: settings.notifyOnEscalation ? 20 : 3 }} />
            </button>
          </div>
        </div>
      </Expandable>

      {/* Profile */}
      <Expandable title="Profile" icon={<User className="w-[18px] h-[18px]" style={{ color: 'var(--apple-green)', strokeWidth: 1.8 }} />}>
        <div className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium mb-2" style={{ color: 'var(--apple-text-primary)' }}>Display Name</label>
            {editingName ? (
              <div className="flex gap-2">
                <input
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && nameInput.trim()) {
                      setSavingName(true);
                      api.updateProfile({ displayName: nameInput.trim() }).then((u: any) => {
                        if (u && !u.error) { updateUser({ displayName: u.displayName }); }
                        setSavingName(false); setEditingName(false);
                      });
                    }
                    if (e.key === 'Escape') { setEditingName(false); setNameInput(user?.displayName || ''); }
                  }}
                  className="apple-input flex-1"
                  autoFocus
                />
                <button
                  disabled={!nameInput.trim() || savingName}
                  onClick={() => {
                    setSavingName(true);
                    api.updateProfile({ displayName: nameInput.trim() }).then((u: any) => {
                      if (u && !u.error) { updateUser({ displayName: u.displayName }); }
                      setSavingName(false); setEditingName(false);
                    });
                  }}
                  className="apple-btn apple-btn-primary text-[12px]"
                >{savingName ? 'Saving...' : 'Save'}</button>
                <button
                  onClick={() => { setEditingName(false); setNameInput(user?.displayName || ''); }}
                  className="apple-btn apple-btn-secondary text-[12px]"
                >Cancel</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-medium" style={{ color: 'var(--apple-text-primary)' }}>{user?.displayName}</span>
                <button onClick={() => { setNameInput(user?.displayName || ''); setEditingName(true); }}
                  className="p-1 rounded-[6px] transition-all hover:opacity-70" style={{ color: 'var(--apple-blue)' }} title="Edit display name">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
          <div style={{ borderTop: '1px solid var(--apple-border)', paddingTop: 16 }}>
            <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--apple-text-tertiary)' }}>Username</label>
            {editingUsername ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="flex items-center flex-1 gap-1">
                    <span className="text-[13px]" style={{ color: 'var(--apple-text-tertiary)' }}>@</span>
                    <input
                      value={usernameInput}
                      onChange={e => { setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')); setUsernameError(''); }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && usernameInput.trim().length >= 3) {
                          setSavingUsername(true); setUsernameError('');
                          api.updateProfile({ username: usernameInput.trim() }).then((u: any) => {
                            if (u?.error) { setUsernameError(u.error); setSavingUsername(false); return; }
                            updateUser({ username: u.username });
                            setSavingUsername(false); setEditingUsername(false);
                          });
                        }
                        if (e.key === 'Escape') { setEditingUsername(false); setUsernameInput(user?.username || ''); setUsernameError(''); }
                      }}
                      className="apple-input flex-1"
                      autoFocus
                    />
                  </div>
                  <button
                    disabled={!usernameInput.trim() || usernameInput.trim().length < 3 || savingUsername}
                    onClick={() => {
                      setSavingUsername(true); setUsernameError('');
                      api.updateProfile({ username: usernameInput.trim() }).then((u: any) => {
                        if (u?.error) { setUsernameError(u.error); setSavingUsername(false); return; }
                        updateUser({ username: u.username });
                        setSavingUsername(false); setEditingUsername(false);
                      });
                    }}
                    className="apple-btn apple-btn-primary text-[12px]"
                  >{savingUsername ? 'Saving...' : 'Save'}</button>
                  <button
                    onClick={() => { setEditingUsername(false); setUsernameInput(user?.username || ''); setUsernameError(''); }}
                    className="apple-btn apple-btn-secondary text-[12px]"
                  >Cancel</button>
                </div>
                {usernameError && <p className="text-[11px] font-medium" style={{ color: 'var(--apple-red)' }}>{usernameError}</p>}
                <p className="text-[10px]" style={{ color: 'var(--apple-text-tertiary)' }}>Lowercase letters, numbers, and underscores only. Min 3 characters.</p>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[13px]" style={{ color: 'var(--apple-text-secondary)' }}>@{user?.username}</span>
                <button onClick={() => { setUsernameInput(user?.username || ''); setUsernameError(''); setEditingUsername(true); }}
                  className="p-1 rounded-[6px] transition-all hover:opacity-70" style={{ color: 'var(--apple-blue)' }} title="Edit username">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
          <div style={{ borderTop: '1px solid var(--apple-border)', paddingTop: 16 }}>
            <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--apple-text-tertiary)' }}>Role</label>
            <span className="text-[13px] font-semibold capitalize" style={{
              color: user?.role === 'admin' ? 'var(--apple-purple)' : user?.role === 'responder' ? 'var(--apple-blue)' : 'var(--apple-text-secondary)',
            }}>{user?.role}</span>
          </div>
        </div>
      </Expandable>

      {/* Preferences */}
      <Expandable title="Preferences" icon={<Palette className="w-[18px] h-[18px]" style={{ color: 'var(--apple-blue)', strokeWidth: 1.8 }} />}>
        <div className="space-y-5">
          <div>
            <label className="block text-[13px] font-medium mb-2" style={{ color: 'var(--apple-text-primary)' }}>
              Auto-refresh Interval
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={5}
                max={60}
                step={5}
                value={settings.autoRefreshInterval}
                onChange={e => update('autoRefreshInterval', Number(e.target.value))}
                className="flex-1 accent-blue-500"
              />
              <span className="text-[13px] font-medium tabular-nums w-10 text-right" style={{ color: 'var(--apple-text-primary)' }}>
                {settings.autoRefreshInterval}s
              </span>
            </div>
            <p className="text-[11px] mt-1" style={{ color: 'var(--apple-text-tertiary)' }}>
              How often to poll for incident updates
            </p>
          </div>

          <div style={{ borderTop: '1px solid var(--apple-border)', paddingTop: 16 }}>
            <label className="block text-[13px] font-medium mb-2" style={{ color: 'var(--apple-text-primary)' }}>
              Theme
            </label>
            <div className="flex gap-2">
              {(['light', 'dark', 'system'] as const).map(t => (
                <button key={t}
                  onClick={() => update('theme', t)}
                  className="text-[12px] font-medium px-4 py-2 rounded-[8px] transition-all duration-150 capitalize"
                  style={{
                    background: settings.theme === t ? 'var(--apple-blue)' : 'var(--apple-surface-2)',
                    color: settings.theme === t ? 'white' : 'var(--apple-text-tertiary)',
                  }}>{t}</button>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--apple-border)', paddingTop: 16 }}>
            <label className="block text-[13px] font-medium mb-2" style={{ color: 'var(--apple-text-primary)' }}>
              Default Severity Filter
            </label>
            <div className="flex gap-2">
              {['all', 'critical', 'high', 'medium', 'low'].map(s => (
                <button key={s}
                  onClick={() => update('defaultSeverityFilter', s)}
                  className="text-[12px] font-medium px-3 py-1.5 rounded-[8px] transition-all duration-150 capitalize"
                  style={{
                    background: settings.defaultSeverityFilter === s ? 'var(--apple-surface-3)' : 'var(--apple-surface-2)',
                    color: settings.defaultSeverityFilter === s ? 'var(--apple-text-primary)' : 'var(--apple-text-tertiary)',
                    outline: settings.defaultSeverityFilter === s ? '1.5px solid var(--apple-blue)' : '1.5px solid transparent',
                    outlineOffset: '-1.5px',
                  }}>{s}</button>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--apple-border)', paddingTop: 16 }}>
            <label className="block text-[13px] font-medium mb-2" style={{ color: 'var(--apple-text-primary)' }}>
              Table Page Size
            </label>
            <div className="flex gap-2">
              {[6, 12, 24, 48, 96].map(n => (
                <button key={n}
                  onClick={() => update('tablePageSize', n)}
                  className="text-[12px] font-medium px-3 py-1.5 rounded-[8px] transition-all duration-150"
                  style={{
                    background: settings.tablePageSize === n ? 'var(--apple-surface-3)' : 'var(--apple-surface-2)',
                    color: settings.tablePageSize === n ? 'var(--apple-text-primary)' : 'var(--apple-text-tertiary)',
                    outline: settings.tablePageSize === n ? '1.5px solid var(--apple-blue)' : '1.5px solid transparent',
                    outlineOffset: '-1.5px',
                  }}>{n}</button>
              ))}
            </div>
          </div>
        </div>
      </Expandable>

      {/* Reset preferences */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-[13px] font-medium transition-all duration-200 hover:opacity-70"
          style={{ background: 'var(--apple-surface-2)', color: 'var(--apple-text-secondary)' }}>
          Reset Preferences to Defaults
        </button>
      </div>
    </div>
  );
}
