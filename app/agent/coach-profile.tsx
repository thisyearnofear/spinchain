"use client";

import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useState, useEffect } from "react";
import { SUI_CONFIG } from "../config";
import {
  Loader2,
  Zap,
  Activity,
  Brain,
  Shield,
  Settings2,
  ArrowRight,
  TrendingUp,
  Flame,
  Wind,
  MessageSquare,
} from "lucide-react";
import { useAgentReasoner } from "../hooks/use-agent-reasoner";
import { useProfile, getDisplayName, getAvatarUrl } from "../hooks/use-profile";

interface CoachProfileProps {
  name?: string;
  personality?: "zen" | "drill-sergeant" | "data";
  onDeploy?: (id: string) => void;
  instructorAddress?: string; // For ENS resolution
}

type GenesisStep = "persona" | "strategy" | "review";

interface SuiCoachData {
  dataType: string;
  fields: {
    current_tempo: string;
    resistance_level: number;
    [key: string]: unknown;
  };
}

export function CoachProfile({
  name: initialName = "Coach Atlas",
  personality: initialPersonality = "drill-sergeant",
  onDeploy,
  instructorAddress,
}: CoachProfileProps) {
  const client = useSuiClient();
  const account = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  
  // Resolve instructor profile (ENS, etc.)
  const { profile: instructorProfile } = useProfile(instructorAddress);

  // Step State
  const [step, setStep] = useState<GenesisStep>("persona");
  const [coachId, setCoachId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [coachData, setCoachData] = useState<SuiCoachData | null>(null);

  // Configuration State
  const [config, setConfig] = useState({
    name: initialName,
    personality: initialPersonality,
    minBpm: 60,
    maxBpm: 180,
    maxResistance: 80,
    strategyType: 1, // 0=Recovery, 1=Balanced, 2=HIIT, 3=Yield
  });

  // AI Reasoning Hook
  const {
    reason,
    thoughtLog,
    state: reasoningState,
  } = useAgentReasoner({
    agentName: config.name,
    personality: config.personality,
    enabled: !!coachId,
  });

  // Poll for coach data if we have an ID
  useEffect(() => {
    if (!coachId) return;

    const fetchCoach = async () => {
      try {
        const obj = await client.getObject({
          id: coachId,
          options: { showContent: true },
        });
        setCoachData(obj.data?.content as unknown as SuiCoachData);

        // Trigger AI Reasoning on new data fetch
        reason({
          telemetry: {
            avgBpm: 145, // Mock data for now
            resistance: 65,
            duration: 25,
          },
          market: {
            ticketsSold: 85,
            revenue: 2.4,
          },
        });
      } catch (e) {
        console.error("Failed to fetch coach", e);
      }
    };

    fetchCoach();
    const interval = setInterval(fetchCoach, 5000);
    return () => clearInterval(interval);
  }, [coachId, client, reason]);

  const deployCoach = async () => {
    if (!account) return;
    setIsLoading(true);

    try {
      const tx = new Transaction();

      // Map personality to numeric value
      const personalityValue = config.personality === "zen" ? 0 : config.personality === "data" ? 2 : 1;

      // Default inference model and prompt CID (can be customized in future)
      const inferenceModel = "gemini::flash";
      const systemPromptCid = "ipfs://QmDefaultCoachPrompt"; // Placeholder - should be actual CID

      // target: package::module::function
      tx.moveCall({
        target: `${SUI_CONFIG.packageId}::spinsession::create_coach`,
        arguments: [
          tx.pure.string(config.name),
          tx.pure.u8(personalityValue),
          tx.pure.u64(config.minBpm),
          tx.pure.u64(config.maxBpm),
          tx.pure.u8(config.maxResistance),
          tx.pure.u8(config.strategyType),
          tx.pure.string(inferenceModel),
          tx.pure.string(systemPromptCid),
        ],
      });

      await signAndExecuteTransaction(
        {
          transaction: tx as unknown as Parameters<typeof signAndExecuteTransaction>[0]['transaction'],
        },
        {
          onSuccess: (result) => {
            console.log("Coach Genesis complete:", result);
            setIsLoading(false);
            // Extract actual coach ID from transaction effects
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const createdObjects = (result.effects as any)?.created;
            if (createdObjects && createdObjects.length > 0) {
              const coachObjectId = createdObjects[0].reference.objectId;
              setCoachId(coachObjectId);
              if (onDeploy) onDeploy(coachObjectId);
            } else {
              // Fallback for testing
              setCoachId("0xSUI_AGENT_LIVE");
              if (onDeploy) onDeploy("0xSUI_AGENT_LIVE");
            }
          },
          onError: (err: Error) => {
            console.error("Genesis failed", err);
            setIsLoading(false);
          },
        },
      );
    } catch (err) {
      console.error("Failed to deploy coach:", err);
      setIsLoading(false);
    }
  };

  const strategies = [
    { id: 0, label: "Recovery", icon: Wind, color: "text-blue-400" },
    { id: 1, label: "Balanced", icon: Activity, color: "text-green-400" },
    { id: 2, label: "HIIT", icon: Flame, color: "text-orange-400" },
    { id: 3, label: "Yield Max", icon: TrendingUp, color: "text-indigo-400" },
  ];

  if (coachId) {
    return (
      <div className="w-full rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-6 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-white/80">
              Agent Online
            </h3>
          </div>
          <Tag label="Sui Performance Layer" />
        </div>

        <div className="mt-6 flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-linear-to-tr from-indigo-600 to-purple-600 p-1">
            <div className="flex h-full w-full items-center justify-center rounded-full bg-black overflow-hidden">
              <img 
                src={getAvatarUrl(instructorProfile)} 
                alt={getDisplayName(instructorProfile, instructorAddress || '')}
                className="h-full w-full object-cover"
                onError={(e) => {
                  // Fallback to icon on image error
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                }}
              />
              <Brain className="text-indigo-400 fallback-icon hidden" />
            </div>
          </div>
          <div>
            <h4 className="text-xl font-bold text-white">
              {getDisplayName(instructorProfile, instructorAddress || config.name)}
            </h4>
            <p className="text-xs text-white/40">
              Autonomous AI Instructor • Level 1
              {instructorProfile?.platform && (
                <span className="ml-2 text-indigo-400">• {instructorProfile.platform.toUpperCase()}</span>
              )}
            </p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-white/5 p-4 border border-white/10">
            <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">
              Current Pacing
            </p>
            <p className="text-2xl font-mono text-white">
              {coachData?.fields?.current_tempo || config.minBpm}{" "}
              <span className="text-xs">BPM</span>
            </p>
          </div>
          <div className="rounded-xl bg-white/5 p-4 border border-white/10">
            <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">
              Resistance
            </p>
            <p className="text-2xl font-mono text-white">
              {coachData?.fields?.resistance_level || 0}%
            </p>
          </div>
        </div>

        <div className="mt-4 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-3 w-3 text-indigo-400" />
            <span className="text-[10px] font-bold uppercase text-indigo-300">
              Operational Guardrails
            </span>
          </div>
          <div className="flex justify-between text-[10px] text-white/60">
            <span>
              BPM: {config.minBpm}-{config.maxBpm}
            </span>
            <span>Max Res: {config.maxResistance}%</span>
            <span className="capitalize">
              Strategy:{" "}
              {strategies.find((s) => s.id === config.strategyType)?.label}
            </span>
          </div>
        </div>

        {/* Live Thought Stream */}
        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="h-3 w-3 text-indigo-400" />
            <span className="text-[10px] font-bold uppercase text-indigo-300">
              Cognitive Stream ({reasoningState})
            </span>
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
            {thoughtLog.length === 0 ? (
              <p className="text-[10px] text-white/30 italic">
                Waiting for reasoning...
              </p>
            ) : (
              thoughtLog.map((thought, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-[10px] text-white/30 font-mono">
                    [{new Date().toLocaleTimeString()}]
                  </span>
                  <p className="text-[10px] text-white/70 leading-relaxed font-mono">
                    &quot;{thought}&quot;
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Agent Genesis</h3>
          <p className="text-xs text-white/50">
            Configure & Deploy Instructor Twin
          </p>
        </div>
        <div className="flex items-center gap-1">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-1 w-4 rounded-full transition-colors ${(step === "persona" && i === 1) ||
                  (step === "strategy" && i <= 2) ||
                  (step === "review" && i <= 3)
                  ? "bg-indigo-500"
                  : "bg-white/10"
                }`}
            />
          ))}
        </div>
      </div>

      <div className="mt-6">
        {step === "persona" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-white/40">
                Agent Name
              </label>
              <input
                type="text"
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-white/40">
                Personality Matrix
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "zen", label: "Zen", icon: "🧘" },
                  { id: "drill-sergeant", label: "Drill", icon: "⚡" },
                  { id: "data", label: "Quant", icon: "📊" },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() =>
                      setConfig({
                        ...config,
                        personality: p.id as "zen" | "drill-sergeant" | "data",
                      })
                    }
                    className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition-all ${config.personality === p.id
                        ? "border-indigo-500 bg-indigo-500/20 text-white"
                        : "border-white/5 bg-white/5 text-white/40 hover:bg-white/10"
                      }`}
                  >
                    <span className="text-xl">{p.icon}</span>
                    <span className="text-[10px] font-bold uppercase">
                      {p.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => setStep("strategy")}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 p-3 text-sm font-bold text-white hover:bg-white/10"
            >
              Configure Strategy <ArrowRight size={16} />
            </button>
          </div>
        )}

        {step === "strategy" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase tracking-wider text-white/40">
                  BPM Boundaries
                </label>
                <span className="text-xs font-mono text-white">
                  {config.minBpm} - {config.maxBpm}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="range"
                  min="40"
                  max="100"
                  value={config.minBpm}
                  onChange={(e) =>
                    setConfig({ ...config, minBpm: parseInt(e.target.value) })
                  }
                  className="accent-indigo-500"
                />
                <input
                  type="range"
                  min="120"
                  max="220"
                  value={config.maxBpm}
                  onChange={(e) =>
                    setConfig({ ...config, maxBpm: parseInt(e.target.value) })
                  }
                  className="accent-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-white/40">
                Operational Mandate
              </label>
              <div className="grid grid-cols-2 gap-2">
                {strategies.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setConfig({ ...config, strategyType: s.id })}
                    className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${config.strategyType === s.id
                        ? "border-indigo-500 bg-indigo-500/20"
                        : "border-white/5 bg-white/5 hover:bg-white/10"
                      }`}
                  >
                    <s.icon
                      size={16}
                      className={
                        config.strategyType === s.id ? s.color : "text-white/20"
                      }
                    />
                    <span
                      className={`text-[10px] font-bold uppercase ${config.strategyType === s.id ? "text-white" : "text-white/40"}`}
                    >
                      {s.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStep("persona")}
                className="p-3 rounded-xl bg-white/5 text-white/40 hover:bg-white/10"
              >
                <Settings2 size={16} />
              </button>
              <button
                onClick={() => setStep("review")}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white/5 p-3 text-sm font-bold text-white hover:bg-white/10"
              >
                Review Genesis <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="rounded-xl bg-indigo-500/5 border border-indigo-500/20 p-4 space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Identity</span>
                <span className="text-white font-bold">
                  {getDisplayName(instructorProfile, instructorAddress || `${config.name}.eth`)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Personality</span>
                <span className="text-white capitalize">
                  {config.personality}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Guardrails</span>
                <span className="text-white">
                  {config.minBpm}-{config.maxBpm} BPM
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Network</span>
                <span className="text-cyan-400 font-bold">SUI TESTNET</span>
              </div>
            </div>

            {account ? (
              <button
                onClick={deployCoach}
                disabled={isLoading}
                className="relative group w-full overflow-hidden rounded-xl bg-indigo-600 px-4 py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-indigo-500/20 transition-all hover:bg-indigo-500 disabled:opacity-50"
              >
                <div className="relative z-10 flex items-center justify-center gap-2">
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  <span>
                    {isLoading ? "Broadcasting..." : "Initiate Genesis"}
                  </span>
                </div>
                <div className="absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
              </button>
            ) : (
              <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-4 text-center text-xs text-yellow-200">
                Connect Sui Wallet to Finalize Agent Deployment
              </div>
            )}
            <button
              onClick={() => setStep("strategy")}
              className="w-full text-[10px] uppercase font-bold text-white/20 hover:text-white/40 tracking-widest transition-colors"
            >
              Back to Configuration
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <div className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest text-indigo-300 border border-indigo-500/30">
      {label}
    </div>
  );
}
