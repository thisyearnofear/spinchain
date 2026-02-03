"use client";

import { useState, useEffect } from "react";
import { ConnectButton as SuiConnectButton } from "@mysten/dapp-kit";

export function SuiWalletButton() {
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch and auto-connect issues
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--muted)] opacity-50 cursor-not-allowed">
        Sui Wallet
      </button>
    );
  }

  return (
    <SuiConnectButton 
      connectText="Sui Wallet"
      className="!rounded-full !border !border-[color:var(--border)] !bg-transparent !px-4 !py-2 !text-sm !font-medium !text-[color:var(--muted)] hover:!text-[color:var(--foreground)] hover:!border-[color:var(--border-strong)]"
    />
  );
}
