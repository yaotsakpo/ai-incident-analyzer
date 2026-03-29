import React, { useState } from 'react';
import { Layers, LogIn, UserPlus, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../useAuth';
import { api } from '../api';

export default function Login() {
  const { login } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const ok = await login(username, password);
    if (!ok) setError('Invalid username or password');
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const res = await api.register({ username, password, displayName, email: email || undefined });
      if (res?.error) { setError(res.error); setLoading(false); return; }
      // Auto-login with returned token
      await login(username, password);
    } catch { setError('Registration failed'); }
    setLoading(false);
  };

  const switchMode = () => { setMode(m => m === 'login' ? 'register' : 'login'); setError(''); };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--apple-bg)' }}>
      <div className="apple-card w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-[14px] flex items-center justify-center mb-3" style={{ background: 'rgba(255, 159, 10, 0.15)' }}>
            <Layers className="w-6 h-6" style={{ color: 'var(--apple-orange)' }} />
          </div>
          <h1 className="text-[20px] font-semibold tracking-tight" style={{ color: 'var(--apple-text-primary)' }}>Incident Analyzer</h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--apple-text-tertiary)' }}>
            {mode === 'login' ? 'Sign in to continue' : 'Create your account'}
          </p>
        </div>

        <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-3">
          {mode === 'register' && (
            <div>
              <label className="text-[12px] font-medium mb-1 block" style={{ color: 'var(--apple-text-secondary)' }}>Display Name</label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="John Doe" className="apple-input w-full" autoFocus aria-label="Display Name" />
            </div>
          )}
          <div>
            <label className="text-[12px] font-medium mb-1 block" style={{ color: 'var(--apple-text-secondary)' }}>Username</label>
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder={mode === 'login' ? 'admin' : 'johndoe'} className="apple-input w-full" autoFocus={mode === 'login'} aria-label="Username" />
          </div>
          {mode === 'register' && (
            <div>
              <label className="text-[12px] font-medium mb-1 block" style={{ color: 'var(--apple-text-secondary)' }}>Email <span style={{ color: 'var(--apple-text-tertiary)' }}>(optional)</span></label>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="john@example.com" className="apple-input w-full" aria-label="Email" />
            </div>
          )}
          <div>
            <label className="text-[12px] font-medium mb-1 block" style={{ color: 'var(--apple-text-secondary)' }}>Password</label>
            <div className="relative">
              <input value={password} onChange={e => setPassword(e.target.value)} type={showPassword ? 'text' : 'password'} placeholder={mode === 'login' ? 'admin123' : 'min 6 characters'} className="apple-input w-full pr-9" aria-label="Password" />
              <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-[4px] transition-all hover:opacity-70" style={{ color: 'var(--apple-text-tertiary)' }} tabIndex={-1} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-[13px] px-3 py-2 rounded-[8px]" style={{ background: 'rgba(255, 69, 58, 0.1)', color: 'var(--apple-red)' }}>
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <button type="submit" disabled={loading || !username || !password || (mode === 'register' && !displayName)} className="apple-btn apple-btn-primary w-full flex items-center justify-center gap-2">
            {mode === 'login'
              ? <><LogIn className="w-4 h-4" /> {loading ? 'Signing in...' : 'Sign In'}</>
              : <><UserPlus className="w-4 h-4" /> {loading ? 'Creating...' : 'Create Account'}</>
            }
          </button>
        </form>

        <div className="mt-4 text-center">
          <button onClick={switchMode} className="text-[12px] font-medium transition-all hover:opacity-80" style={{ color: 'var(--apple-blue)' }}>
            {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Sign In'}
          </button>
        </div>

        {mode === 'login' && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--apple-border)' }}>
            <p className="text-[11px] text-center mb-2" style={{ color: 'var(--apple-text-tertiary)' }}>Demo accounts:</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { user: 'admin', pass: 'admin123', role: 'Admin' },
                { user: 'responder', pass: 'resp123', role: 'Responder' },
                { user: 'viewer', pass: 'view123', role: 'Viewer' },
              ].map(d => (
                <button key={d.user} onClick={() => { setUsername(d.user); setPassword(d.pass); }}
                  className="text-[11px] px-2 py-1.5 rounded-[6px] text-center transition-all"
                  style={{ background: 'var(--apple-surface-2)', color: 'var(--apple-text-secondary)' }}>
                  {d.role}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
