'use client';

import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi';
import { useEffect, useState } from 'react';
import { useToastHelpers } from './toast';
import { LoadingButton } from './loading-states';
import { Wallet, AlertCircle, ChevronDown, LogOut, RefreshCw } from 'lucide-react';

// Supported chains configuration
const SUPPORTED_CHAINS = [
  { id: 43113, name: 'Avalanche Fuji', icon: '🔺' },
  { id: 43114, name: 'Avalanche C-Chain', icon: '🔺' },
  { id: 1, name: 'Ethereum', icon: '◆' },
];

// Error message mapper
function getWalletErrorMessage(error: Error): { title: string; message: string } {
  const errorMessage = error.message.toLowerCase();
  
  // User rejected
  if (errorMessage.includes('user rejected') || errorMessage.includes('rejected the request')) {
    return {
      title: 'Connection Cancelled',
      message: 'You declined the wallet connection. Please try again when you\'re ready.',
    };
  }
  
  // Already processing
  if (errorMessage.includes('already processing') || errorMessage.includes('request of type')) {
    return {
      title: 'Request Pending',
      message: 'Please check your wallet - there\'s already a connection request waiting for approval.',
    };
  }
  
  // Wallet not installed
  if (errorMessage.includes('wallet') && (errorMessage.includes('not found') || errorMessage.includes('not installed'))) {
    return {
      title: 'Wallet Not Found',
      message: 'No compatible wallet detected. Please install MetaMask, Rabby, or another Web3 wallet.',
    };
  }
  
  // Network/chain errors
  if (errorMessage.includes('network') || errorMessage.includes('chain')) {
    return {
      title: 'Network Error',
      message: 'There was a problem connecting to the network. Please check your connection and try again.',
    };
  }
  
  // Timeout
  if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
    return {
      title: 'Connection Timeout',
      message: 'The connection took too long. Please check your wallet and try again.',
    };
  }
  
  // Default
  return {
    title: 'Connection Failed',
    message: error.message || 'An unexpected error occurred. Please try again.',
  };
}

// Hook for wallet connection with toast notifications
export function useWalletConnection() {
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();
  const { connectors, connect, error: connectError, isPending: isConnectPending } = useConnect();
  const { disconnect, isPending: isDisconnectPending } = useDisconnect();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitchPending, error: switchError } = useSwitchChain();
  const toast = useToastHelpers();
  const [hasShownSuccess, setHasShownSuccess] = useState(false);

  // Handle connection errors
  useEffect(() => {
    if (connectError) {
      const { title, message } = getWalletErrorMessage(connectError);
      toast.error(title, message);
    }
  }, [connectError, toast]);

  // Handle successful connection
  useEffect(() => {
    if (isConnected && address && !hasShownSuccess) {
      toast.success(
        'Wallet Connected',
        `Connected to ${address.slice(0, 6)}...${address.slice(-4)}`
      );
      setHasShownSuccess(true);
    }
    
    if (!isConnected) {
      setHasShownSuccess(false);
    }
  }, [isConnected, address, hasShownSuccess, toast]);

  // Handle chain switch errors
  useEffect(() => {
    if (switchError) {
      toast.error(
        'Network Switch Failed',
        switchError.message || 'Could not switch networks. Please try manually in your wallet.'
      );
    }
  }, [switchError, toast]);

  const connectWallet = async (connectorId?: string) => {
    try {
      const connector = connectorId 
        ? connectors.find(c => c.id === connectorId)
        : connectors[0];
      
      if (!connector) {
        toast.error('No Wallet Available', 'Please install a Web3 wallet to continue.');
        return;
      }

      await connect({ connector });
    } catch (err) {
      // Error is handled by the effect above
      console.error('Connection error:', err);
    }
  };

  const disconnectWallet = async () => {
    try {
      await disconnect();
      toast.info('Wallet Disconnected', 'Your wallet has been disconnected.');
    } catch (err) {
      toast.error('Disconnect Failed', 'Could not disconnect wallet. Please try again.');
    }
  };

  const switchToChain = async (chainId: number) => {
    try {
      await switchChain({ chainId });
      const chain = SUPPORTED_CHAINS.find(c => c.id === chainId);
      toast.success(
        'Network Switched',
        `Connected to ${chain?.name || 'new network'}`
      );
    } catch (err) {
      // Error is handled by the effect above
      console.error('Switch chain error:', err);
    }
  };

  const currentChain = SUPPORTED_CHAINS.find(c => c.id === chainId);
  const isWrongNetwork = chainId && !SUPPORTED_CHAINS.some(c => c.id === chainId);

  return {
    address,
    isConnected,
    isConnecting: isConnecting || isConnectPending || isReconnecting,
    isDisconnecting: isDisconnectPending,
    isSwitching: isSwitchPending,
    chainId,
    currentChain,
    isWrongNetwork,
    connectors,
    connectWallet,
    disconnectWallet,
    switchToChain,
    error: connectError,
  };
}

// Wallet connection button with dropdown
export function WalletConnectionButton() {
  const {
    address,
    isConnected,
    isConnecting,
    isDisconnecting,
    currentChain,
    isWrongNetwork,
    connectors,
    connectWallet,
    disconnectWallet,
  } = useWalletConnection();
  
  const [showDropdown, setShowDropdown] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);

  if (!isConnected) {
    return (
      <>
        <LoadingButton
          onClick={() => setShowConnectModal(true)}
          isLoading={isConnecting}
          loadingText="Connecting..."
          variant="primary"
          className="gap-2"
        >
          <Wallet className="w-4 h-4" />
          Connect Wallet
        </LoadingButton>

        {/* Connection Modal */}
        {showConnectModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setShowConnectModal(false)}
          >
            <div 
              className="w-full max-w-md p-6 mx-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-[color:var(--foreground)]">
                  Connect Wallet
                </h3>
                <button
                  onClick={() => setShowConnectModal(false)}
                  className="p-2 rounded-lg text-[color:var(--muted)] hover:text-[color:var(--foreground)] hover:bg-[color:var(--surface-strong)]"
                >
                  ×
                </button>
              </div>

              <div className="space-y-3">
                {connectors.length === 0 ? (
                  <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-500">No Wallet Detected</p>
                        <p className="text-sm text-[color:var(--muted)] mt-1">
                          Please install{' '}
                          <a 
                            href="https://metamask.io" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[color:var(--accent)] hover:underline"
                          >
                            MetaMask
                          </a>
                          ,{' '}
                          <a 
                            href="https://rabby.io" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[color:var(--accent)] hover:underline"
                          >
                            Rabby
                          </a>
                          , or another Web3 wallet.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  connectors.map((connector) => (
                    <button
                      key={connector.id}
                      onClick={() => {
                        connectWallet(connector.id);
                        setShowConnectModal(false);
                      }}
                      className="w-full flex items-center gap-3 p-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] hover:border-[color:var(--accent)] hover:bg-[color:var(--accent)]/5 transition-all group"
                    >
                      {connector.icon ? (
                        <img 
                          src={connector.icon} 
                          alt={connector.name}
                          className="w-10 h-10 rounded-lg"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-[color:var(--accent)]/10 flex items-center justify-center">
                          <Wallet className="w-5 h-5 text-[color:var(--accent)]" />
                        </div>
                      )}
                      <div className="text-left">
                        <p className="font-medium text-[color:var(--foreground)] group-hover:text-[color:var(--accent)]">
                          {connector.name}
                        </p>
                        <p className="text-xs text-[color:var(--muted)]">
                          {connector.ready ? 'Click to connect' : 'Not installed'}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <p className="mt-4 text-xs text-center text-[color:var(--muted)]">
                By connecting, you agree to the terms of service and privacy policy.
              </p>
            </div>
          </div>
        )}
      </>
    );
  }

  // Connected state
  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium
          transition-all duration-200
          ${isWrongNetwork 
            ? 'border-red-500/50 bg-red-500/10 text-red-500 hover:bg-red-500/20' 
            : 'border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--foreground)] hover:border-[color:var(--accent)]'
          }
        `}
      >
        {isWrongNetwork ? (
          <>
            <AlertCircle className="w-4 h-4" />
            Wrong Network
          </>
        ) : (
          <>
            <span className="text-[color:var(--accent)]">{currentChain?.icon}</span>
            <span className="hidden sm:inline">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </span>
            <span className="sm:hidden">
              {address?.slice(0, 4)}...{address?.slice(-2)}
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <>
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-64 p-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-xl z-50">
            {/* Address display */}
            <div className="px-3 py-2 mb-2 rounded-lg bg-[color:var(--surface-strong)]">
              <p className="text-xs text-[color:var(--muted)]">Connected Address</p>
              <p className="text-sm font-mono text-[color:var(--foreground)] truncate">
                {address}
              </p>
            </div>

            {/* Network selector */}
            <div className="space-y-1 mb-2">
              <p className="px-3 text-xs text-[color:var(--muted)]">Network</p>
              {SUPPORTED_CHAINS.map((chain) => (
                <button
                  key={chain.id}
                  onClick={() => {
                    // switchToChain(chain.id);
                    setShowDropdown(false);
                  }}
                  className={`
                    w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                    transition-colors
                    ${currentChain?.id === chain.id 
                      ? 'bg-[color:var(--accent)]/10 text-[color:var(--accent)]' 
                      : 'text-[color:var(--foreground)] hover:bg-[color:var(--surface-strong)]'
                    }
                  `}
                >
                  <span>{chain.icon}</span>
                  {chain.name}
                  {currentChain?.id === chain.id && (
                    <CheckCircle className="w-4 h-4 ml-auto" />
                  )}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="h-px bg-[color:var(--border)] my-2" />

            {/* Disconnect */}
            <LoadingButton
              onClick={() => {
                disconnectWallet();
                setShowDropdown(false);
              }}
              isLoading={isDisconnecting}
              loadingText="Disconnecting..."
              variant="ghost"
              className="w-full justify-start gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <LogOut className="w-4 h-4" />
              Disconnect
            </LoadingButton>
          </div>
        </>
      )}
    </div>
  );
}

// Import CheckCircle for the dropdown
import { CheckCircle } from 'lucide-react';

// Network guard - shows warning if on wrong network
export function NetworkGuard({ children }: { children: React.ReactNode }) {
  const { isWrongNetwork, currentChain, switchToChain } = useWalletConnection();
  const [isDismissing, setIsDismissing] = useState(false);

  if (!isWrongNetwork || isDismissing) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 p-4 bg-red-500/10 border-b border-red-500/30">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-500">Wrong Network</p>
              <p className="text-sm text-[color:var(--muted)]">
                Please switch to {SUPPORTED_CHAINS.map(c => c.name).join(' or ')} to continue.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => switchToChain(SUPPORTED_CHAINS[0].id)}
              className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Switch Network
            </button>
            <button
              onClick={() => setIsDismissing(true)}
              className="p-2 rounded-lg text-[color:var(--muted)] hover:text-[color:var(--foreground)] hover:bg-[color:var(--surface-strong)]"
            >
              ×
            </button>
          </div>
        </div>
      </div>
      <div className="pt-20">{children}</div>
    </>
  );
}
