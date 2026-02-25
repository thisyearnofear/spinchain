"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { motion } from "framer-motion";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary - Catches JavaScript errors anywhere in child component tree
 * Prevents entire app from crashing due to one component failure
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error);
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
    
    this.props.onError?.(error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="min-h-screen flex items-center justify-center p-6 bg-[color:var(--background)]"
        >
          <div className="max-w-md w-full text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring" }}
              className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center"
            >
              <span className="text-4xl">⚠️</span>
            </motion.div>
            
            <h2 className="text-2xl font-bold text-[color:var(--foreground)] mb-2">
              Something went wrong
            </h2>
            <p className="text-[color:var(--muted)] mb-6">
              We&apos;ve encountered an unexpected error. Don&apos;t worry, your data is safe.
            </p>

            {this.state.error && (
              <div className="mb-6 p-4 rounded-lg bg-red-500/5 border border-red-500/20 text-left">
                <p className="text-xs font-mono text-red-400 break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-6 py-2.5 rounded-full bg-[color:var(--accent)] text-white font-medium hover:opacity-90 transition-opacity"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="px-6 py-2.5 rounded-full border border-[color:var(--border)] text-[color:var(--foreground)] font-medium hover:border-[color:var(--accent)]/50 transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        </motion.div>
      );
    }

    return this.props.children;
  }
}

/**
 * Section-level error boundary for isolated failures
 */
export function SectionErrorBoundary({ 
  children, 
  title = "Section" 
}: { 
  children: ReactNode; 
  title?: string;
}) {
  return (
    <ErrorBoundary
      fallback={
        <div className="p-6 rounded-2xl border border-red-500/20 bg-red-500/5 text-center">
          <p className="text-red-400 font-medium mb-2">Failed to load {title}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)] transition-colors"
          >
            Reload to try again
          </button>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
