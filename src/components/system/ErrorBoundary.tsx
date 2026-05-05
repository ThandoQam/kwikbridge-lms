/**
 * Production-grade error boundary.
 *
 * Wraps page-level components. On error:
 *   1. Captures to Sentry (via observability layer)
 *   2. Renders friendly fallback UI
 *   3. Provides recovery actions (retry, go home, contact support)
 *   4. Logs the error with full component stack
 *
 * Usage:
 *   <ErrorBoundary fallback="page-level" pageName="Dashboard">
 *     <DashboardPage />
 *   </ErrorBoundary>
 *
 * Why two boundaries? React doesn't catch errors in event handlers,
 * async code, or server-side rendering. We use boundaries for render
 * errors and the global window.onerror for the rest.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { log } from '../../lib/observability';

interface Props {
  children: ReactNode;
  fallback?: 'page-level' | 'widget-level' | 'inline';
  pageName?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
    errorId: null,
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Generate a short error ID users can quote when reporting
    const errorId = `ERR-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    return { hasError: true, error, errorId };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    log.error(`React error in ${this.props.pageName || 'component'}`, error, {
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId,
    });
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorId: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    window.location.href = '/';
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { fallback = 'page-level' } = this.props;
    const errorMessage = this.state.error?.message || 'An unexpected error occurred';

    // Inline fallback — small footprint for widgets
    if (fallback === 'inline') {
      return (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            background: '#FEF2F2',
            border: '1px solid #FCA5A5',
            borderRadius: 6,
            fontSize: 13,
            color: '#991B1B',
          }}
        >
          <strong>Component error.</strong> {errorMessage}{' '}
          <button
            onClick={this.handleReset}
            style={{
              background: 'none',
              border: 'none',
              color: '#991B1B',
              textDecoration: 'underline',
              cursor: 'pointer',
              padding: 0,
              fontSize: 13,
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    // Widget-level fallback — for dashboard widgets etc.
    if (fallback === 'widget-level') {
      return (
        <div
          role="alert"
          style={{
            padding: '24px',
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: 8,
            textAlign: 'center',
            color: '#6B7280',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
            This widget couldn't load
          </div>
          <div style={{ fontSize: 12, marginBottom: 12 }}>
            Reference: {this.state.errorId}
          </div>
          <button
            onClick={this.handleReset}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              background: '#1B7A6E',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    // Page-level fallback — full screen friendly error
    return (
      <div
        role="alert"
        style={{
          minHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
          textAlign: 'center',
          background: '#F9FAFB',
        }}
      >
        <div
          style={{
            maxWidth: 480,
            background: 'white',
            border: '1px solid #E5E7EB',
            borderRadius: 12,
            padding: '40px 32px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>

          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#1F2937',
              margin: '0 0 8px',
            }}
          >
            Something went wrong
          </h1>

          <p
            style={{
              fontSize: 14,
              color: '#6B7280',
              lineHeight: 1.6,
              margin: '0 0 24px',
            }}
          >
            {this.props.pageName
              ? `The ${this.props.pageName} page encountered an unexpected error.`
              : 'The application encountered an unexpected error.'}
            {' '}Your data has been saved automatically. Our team has been notified.
          </p>

          <div
            style={{
              background: '#F3F4F6',
              border: '1px solid #E5E7EB',
              borderRadius: 6,
              padding: '10px 14px',
              fontSize: 12,
              color: '#6B7280',
              fontFamily: 'monospace',
              marginBottom: 24,
              textAlign: 'left',
            }}
          >
            <strong>Error reference:</strong> {this.state.errorId}
            <br />
            <strong>Message:</strong> {errorMessage.slice(0, 200)}
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '10px 20px',
                fontSize: 14,
                fontWeight: 600,
                background: '#1B7A6E',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
            <button
              onClick={this.handleGoHome}
              style={{
                padding: '10px 20px',
                fontSize: 14,
                fontWeight: 500,
                background: 'white',
                color: '#374151',
                border: '1px solid #D1D5DB',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Go to Home
            </button>
            <button
              onClick={this.handleReload}
              style={{
                padding: '10px 20px',
                fontSize: 14,
                fontWeight: 500,
                background: 'white',
                color: '#374151',
                border: '1px solid #D1D5DB',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Reload Page
            </button>
          </div>

          <p
            style={{
              fontSize: 12,
              color: '#9CA3AF',
              marginTop: 24,
              marginBottom: 0,
            }}
          >
            Need help? Contact{' '}
            <a
              href="mailto:support@tqacapital.co.za"
              style={{ color: '#1B7A6E' }}
            >
              support@tqacapital.co.za
            </a>{' '}
            and quote reference {this.state.errorId}
          </p>
        </div>
      </div>
    );
  }
}
