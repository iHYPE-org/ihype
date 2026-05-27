'use client';

import React from 'react';

interface Props { children: React.ReactNode; viewName?: string; }
interface State { hasError: boolean; error?: Error; }

export class ViewErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[iHYPE] View error in ${this.props.viewName ?? 'unknown'}:`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100%', minHeight: 320, gap: 16, textAlign: 'center', padding: 32,
        }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <div style={{
            fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 22,
            color: 'var(--ink)', letterSpacing: '-.01em',
          }}>Something went wrong</div>
          <div style={{
            fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)',
            maxWidth: '32ch', lineHeight: 1.6,
          }}>
            {this.props.viewName ? `The ${this.props.viewName} view hit an error.` : 'This view hit an error.'} Your other tabs are fine.
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            style={{
              marginTop: 8, padding: '10px 22px', borderRadius: 8,
              fontFamily: 'var(--f-m)', fontSize: 13, fontWeight: 700,
              letterSpacing: '.06em', textTransform: 'uppercase',
              cursor: 'pointer', border: '1px solid var(--line-2)',
              background: 'var(--bg-2)', color: 'var(--ink)',
            }}
          >Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
