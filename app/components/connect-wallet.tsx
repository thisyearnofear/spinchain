'use client';

// Single-purpose: Wallet connection UI
// DRY: Uses centralized error parsing

import { useAccount, useConnect, useDisconnect, useChainId } from 'wagmi';
import { useState } from 'react';
import { useToast } from './toast';
import { LoadingButton } from './loading-button';
import { parseError } from '../lib/errors';
import { Wallet, AlertCircle, ChevronDown, LogOut } from 'lucide-react';

const SUPPORTED_CHAINS = [
  { id: 43113, name: 'Fuji', icon: '🔺' },
  { id: 43114, name: 'C-Chain', icon: '🔺' },
  { id: 1, name: 'Ethereum', icon: '◆' },
];

export function ConnectWallet() {
  const { address, isConnected, isConnecting } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect, isPending: isDisconnecting } = useDisconnect();
  const chainId = useChainId();
  const toast = useToast();
  
  const [showModal, setShowModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const isLoading = isConnecting || isPending;
  const currentChain = SUPPORTED_CHAINS.find(c => c.id === chainId);
  const isWrongNetwork = chainId && !SUPPORTED_CHAINS.some(c => c.id === chainId);

  const handleConnect = async (connectorId: string) => {
    const connector = connectors.find(c => c.id === connectorId);
    if (!connector) return;

    try {
      await connect({ connector });
      setShowModal(false);
      toast.success('Wallet Connected', `Connected to ${address?.slice(0, 6)}...${address?.slice(-4)}`);
    } catch (err) {
      const parsed = parseError(err as Error);
      toast.error(parsed.title, parsed.message);
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    setShowMenu(false);
    toast.info('Disconnected', 'Your wallet has been disconnected');
  };

  // Connected state
  if (isConnected && address) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium
            transition-all
            ${isWrongNetwork 
              ? 'border-red-500/50 bg-red-500/10 text-red-500' 
              : 'border-[color:var(--border)] bg-[color:var(--surface)] hover:border-[color:var(--accent)]'
            }
          `}
        >
          {isWrongNetwork ? (
            <><AlertCircle className="w-4 h-4" /> Wrong Network</>
          ) : (
            <>
              <span>{currentChain?.icon}</span>
              <span className="hidden sm:inline">{address.slice(0, 6)}...{address.slice(-4)}</span>
              <span className="sm:hidden">{address.slice(0, 4)}...{address.slice(-2)}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showMenu ? 'rotate-180' : ''}`} />
            </>
          )}
        </button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-full mt-2 w-56 p-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-xl z-50">
              <div className="px-3 py-2 rounded-lg bg-[color:var(--surface-strong)]">
                <p className="text-xs text-[color:var(--muted)]">Address</p>
                <p className="text-sm font-mono truncate">{address}</p>
              </div>
              
              <div className="h-px bg-[color:var(--border)] my-2" />
              
              <LoadingButton
                onClick={handleDisconnect}
                isLoading={isDisconnecting}
                variant="ghost"
                className="w-full justify-start gap-2 text-red-400"
              >
                <LogOut className="w-4 h-4" /> Disconnect
              </LoadingButton>
            </div>
          </>
        )}
      </div>
    );
  }

  // Disconnected state
  return (
    <>
      <LoadingButton
        onClick={() => setShowModal(true)}
        isLoading={isLoading}
        loadingText="Connecting..."
        className="gap-2"
      >
        <Wallet className="w-4 h-4" /> Connect
      </LoadingButton>

      {showModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div 
            className="w-full max-w-sm p-6 mx-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Connect Wallet</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg text-[color:var(--muted)] hover:bg-[color:var(--surface-strong)]"
              >
                ×
              </button>
            </div>

            <div className="space-y-2">
              {connectors.length === 0 ? (
                <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
                  <p className="text-amber-500 font-medium">No Wallet Detected</p>
                  <p className="text-sm text-[color:var(--muted)] mt-1">
                    Install <a href="https://metamask.io" target="_blank" rel="noopener" className="text-[color:var(--accent)] underline">MetaMask</a>
                  </p>
                </div>
              ) : (
                connectors.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleConnect(c.id)}
                    disabled={!c.ready}
                    className="w-full flex items-center gap-3 p-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] hover:border-[color:var(--accent)] transition-all disabled:opacity-50"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[color:var(--accent)]/10 flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-[color:var(--accent)]" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-[color:var(--muted)]">
                        {c.ready ? 'Click to connect' : 'Not installed'}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
