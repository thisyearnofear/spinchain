'use client';

import { Loader2, Wallet, CheckCircle2, AlertCircle } from 'lucide-react';

// Button loading state
interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
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
  const baseStyles = 'relative inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-[color:var(--accent)] text-white hover:opacity-90 hover:shadow-lg hover:shadow-[color:var(--glow)] active:scale-95',
    secondary: 'border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--foreground)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-strong)] active:scale-95',
    ghost: 'text-[color:var(--muted)] hover:text-[color:var(--foreground)] hover:bg-[color:var(--surface)] active:scale-95',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <Loader2 className="w-4 h-4 animate-spin" />
      )}
      <span className={isLoading ? 'opacity-90' : ''}>
        {isLoading ? loadingText : children}
      </span>
    </button>
  );
}

// Transaction status badge
interface TransactionStatusProps {
  status: 'idle' | 'pending' | 'success' | 'error';
  hash?: string;
  error?: Error | null;
  chainName?: string;
}

export function TransactionStatus({
  status,
  hash,
  error,
  chainName = 'Avalanche',
}: TransactionStatusProps) {
  const statuses = {
    idle: null,
    pending: {
      icon: <Loader2 className="w-4 h-4 animate-spin text-[color:var(--accent)]" />,
      text: `Submitting to ${chainName}...`,
      className: 'border-[color:var(--accent)]/30 bg-[color:var(--accent)]/10 text-[color:var(--accent)]',
    },
    success: {
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
      text: 'Transaction confirmed',
      className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500',
    },
    error: {
      icon: <AlertCircle className="w-4 h-4 text-red-500" />,
      text: error?.message || 'Transaction failed',
      className: 'border-red-500/30 bg-red-500/10 text-red-500',
    },
  };

  const current = statuses[status];
  if (!current) return null;

  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm ${current.className}`}>
      {current.icon}
      <span className="font-medium">{current.text}</span>
      {hash && status === 'success' && (
        <a
          href={`https://testnet.snowtrace.io/tx/${hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 text-xs underline hover:no-underline opacity-80"
        >
          View
        </a>
      )}
    </div>
  );
}

// Skeleton loader for cards
interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-[color:var(--surface-strong)] rounded-lg ${className}`}
    />
  );
}

// Card skeleton with multiple elements
export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 space-y-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <div className="flex gap-3 pt-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  );
}

// Wallet connection loading state
interface WalletConnectingProps {
  walletName?: string;
}

export function WalletConnecting({ walletName = 'wallet' }: WalletConnectingProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-[color:var(--accent)]/10 flex items-center justify-center">
          <Wallet className="w-8 h-8 text-[color:var(--accent)]" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[color:var(--surface)] border-2 border-[color:var(--border)] flex items-center justify-center">
          <Loader2 className="w-3 h-3 animate-spin text-[color:var(--accent)]" />
        </div>
      </div>
      <div>
        <p className="text-[color:var(--foreground)] font-medium">
          Connecting to {walletName}...
        </p>
        <p className="text-sm text-[color:var(--muted)] mt-1">
          Please approve the connection in your wallet
        </p>
      </div>
    </div>
  );
}

// Full page loading overlay
interface PageLoaderProps {
  message?: string;
}

export function PageLoader({ message = 'Loading...' }: PageLoaderProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--background)]/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-xl bg-[color:var(--accent)]/10 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[color:var(--accent)]" />
          </div>
        </div>
        <p className="text-[color:var(--foreground)] font-medium">{message}</p>
      </div>
    </div>
  );
}

// Contract write button with full status
interface ContractButtonProps {
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  hash?: string;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function ContractButton({
  isPending,
  isSuccess,
  isError,
  error,
  hash,
  children,
  onClick,
  disabled,
  className = '',
}: ContractButtonProps) {
  return (
    <div className="space-y-3">
      <LoadingButton
        onClick={onClick}
        disabled={disabled || isPending || isSuccess}
        isLoading={isPending}
        loadingText="Confirm in wallet..."
        className={className}
      >
        {isSuccess ? 'Confirmed!' : children}
      </LoadingButton>
      
      <TransactionStatus
        status={isError ? 'error' : isSuccess ? 'success' : isPending ? 'pending' : 'idle'}
        hash={hash}
        error={error}
      />
    </div>
  );
}

// Step indicator for multi-step flows
interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        
        return (
          <div key={step} className="flex items-center">
            <div
              className={`
                flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold
                transition-all duration-300
                ${isCompleted 
                  ? 'bg-emerald-500 text-white' 
                  : isCurrent 
                    ? 'bg-[color:var(--accent)] text-white ring-2 ring-[color:var(--accent)]/30'
                    : 'bg-[color:var(--surface-strong)] text-[color:var(--muted)]'
                }
              `}
            >
              {isCompleted ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                index + 1
              )}
            </div>
            <span
              className={`
                ml-2 text-sm font-medium hidden sm:block
                ${isCompleted || isCurrent ? 'text-[color:var(--foreground)]' : 'text-[color:var(--muted)]'}
              `}
            >
              {step}
            </span>
            {index < steps.length - 1 && (
              <div
                className={`
                  w-8 h-0.5 mx-2 transition-colors duration-300
                  ${isCompleted ? 'bg-emerald-500' : 'bg-[color:var(--border)]'}
                `}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
