import { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { api } from '../api';

export default function ForcePasswordChange({ onDone, onLogout }: { onDone: () => void; onLogout: () => void }) {
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const submit = async () => {
    if (pw.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (pw !== confirm) { setError('Passwords do not match'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await api.changePassword(pw);
      if (res.error) { setError(res.error); setSaving(false); return; }
      onDone();
    } catch { setError('Failed to change password'); setSaving(false); }
  };

  return (
    <div className="flex items-center justify-center h-screen" style={{ background: 'var(--apple-bg)' }}>
      <div className="w-full max-w-sm p-8 rounded-[16px]" style={{ background: 'var(--apple-surface-1)', border: '1px solid var(--apple-border)' }}>
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: 'rgba(255, 159, 10, 0.15)' }}>
            <Lock className="w-6 h-6" style={{ color: 'var(--apple-orange)' }} />
          </div>
          <h2 className="text-[18px] font-semibold" style={{ color: 'var(--apple-text-primary)' }}>Change Your Password</h2>
          <p className="text-[13px] mt-1 text-center" style={{ color: 'var(--apple-text-tertiary)' }}>
            Your password was reset by an admin. Please set a new password to continue.
          </p>
        </div>
        <div className="space-y-3">
          <div className="relative">
            <input type={showPw ? 'text' : 'password'} placeholder="New password (min 6 chars)" value={pw} onChange={e => setPw(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()} className="apple-input w-full pr-9" autoFocus />
            <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-[4px] transition-all hover:opacity-70" style={{ color: 'var(--apple-text-tertiary)' }} tabIndex={-1}>
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="relative">
            <input type={showConfirm ? 'text' : 'password'} placeholder="Confirm new password" value={confirm} onChange={e => setConfirm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()} className="apple-input w-full pr-9" />
            <button type="button" onClick={() => setShowConfirm(p => !p)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-[4px] transition-all hover:opacity-70" style={{ color: 'var(--apple-text-tertiary)' }} tabIndex={-1}>
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {error && <p className="text-[12px] font-medium" style={{ color: 'var(--apple-red)' }}>{error}</p>}
          <button onClick={submit} disabled={saving || !pw || !confirm} className="apple-btn apple-btn-primary w-full">
            {saving ? 'Saving...' : 'Set New Password'}
          </button>
          <button onClick={onLogout} className="apple-btn apple-btn-secondary w-full text-[12px]">Sign Out Instead</button>
        </div>
      </div>
    </div>
  );
}
