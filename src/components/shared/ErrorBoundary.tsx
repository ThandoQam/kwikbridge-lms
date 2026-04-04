// KwikBridge LMS — Error Boundary
// Catches React rendering errors and reports them.

import React from "react";
import { captureError } from "../../lib/monitoring";
import { C } from "../../lib/theme";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  component?: string;
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
    captureError(error, {
      component: this.props.component || "ErrorBoundary",
      action: "render",
      extra: { componentStack: info.componentStack },
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          padding: 32, textAlign: "center", fontFamily: "'Outfit',system-ui,sans-serif",
        }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 8 }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>
            {this.state.error?.message || "An unexpected error occurred"}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: "8px 20px", fontSize: 13, fontWeight: 500,
              background: C.accent, color: "#fff", border: "none",
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Try Again
          </button>
          <div style={{ fontSize: 11, color: C.textDim, marginTop: 16 }}>
            If this persists, contact support@tqacapital.co.za
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
