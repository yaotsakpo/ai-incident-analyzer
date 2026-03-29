import React, { useState } from 'react';
import { AlertTriangle, BarChart3, Activity, BookOpen, Bell, Settings, ChevronRight, ChevronLeft, X } from 'lucide-react';

interface GuideTourProps {
  onDone: () => void;
}

const TOUR_STEPS = [
  {
    icon: <AlertTriangle className="w-6 h-6" style={{ color: 'var(--apple-orange)' }} />,
    title: 'Incidents Feed',
    desc: 'Your main workspace. View, triage, and manage all incidents in real-time. Click any incident to see full details, run AI analysis, and collaborate with your team.',
    color: 'var(--apple-orange)',
  },
  {
    icon: <Activity className="w-6 h-6" style={{ color: 'var(--apple-red)' }} />,
    title: 'Anomaly Detection',
    desc: 'AI-powered anomaly detection watches your metrics and flags unusual patterns before they become full incidents.',
    color: 'var(--apple-red)',
  },
  {
    icon: <BarChart3 className="w-6 h-6" style={{ color: 'var(--apple-blue)' }} />,
    title: 'Analytics',
    desc: 'Track MTTR, incident trends, SLA compliance, and team performance over time with detailed charts and breakdowns.',
    color: 'var(--apple-blue)',
  },
  {
    icon: <BookOpen className="w-6 h-6" style={{ color: 'var(--apple-green)' }} />,
    title: 'Runbooks',
    desc: 'Create and manage step-by-step response playbooks. Attach them to incidents for guided resolution workflows.',
    color: 'var(--apple-green)',
  },
  {
    icon: <Bell className="w-6 h-6" style={{ color: 'var(--apple-purple)' }} />,
    title: 'Notifications',
    desc: 'The bell icon in the top-right shows real-time notifications for status changes, @mentions, comments, and escalations.',
    color: 'var(--apple-purple)',
  },
  {
    icon: <Settings className="w-6 h-6" style={{ color: 'var(--apple-text-secondary)' }} />,
    title: 'Settings',
    desc: 'Manage your team, integrations (Slack, PagerDuty, Jira), user accounts, and personal preferences all in one place.',
    color: 'var(--apple-text-secondary)',
  },
];

export default function GuideTour({ onDone }: GuideTourProps) {
  const [idx, setIdx] = useState(0);
  const step = TOUR_STEPS[idx];
  const isLast = idx === TOUR_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md mx-4 rounded-[16px] overflow-hidden" style={{ background: 'var(--apple-bg)', border: '1px solid var(--apple-border)' }}>
        {/* Header with dismiss */}
        <div className="flex items-center justify-between px-5 pt-4">
          <div className="flex gap-1.5">
            {TOUR_STEPS.map((_, i) => (
              <div key={i} className="w-2 h-2 rounded-full transition-all duration-300"
                style={{ background: i === idx ? step.color : 'var(--apple-surface-3)', transform: i === idx ? 'scale(1.3)' : 'scale(1)' }} />
            ))}
          </div>
          <button onClick={onDone} className="p-1 rounded-[6px] transition-all hover:opacity-70" style={{ color: 'var(--apple-text-tertiary)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-[14px] flex items-center justify-center mx-auto transition-all duration-300"
            style={{ background: `color-mix(in srgb, ${step.color} 15%, transparent)` }}>
            {step.icon}
          </div>
          <div>
            <h3 className="text-[20px] font-bold tracking-tight" style={{ color: 'var(--apple-text-primary)' }}>{step.title}</h3>
            <p className="text-[13px] mt-2 leading-relaxed max-w-sm mx-auto" style={{ color: 'var(--apple-text-tertiary)' }}>{step.desc}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 pb-5">
          <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}
            className="flex items-center gap-1 text-[13px] font-medium transition-all hover:opacity-70 disabled:opacity-20"
            style={{ color: 'var(--apple-text-tertiary)' }}>
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <div className="flex items-center gap-3">
            <button onClick={onDone} className="text-[13px] font-medium transition-all hover:opacity-70" style={{ color: 'var(--apple-text-tertiary)' }}>
              Skip tour
            </button>
            <button onClick={() => isLast ? onDone() : setIdx(i => i + 1)}
              className="apple-btn apple-btn-primary flex items-center gap-1.5 text-[13px]">
              {isLast ? "Let's go!" : 'Next'} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
