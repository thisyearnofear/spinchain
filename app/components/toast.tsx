'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X, Loader2 } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  updateToast: (id: string, updates: Partial<Toast>) => void;
  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    },
    options?: { successMessage?: (data: T) => string; errorMessage?: (error: Error) => string }
  ) => Promise<T>;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Generate unique ID
let toastIdCounter = 0;
function generateId(): string {
  return `toast-${++toastIdCounter}-${Date.now()}`;
}

// Icon mapping
const toastIcons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 text-emerald-500" />,
  error: <XCircle className="w-5 h-5 text-red-500" />,
  warning: <AlertCircle className="w-5 h-5 text-amber-500" />,
  info: <Info className="w-5 h-5 text-blue-500" />,
  loading: <Loader2 className="w-5 h-5 text-[color:var(--accent)] animate-spin" />,
};

// Color mapping for borders and backgrounds
const toastStyles: Record<ToastType, string> = {
  success: 'border-emerald-500/30 bg-emerald-500/10',
  error: 'border-red-500/30 bg-red-500/10',
  warning: 'border-amber-500/30 bg-amber-500/10',
  info: 'border-blue-500/30 bg-blue-500/10',
  loading: 'border-[color:var(--accent)]/30 bg-[color:var(--accent)]/10',
};

// Toast Item Component
function ToastItem({
  toast,
  onRemove,
}: {
  toast: Toast;
  onRemove: (id: string) => void;
}) {
  const [isExiting, setIsExiting] = useState(false);

  const handleRemove = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  // Auto-remove for non-loading toasts
  React.useEffect(() => {
    if (toast.type !== 'loading' && toast.duration !== Infinity) {
      const duration = toast.duration || 5000;
      const timer = setTimeout(handleRemove, duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration, toast.type]);

  return (
    <div
      className={`
        relative flex items-start gap-3 p-4 rounded-xl border
        backdrop-blur-md shadow-lg
        transition-all duration-300 ease-out
        ${toastStyles[toast.type]}
        ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
        min-w-[320px] max-w-[420px]
      `}
      role="alert"
    >
      <div className="flex-shrink-0 mt-0.5">{toastIcons[toast.type]}</div>
      
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-[color:var(--foreground)]">
          {toast.title}
        </h4>
        {toast.message && (
          <p className="mt-1 text-sm text-[color:var(--muted)] line-clamp-3">
            {toast.message}
          </p>
        )}
        {toast.action && (
          <button
            onClick={() => {
              toast.action?.onClick();
              handleRemove();
            }}
            className="mt-2 text-xs font-medium text-[color:var(--accent)] hover:underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      <button
        onClick={handleRemove}
        className="flex-shrink-0 p-1 rounded-lg text-[color:var(--muted)] hover:text-[color:var(--foreground)] hover:bg-[color:var(--surface-strong)] transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Progress bar for auto-dismiss */}
      {toast.type !== 'loading' && toast.duration !== Infinity && (
        <div
          className="absolute bottom-0 left-0 h-0.5 bg-current opacity-30 rounded-b-xl"
          style={{
            width: '100%',
            animation: `shrink ${toast.duration || 5000}ms linear forwards`,
          }}
        />
      )}
    </div>
  );
}

// Provider Component
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>): string => {
    const id = generateId();
    setToasts((prev) => [...prev, { ...toast, id }]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateToast = useCallback((id: string, updates: Partial<Toast>) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  }, []);

  const promise = useCallback(
    async <T,>(
      promise: Promise<T>,
      messages: {
        loading: string;
        success: string;
        error: string;
      },
      options?: { successMessage?: (data: T) => string; errorMessage?: (error: Error) => string }
    ): Promise<T> => {
      const id = addToast({
        type: 'loading',
        title: messages.loading,
        duration: Infinity,
      });

      try {
        const data = await promise;
        updateToast(id, {
          type: 'success',
          title: messages.success,
          message: options?.successMessage?.(data),
          duration: 5000,
        });
        return data;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        updateToast(id, {
          type: 'error',
          title: messages.error,
          message: options?.errorMessage?.(err) || err.message,
          duration: 8000,
        });
        throw error;
      }
    },
    [addToast, updateToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, updateToast, promise }}>
      {children}
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
        <div className="flex flex-col gap-3 pointer-events-auto">
          {toasts.map((toast) => (
            <ToastItem
              key={toast.id}
              toast={toast}
              onRemove={removeToast}
            />
          ))}
        </div>
      </div>
      
      {/* Animation styles */}
      <style jsx global>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

// Hook for using toasts
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// Convenience hooks for common toast types
export function useToastHelpers() {
  const { addToast, promise } = useToast();

  return {
    success: (title: string, message?: string, options?: { action?: { label: string; onClick: () => void } }) =>
      addToast({ type: 'success', title, message, duration: 5000, action: options?.action }),
    
    error: (title: string, message?: string) =>
      addToast({ type: 'error', title, message, duration: 8000 }),
    
    warning: (title: string, message?: string) =>
      addToast({ type: 'warning', title, message, duration: 6000 }),
    
    info: (title: string, message?: string) =>
      addToast({ type: 'info', title, message, duration: 5000 }),
    
    loading: (title: string, message?: string) =>
      addToast({ type: 'loading', title, message, duration: Infinity }),
    
    promise,
  };
}
