import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: '#f8fafc',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: 560,
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: 24,
              boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
            }}
          >
            <h1 style={{ color: '#dc2626', fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
              Something went wrong
            </h1>
            <pre
              style={{
                background: '#f1f5f9',
                padding: 16,
                borderRadius: 8,
                fontSize: 13,
                overflow: 'auto',
                marginBottom: 16,
                color: '#1e293b',
              }}
            >
              {this.state.error.message}
            </pre>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                padding: '10px 16px',
                background: '#4f46e5',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
