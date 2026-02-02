"use client";

import { useState } from "react";
import { PrimaryNav } from "../../components/nav";
import {
  GlassCard,
  SectionHeader,
  SurfaceCard,
  Tag,
  GradientText,
  BulletList,
} from "../../components/ui";
import { useAiInstructor } from "../../hooks/use-ai-instructor";
import { useAccount } from "wagmi";

export default function AiInstructorPage() {
  const [agentName, setAgentName] = useState("Coach Atlas");
  const [personality, setPersonality] = useState("drill-sergeant");
  const [suiEnabled, setSuiEnabled] = useState(true);
  const [sessionObjectId, setSessionObjectId] = useState<string | null>(null);

  const { logs, isActive, setIsActive, addLog } = useAiInstructor(
    agentName,
    personality as any,
    sessionObjectId
  );

  const capabilities = [
    "Autonomous class scheduling on Base",
    "Real-time pacing adjustments via Sui Move",
    "Liquidity management on Uniswap v4",
    "Cross-chain reputation bridging (Yellow)",
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1a2550,transparent_55%),radial-gradient(circle_at_80%_20%,#2a1d5a,transparent_40%)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-10 lg:px-12">
        <div className="rounded-3xl border border-white/10 bg-[color:var(--surface)]/80 px-8 py-10 backdrop-blur">
          <PrimaryNav />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Tag>Agentic Finance</Tag>
            <Tag>Sui Powered</Tag>
          </div>
          <h1 className="text-4xl font-bold text-white">
            AI Instructor Studio
          </h1>
          <p className="max-w-2xl text-lg text-white/60">
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
                title="Agent Profile"
                description="This identity will live on Ethereum (ENS) and bridge state to Sui."
              />

              <div className="mt-6 grid gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/80">
                    Agent Name
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-white placeholder:text-white/20 focus:border-indigo-500 focus:outline-none"
                    />
                    <div className="flex items-center justify-center rounded-xl bg-white/5 px-4 font-mono text-sm text-white/50">
                      .eth
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/80">
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
                        onClick={() => setPersonality(p.id)}
                        className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${personality === p.id
                          ? "border-indigo-500 bg-indigo-500/20 text-white"
                          : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                          }`}
                      >
                        <span className="text-2xl">{p.icon}</span>
                        <span className="text-xs font-medium">{p.label}</span>
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
              className="bg-[color:var(--surface-strong)]"
            >
              <div className="mt-6 space-y-4">
                <div className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
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
                    <h4 className="font-semibold text-white">
                      Base (Settlement Layer)
                    </h4>
                    <p className="text-sm text-white/60">
                      Handles high-value assets: Tickets (NFTs), $SPIN rewards,
                      and ENS identity.
                    </p>
                  </div>
                </div>

                <div
                  className={`flex items-start gap-4 rounded-xl border p-4 transition-all ${suiEnabled
                    ? "border-cyan-500/30 bg-cyan-500/10"
                    : "border-white/10 bg-white/5 opacity-50"
                    }`}
                >
                  <div className="mt-1 grid h-8 w-8 place-items-center rounded-full bg-cyan-500/20 text-cyan-300">
                    <span className="font-bold text-xs">💧</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-white">
                        Sui (Performance Layer)
                      </h4>
                      <div
                        className="relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full bg-white/20"
                        onClick={() => setSuiEnabled(!suiEnabled)}
                      >
                        <span
                          className={`h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${suiEnabled ? "translate-x-5" : "translate-x-1"}`}
                        />
                      </div>
                    </div>
                    <p className="text-sm text-white/60 mt-1">
                      Processes real-time biometrics (10Hz), adjusts
                      music/lighting agents, and stores route telemetry cheaply.
                    </p>
                  </div>
                </div>
              </div>
            </SurfaceCard>

            {isActive && (
              <GlassCard className="p-8 border-cyan-500/20 bg-cyan-500/5">
                <SectionHeader
                  eyebrow="Agent Live"
                  title="Autonomous Activity Log"
                  description="Real-time decisions being pushed to Sui."
                />
                <div className="mt-6 flex flex-col gap-3 font-mono text-[10px]">
                  {logs.length === 0 && (
                    <p className="text-white/20 italic">
                      Waiting for telemetry signals...
                    </p>
                  )}
                  {logs.map((log, i) => (
                    <div
                      key={i}
                      className="flex gap-2 border-l border-white/10 pl-3"
                    >
                      <span className="text-white/30">
                        [{new Date(log.timestamp).toLocaleTimeString()}]
                      </span>
                      <span
                        className={
                          log.type === "action"
                            ? "text-cyan-400 font-bold"
                            : log.type === "alert"
                              ? "text-red-400"
                              : "text-white/60"
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
            <GlassCard className="relative overflow-hidden p-0">
              <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-black p-8 text-center">
                <div className="mx-auto h-24 w-24 overflow-hidden rounded-full border-4 border-white/10 shadow-2xl">
                  <div className="grid h-full w-full place-items-center bg-black text-4xl">
                    {personality === "zen"
                      ? "🧘"
                      : personality === "drill-sergeant"
                        ? "⚡"
                        : "📊"}
                  </div>
                </div>
                <h3 className="mt-4 text-2xl font-bold text-white">
                  {agentName}
                </h3>
                <p className="text-indigo-200">AI Instructor • Level 1</p>
              </div>
              <div className="p-6">
                <h4 className="text-xs uppercase tracking-widest text-white/50">
                  Capabilities
                </h4>
                <div className="mt-4">
                  <BulletList items={capabilities} />
                </div>

                <div className="mt-6 border-t border-white/10 pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">ENS Status</span>
                    <span className="text-green-400">Available</span>
                  </div>
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-white/60">Sui Object ID</span>
                    <span className="font-mono text-white/40">Pending...</span>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3">
                  {!isActive ? (
                    <button
                      onClick={() => {
                        setSessionObjectId("0xSESSION_MOCK");
                        setIsActive(true);
                        addLog(`Agent initialized on Sui Performance Layer.`, "info");
                      }}
                      className="w-full rounded-full bg-white py-3 text-sm font-bold text-black transition hover:bg-gray-200"
                    >
                      Deploy & Start Agent (0.05 ETH)
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsActive(false)}
                      className="w-full rounded-full bg-red-500/20 border border-red-500/30 py-3 text-sm font-bold text-red-400 transition hover:bg-red-500/30"
                    >
                      Pause Agent
                    </button>
                  )}

                  {suiEnabled && !isActive && (
                    <div className="flex flex-col gap-2">
                      <div className="h-px bg-white/10 w-full my-1" />
                      <p className="text-[10px] text-white/40 uppercase tracking-widest text-center">Sui Integration</p>
                      <button className="w-full rounded-full border border-cyan-500/30 bg-cyan-500/10 py-3 text-sm font-bold text-cyan-300 transition hover:bg-cyan-500/20">
                        Connect Sui for Telemetry
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>

            <SurfaceCard
              eyebrow="Integration"
              title="Uniswap v4 Hooks"
              className="border-dashed bg-transparent"
            >
              <p className="mb-4 text-sm text-white/60">
                This agent can automatically manage liquidity for your class
                tokens based on attendance demand.
              </p>
              <Tag>Liquidity Agent</Tag>
            </SurfaceCard>
          </div>
        </div>
      </main>
    </div>
  );
}
