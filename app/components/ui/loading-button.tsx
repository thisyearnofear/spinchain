'use client';

// Single-purpose: Button with loading state
// ENHANCEMENT FIRST: Enhances native button, doesn't replace it

import { Loader2 } from 'lucide-react';

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}

export function LoadingButton({
  isLoading = false,
  loadingText = 'Loading...',
  children,
  variant = 'primary',
  className = '',
  disabled,
  ...props
}: LoadingButtonProps) {
  const variants = {
    primary: 'bg-[color:var(--accent)] text-white hover:opacity-90 hover:shadow-lg hover:shadow-[color:var(--glow)]',
    secondary: 'border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--foreground)] hover:border-[color:var(--border-strong)]',
    ghost: 'text-[color:var(--muted)] hover:text-[color:var(--foreground)] hover:bg-[color:var(--surface)]',
    danger: 'text-red-400 hover:text-red-300 hover:bg-red-500/10',
  };

  return (
    <button
      className={`
        relative inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full 
        font-medium text-sm transition-all duration-200 
        disabled:opacity-50 disabled:cursor-not-allowed active:scale-95
        ${variants[variant]}
        ${className}
      `}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
      <span className={isLoading ? 'opacity-90' : ''}>
        {isLoading ? loadingText : children}
      </span>
    </button>
  );
}
