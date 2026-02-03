'use client';

// Single-purpose: Transaction status display
// CLEAN: One component, one responsibility

import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export type TxStatus = 'idle' | 'pending' | 'success' | 'error';

interface TxStatusProps {
  status: TxStatus;
  hash?: string;
  error?: string;
  chainName?: string;
}

const config = {
  idle: null,
  pending: {
    icon: Loader2,
    text: (chain: string) => `Submitting to ${chain}...`,
    className: 'border-[color:var(--accent)]/30 bg-[color:var(--accent)]/10 text-[color:var(--accent)]',
  },
  success: {
    icon: CheckCircle2,
    text: (_: string) => 'Transaction confirmed',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500',
  },
  error: {
    icon: AlertCircle,
    text: (error: string) => error || 'Transaction failed',
    className: 'border-red-500/30 bg-red-500/10 text-red-500',
  },
};

export function TxStatus({ status, hash, error, chainName = 'Avalanche' }: TxStatusProps) {
  if (status === 'idle') return null;
  
  const cfg = config[status];
  const Icon = cfg.icon;
  const text = status === 'pending' ? cfg.text(chainName) 
    : status === 'error' ? cfg.text(error || '') 
    : cfg.text('');

  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm ${cfg.className}`}>
      <Icon className={`w-4 h-4 ${status === 'pending' ? 'animate-spin' : ''}`} />
      <span className="font-medium">{text}</span>
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
