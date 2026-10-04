'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Wallet, Check } from 'lucide-react';
import { WalletInfoTooltip } from './wallet-info-tooltip';
import { useWalletAuth } from '@/app/hooks/common/use-wallet-auth';
import { isSupabaseConfigured } from '@/app/lib/supabase/client';

export function ConnectWallet() {
  const {
    isAuthenticated,
    isAuthenticating,
    error: authError,
    login,
    logout,
  } = useWalletAuth();
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              style: {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={openConnectModal}
                      type="button"
                      className="flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-transparent px-4 py-2 text-sm font-medium text-[color:var(--muted)] transition hover:text-[color:var(--foreground)] hover:border-[color:var(--border-strong)]"
                    >
                      <Wallet className="w-4 h-4" />
                      Connect Wallet
                    </button>
                    <WalletInfoTooltip variant="evm" />
                  </div>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    type="button"
                    className="flex items-center gap-2 rounded-full border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-500 transition hover:bg-red-500/20"
                  >
                    Wrong network
                  </button>
                );
              }

              return (
                <div className="flex flex-col items-end">
                <div className="flex items-center gap-2">
                  <button
                    onClick={openChainModal}
                    type="button"
                    className="flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm font-medium text-[color:var(--muted)] transition hover:text-[color:var(--foreground)] hover:border-[color:var(--border-strong)]"
                  >
                    {chain.hasIcon && (
                      <div
                        style={{
                          background: chain.iconBackground,
                          width: 16,
                          height: 16,
                          borderRadius: 999,
                          overflow: 'hidden',
                        }}
                      >
                        {chain.iconUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            alt={chain.name ?? 'Chain icon'}
                            src={chain.iconUrl}
                            style={{ width: 16, height: 16 }}
                          />
                        )}
                      </div>
                    )}
                    <span className="hidden sm:inline">{chain.name}</span>
                  </button>

                  <button
                    onClick={openAccountModal}
                    type="button"
                    className="flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-transparent px-4 py-2 text-sm font-medium text-[color:var(--muted)] transition hover:text-[color:var(--foreground)] hover:border-[color:var(--border-strong)]"
                  >
                    <span className="hidden sm:inline">
                      {account.displayName}
                    </span>
                    <span className="sm:hidden">
                      {account.address.slice(0, 4)}...{account.address.slice(-2)}
                    </span>
                  </button>

                  {isSupabaseConfigured() && (
                    isAuthenticated ? (
                      <button
                        onClick={() => void logout()}
                        type="button"
                        aria-label="Sign out"
                        title="Sign out"
                        className="flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-500 transition hover:bg-emerald-500/20"
                      >
                        <Check className="w-3 h-3" aria-hidden />
                        <span className="hidden sm:inline">Signed in</span>
                        <span className="sm:hidden">Sign out</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => void login()}
                        type="button"
                        disabled={isAuthenticating}
                        className="flex items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-transparent px-3 py-2 text-xs font-medium text-[color:var(--muted)] transition hover:text-[color:var(--foreground)] hover:border-[color:var(--border-strong)] disabled:opacity-50"
                      >
                        {isAuthenticating ? "Signing…" : "Sign in to save rides"}
                      </button>
                    )
                  )}
                </div>
                {authError && (
                  <p role="alert" className="mt-1 text-xs text-red-500">
                    {authError}
                  </p>
                )}
              </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
