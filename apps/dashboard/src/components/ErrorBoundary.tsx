import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="apple-card flex flex-col items-center justify-center py-12 px-6 text-center gap-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(255, 69, 58, 0.12)' }}>
            <AlertTriangle className="w-6 h-6" style={{ color: 'var(--apple-red)' }} />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold mb-1" style={{ color: 'var(--apple-text-primary)' }}>Something went wrong</h3>
            <p className="text-[13px]" style={{ color: 'var(--apple-text-tertiary)' }}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="apple-btn apple-btn-primary flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
