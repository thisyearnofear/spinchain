'use client';

// Single-purpose: Toast notification system
// CLEAN: Context + Hook pattern, clear separation of concerns

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X, Loader2 } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  action?: { label: string; onClick: () => void };
}

interface ToastContextType {
  success: (title: string, message?: string, action?: { label: string; onClick: () => void }) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  loading: (title: string, message?: string) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

let idCounter = 0;

// Icons for each toast type
const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 text-emerald-500" />,
  error: <XCircle className="w-5 h-5 text-red-500" />,
  warning: <AlertCircle className="w-5 h-5 text-amber-500" />,
  info: <Info className="w-5 h-5 text-blue-500" />,
  loading: <Loader2 className="w-5 h-5 text-[color:var(--accent)] animate-spin" />,
};

// Styles for each toast type
const styles: Record<ToastType, string> = {
  success: 'border-emerald-500/30 bg-emerald-500/10',
  error: 'border-red-500/30 bg-red-500/10',
  warning: 'border-amber-500/30 bg-amber-500/10',
  info: 'border-blue-500/30 bg-blue-500/10',
  loading: 'border-[color:var(--accent)]/30 bg-[color:var(--accent)]/10',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const add = useCallback((toast: Omit<Toast, 'id'>): string => {
    const id = `toast-${++idCounter}`;
    setToasts(prev => [...prev, { ...toast, id }]);
    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const success = useCallback((title: string, message?: string, action?: { label: string; onClick: () => void }) => {
    const id = add({ type: 'success', title, message, action });
    setTimeout(() => dismiss(id), 5000);
  }, [add, dismiss]);

  const error = useCallback((title: string, message?: string) => {
    const id = add({ type: 'error', title, message });
    setTimeout(() => dismiss(id), 8000);
  }, [add, dismiss]);

  const warning = useCallback((title: string, message?: string) => {
    const id = add({ type: 'warning', title, message });
    setTimeout(() => dismiss(id), 6000);
  }, [add, dismiss]);

  const info = useCallback((title: string, message?: string) => {
    const id = add({ type: 'info', title, message });
    setTimeout(() => dismiss(id), 5000);
  }, [add, dismiss]);

  const loading = useCallback((title: string, message?: string): string => {
    return add({ type: 'loading', title, message });
  }, [add]);

  return (
    <ToastContext.Provider value={{ success, error, warning, info, loading, dismiss }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// Individual toast item
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  return (
    <div className={`
      flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md shadow-lg
      min-w-[320px] max-w-[420px] animate-in slide-in-from-right
      ${styles[toast.type]}
    `}>
      <div className="flex-shrink-0 mt-0.5">{icons[toast.type]}</div>
      
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-[color:var(--foreground)]">{toast.title}</h4>
        {toast.message && (
          <p className="mt-1 text-sm text-[color:var(--muted)]">{toast.message}</p>
        )}
        {toast.action && (
          <button
            onClick={() => { toast.action?.onClick(); onDismiss(); }}
            className="mt-2 text-xs font-medium text-[color:var(--accent)] hover:underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      <button
        onClick={onDismiss}
        className="flex-shrink-0 p-1 rounded-lg text-[color:var(--muted)] hover:text-[color:var(--foreground)] hover:bg-[color:var(--surface-strong)]"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// Hook for consuming toasts
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

// Convenience hook for components that need the full API
export function useToastHelpers() {
  return useToast();
}
