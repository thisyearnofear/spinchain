"use client";

import Link from "next/link";
import { HookVisualizer } from "./hook-visualizer";
import { CoachProfile } from "./coach-profile";
import { ArrowLeft } from "lucide-react";

export default function AgentPage() {
  return (
    <main className="min-h-screen bg-black text-white selection:bg-indigo-500/30">
      {/* Background Gradients */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-indigo-600/10 blur-[128px]" />
        <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-blue-600/5 blur-[128px]" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Simple Header */}
        <header className="border-b border-white/5 bg-black/50 backdrop-blur-md">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
                <Link href="/" className="flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white transition-colors">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Home
                </Link>
                <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500"></div>
                    <span className="font-bold tracking-tight">SpinChain</span>
                </div>
                <div className="w-24"></div> {/* Spacer for center alignment */}
            </div>
        </header>

        <div className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-8">
          <div className="mb-12">
            <div className="inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300 mb-4">
                Dual-Engine Architecture
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Agentic Finance
              <span className="block text-lg font-medium tracking-normal text-indigo-400 mt-2">
                Sui Powered AI Instructor Studio
              </span>
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-gray-400">
              Deploy autonomous agents that manage your classes, adjust difficulty in real-time,
              and optimize revenue using Uniswap v4 hooks.
            </p>
          </div>

          <div className="grid gap-12 lg:grid-cols-2">
            {/* Left Column: Sui / Performance */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 border-b border-white/10 pb-2">
                 <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                 </div>
                 <div>
                    <h2 className="text-sm font-bold uppercase tracking-widest text-blue-400">Performance Layer</h2>
                    <p className="text-[10px] text-white/40">SUI NETWORK (TESTNET)</p>
                 </div>
              </div>
              <p className="text-sm text-gray-500">
                The physical manifestation of your agent. It lives on the high-throughput Sui blockchain to process biometric telemetry at 10Hz and adjust class difficulty instantly.
              </p>
              <CoachProfile />
            </section>

            {/* Right Column: EVM / Finance */}
            <section className="space-y-6">
               <div className="flex items-center gap-3 border-b border-white/10 pb-2">
                 <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-500/20 text-pink-400">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                 </div>
                 <div>
                    <h2 className="text-sm font-bold uppercase tracking-widest text-pink-400">Settlement Layer</h2>
                    <p className="text-[10px] text-white/40">AVALANCHE C-CHAIN</p>
                 </div>
              </div>
               <p className="text-sm text-gray-500">
                The financial brain. It manages high-value assets (NFT Tickets, $SPIN) and uses Uniswap v4 Hooks to dynamically price inventory based on real-time demand.
              </p>
              <HookVisualizer />
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
