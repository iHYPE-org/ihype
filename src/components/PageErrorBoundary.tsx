'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
  /** Optional label shown in the fallback message, e.g. "artist profile" */
  label?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Generic page-level error boundary for public-facing pages.
 * Use this when you need a React class boundary (e.g. wrapping a specific
 * client sub-tree inside a server component page).
 *
 * For full Next.js route-level error handling prefer colocated `error.tsx`
 * files alongside the route's `page.tsx`.
 */
export class PageErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[iHYPE] Page render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      const label = this.props.label ? `The ${this.props.label} page` : 'This page';
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            gap: 16,
            textAlign: 'center',
            padding: '2rem',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Something went wrong</h2>
          <p className="meta">{label} couldn&apos;t load. Try refreshing.</p>
          <button
            className="button secondary small"
            onClick={() => this.setState({ hasError: false, error: undefined })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
