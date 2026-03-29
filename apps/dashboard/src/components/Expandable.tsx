import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function Expandable({ title, icon, defaultOpen = true, count, onToggle, children }: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  count?: number;
  onToggle?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="apple-card">
      <button onClick={() => setOpen(o => { const next = !o; onToggle?.(next); return next; })}
        className="w-full flex items-center gap-2 text-left transition-colors duration-150 hover:opacity-80">
        {icon}
        <span className="apple-section-title flex-1">{title}</span>
        {count !== undefined && (
          <span className="text-[12px] font-medium tabular-nums mr-2" style={{ color: 'var(--apple-text-tertiary)' }}>{count}</span>
        )}
        <ChevronDown className="w-4 h-4 transition-transform duration-300 shrink-0" style={{
          color: 'var(--apple-text-tertiary)',
          strokeWidth: 1.8,
          transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
        }} />
      </button>
      {open && (
        <div style={{ marginTop: '20px' }}>
          {children}
        </div>
      )}
    </div>
  );
}
