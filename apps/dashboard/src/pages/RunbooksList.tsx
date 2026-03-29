import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Clock, Layers, Plus, Trash2, X } from 'lucide-react';
import { api } from '../api';
import { useSettings } from '../useSettings';
import { useAuth } from '../useAuth';
import type { Runbook } from '../types';

export default function RunbooksList() {
  const [runbooks, setRunbooks] = React.useState<Runbook[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [catFilter, setCatFilter] = React.useState<string | null>(null);
  const [tagFilter, setTagFilter] = React.useState<string | null>(null);
  const [rbPage, setRbPage] = React.useState(0);
  const { settings } = useSettings();
  const { hasPerm } = useAuth();
  const canManageRunbooks = hasPerm('runbooks:manage');
  const navigate = useNavigate();

  // Create runbook state
  const [showCreate, setShowCreate] = React.useState(false);
  const [rbName, setRbName] = React.useState('');
  const [rbDesc, setRbDesc] = React.useState('');
  const [rbCategory, setRbCategory] = React.useState('');
  const [rbTags, setRbTags] = React.useState('');
  const [rbTime, setRbTime] = React.useState(15);
  const [rbSteps, setRbSteps] = React.useState<{ title: string; description: string; command: string; expectedOutcome: string; isAutomatable: boolean }[]>([{ title: '', description: '', command: '', expectedOutcome: '', isAutomatable: false }]);
  const [rbSaving, setRbSaving] = React.useState(false);
  const [rbError, setRbError] = React.useState('');

  const resetForm = () => { setRbName(''); setRbDesc(''); setRbCategory(''); setRbTags(''); setRbTime(15); setRbSteps([{ title: '', description: '', command: '', expectedOutcome: '', isAutomatable: false }]); setRbError(''); };

  const handleCreate = async () => {
    if (!rbName.trim() || !rbCategory.trim()) { setRbError('Name and category are required'); return; }
    const validSteps = rbSteps.filter(s => s.title.trim());
    if (validSteps.length === 0) { setRbError('At least one step with a title is required'); return; }
    setRbSaving(true); setRbError('');
    const res = await api.createRunbook({
      name: rbName.trim(), description: rbDesc.trim(), category: rbCategory.trim(),
      tags: rbTags.split(',').map(t => t.trim()).filter(Boolean),
      estimatedTimeMinutes: rbTime,
      steps: validSteps.map((s, i) => ({ ...s, order: i, title: s.title.trim(), description: s.description.trim(), command: s.command.trim(), expectedOutcome: s.expectedOutcome.trim() })),
    });
    setRbSaving(false);
    if (res?.error) { setRbError(res.error); return; }
    setRunbooks(prev => [res, ...prev]);
    resetForm(); setShowCreate(false);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this runbook?')) return;
    await api.deleteRunbook(id);
    setRunbooks(prev => prev.filter(r => r.id !== id));
  };

  const addStep = () => setRbSteps(prev => [...prev, { title: '', description: '', command: '', expectedOutcome: '', isAutomatable: false }]);
  const removeStep = (idx: number) => setRbSteps(prev => prev.filter((_, i) => i !== idx));
  const updateStep = (idx: number, field: string, value: string | boolean) => setRbSteps(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));

  React.useEffect(() => {
    import('../api').then(({ api }) =>
      api.listRunbooks().then((data: { runbooks?: Runbook[] }) => {
        setRunbooks(data.runbooks || []);
        setLoading(false);
      })
    );
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-full" style={{ color: 'var(--apple-text-tertiary)' }}>
      <div className="w-5 h-5 border-2 rounded-full animate-spin mr-3" style={{ borderColor: 'var(--apple-surface-3)', borderTopColor: 'var(--apple-blue)' }} />
      Loading runbooks...
    </div>
  );

  if (!runbooks.length && !showCreate) return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--apple-surface-1)' }}>
        <BookOpen className="w-7 h-7" style={{ color: 'var(--apple-text-tertiary)', strokeWidth: 1.5 }} />
      </div>
      <p className="text-[17px] font-semibold tracking-tight" style={{ color: 'var(--apple-text-primary)' }}>No runbooks yet</p>
      <p className="text-[13px] mt-1 mb-4" style={{ color: 'var(--apple-text-tertiary)' }}>Create your first runbook or seed demo data</p>
      {canManageRunbooks && <button onClick={() => setShowCreate(true)} className="apple-btn apple-btn-primary flex items-center gap-1.5 text-[13px]"><Plus className="w-4 h-4" /> Create Runbook</button>}
    </div>
  );

  const hasFilter = catFilter || tagFilter;

  // Cross-filter: categories from tag-filtered, tags from category-filtered
  const forCat = runbooks.filter((rb) => !tagFilter || rb.tags?.includes(tagFilter));
  const forTag = runbooks.filter((rb) => !catFilter || rb.category === catFilter);
  const categories = Array.from(new Set(forCat.map((rb) => rb.category)));
  const allTags = Array.from(new Set(forTag.flatMap((rb) => rb.tags || []))).sort();

  const filtered = runbooks
    .filter((rb) => !catFilter || rb.category === catFilter)
    .filter((rb) => !tagFilter || rb.tags?.includes(tagFilter));

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="apple-title">Runbooks</h1>
        <p className="apple-subtitle">Pre-defined remediation procedures auto-matched to incidents.</p>
      </div>

      {/* Floating create button */}
      {canManageRunbooks && !showCreate && (
        <button onClick={() => { resetForm(); setShowCreate(true); }}
          className="fixed bottom-8 right-8 z-30 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
          style={{ background: 'var(--apple-blue)', color: 'white', boxShadow: '0 4px 20px rgba(10, 132, 255, 0.4)' }}
          title="Create Runbook">
          <Plus className="w-6 h-6" strokeWidth={2.5} />
        </button>
      )}

      {/* Create Runbook Form */}
      {showCreate && (
        <div className="apple-card mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-semibold" style={{ color: 'var(--apple-text-primary)' }}>New Runbook</h3>
            <button onClick={() => setShowCreate(false)} className="p-1 rounded-[6px] transition-all hover:opacity-70" style={{ color: 'var(--apple-text-tertiary)' }}><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--apple-text-secondary)' }}>Name</label>
              <input value={rbName} onChange={e => setRbName(e.target.value)} placeholder="e.g. Database Recovery" className="apple-input w-full text-[12px]" autoFocus />
            </div>
            <div>
              <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--apple-text-secondary)' }}>Category</label>
              <input value={rbCategory} onChange={e => setRbCategory(e.target.value)} placeholder="e.g. database, networking" className="apple-input w-full text-[12px]" />
            </div>
            <div className="col-span-2">
              <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--apple-text-secondary)' }}>Description</label>
              <input value={rbDesc} onChange={e => setRbDesc(e.target.value)} placeholder="What does this runbook address?" className="apple-input w-full text-[12px]" />
            </div>
            <div>
              <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--apple-text-secondary)' }}>Tags <span style={{ color: 'var(--apple-text-tertiary)' }}>(comma-separated)</span></label>
              <input value={rbTags} onChange={e => setRbTags(e.target.value)} placeholder="postgres, failover, backup" className="apple-input w-full text-[12px]" />
            </div>
            <div>
              <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--apple-text-secondary)' }}>Est. Time (min)</label>
              <input type="number" value={rbTime} onChange={e => setRbTime(Number(e.target.value) || 15)} min={1} className="apple-input w-full text-[12px]" />
            </div>
          </div>

          {/* Steps Builder */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-medium" style={{ color: 'var(--apple-text-secondary)' }}>Steps</label>
              <button onClick={addStep} className="text-[11px] font-medium flex items-center gap-1 transition-all hover:opacity-70" style={{ color: 'var(--apple-blue)' }}><Plus className="w-3 h-3" /> Add Step</button>
            </div>
            <div className="space-y-2">
              {rbSteps.map((step, idx) => (
                <div key={idx} className="p-3 rounded-[10px] space-y-2" style={{ background: 'var(--apple-surface-2)', border: '1px solid var(--apple-border)' }}>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: 'var(--apple-surface-3)', color: 'var(--apple-text-secondary)' }}>{idx + 1}</span>
                    <input value={step.title} onChange={e => updateStep(idx, 'title', e.target.value)} placeholder="Step title" className="apple-input flex-1 text-[12px]" />
                    {rbSteps.length > 1 && <button onClick={() => removeStep(idx)} className="p-1 rounded-[4px] transition-all hover:opacity-70" style={{ color: 'var(--apple-red)' }}><Trash2 className="w-3.5 h-3.5" /></button>}
                  </div>
                  <input value={step.description} onChange={e => updateStep(idx, 'description', e.target.value)} placeholder="Description (optional)" className="apple-input w-full text-[11px]" />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={step.command} onChange={e => updateStep(idx, 'command', e.target.value)} placeholder="Command (optional)" className="apple-input w-full text-[11px] font-mono" />
                    <input value={step.expectedOutcome} onChange={e => updateStep(idx, 'expectedOutcome', e.target.value)} placeholder="Expected outcome (optional)" className="apple-input w-full text-[11px]" />
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={step.isAutomatable} onChange={e => updateStep(idx, 'isAutomatable', e.target.checked)} className="rounded" />
                    <span className="text-[11px]" style={{ color: 'var(--apple-text-tertiary)' }}>Automatable</span>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {rbError && <p className="text-[11px] font-medium" style={{ color: 'var(--apple-red)' }}>{rbError}</p>}
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={rbSaving || !rbName.trim() || !rbCategory.trim()}
              className="apple-btn apple-btn-primary text-[12px] disabled:opacity-30">{rbSaving ? 'Creating...' : 'Create Runbook'}</button>
            <button onClick={() => setShowCreate(false)} className="apple-btn apple-btn-secondary text-[12px]">Cancel</button>
          </div>
        </div>
      )}

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-1.5 mb-6">
        {categories.map((c) => {
          const active = catFilter === c;
          return (
            <button key={c} onClick={() => setCatFilter(active ? null : c)}
              className="text-[11px] font-medium px-2.5 py-1 rounded-full transition-all duration-150"
              style={{
                background: active ? 'rgba(10, 132, 255, 0.15)' : 'var(--apple-surface-2)',
                color: active ? 'var(--apple-blue)' : 'var(--apple-text-tertiary)',
                outline: active ? '1.5px solid var(--apple-blue)' : '1.5px solid transparent',
                outlineOffset: '-1.5px',
              }}>{c}</button>
          );
        })}
        <span className="w-px h-4 mx-1" style={{ background: 'var(--apple-surface-3)' }} />
        {allTags.map((t) => {
          const active = tagFilter === t;
          return (
            <button key={t} onClick={() => setTagFilter(active ? null : t)}
              className="text-[11px] font-medium px-2.5 py-1 rounded-full transition-all duration-150"
              style={{
                background: active ? 'rgba(48, 209, 88, 0.12)' : 'var(--apple-surface-2)',
                color: active ? 'var(--apple-green)' : 'var(--apple-text-tertiary)',
                outline: active ? '1.5px solid var(--apple-green)' : '1.5px solid transparent',
                outlineOffset: '-1.5px',
              }}>{t}</button>
          );
        })}
        {hasFilter && (
          <button onClick={() => { setCatFilter(null); setTagFilter(null); }}
            className="text-[11px] font-medium px-2.5 py-1 rounded-full transition-all duration-150 ml-1"
            style={{ background: 'var(--apple-overlay-dim)', color: 'var(--apple-text-tertiary)' }}>
            ✕ Clear
          </button>
        )}
        <span className="ml-auto text-[11px] tabular-nums" style={{ color: 'var(--apple-text-tertiary)' }}>
          {filtered.length} of {runbooks.length}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.slice(rbPage * settings.tablePageSize, (rbPage + 1) * settings.tablePageSize).map((rb) => (
          <div key={rb.id} className="apple-card apple-card-hover cursor-pointer space-y-3 relative group" onClick={() => navigate(`/runbooks/${rb.id}`)}>
            {canManageRunbooks && (
              <button onClick={(e) => handleDelete(rb.id, e)}
                className="absolute top-3 right-3 p-1.5 rounded-[6px] opacity-0 group-hover:opacity-100 transition-all hover:!opacity-80"
                style={{ background: 'rgba(255, 69, 58, 0.1)', color: 'var(--apple-red)' }} title="Delete runbook">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <h3 className="text-[15px] font-semibold tracking-tight" style={{ color: 'var(--apple-text-primary)' }}>{rb.name}</h3>
            <p className="text-[13px] leading-relaxed" style={{ color: 'var(--apple-text-secondary)' }}>{rb.description}</p>
            <div className="flex items-center gap-2">
              <span className="apple-pill" style={{ background: 'rgba(10, 132, 255, 0.12)', color: 'var(--apple-blue)' }}>{rb.category}</span>
            </div>
            <div className="flex items-center gap-4 text-[12px]" style={{ color: 'var(--apple-text-tertiary)' }}>
              <span className="flex items-center gap-1"><Layers className="w-3 h-3" />{rb.steps.length} steps</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />~{rb.estimatedTimeMinutes}min</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {rb.tags?.slice(0, 4).map((t) => (
                <span key={t} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--apple-surface-2)', color: 'var(--apple-text-tertiary)' }}>{t}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {filtered.length > settings.tablePageSize && (
        <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid var(--apple-border)' }}>
          <span className="text-[12px] tabular-nums" style={{ color: 'var(--apple-text-tertiary)' }}>
            {rbPage * settings.tablePageSize + 1}–{Math.min((rbPage + 1) * settings.tablePageSize, filtered.length)} of {filtered.length}
          </span>
          <div className="flex gap-1.5">
            <button disabled={rbPage === 0} onClick={() => setRbPage(p => p - 1)}
              className="text-[12px] font-medium px-3 py-1.5 rounded-[8px] transition-all duration-150 disabled:opacity-30"
              style={{ background: 'var(--apple-surface-2)', color: 'var(--apple-text-secondary)' }}>Previous</button>
            <button disabled={(rbPage + 1) * settings.tablePageSize >= filtered.length} onClick={() => setRbPage(p => p + 1)}
              className="text-[12px] font-medium px-3 py-1.5 rounded-[8px] transition-all duration-150 disabled:opacity-30"
              style={{ background: 'var(--apple-surface-2)', color: 'var(--apple-text-secondary)' }}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
