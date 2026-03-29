import React, { useState } from 'react';
import { Users, Link2, Rocket, ChevronRight, ChevronLeft, Plus, Trash2, SkipForward, Check, Layers } from 'lucide-react';
import { api } from '../api';

interface OnboardingProps {
  user: { id: string; displayName: string; role: string };
  onComplete: () => void;
}

type Step = 'welcome' | 'team' | 'members' | 'integrations' | 'done';
const STEPS: Step[] = ['welcome', 'team', 'members', 'integrations', 'done'];

export default function Onboarding({ user, onComplete }: OnboardingProps) {
  const [step, setStep] = useState<Step>('welcome');
  const stepIdx = STEPS.indexOf(step);

  // Team
  const [teamName, setTeamName] = useState('');
  const [teamDesc, setTeamDesc] = useState('');
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamError, setTeamError] = useState('');
  const [teamSaving, setTeamSaving] = useState(false);

  // Members
  const [members, setMembers] = useState<{ username: string; displayName: string; role: string }[]>([]);
  const [mUsername, setMUsername] = useState('');
  const [mDisplayName, setMDisplayName] = useState('');
  const [mRole, setMRole] = useState('responder');
  const [memberError, setMemberError] = useState('');
  const [membersSaving, setMembersSaving] = useState(false);
  const [createdMembers, setCreatedMembers] = useState<{ username: string; password: string }[]>([]);

  // Integrations
  const [slackWebhook, setSlackWebhook] = useState('');
  const [slackChannel, setSlackChannel] = useState('#incidents');
  const [pagerdutyKey, setPagerdutyKey] = useState('');
  const [intSaving, setIntSaving] = useState(false);

  const [finishing, setFinishing] = useState(false);

  const next = () => setStep(STEPS[Math.min(stepIdx + 1, STEPS.length - 1)]);
  const prev = () => setStep(STEPS[Math.max(stepIdx - 1, 0)]);
  const skip = () => next();

  const createTeam = async () => {
    if (!teamName.trim()) { setTeamError('Team name is required'); return; }
    setTeamSaving(true); setTeamError('');
    const res = await api.createTeam(teamName.trim(), teamDesc.trim());
    setTeamSaving(false);
    if (res?.error) { setTeamError(res.error); return; }
    setTeamId(res.id);
    next();
  };

  const addMember = () => {
    if (!mUsername.trim() || !mDisplayName.trim()) { setMemberError('Username and display name required'); return; }
    if (members.some(m => m.username === mUsername.trim())) { setMemberError('Username already added'); return; }
    setMembers(prev => [...prev, { username: mUsername.trim(), displayName: mDisplayName.trim(), role: mRole }]);
    setMUsername(''); setMDisplayName(''); setMRole('responder'); setMemberError('');
  };

  const removeMember = (username: string) => setMembers(prev => prev.filter(m => m.username !== username));

  const createMembers = async () => {
    if (members.length === 0) { next(); return; }
    setMembersSaving(true); setMemberError('');
    const created: { username: string; password: string }[] = [];
    for (const m of members) {
      const res = await api.createUser({ username: m.username, displayName: m.displayName, role: m.role, teamId: teamId || undefined });
      if (res?.error) { setMemberError(`Failed to create ${m.username}: ${res.error}`); setMembersSaving(false); return; }
      created.push({ username: m.username, password: res.initialPassword });
    }
    setCreatedMembers(created);
    setMembersSaving(false);
    next();
  };

  const saveIntegrations = async () => {
    setIntSaving(true);
    if (slackWebhook.trim()) {
      await api.updateIntegrationSettings({
        slack: { webhookUrl: slackWebhook.trim(), channel: slackChannel.trim() || '#incidents', enabled: true },
      });
    }
    setIntSaving(false);
    next();
  };

  const finish = async () => {
    setFinishing(true);
    await api.updateProfile({ onboardingComplete: true });
    setFinishing(false);
    onComplete();
  };

  const progressPct = ((stepIdx) / (STEPS.length - 1)) * 100;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: 'var(--apple-bg)' }}>
      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: 'var(--apple-surface-2)' }}>
        <div className="h-full transition-all duration-500 ease-out" style={{ width: `${progressPct}%`, background: 'var(--apple-blue)' }} />
      </div>

      <div className="w-full max-w-lg mx-4">
        {/* Welcome */}
        {step === 'welcome' && (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 rounded-[18px] flex items-center justify-center mx-auto" style={{ background: 'rgba(255, 159, 10, 0.15)' }}>
              <Layers className="w-8 h-8" style={{ color: 'var(--apple-orange)' }} />
            </div>
            <div>
              <h1 className="text-[28px] font-bold tracking-tight" style={{ color: 'var(--apple-text-primary)' }}>
                Welcome, {user.displayName}!
              </h1>
              <p className="text-[15px] mt-2 max-w-sm mx-auto" style={{ color: 'var(--apple-text-tertiary)' }}>
                Let's get your workspace set up in a few quick steps. You can always change these later in Settings.
              </p>
            </div>
            <div className="flex flex-col gap-3 max-w-xs mx-auto">
              <button onClick={next} className="apple-btn apple-btn-primary flex items-center justify-center gap-2 py-3">
                Get Started <ChevronRight className="w-4 h-4" />
              </button>
              <button onClick={finish} className="text-[13px] font-medium transition-all hover:opacity-70" style={{ color: 'var(--apple-text-tertiary)' }}>
                Skip setup, I'll do it later
              </button>
            </div>
          </div>
        )}

        {/* Create Team */}
        {step === 'team' && (
          <div className="space-y-6">
            <StepHeader icon={<Users className="w-6 h-6" style={{ color: 'var(--apple-teal)' }} />}
              title="Create Your Team" subtitle="A team lets you organize members and manage incidents together." step={1} total={3} />
            <div className="space-y-3">
              <div>
                <label className="text-[12px] font-medium mb-1 block" style={{ color: 'var(--apple-text-secondary)' }}>Team Name</label>
                <input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="e.g. Platform Engineering"
                  className="apple-input w-full" autoFocus onKeyDown={e => e.key === 'Enter' && createTeam()} />
              </div>
              <div>
                <label className="text-[12px] font-medium mb-1 block" style={{ color: 'var(--apple-text-secondary)' }}>Description <span style={{ color: 'var(--apple-text-tertiary)' }}>(optional)</span></label>
                <input value={teamDesc} onChange={e => setTeamDesc(e.target.value)} placeholder="What does this team do?"
                  className="apple-input w-full" />
              </div>
              {teamError && <p className="text-[12px] font-medium" style={{ color: 'var(--apple-red)' }}>{teamError}</p>}
            </div>
            <StepFooter onBack={prev} onNext={createTeam} onSkip={() => { setTeamId(null); setStep('integrations'); }}
              nextLabel={teamSaving ? 'Creating...' : 'Create Team'} nextDisabled={!teamName.trim() || teamSaving} />
          </div>
        )}

        {/* Add Members */}
        {step === 'members' && (
          <div className="space-y-6">
            <StepHeader icon={<Plus className="w-6 h-6" style={{ color: 'var(--apple-green)' }} />}
              title="Add Team Members" subtitle="Create accounts for your teammates. They'll set their own passwords on first login." step={2} total={3} />
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--apple-text-secondary)' }}>Display Name</label>
                  <input value={mDisplayName} onChange={e => setMDisplayName(e.target.value)} placeholder="Jane Doe" className="apple-input w-full text-[12px]" />
                </div>
                <div className="col-span-1">
                  <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--apple-text-secondary)' }}>Username</label>
                  <input value={mUsername} onChange={e => setMUsername(e.target.value)} placeholder="janedoe" className="apple-input w-full text-[12px]"
                    onKeyDown={e => e.key === 'Enter' && addMember()} />
                </div>
                <div className="col-span-1">
                  <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--apple-text-secondary)' }}>Role</label>
                  <div className="flex gap-1.5">
                    <select value={mRole} onChange={e => setMRole(e.target.value)} className="apple-input flex-1 text-[12px]">
                      <option value="admin">Admin</option>
                      <option value="responder">Responder</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button onClick={addMember} className="px-2.5 rounded-[8px] transition-all hover:opacity-80 shrink-0"
                      style={{ background: 'var(--apple-blue)', color: 'white' }}><Plus className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
              {memberError && <p className="text-[11px] font-medium" style={{ color: 'var(--apple-red)' }}>{memberError}</p>}
              {members.length > 0 && (
                <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                  {members.map(m => (
                    <div key={m.username} className="flex items-center justify-between px-3 py-2 rounded-[8px]" style={{ background: 'var(--apple-surface-2)' }}>
                      <div>
                        <span className="text-[13px] font-medium" style={{ color: 'var(--apple-text-primary)' }}>{m.displayName}</span>
                        <span className="text-[11px] ml-2" style={{ color: 'var(--apple-text-tertiary)' }}>@{m.username} · {m.role}</span>
                      </div>
                      <button onClick={() => removeMember(m.username)} className="p-1 rounded-[4px] transition-all hover:opacity-70" style={{ color: 'var(--apple-red)' }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {members.length === 0 && (
                <p className="text-[12px] text-center py-4" style={{ color: 'var(--apple-text-tertiary)' }}>No members added yet. You can always add members later from Settings.</p>
              )}
            </div>
            <StepFooter onBack={prev} onNext={createMembers} onSkip={skip}
              nextLabel={membersSaving ? 'Creating accounts...' : members.length > 0 ? `Create ${members.length} Account${members.length > 1 ? 's' : ''}` : 'Continue'}
              nextDisabled={membersSaving} />
          </div>
        )}

        {/* Integrations */}
        {step === 'integrations' && (
          <div className="space-y-6">
            <StepHeader icon={<Link2 className="w-6 h-6" style={{ color: 'var(--apple-purple)' }} />}
              title="Connect Integrations" subtitle="Connect your tools for seamless incident management. All optional." step={3} total={3} />
            <div className="space-y-4">
              <div className="p-4 rounded-[10px] space-y-2" style={{ background: 'var(--apple-surface-1)', border: '1px solid var(--apple-border)' }}>
                <p className="text-[13px] font-semibold" style={{ color: 'var(--apple-text-primary)' }}>Slack</p>
                <div>
                  <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--apple-text-secondary)' }}>Webhook URL</label>
                  <input value={slackWebhook} onChange={e => setSlackWebhook(e.target.value)} placeholder="https://hooks.slack.com/services/..."
                    className="apple-input w-full text-[12px]" />
                </div>
                <div>
                  <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--apple-text-secondary)' }}>Channel</label>
                  <input value={slackChannel} onChange={e => setSlackChannel(e.target.value)} placeholder="#incidents"
                    className="apple-input w-full text-[12px]" />
                </div>
              </div>
              <div className="p-4 rounded-[10px] space-y-2" style={{ background: 'var(--apple-surface-1)', border: '1px solid var(--apple-border)' }}>
                <p className="text-[13px] font-semibold" style={{ color: 'var(--apple-text-primary)' }}>PagerDuty</p>
                <div>
                  <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--apple-text-secondary)' }}>Routing Key</label>
                  <input value={pagerdutyKey} onChange={e => setPagerdutyKey(e.target.value)} placeholder="Integration key..."
                    className="apple-input w-full text-[12px]" />
                </div>
              </div>
            </div>
            <StepFooter onBack={prev} onNext={saveIntegrations} onSkip={skip}
              nextLabel={intSaving ? 'Saving...' : 'Save & Continue'} nextDisabled={intSaving} />
          </div>
        )}

        {/* Done */}
        {step === 'done' && (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: 'rgba(52, 199, 89, 0.15)' }}>
              <Rocket className="w-8 h-8" style={{ color: 'var(--apple-green)' }} />
            </div>
            <div>
              <h1 className="text-[24px] font-bold tracking-tight" style={{ color: 'var(--apple-text-primary)' }}>You're All Set!</h1>
              <p className="text-[14px] mt-2" style={{ color: 'var(--apple-text-tertiary)' }}>
                Your workspace is ready. You can always update these settings later.
              </p>
            </div>
            {createdMembers.length > 0 && (
              <div className="text-left p-4 rounded-[10px] space-y-2" style={{ background: 'var(--apple-surface-1)', border: '1px solid var(--apple-border)' }}>
                <p className="text-[12px] font-semibold" style={{ color: 'var(--apple-text-primary)' }}>Share these credentials with your team:</p>
                <div className="space-y-1 max-h-[150px] overflow-y-auto">
                  {createdMembers.map(m => (
                    <div key={m.username} className="flex items-center justify-between text-[11px] px-2 py-1.5 rounded-[6px]" style={{ background: 'var(--apple-surface-2)' }}>
                      <span style={{ color: 'var(--apple-text-secondary)' }}>@{m.username}</span>
                      <code className="font-mono" style={{ color: 'var(--apple-green)' }}>{m.password}</code>
                    </div>
                  ))}
                </div>
                <button onClick={() => {
                  const text = createdMembers.map(m => `Username: ${m.username}\nPassword: ${m.password}`).join('\n\n');
                  navigator.clipboard.writeText(text);
                }} className="text-[11px] font-medium transition-all hover:opacity-70" style={{ color: 'var(--apple-blue)' }}>
                  Copy all credentials
                </button>
              </div>
            )}
            <button onClick={finish} disabled={finishing}
              className="apple-btn apple-btn-primary flex items-center justify-center gap-2 py-3 mx-auto px-8">
              {finishing ? 'Finishing...' : 'Go to Dashboard'} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StepHeader({ icon, title, subtitle, step, total }: { icon: React.ReactNode; title: string; subtitle: string; step: number; total: number }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 rounded-[12px] flex items-center justify-center" style={{ background: 'var(--apple-surface-2)' }}>{icon}</div>
        <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--apple-text-tertiary)' }}>Step {step} of {total}</span>
      </div>
      <div>
        <h2 className="text-[22px] font-bold tracking-tight" style={{ color: 'var(--apple-text-primary)' }}>{title}</h2>
        <p className="text-[13px] mt-1" style={{ color: 'var(--apple-text-tertiary)' }}>{subtitle}</p>
      </div>
    </div>
  );
}

function StepFooter({ onBack, onNext, onSkip, nextLabel, nextDisabled }: {
  onBack: () => void; onNext: () => void; onSkip: () => void; nextLabel: string; nextDisabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between pt-2">
      <button onClick={onBack} className="flex items-center gap-1 text-[13px] font-medium transition-all hover:opacity-70" style={{ color: 'var(--apple-text-tertiary)' }}>
        <ChevronLeft className="w-4 h-4" /> Back
      </button>
      <div className="flex items-center gap-3">
        <button onClick={onSkip} className="flex items-center gap-1 text-[13px] font-medium transition-all hover:opacity-70" style={{ color: 'var(--apple-text-tertiary)' }}>
          Skip <SkipForward className="w-3.5 h-3.5" />
        </button>
        <button onClick={onNext} disabled={nextDisabled}
          className="apple-btn apple-btn-primary flex items-center gap-1.5 text-[13px] disabled:opacity-30">
          {nextLabel} <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
