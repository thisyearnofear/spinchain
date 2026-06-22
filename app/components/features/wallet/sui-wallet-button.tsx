"use client";

import { useState, useEffect } from "react";
import { ConnectButton as SuiConnectButton } from "@mysten/dapp-kit";
import { WalletInfoTooltip } from "./wallet-info-tooltip";

export function SuiWalletButton() {
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch and auto-connect issues
  useEffect(() => {
    // Use a microtask to defer the state update
    Promise.resolve().then(() => {
      setMounted(true);
    });
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center gap-1.5">
        <button className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--muted)] opacity-50 cursor-not-allowed">
          Sui Wallet
        </button>
        <WalletInfoTooltip variant="sui" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <SuiConnectButton
        connectText="Sui Wallet"
        className="!rounded-full !border !border-[color:var(--border)] !bg-transparent !px-4 !py-2 !text-sm !font-medium !text-[color:var(--muted)] hover:!text-[color:var(--foreground)] hover:!border-[color:var(--border-strong)]"
      />
      <WalletInfoTooltip variant="sui" />
    </div>
  );
}
