import React, { useEffect, useState, useCallback, createContext, useContext } from 'react';
import { CheckCircle, AlertTriangle, X, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(toast.id), 200);
    }, 3000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const icon = {
    success: <CheckCircle className="w-4 h-4" style={{ color: 'var(--apple-green)' }} />,
    error: <AlertTriangle className="w-4 h-4" style={{ color: 'var(--apple-red)' }} />,
    info: <Info className="w-4 h-4" style={{ color: 'var(--apple-blue)' }} />,
  }[toast.type];

  return (
    <div
      className="flex items-center gap-2.5 px-4 py-3 rounded-[12px] text-[13px] font-medium pointer-events-auto"
      style={{
        background: 'var(--apple-glass-bg)',
        backdropFilter: 'blur(20px)',
        color: 'var(--apple-text-primary)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(-8px) scale(0.96)',
        opacity: visible ? 1 : 0,
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {icon}
      <span>{toast.message}</span>
      <button onClick={() => { setVisible(false); setTimeout(() => onDismiss(toast.id), 200); }}
        className="ml-1 opacity-40 hover:opacity-100 transition-opacity">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none" style={{ minWidth: 260 }}>
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
