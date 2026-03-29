import React, { useState } from 'react';
import { KeyRound, UserPlus, Check, Copy, Trash2 } from 'lucide-react';
import Expandable from '../Expandable';
import { useAuth } from '../../useAuth';
import { api } from '../../api';
import type { User, Team, Permission } from '../../types';

interface Props {
  teams: Team[];
  allUsers: User[];
  onRefresh: () => void;
}

export default function UserManagement({ teams, allUsers: externalUsers, onRefresh }: Props) {
  const { user } = useAuth();

  // Password reset
  const [resetResult, setResetResult] = useState<{ userId: string; tempPassword: string } | null>(null);
  const [resetCopied, setResetCopied] = useState(false);

  // Create user
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<string>('responder');
  const [newTeamId, setNewTeamId] = useState('');
  const [createResult, setCreateResult] = useState<{ username: string; password: string } | null>(null);
  const [createCopied, setCreateCopied] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSaving, setCreateSaving] = useState(false);
  const [customPermissions, setCustomPermissions] = useState<string[]>([]);

  // Local copy of allUsers for inline updates
  const [allUsers, setAllUsers] = useState(externalUsers);
  React.useEffect(() => setAllUsers(externalUsers), [externalUsers]);

  const PERMISSIONS = [
    { key: 'incidents:view', label: 'View incidents' },
    { key: 'incidents:acknowledge', label: 'Acknowledge incidents' },
    { key: 'incidents:resolve', label: 'Resolve incidents' },
    { key: 'incidents:assign', label: 'Assign incidents' },
    { key: 'incidents:escalate', label: 'Escalate incidents' },
    { key: 'incidents:create', label: 'Create incidents' },
    { key: 'runbooks:view', label: 'View runbooks' },
    { key: 'runbooks:manage', label: 'Manage runbooks' },
    { key: 'analytics:view', label: 'View analytics' },
    { key: 'teams:view', label: 'View teams' },
    { key: 'teams:manage', label: 'Manage teams' },
    { key: 'users:view', label: 'View users' },
    { key: 'users:manage', label: 'Manage users' },
    { key: 'integrations:view', label: 'View integrations' },
    { key: 'integrations:manage', label: 'Manage integrations' },
    { key: 'audit:view', label: 'View audit log' },
    { key: 'settings:manage', label: 'Manage settings' },
  ];

  return (
    <Expandable title="User Management" icon={<KeyRound className="w-[18px] h-[18px]" style={{ color: 'var(--apple-orange)', strokeWidth: 1.8 }} />}>
      <div className="space-y-3">
        <p className="text-[12px]" style={{ color: 'var(--apple-text-tertiary)' }}>Reset a user's password. A temporary password will be generated — share it with the user. They will be required to set a new password on next login.</p>
        {/* Create User */}
        {!showCreateUser && !createResult ? (
          <button
            onClick={() => { setShowCreateUser(true); setCreateError(''); setNewTeamId(teams[0]?.id || ''); }}
            className="flex items-center gap-1.5 text-[12px] font-semibold transition-all hover:opacity-80 px-3 py-2 rounded-[8px]"
            style={{ background: 'var(--apple-blue)', color: 'white' }}>
            <UserPlus className="w-3.5 h-3.5" /> Create User
          </button>
        ) : createResult ? (
          <div className="p-4 rounded-[10px] space-y-3" style={{ background: 'var(--apple-surface-2)', border: '1px solid var(--apple-border)' }}>
            <p className="text-[13px] font-semibold" style={{ color: 'var(--apple-green)' }}>User created! Share these credentials:</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium w-[70px]" style={{ color: 'var(--apple-text-tertiary)' }}>Username</span>
                <code className="text-[12px] font-mono px-2 py-0.5 rounded-[4px]" style={{ background: 'var(--apple-surface-3)', color: 'var(--apple-text-primary)' }}>{createResult.username}</code>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium w-[70px]" style={{ color: 'var(--apple-text-tertiary)' }}>Password</span>
                <code className="text-[12px] font-mono px-2 py-0.5 rounded-[4px]" style={{ background: 'var(--apple-surface-3)', color: 'var(--apple-green)' }}>{createResult.password}</code>
                <button
                  onClick={() => { navigator.clipboard.writeText(`Username: ${createResult.username}\nPassword: ${createResult.password}`); setCreateCopied(true); setTimeout(() => setCreateCopied(false), 2000); }}
                  className="p-1 rounded-[4px] transition-all hover:opacity-70"
                  style={{ color: createCopied ? 'var(--apple-green)' : 'var(--apple-blue)' }}
                  title="Copy credentials">
                  {createCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--apple-text-tertiary)' }}>The user will be asked to change their password on first login.</p>
            <button onClick={() => { setCreateResult(null); setShowCreateUser(false); }} className="text-[11px] font-medium px-3 py-1.5 rounded-[6px] transition-all hover:opacity-70" style={{ background: 'var(--apple-surface-3)', color: 'var(--apple-text-secondary)' }}>Done</button>
          </div>
        ) : (
          <div className="p-4 rounded-[10px] space-y-3" style={{ background: 'var(--apple-surface-2)', border: '1px solid var(--apple-border)' }}>
            <p className="text-[13px] font-semibold" style={{ color: 'var(--apple-text-primary)' }}>Create a new user</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--apple-text-secondary)' }}>Display Name</label>
                <input value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)} placeholder="John Doe" className="apple-input w-full text-[12px]" />
              </div>
              <div>
                <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--apple-text-secondary)' }}>Username</label>
                <input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="johndoe" className="apple-input w-full text-[12px]" />
              </div>
              <div>
                <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--apple-text-secondary)' }}>Email <span style={{ color: 'var(--apple-text-tertiary)' }}>(optional)</span></label>
                <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="john@example.com" className="apple-input w-full text-[12px]" />
              </div>
              <div>
                <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--apple-text-secondary)' }}>Role</label>
                <select value={newRole} onChange={e => { setNewRole(e.target.value); if (e.target.value !== 'custom') setCustomPermissions([]); }} className="apple-input w-full text-[12px]">
                  <option value="admin">Admin</option>
                  <option value="responder">Responder</option>
                  <option value="viewer">Viewer</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>
            {newRole === 'custom' && (
              <div>
                <label className="text-[11px] font-medium mb-1.5 block" style={{ color: 'var(--apple-text-secondary)' }}>Permissions</label>
                <div className="grid grid-cols-2 gap-1">
                  {PERMISSIONS.filter(p => p.key !== 'settings:manage').map(p => (
                    <label key={p.key} className="flex items-center gap-1.5 text-[11px] cursor-pointer py-0.5" style={{ color: 'var(--apple-text-secondary)' }}>
                      <input type="checkbox" checked={customPermissions.includes(p.key)}
                        onChange={e => {
                          if (e.target.checked) setCustomPermissions(prev => [...prev, p.key]);
                          else setCustomPermissions(prev => prev.filter(x => x !== p.key));
                        }}
                        className="rounded" style={{ accentColor: 'var(--apple-blue)' }} />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--apple-text-secondary)' }}>Add to Team</label>
              <select value={newTeamId} onChange={e => setNewTeamId(e.target.value)} className="apple-input w-full text-[12px]">
                <option value="">No team</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            {createError && <p className="text-[11px] font-medium" style={{ color: 'var(--apple-red)' }}>{createError}</p>}
            <div className="flex gap-2">
              <button
                disabled={createSaving || !newUsername || !newDisplayName}
                onClick={async () => {
                  setCreateSaving(true); setCreateError('');
                  const res = await api.createUser({ username: newUsername, displayName: newDisplayName, role: newRole, email: newEmail || undefined, teamId: newTeamId || undefined, permissions: newRole === 'custom' ? customPermissions : undefined });
                  setCreateSaving(false);
                  if (res?.error) { setCreateError(res.error); return; }
                  setCreateResult({ username: newUsername, password: res.initialPassword });
                  onRefresh();
                  setNewUsername(''); setNewDisplayName(''); setNewEmail(''); setNewRole('responder'); setNewTeamId('');
                }}
                className="px-3 py-1.5 rounded-[6px] text-[12px] font-semibold transition-all hover:opacity-90 disabled:opacity-30"
                style={{ background: 'var(--apple-blue)', color: 'white' }}>
                {createSaving ? 'Creating...' : 'Create'}
              </button>
              <button onClick={() => { setShowCreateUser(false); setCreateError(''); }} className="px-3 py-1.5 rounded-[6px] text-[12px] font-medium transition-all hover:opacity-70" style={{ background: 'var(--apple-surface-3)', color: 'var(--apple-text-secondary)' }}>Cancel</button>
            </div>
          </div>
        )}

        {allUsers.filter((u) => u.id !== user?.id).map((u) => {
          const userTeams = teams.filter((t) => (t.members || []).some((m) => m.userId === u.id));
          return (
          <div key={u.id} className="p-3 rounded-[10px] space-y-2" style={{ background: 'var(--apple-surface-2)' }}>
            <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold" style={{ background: 'var(--apple-surface-3)', color: 'var(--apple-text-secondary)' }}>
                {u.displayName?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div>
                <p className="text-[13px] font-medium" style={{ color: 'var(--apple-text-primary)' }}>{u.displayName}</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px]" style={{ color: 'var(--apple-text-tertiary)' }}>@{u.username} · </span>
                  <select
                    value={u.role}
                    onChange={async (e) => {
                      const role = e.target.value;
                      if (role === 'custom') {
                        const res = await api.updateUserRole(u.id, role, u.permissions || []);
                        if (res && !res.error) setAllUsers(prev => prev.map((x) => x.id === u.id ? { ...x, role: role as User['role'], permissions: res.permissions as Permission[] || [] } : x));
                      } else {
                        const res = await api.updateUserRole(u.id, role);
                        if (res && !res.error) setAllUsers(prev => prev.map((x) => x.id === u.id ? { ...x, role: role as User['role'], permissions: undefined } : x));
                      }
                    }}
                    className="text-[11px] font-semibold bg-transparent border-none outline-none cursor-pointer capitalize"
                    style={{ color: u.role === 'admin' ? 'var(--apple-purple)' : u.role === 'responder' ? 'var(--apple-blue)' : u.role === 'custom' ? 'var(--apple-teal)' : 'var(--apple-text-tertiary)' }}
                  >
                    <option value="viewer">viewer</option>
                    <option value="responder">responder</option>
                    <option value="admin">admin</option>
                    <option value="custom">custom</option>
                  </select>
                  {userTeams.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(48, 209, 88, 0.12)', color: 'var(--apple-green)' }}>
                      {userTeams.map((t) => t.name).join(', ')}
                    </span>
                  )}
                  {userTeams.length === 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--apple-surface-3)', color: 'var(--apple-text-tertiary)' }}>
                      No team
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {resetResult?.userId === u.id ? (
                <div className="flex items-center gap-2">
                  <code className="text-[12px] font-mono px-2 py-1 rounded-[6px]" style={{ background: 'var(--apple-surface-3)', color: 'var(--apple-green)' }}>
                    {resetResult!.tempPassword}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(resetResult!.tempPassword);
                      setResetCopied(true);
                      setTimeout(() => setResetCopied(false), 2000);
                    }}
                    className="p-1.5 rounded-[6px] transition-all hover:opacity-70"
                    style={{ color: resetCopied ? 'var(--apple-green)' : 'var(--apple-blue)' }}
                    title="Copy password">
                    {resetCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => setResetResult(null)}
                    className="text-[11px] font-medium px-2 py-1 rounded-[6px] transition-all hover:opacity-70"
                    style={{ background: 'var(--apple-surface-3)', color: 'var(--apple-text-tertiary)' }}>
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={async () => {
                      const res = await api.resetUserPassword(u.id);
                      if (res?.tempPassword) {
                        setResetResult({ userId: u.id, tempPassword: res.tempPassword });
                        setResetCopied(false);
                      }
                    }}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-[6px] transition-all hover:opacity-80"
                    style={{ background: 'rgba(255, 159, 10, 0.12)', color: 'var(--apple-orange)' }}>
                    Reset Password
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete user "${u.displayName}" (@${u.username})? This cannot be undone.`)) return;
                      const res = await api.deleteUser(u.id);
                      if (res && !res.error) {
                        setAllUsers(prev => prev.filter(x => x.id !== u.id));
                        onRefresh();
                      }
                    }}
                    className="p-1.5 rounded-[6px] transition-all hover:opacity-70"
                    style={{ color: 'var(--apple-red)' }}
                    title="Delete user">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
            </div>
            {u.role === 'custom' && (
              <div className="pt-1">
                <p className="text-[11px] font-medium mb-1.5" style={{ color: 'var(--apple-text-secondary)' }}>Permissions</p>
                <div className="grid grid-cols-2 gap-1">
                  {PERMISSIONS.map(p => (
                    <label key={p.key} className="flex items-center gap-1.5 text-[11px] cursor-pointer py-0.5" style={{ color: 'var(--apple-text-secondary)' }}>
                      <input type="checkbox" checked={(u.permissions || []).includes(p.key as Permission)}
                        onChange={async (e) => {
                          const newPerms = e.target.checked
                            ? [...(u.permissions || []), p.key as Permission]
                            : (u.permissions || []).filter((x) => x !== p.key);
                          const res = await api.updateUserRole(u.id, 'custom', newPerms);
                          if (res && !res.error) setAllUsers(prev => prev.map((x) => x.id === u.id ? { ...x, permissions: newPerms } : x));
                        }}
                        className="rounded" style={{ accentColor: 'var(--apple-teal)' }} />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          );
        })}
      </div>
    </Expandable>
  );
}
