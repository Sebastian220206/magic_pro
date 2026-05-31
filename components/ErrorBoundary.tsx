'use client';

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
  zone?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

const zoneStyles: Record<string, React.CSSProperties> = {
  default: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '24px', gap: '8px',
    background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '8px', minHeight: '80px', color: '#eee',
    margin: '4px', fontSize: '13px',
  },
  timeline: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '32px', gap: '12px',
    background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(239, 68, 68, 0.15)',
    color: '#ccc', fontSize: '13px',
  },
  tracklist: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '16px', gap: '8px',
    background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(239, 68, 68, 0.15)',
    borderRadius: '4px', minWidth: '120px', color: '#ccc', fontSize: '12px',
  },
  transport: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '8px 16px', gap: '8px', background: 'rgba(0,0,0,0.15)',
    borderBottom: '1px solid rgba(239, 68, 68, 0.2)', color: '#ccc', fontSize: '12px',
    height: '48px',
  },
  panel: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '20px', gap: '8px',
    background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(239, 68, 68, 0.15)',
    borderRadius: '6px', color: '#ccc', fontSize: '13px',
    width: '100%', height: '100%', minHeight: '60px',
  },
  overlay: {
    position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: 'rgba(0,0,0,0.6)',
    zIndex: 9999,
  },
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const zone = this.props.zone || this.props.name || 'ErrorBoundary';
    console.error(`[ErrorBoundary:${zone}] caught:`, error, info.componentStack);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const zone = this.props.zone || this.props.name || 'This section';
      const styleKey = (this.props.zone as keyof typeof zoneStyles) || 'default';
      const style = zoneStyles[styleKey] || zoneStyles.default;

      return (
        <div style={style}>
          <p style={{ margin: 0, fontWeight: 600, color: '#888', fontSize: 'inherit' }}>
            {zone} crashed
          </p>
          <p style={{ margin: 0, fontSize: '0.9em', color: '#666' }}>
            Something went wrong.
          </p>
          <button
            onClick={this.reset}
            style={{
              marginTop: '4px', fontSize: '11px', padding: '4px 16px',
              borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.06)', cursor: 'pointer',
              color: '#aaa', transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
