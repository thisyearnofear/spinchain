"use client";

import { useState, useEffect } from "react";
import { PrimaryNav } from "../../components/nav";
import {
  GlassCard,
  SectionHeader,
  SurfaceCard,
  Tag,
} from "../../components/ui";
import { HookVisualizer } from "../../agent/hook-visualizer";
import { CoachProfile } from "../../agent/coach-profile";

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
  const [agentName, setAgentName] = useState("Coach Atlas");
  const [personality, setPersonality] = useState<
    "zen" | "drill-sergeant" | "data"
  >("drill-sergeant");
  const [suiEnabled, setSuiEnabled] = useState(true);
  const [isActive, setIsActive] = useState(false);

  const { logs, addLog } = useAiInstructor(isActive);

  return (
    <div className="min-h-screen bg-background selection:bg-indigo-500/30">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-10 lg:px-12">
        <div className="rounded-3xl border border-(--border) bg-(--surface)/80 px-8 py-10 backdrop-blur">
          <PrimaryNav />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Tag>Agentic Finance</Tag>
            <Tag>Sui Powered</Tag>
          </div>
          <h1 className="text-4xl font-bold text-foreground tracking-tight">
            AI Instructor Studio
          </h1>
          <p className="max-w-2xl text-lg text-(--muted)">
            Deploy autonomous agents that manage your classes, adjust difficulty
            in real-time, and optimize revenue using Uniswap v4 hooks.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          {/* Configuration Column */}
          <div className="flex flex-col gap-6">
            <GlassCard className="p-8">
              <SectionHeader
                eyebrow="Identity"
                title="Agent Persona"
                description="Configure the appearance and behavior of your AI agent."
              />

              <div className="mt-6 grid gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
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
                  <label className="text-sm font-medium text-foreground">
                    Coaching Personality
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: "zen", label: "Zen Master", icon: "🧘" },
                      {
                        id: "drill-sergeant",
                        label: "Drill Sergeant",
                        icon: "⚡",
                      },
                      { id: "data", label: "Quant Analyst", icon: "📊" },
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
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          {p.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </GlassCard>

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
                    <h4 className="font-semibold text-foreground">
                      Avalanche (Settlement Layer)
                    </h4>
                    <p className="text-sm text-(--muted)">
                      Handles high-value assets: Tickets (NFTs), $SPIN rewards,
                      and ENS identity.
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
                      <h4 className="font-semibold text-foreground">
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
                    <p className="text-sm text-(--muted) mt-1">
                      Processes real-time biometrics (10Hz), adjusts
                      music/lighting agents, and stores route telemetry cheaply.
                    </p>
                  </div>
                </div>
              </div>
            </SurfaceCard>

            {isActive && (
              <GlassCard className="p-8 border-cyan-500/20 bg-cyan-500/5 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 bg-cyan-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest">
                      Live Syncing
                    </span>
                  </div>
                </div>
                <SectionHeader
                  eyebrow="Agent Live"
                  title="Autonomous Activity Log"
                  description="Real-time decisions being pushed to Sui."
                />
                <div className="mt-6 flex flex-col gap-3 font-mono text-[10px]">
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
          </div>

          {/* Preview Column */}
          <div className="flex flex-col gap-6">
            <CoachProfile
              name={agentName}
              personality={personality}
              onDeploy={() => {
                setIsActive(true);
                addLog(
                  `Agent ${agentName} initialized on Sui Performance Layer.`,
                  "info",
                );
              }}
            />

            <HookVisualizer />
          </div>
        </div>
      </main>
    </div>
  );
}
