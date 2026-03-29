import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Terminal, Clock, Layers, Zap, Tag } from 'lucide-react';
import { api } from '../api';
import Expandable from '../components/Expandable';
import type { Runbook, RunbookStep } from '../types';

export default function RunbookDetail() {
  const { id } = useParams<{ id: string }>();
  const [runbook, setRunbook] = useState<Runbook | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.getRunbook(id).then((data: Runbook) => {
      setRunbook(data);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--apple-text-tertiary)' }}>
        <div className="w-5 h-5 border-2 rounded-full animate-spin mr-3" style={{ borderColor: 'var(--apple-surface-3)', borderTopColor: 'var(--apple-blue)' }} />
        Loading runbook...
      </div>
    );
  }

  if (!runbook) {
    return (
      <div className="p-8">
        <Link to="/runbooks" className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors duration-200" style={{ color: 'var(--apple-blue)' }}>
          <ArrowLeft className="w-3.5 h-3.5" style={{ strokeWidth: 2 }} /> Runbooks
        </Link>
        <div className="text-center py-20 text-[15px]" style={{ color: 'var(--apple-text-tertiary)' }}>Runbook not found.</div>
      </div>
    );
  }

  const autoSteps = runbook.steps.filter((s: RunbookStep) => s.isAutomatable);
  const manualSteps = runbook.steps.filter((s: RunbookStep) => !s.isAutomatable);

  return (
    <div className="p-8 space-y-6">
      <Link to="/runbooks" className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors duration-200 hover:opacity-80" style={{ color: 'var(--apple-blue)' }}>
        <ArrowLeft className="w-3.5 h-3.5" style={{ strokeWidth: 2 }} /> Runbooks
      </Link>

      {/* Header */}
      <div>
        <h1 className="apple-title mb-3">{runbook.name}</h1>
        <p className="text-[15px] leading-relaxed mb-4" style={{ color: 'var(--apple-text-secondary)' }}>{runbook.description}</p>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="apple-pill" style={{ background: 'rgba(10, 132, 255, 0.12)', color: 'var(--apple-blue)' }}>
            <BookOpen className="w-3 h-3 mr-1" style={{ strokeWidth: 1.8 }} />
            {runbook.category}
          </span>
          <span className="apple-pill" style={{ background: 'var(--apple-surface-2)', color: 'var(--apple-text-secondary)' }}>
            <Layers className="w-3 h-3 mr-1" style={{ strokeWidth: 1.8 }} />
            {runbook.steps.length} steps
          </span>
          <span className="apple-pill" style={{ background: 'var(--apple-surface-2)', color: 'var(--apple-text-secondary)' }}>
            <Clock className="w-3 h-3 mr-1" style={{ strokeWidth: 1.8 }} />
            ~{runbook.estimatedTimeMinutes} min
          </span>
        </div>
      </div>

      {/* Tags */}
      {runbook.tags?.length > 0 && (
        <Expandable title="Tags" icon={<Tag className="w-[18px] h-[18px]" style={{ color: 'var(--apple-text-tertiary)', strokeWidth: 1.8 }} />} count={runbook.tags.length}>
          <div className="flex items-center gap-2 flex-wrap">
            {runbook.tags.map((t: string) => (
              <span key={t} className="text-[12px] px-2.5 py-1 rounded-full" style={{ background: 'var(--apple-surface-2)', color: 'var(--apple-text-secondary)' }}>{t}</span>
            ))}
          </div>
        </Expandable>
      )}

      {/* All Steps */}
      <Expandable title="Procedure Steps" icon={<Layers className="w-[18px] h-[18px]" style={{ color: 'var(--apple-text-tertiary)', strokeWidth: 1.8 }} />} count={runbook.steps.length}>
        <div className="space-y-3">
          {runbook.steps.map((step: RunbookStep, idx: number) => (
            <StepCard key={step.order} step={step} idx={idx} />
          ))}
        </div>
      </Expandable>

      {/* Automatable Steps */}
      {autoSteps.length > 0 && (
        <Expandable title="Automatable Steps" defaultOpen={false} icon={<Zap className="w-[18px] h-[18px]" style={{ color: 'var(--apple-purple)', strokeWidth: 1.8 }} />} count={autoSteps.length}>
          <div className="space-y-3">
            {autoSteps.map((step: RunbookStep) => (
              <StepCard key={step.order} step={step} idx={runbook.steps.indexOf(step)} />
            ))}
          </div>
        </Expandable>
      )}

      {/* Manual Steps */}
      {manualSteps.length > 0 && (
        <Expandable title="Manual Steps" defaultOpen={false} icon={<Layers className="w-[18px] h-[18px]" style={{ color: 'var(--apple-orange)', strokeWidth: 1.8 }} />} count={manualSteps.length}>
          <div className="space-y-3">
            {manualSteps.map((step: RunbookStep) => (
              <StepCard key={step.order} step={step} idx={runbook.steps.indexOf(step)} />
            ))}
          </div>
        </Expandable>
      )}

      {/* Commands Reference */}
      {runbook.steps.some((s: RunbookStep) => s.command) && (
        <Expandable title="Commands Reference" defaultOpen={false} icon={<Terminal className="w-[18px] h-[18px]" style={{ color: 'var(--apple-green)', strokeWidth: 1.8 }} />} count={runbook.steps.filter((s: RunbookStep) => s.command).length}>
          <div className="space-y-2">
            {runbook.steps.filter((s: RunbookStep) => s.command).map((step: RunbookStep, i: number) => (
              <div key={i} className="flex items-center gap-3 px-3.5 py-2.5 rounded-[10px]" style={{ background: 'var(--apple-surface-1)' }}>
                <span className="text-[12px] font-medium shrink-0" style={{ color: 'var(--apple-text-tertiary)' }}>Step {runbook.steps.indexOf(step) + 1}</span>
                <code className="text-[12px] font-mono flex-1 truncate" style={{ color: 'var(--apple-green)' }}>{step.command}</code>
              </div>
            ))}
          </div>
        </Expandable>
      )}
    </div>
  );
}

function StepCard({ step, idx }: { step: RunbookStep; idx: number }) {
  return (
    <div className="p-4 rounded-[12px]" style={{ background: 'var(--apple-surface-1)' }}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-semibold shrink-0"
          style={{ background: 'var(--apple-surface-3)', color: 'var(--apple-text-secondary)' }}>
          {idx + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[14px] font-medium" style={{ color: 'var(--apple-text-primary)' }}>
              {step.title}
            </span>
            {step.isAutomatable && (
              <span className="apple-pill" style={{ background: 'rgba(191, 90, 242, 0.12)', color: 'var(--apple-purple)' }}>
                <Zap className="w-2.5 h-2.5 mr-0.5" style={{ strokeWidth: 2 }} /> auto
              </span>
            )}
          </div>
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--apple-text-tertiary)' }}>{step.description}</p>
          {step.command && (
            <div className="mt-2.5 flex items-center gap-2 px-3 py-2 rounded-[8px]" style={{ background: 'var(--apple-surface-2)' }}>
              <Terminal className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--apple-text-tertiary)', strokeWidth: 1.8 }} />
              <code className="text-[12px] font-mono truncate" style={{ color: 'var(--apple-green)' }}>{step.command}</code>
            </div>
          )}
          {step.expectedOutcome && (
            <p className="text-[11px] mt-2" style={{ color: 'var(--apple-text-tertiary)' }}>
              <span className="font-medium" style={{ color: 'var(--apple-text-secondary)' }}>Expected:</span> {step.expectedOutcome}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
