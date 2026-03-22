"use client";

import { useState, useEffect, useRef } from "react";
import { PrimaryNav } from "@/app/components/layout/nav";
import { GlassCard, Tag, SectionHeader } from "@/app/components/ui/ui";
import { LoadingButton } from "@/app/components/ui/loading-button";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Zap,
  Shield,
  MessageSquare,
  TrendingUp,
  Activity,
  MicOff,
  Volume2,
  Lock,
  Unlock,
} from "lucide-react";

export default function InstructorLivePage() {
  const [isAgentPaused, setIsAgentPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [riderCount, setRiderCount] = useState(42);
  const [activeRiders, setActiveRiders] = useState(38);
  const [marketStats, setMarketStats] = useState({
    ticketsSold: 42,
    revenue: 630,
    trending: "+12%",
  });

  // Mock Live Telemetry
  const [telemetry, setTelemetry] = useState({
    avgPower: 185,
    avgHr: 142,
    intensity: 75,
  });

  return (
    <div className="min-h-screen bg-black text-white selection:bg-indigo-500/30">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-20 pt-6 lg:px-12 lg:pt-10">
        <div className="rounded-3xl border border-white/5 bg-white/5 px-6 py-4 lg:px-8 lg:py-6 backdrop-blur-xl">
          <PrimaryNav />
        </div>

        {/* Header with Live Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-red-500/20 border border-red-500/30 px-3 py-1 rounded-full">
                <span className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">
                  Live Session
                </span>
              </div>
              <Tag className="bg-indigo-500/10 border-indigo-500/20 text-indigo-400">
                HIIT 45: Neon Peak
              </Tag>
            </div>
            <h1 className="text-3xl font-black tracking-tighter mt-2">
              Command Center
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2 flex flex-col items-center min-w-[80px]">
              <span className="text-[10px] font-bold text-white/40 uppercase">
                Riders
              </span>
              <span className="text-xl font-black">{riderCount}</span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2 flex flex-col items-center min-w-[80px]">
              <span className="text-[10px] font-bold text-white/40 uppercase">
                Active
              </span>
              <span className="text-xl font-black text-emerald-400">
                {activeRiders}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
          {/* Main Grid: Adapts for Mobile (Single Column) vs Desktop (Two Columns) */}
          <div className="flex flex-col gap-6">
            {/* Live Performance View */}
            <GlassCard className="p-6 lg:p-8 bg-gradient-to-br from-indigo-500/5 to-transparent">
              <div className="flex items-center justify-between mb-8">
                <SectionHeader
                  eyebrow="Real-time"
                  title="Class Performance"
                  description="Average biometrics across all participants."
                />
                <Activity className="w-5 h-5 text-indigo-400" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-8">
                <div className="p-6 rounded-3xl bg-white/5 border border-white/10 flex flex-col items-center text-center">
                  <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2">
                    Avg Power
                  </span>
                  <span className="text-4xl font-black text-white tracking-tighter">
                    {telemetry.avgPower}W
                  </span>
                  <div className="mt-3 w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 w-[65%]" />
                  </div>
                </div>
                <div className="p-6 rounded-3xl bg-white/5 border border-white/10 flex flex-col items-center text-center">
                  <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2">
                    Avg HR
                  </span>
                  <span className="text-4xl font-black text-rose-400 tracking-tighter">
                    {telemetry.avgHr}
                  </span>
                  <span className="text-[10px] text-rose-400/60 font-bold mt-1">
                    Zone 4
                  </span>
                </div>
                <div className="p-6 rounded-3xl bg-white/5 border border-white/10 flex flex-col items-center text-center">
                  <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2">
                    Intensity
                  </span>
                  <span className="text-4xl font-black text-amber-400 tracking-tighter">
                    {telemetry.intensity}%
                  </span>
                  <span className="text-[10px] text-amber-400/60 font-bold mt-1">
                    Target 80%
                  </span>
                </div>
              </div>
            </GlassCard>

            {/* Mobile-Optimized "Quick Action" Grid */}
            <div className="grid grid-cols-2 gap-4">
              <button className="flex flex-col items-center justify-center gap-3 p-8 rounded-[2.5rem] bg-indigo-600 hover:bg-indigo-500 transition-all active:scale-95 group border border-white/10 shadow-xl">
                <div className="p-4 rounded-3xl bg-white/20 group-hover:bg-white/30 transition-colors">
                  <Zap className="w-8 h-8 text-white" />
                </div>
                <span className="text-sm font-black uppercase tracking-widest text-white">
                  Manual Sprint
                </span>
              </button>

              <button className="flex flex-col items-center justify-center gap-3 p-8 rounded-[2.5rem] bg-white/5 hover:bg-white/10 transition-all active:scale-95 group border border-white/10">
                <div className="p-4 rounded-3xl bg-white/5 group-hover:bg-white/10 transition-colors">
                  <MessageSquare className="w-8 h-8 text-indigo-400" />
                </div>
                <span className="text-sm font-black uppercase tracking-widest text-white/80">
                  Group Shoutout
                </span>
              </button>
            </div>

            {/* Market Tracking (Desktop only or scrollable on mobile) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <SurfaceCard
                eyebrow="Economics"
                title="Class Revenue"
                className="bg-emerald-500/10 border-emerald-500/20"
              >
                <div className="mt-4 flex items-end gap-3">
                  <span className="text-4xl font-black text-white tracking-tighter">
                    ${marketStats.revenue}
                  </span>
                  <span className="text-sm font-bold text-emerald-400 mb-1.5">
                    {marketStats.trending}
                  </span>
                </div>
                <p className="text-xs text-white/40 mt-2">
                  Late ticket sales active via Venice agent.
                </p>
              </SurfaceCard>

              <SurfaceCard
                eyebrow="Market"
                title="Conversion"
                className="bg-amber-500/10 border-amber-500/20"
              >
                <div className="mt-4 flex items-end gap-3">
                  <span className="text-4xl font-black text-white tracking-tighter">
                    14%
                  </span>
                  <span className="text-sm font-bold text-amber-400 mb-1.5">
                    +2% vs Avg
                  </span>
                </div>
                <p className="text-xs text-white/40 mt-2">
                  Trial users converting to monthly subs.
                </p>
              </SurfaceCard>
            </div>
          </div>

          {/* Sidebar / Focus Column */}
          <div className="flex flex-col gap-6">
            <div className="sticky top-6 flex flex-col gap-6">
              {/* Agent Control Panel */}
              <GlassCard className="p-6 border-white/10 bg-black/40 backdrop-blur-3xl overflow-hidden relative">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">
                      Agent Status
                    </span>
                    <h3 className="text-lg font-black text-white tracking-tight">
                      Coach Atlas
                    </h3>
                  </div>
                  <div
                    className={`p-2 rounded-xl ${isAgentPaused ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"}`}
                  >
                    <Zap
                      className={`w-5 h-5 ${isAgentPaused ? "" : "animate-pulse"}`}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <LoadingButton
                    variant={isAgentPaused ? "primary" : "secondary"}
                    onClick={() => setIsAgentPaused(!isAgentPaused)}
                    className="w-full py-4 rounded-2xl gap-2 font-black uppercase tracking-widest text-[10px]"
                  >
                    {isAgentPaused ? (
                      <Unlock className="w-4 h-4" />
                    ) : (
                      <Lock className="w-4 h-4" />
                    )}
                    {isAgentPaused ? "Resume Autonomy" : "Pause Agent"}
                  </LoadingButton>

                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 border transition-all font-black uppercase tracking-widest text-[10px] ${
                      isMuted
                        ? "bg-red-500/20 border-red-500/30 text-red-400"
                        : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    {isMuted ? (
                      <MicOff className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                    {isMuted ? "Unmute Coach" : "Mute Coach"}
                  </button>
                </div>

                <div className="mt-8 pt-6 border-t border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">
                      Active Reasoning
                    </span>
                    <div className="flex gap-1">
                      <div className="h-1 w-4 bg-indigo-500 rounded-full" />
                      <div className="h-1 w-2 bg-indigo-500/30 rounded-full" />
                    </div>
                  </div>
                  <p className="text-[11px] text-white/60 leading-relaxed italic">
                    &ldquo;Detecting slight power drop in Group B. Preparing
                    motivational cue for the next climb.&rdquo;
                  </p>
                </div>
              </GlassCard>

              {/* Quick View Leaderboard (Desktop/Mobile scroll) */}
              <div className="p-6 rounded-3xl border border-white/5 bg-white/5 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest">
                    Top Performers
                  </h4>
                  <Users className="w-4 h-4 text-white/20" />
                </div>
                <div className="space-y-4">
                  {[
                    { name: "Satoshi_N", score: "842", trend: "up" },
                    { name: "Vitalik.eth", score: "815", trend: "down" },
                    { name: "CyclingSam", score: "798", trend: "up" },
                  ].map((rider, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-white/20 w-4">
                          {i + 1}
                        </span>
                        <span className="text-xs font-bold text-white/80 group-hover:text-white transition-colors">
                          {rider.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-indigo-400">
                          {rider.score}
                        </span>
                        <TrendingUp
                          className={`w-3 h-3 ${rider.trend === "up" ? "text-emerald-400" : "text-rose-400 rotate-180"}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
