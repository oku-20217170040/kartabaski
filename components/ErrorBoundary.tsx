'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{
          padding: '40px 24px',
          textAlign: 'center',
          color: 'var(--muted)',
          background: 'var(--surface)',
          borderRadius: 12,
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Bir şeyler ters gitti</p>
          <p style={{ fontSize: 14 }}>Sayfayı yenileyerek tekrar deneyin.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              marginTop: 16,
              padding: '8px 20px',
              borderRadius: 8,
              background: 'var(--accent)',
              color: '#0b0f14',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Tekrar Dene
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
