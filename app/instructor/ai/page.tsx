"use client";

import { useState, useEffect } from "react";
import { PrimaryNav } from "@/app/components/layout/nav";
import {
  GlassCard,
  SectionHeader,
  SurfaceCard,
  Tag,
} from "@/app/components/ui/ui";
import { HookVisualizer } from "@/app/agent/hook-visualizer";
import { CoachProfile } from "@/app/agent/coach-profile";
import { TrainingStudio } from "@/app/components/features/coach";

function useAiInstructor(isActive: boolean) {
  const [logs, setLogs] = useState<
    Array<{
      timestamp: number;
      message: string;
      type: "info" | "action" | "alert";
    }>
  >([]);

  const addLog = (
    message: string,
    type: "info" | "action" | "alert" = "info",
  ) => {
    setLogs((prev) => [...prev, { timestamp: Date.now(), message, type }]);
  };

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      const actions = [
        "Scanning mempool for arbitrage...",
        "Rider fatigue detected: lowering difficulty.",
        "Adjusting Uniswap v4 Hook fee -> 0.05%",
        "Sui Move Object sync: 480ms latency",
        "Distributing SPIN rewards to top performers",
      ];
      const randomAction = actions[Math.floor(Math.random() * actions.length)];
      addLog(randomAction, Math.random() > 0.7 ? "action" : "info");
    }, 4000);

    return () => clearInterval(interval);
  }, [isActive]);

  return { logs, addLog };
}

export default function AiInstructorPage() {
  const [activeTab, setActiveTab] = useState<
    "persona" | "training" | "infrastructure"
  >("persona");
  const [agentName, setAgentName] = useState("Coach Atlas");
  const [personality, setPersonality] = useState<
    "zen" | "drill-sergeant" | "data"
  >("drill-sergeant");
  const [suiEnabled, setSuiEnabled] = useState(true);
  const [isActive, setIsActive] = useState(false);

  const { logs, addLog } = useAiInstructor(isActive);

  return (
    <div className="min-h-screen bg-background selection:bg-indigo-500/30">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-20 pt-6 lg:px-12 lg:pt-10">
        <div className="rounded-3xl border border-(--border) bg-(--surface)/80 px-6 py-4 lg:px-8 lg:py-10 backdrop-blur">
          <PrimaryNav />
        </div>

        {/* Mobile-Only Tab Switcher */}
        <div className="lg:hidden flex p-1 bg-black/20 rounded-2xl border border-white/5">
          {[
            { id: "persona", label: "Persona", icon: "👤" },
            { id: "training", label: "Studio", icon: "🎙️" },
            { id: "infrastructure", label: "Infra", icon: "⚙️" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Tag>Agentic Finance</Tag>
            <Tag className="hidden sm:inline-flex">Sui Powered</Tag>
            {isActive && (
              <div className="ml-auto flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                  Live
                </span>
              </div>
            )}
          </div>
          <h1 className="text-3xl lg:text-4xl font-black text-foreground tracking-tighter">
            AI Instructor Studio
          </h1>
        </div>

        {/* Desktop: Multi-Pane | Mobile: Tab-Based */}
        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          {/* Main Content Area */}
          <div className="flex flex-col gap-6">
            {/* Identity Pane (Always visible on desktop, tabbed on mobile) */}
            <div
              className={`${activeTab === "persona" ? "block" : "hidden lg:block"}`}
            >
              <GlassCard className="p-6 lg:p-8">
                <SectionHeader
                  eyebrow="Identity"
                  title="Agent Persona"
                  description="Configure the appearance and behavior of your AI agent."
                />

                <div className="mt-6 grid gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-white/40 uppercase tracking-widest">
                      Agent Name
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={agentName}
                        onChange={(e) => setAgentName(e.target.value)}
                        className="w-full rounded-xl border border-(--border) bg-(--surface-strong) p-3 text-foreground placeholder:text-(--muted) focus:border-indigo-500 focus:outline-none transition-colors"
                      />
                      <div className="flex items-center justify-center rounded-xl bg-(--surface) px-4 font-mono text-sm text-(--muted) border border-(--border)">
                        .eth
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-white/40 uppercase tracking-widest">
                      Coaching Personality
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: "zen", label: "Zen", icon: "🧘" },
                        {
                          id: "drill-sergeant",
                          label: "Drill",
                          icon: "⚡",
                        },
                        { id: "data", label: "Data", icon: "📊" },
                      ].map((p) => (
                        <button
                          key={p.id}
                          onClick={() =>
                            setPersonality(
                              p.id as "zen" | "drill-sergeant" | "data",
                            )
                          }
                          className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all duration-200 ${
                            personality === p.id
                              ? "border-indigo-500 bg-indigo-500/20 text-foreground shadow-[0_0_20px_rgba(99,102,241,0.1)]"
                              : "border-(--border) bg-(--surface) text-(--muted) hover:bg-(--surface-strong)"
                          }`}
                        >
                          <span className="text-2xl">{p.icon}</span>
                          <span className="text-[9px] font-bold uppercase tracking-wider">
                            {p.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </GlassCard>
            </div>

            {/* Training Studio Pane (Always visible on desktop, tabbed on mobile) */}
            <div
              className={`${activeTab === "training" ? "block" : "hidden lg:block"}`}
            >
              <GlassCard className="p-6 lg:p-8 border-indigo-500/10">
                <TrainingStudio />
              </GlassCard>
            </div>

            {/* Infrastructure Pane (Always visible on desktop, tabbed on mobile) */}
            <div
              className={`${activeTab === "infrastructure" ? "block" : "hidden lg:block"}`}
            >
              <SurfaceCard
                eyebrow="Architecture"
                title="Dual-Engine Setup"
                description="Configure how your agent utilizes both chains."
                className="bg-(--surface-strong)"
              >
                <div className="mt-6 space-y-4">
                  <div className="flex items-start gap-4 rounded-xl border border-(--border) bg-(--surface) p-4">
                    <div className="mt-1 grid h-8 w-8 place-items-center rounded-full bg-blue-500/20 text-blue-300">
                      <svg
                        className="h-4 w-4"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 2L2 19.7778H22L12 2Z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground text-sm">
                        Avalanche (Settlement Layer)
                      </h4>
                      <p className="text-xs text-(--muted) mt-1">
                        Handles high-value assets: Tickets (NFTs), $SPIN
                        rewards, and ENS identity.
                      </p>
                    </div>
                  </div>

                  <div
                    className={`flex items-start gap-4 rounded-xl border p-4 transition-all ${
                      suiEnabled
                        ? "border-cyan-500/30 bg-cyan-500/10"
                        : "border-(--border) bg-(--surface) opacity-50"
                    }`}
                  >
                    <div className="mt-1 grid h-8 w-8 place-items-center rounded-full bg-cyan-500/20 text-cyan-300">
                      <span className="font-bold text-xs">💧</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-foreground text-sm">
                          Sui (Performance Layer)
                        </h4>
                        <div
                          className="relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full bg-(--surface-strong)"
                          onClick={() => setSuiEnabled(!suiEnabled)}
                        >
                          <span
                            className={`h-3 w-3 rounded-full bg-foreground shadow-sm transition-transform ${suiEnabled ? "translate-x-5" : "translate-x-1"}`}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-(--muted) mt-1">
                        Processes real-time biometrics (10Hz), adjusts
                        music/lighting agents, and stores route telemetry.
                      </p>
                    </div>
                  </div>
                </div>
              </SurfaceCard>
            </div>
          </div>

          {/* Activity Column (Sidebar on desktop, bottom or separate tab on mobile) */}
          <div className="flex flex-col gap-6">
            <div className="sticky top-6">
              <div className="flex flex-col gap-4 mb-6">
                <button
                  onClick={() => setIsActive(!isActive)}
                  className={`w-full py-4 rounded-2xl font-black uppercase tracking-[0.2em] transition-all ${
                    isActive
                      ? "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                      : "bg-indigo-600 text-white shadow-[0_0_40px_rgba(79,70,229,0.3)] hover:shadow-[0_0_60px_rgba(79,70,229,0.4)]"
                  }`}
                >
                  {isActive ? "Terminate Session" : "Deploy Agent"}
                </button>
                {isActive && (
                  <a
                    href="/instructor/live"
                    className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-center hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                  >
                    <span className="h-1.5 w-1.5 bg-red-500 rounded-full animate-pulse" />
                    Open Live Command Center
                  </a>
                )}
                <p className="text-[10px] text-center text-white/30 font-bold uppercase tracking-widest">
                  {isActive
                    ? "Agent actively monitoring class"
                    : "Ready for deployment"}
                </p>
              </div>

              {isActive && (
                <GlassCard className="p-6 border-cyan-500/20 bg-cyan-500/5 overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-4">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 bg-cyan-500 rounded-full animate-pulse" />
                    </div>
                  </div>
                  <SectionHeader
                    eyebrow="Agent Live"
                    title="Activity Log"
                    description="Real-time decisions."
                  />
                  <div className="mt-6 flex flex-col gap-3 font-mono text-[9px] max-h-[400px] overflow-y-auto">
                    {logs.length === 0 && (
                      <p className="text-(--muted) italic">
                        Waiting for telemetry signals...
                      </p>
                    )}
                    {logs.map((log, i) => (
                      <div
                        key={i}
                        className="flex gap-2 border-l border-(--border) pl-3"
                      >
                        <span className="text-(--muted)">
                          [{new Date(log.timestamp).toLocaleTimeString()}]
                        </span>
                        <span
                          className={
                            log.type === "action"
                              ? "text-cyan-400 font-bold"
                              : log.type === "alert"
                                ? "text-red-400"
                                : "text-(--muted)"
                          }
                        >
                          {log.message}
                        </span>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              )}

              <div className="mt-6 p-6 rounded-3xl border border-white/5 bg-white/5 backdrop-blur-sm">
                <h4 className="text-xs font-black text-white/40 uppercase tracking-widest mb-4">
                  Quick Insights
                </h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/60">Success Rate</span>
                    <span className="text-xs font-bold text-emerald-400">
                      99.8%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/60">
                      Latentency (Sui)
                    </span>
                    <span className="text-xs font-bold text-cyan-400">
                      420ms
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
