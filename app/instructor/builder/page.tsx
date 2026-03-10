"use client";

import { useState } from "react";
import { PrimaryNav } from "@/app/components/layout/nav";
import {
  BulletList,
  GlassCard,
  SectionHeader,
  SurfaceCard,
  Tag,
} from "@/app/components/ui/ui";
import { useCreateClass } from "@/app/hooks/evm/use-create-class";
import { useClassWithRoute, getDeploymentStepText } from "@/app/hooks/common/use-class-with-route";
import { RouteSelectionStep } from "@/app/components/features/route/route-selection-step";
import { INCENTIVE_ENGINE_ADDRESS, SPIN_TOKEN_ADDRESS } from "@/app/lib/contracts";
import { useAccount } from "wagmi";
import type { SavedRoute } from "@/app/lib/route-library";
import type { GpxSummary } from "@/app/routes/builder/gpx-uploader";

import { SelectionGarage } from "@/app/components/features/common/selection-garage";
import type { AvatarAsset, EquipmentAsset, WorldAsset } from "@/app/lib/selection-library";

type ClassFormData = {
  name: string;
  date: string;
  capacity: number;
  basePrice: number;
  maxPrice: number;
  curveType: "linear" | "exponential";
  rewardThreshold: number;
  rewardAmount: number;
  suiPerformance: boolean;
  // NEW: AI configuration
  aiEnabled?: boolean;
  aiPersonality?: "zen" | "drill-sergeant" | "data";
  // NEW: Selection
  avatarId?: string;
  equipmentId?: string;
  worldId?: string;
};

function PricingCurveVisualizer({
  data,
  capacity,
}: {
  data: ClassFormData;
  capacity: number;
}) {
  // Generate points for SVG path
  const width = 400;
  const height = 200;
  const padding = 20;

  const points = [];
  const steps = 20;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // 0 to 1 representing ticket sales progress
    const x = padding + t * (width - 2 * padding);

    // Calculate price based on curve
    let priceRatio = 0;
    if (data.curveType === "linear") {
      priceRatio = t;
    } else {
      priceRatio = t * t; // Simple exponential
    }

    const price =
      data.basePrice + (data.maxPrice - data.basePrice) * priceRatio;
    const normalizedPrice =
      (price - data.basePrice) / (data.maxPrice - data.basePrice || 1);

    // Y is inverted in SVG (0 is top)
    const y = height - padding - normalizedPrice * (height - 2 * padding);
    points.push(`${x},${y}`);
  }

  const pathD = `M ${points.join(" L ")}`;

  // Gradient area path
  const areaD = `${pathD} L ${width - padding},${height - padding} L ${padding},${height - padding} Z`;

  return (
    <div className="group relative h-64 w-full overflow-hidden rounded-3xl border border-white/10 bg-black/40 p-6 backdrop-blur-3xl shadow-2xl">
      {/* Tactical Border Glow */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-indigo-500/20 rounded-3xl blur opacity-30 group-hover:opacity-70 transition duration-1000"></div>
      
      <div className="relative">
        <div className="absolute left-6 top-6 z-10">
          <div className="flex items-center gap-2 mb-1">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400">
              Price Trajectory
            </p>
          </div>
          <p className="text-2xl font-black text-white tracking-tighter">
            {data.basePrice} ETH <span className="text-white/30">→</span> {data.maxPrice} ETH
          </p>
        </div>

        <svg className="h-full w-full" viewBox={`0 0 ${width} ${height}`}>
          <defs>
            <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6ef3c6" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#6ef3c6" stopOpacity="0" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grid lines - Tactical */}
          <line
            x1={padding}
            y1={height - padding}
            x2={width - padding}
            y2={height - padding}
            stroke="#ffffff"
            strokeOpacity="0.08"
          />
          <line
            x1={padding}
            y1={padding}
            x2={padding}
            y2={height - padding}
            stroke="#ffffff"
            strokeOpacity="0.08"
          />

          {/* Horizontal grid lines */}
          {[0.25, 0.5, 0.75].map((y) => (
            <line
              key={y}
              x1={padding}
              y1={padding + y * (height - 2 * padding)}
              x2={width - padding}
              y2={padding + y * (height - 2 * padding)}
              stroke="#ffffff"
              strokeOpacity="0.04"
              strokeDasharray="4 4"
            />
          ))}

          {/* The Curve - Glowing */}
          <path d={areaD} fill="url(#curveGradient)" />
          <path
            d={pathD}
            fill="none"
            stroke="#6ef3c6"
            strokeWidth="3"
            strokeLinecap="round"
            filter="url(#glow)"
            className="drop-shadow-[0_0_10px_rgba(110,243,198,0.5)]"
          />

          {/* Current price indicator dot */}
          {capacity > 0 && (
            <circle
              cx={padding + (capacity / 100) * (width - 2 * padding)}
              cy={height - padding - (data.curveType === "linear" ? capacity / 100 : (capacity / 100) ** 2) * (height - 2 * padding)}
              r="6"
              fill="#6ef3c6"
              className="animate-pulse"
            />
          )}

          {/* Labels - Mono-spaced telemetry look */}
          <text
            x={width - padding}
            y={height - 8}
            textAnchor="end"
            fontSize="10"
            fontFamily="mono"
            fill="rgba(255,255,255,0.4)"
            className="uppercase tracking-wider"
          >
            [{capacity} sold]
          </text>
          <text
            x={padding}
            y={height - 8}
            textAnchor="start"
            fontSize="10"
            fontFamily="mono"
            fill="rgba(255,255,255,0.4)"
            className="uppercase tracking-wider"
          >
            [0 sold]
          </text>
        </svg>
      </div>
      
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-8 h-8 border-l-2 border-t-2 border-white/10 rounded-tl-2xl" />
      <div className="absolute top-0 right-0 w-8 h-8 border-r-2 border-t-2 border-white/10 rounded-tr-2xl" />
      <div className="absolute bottom-0 left-0 w-8 h-8 border-l-2 border-b-2 border-white/10 rounded-bl-2xl" />
      <div className="absolute bottom-0 right-0 w-8 h-8 border-r-2 border-b-2 border-white/10 rounded-br-2xl" />
    </div>
  );
}

import { Tooltip } from "@/app/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";

export default function InstructorBuilderPage() {
  const { address: userAddress } = useAccount();
  const { createClass, isPending, isSuccess, error: deployError, hash } = useCreateClass();
  const {
    deployClassWithRoute,
    deploymentStep,
    isPending: isDeploying,
    isSuccess: deploySuccess
  } = useClassWithRoute();

  const [step, setStep] = useState(0); 
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState<SavedRoute | null>(null);
  const [gpxSummary, setGpxSummary] = useState<GpxSummary | null>(null);
  
  const onboardingTips = [
    "Start by choosing a race track for your riders.",
    "Give your class a name and schedule it on the calendar.",
    "Pick your character, bike, and world theme.",
    "Set the ticket price curve - early birds pay less!",
    "Define how much riders can earn for their effort.",
    "Review everything and deploy your smart contract."
  ];

  // ... rest of the component
  
  const [formData, setFormData] = useState<ClassFormData>({
    name: "Morning Mountain Climb",
    date: "2026-03-12T09:00",
    capacity: 50,
    basePrice: 0.02,
    maxPrice: 0.08,
    curveType: "linear",
    rewardThreshold: 150,
    rewardAmount: 20,
    suiPerformance: true,
  });

  const steps = [
    { number: 0, title: "Route" },
    { number: 1, title: "Basics" },
    { number: 2, title: "Character & Gear" }, // NEW
    { number: 3, title: "Economics" },
    { number: 4, title: "AI & Rewards" },
    { number: 5, title: "Deploy" },
  ];
  
  // Auto-populate from route
  const handleRouteSelected = (route: SavedRoute, summary: GpxSummary, smartConfig?: { formData: Partial<ClassFormData> }) => {
    setSelectedRoute(route);
    setGpxSummary(summary);
    
    // Auto-fill form data from route
    setFormData(prev => ({
      ...prev,
      name: route.name,
      // Duration could be synced with route if needed
    }));
    
    // If smart config is provided, apply AI suggestions
    if (smartConfig?.formData) {
      setFormData(prev => ({
        ...prev,
        ...smartConfig.formData,
      }));
    }
    
    // Move to next step
    setStep(1);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? parseFloat(value) : value,
    }));
  };

  const startPractice = () => {
    if (!selectedRoute || !gpxSummary || !userAddress) return;

    const routeDuration = Math.round(gpxSummary.segments.reduce((acc, s) => acc + s.minutes, 0));
    const routeElevation = (gpxSummary.maxElevation || 0) - (gpxSummary.minElevation || 0);

    // Build URL params for practice mode
    const params = new URLSearchParams({
      mode: "practice",
      name: formData.name,
      date: formData.date,
      instructor: userAddress,
      capacity: formData.capacity.toString(),
      basePrice: formData.basePrice.toString(),
      maxPrice: formData.maxPrice.toString(),
      curveType: formData.curveType,
      rewardThreshold: formData.rewardThreshold.toString(),
      rewardAmount: formData.rewardAmount.toString(),
      aiEnabled: (formData.aiEnabled ?? true).toString(),
      aiPersonality: formData.aiPersonality || "drill-sergeant",
      routeName: selectedRoute.name,
      routeDistance: (gpxSummary.distanceKm || 20).toString(),
      routeDuration: routeDuration.toString(),
      routeElevation: routeElevation.toString(),
      // NEW: Selection
      avatarId: formData.avatarId || "default-human",
      equipmentId: formData.equipmentId || "spin-bike-01",
      worldId: formData.worldId || "neon-city",
    });

    window.location.href = `/rider/ride/practice-${Date.now()}?${params.toString()}`;
  };

  return (
    <div className="min-h-screen bg-[color:var(--background)] relative">
      {/* Onboarding Overlay */}
      <AnimatePresence>
        {showOnboarding && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="max-w-md w-full bg-[#12141c] border border-white/10 rounded-3xl p-8 shadow-2xl"
            >
              <div className="h-16 w-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-6">
                <span className="text-3xl">🏗️</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Welcome, Instructor!</h2>
              <p className="text-white/60 mb-8 leading-relaxed">
                You&apos;re about to build a programmable spin class. Follow the 6 steps to configure your route, identity, and economics.
              </p>
              
              <div className="space-y-4 mb-8">
                {["Select Track", "Identity & Gear", "Program Economics"].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-white/80">
                    <div className="h-5 w-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px] font-bold text-indigo-400">
                      {i + 1}
                    </div>
                    {item}
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowOnboarding(false)}
                className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-indigo-500/20"
              >
                Let&apos;s Build!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-10 lg:px-12">
        <div className="group relative rounded-3xl border border-white/10 bg-black/40 px-8 py-10 backdrop-blur-3xl shadow-2xl overflow-hidden">
          {/* Tactical glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 rounded-3xl blur opacity-30"></div>
          <PrimaryNav />
        </div>

        {/* Header */}
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h1 className="text-4xl font-black text-white tracking-tighter">Class Builder</h1>
            <p className="mt-2 text-white/50 font-medium">
              Configure your programmable class contract.
            </p>
          </div>
          <div className="flex gap-2 p-1.5 rounded-full bg-black/40 border border-white/10 backdrop-blur-xl">
            {steps.map((s) => (
              <div
                key={s.number}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-widest transition-all ${
                  step === s.number
                    ? "bg-white text-black shadow-lg"
                    : step > s.number
                      ? "bg-indigo-500/20 text-indigo-300"
                      : "text-white/40 hover:text-white"
                }`}
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                  step === s.number ? "bg-black/10" : "bg-white/10"
                }`}>
                  {s.number}
                </span>
                <span className="hidden sm:inline">{s.title}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          {/* Main Form Area */}
          <div className="space-y-6">
            {/* Step 0: Route Selection */}
            {step === 0 && (
              <div className="space-y-6">
                <div className="group relative rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-5 backdrop-blur-xl overflow-hidden">
                  <div className="absolute -inset-1 bg-indigo-500/10 blur-xl opacity-50"></div>
                  <div className="relative flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                      <span className="text-2xl">💡</span>
                    </div>
                    <p className="text-sm text-indigo-200 font-medium">{onboardingTips[0]}</p>
                  </div>
                </div>
                <RouteSelectionStep
                  onRouteSelected={handleRouteSelected}
                  selectedRoute={selectedRoute}
                />
              </div>
            )}

            {step === 1 && (
              <div className="group relative rounded-3xl border border-white/10 bg-black/40 p-8 backdrop-blur-3xl shadow-2xl overflow-hidden">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/10 rounded-3xl blur opacity-30"></div>
                <div className="relative space-y-6">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                      <span className="text-lg">📋</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-400">Step 1</p>
                      <h2 className="text-2xl font-black text-white tracking-tighter">Class Details</h2>
                    </div>
                  </div>
                  <p className="text-sm text-white/50 font-medium mb-6">{onboardingTips[1]}</p>
                  <div className="grid gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-white/40">
                        Class Name
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-white placeholder:text-white/20 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
                      />
                    </div>
                    <div className="grid gap-6 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-white/40">
                          Date & Time
                        </label>
                        <input
                          type="datetime-local"
                          name="date"
                          value={formData.date}
                          onChange={handleInputChange}
                          className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all [color-scheme:dark]"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-white/40">
                          Max Capacity
                        </label>
                        <input
                          type="number"
                          name="capacity"
                          value={formData.capacity}
                          onChange={handleInputChange}
                          className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="group relative rounded-2xl border border-pink-500/20 bg-pink-500/5 p-5 backdrop-blur-xl overflow-hidden">
                  <div className="absolute -inset-1 bg-pink-500/10 blur-xl opacity-50"></div>
                  <div className="relative flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
                      <span className="text-2xl">🎨</span>
                    </div>
                    <p className="text-sm text-pink-200 font-medium">{onboardingTips[2]}</p>
                  </div>
                </div>
                <SelectionGarage
                  onSelectionChange={(selection) => {
                    setFormData(prev => ({
                      ...prev,
                      avatarId: selection.avatar.id,
                      equipmentId: selection.equipment.id,
                      worldId: selection.world.id,
                    }));
                  }}
                  initialSelection={{
                    avatarId: formData.avatarId,
                    equipmentId: formData.equipmentId,
                    worldId: formData.worldId,
                  }}
                />
              </div>
            )}

            {step === 3 && (
              <div className="group relative rounded-3xl border border-white/10 bg-black/40 p-8 backdrop-blur-3xl shadow-2xl overflow-hidden">
                <div className="absolute -inset-1 bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-green-500/10 rounded-3xl blur opacity-30"></div>
                <div className="relative space-y-6">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="h-10 w-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                      <span className="text-lg">💰</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-green-400">Step 3</p>
                      <h2 className="text-2xl font-black text-white tracking-tighter">Token Economics</h2>
                    </div>
                  </div>
                  <p className="text-sm text-white/50 font-medium mb-6">{onboardingTips[3]}</p>
                  <PricingCurveVisualizer
                    data={formData}
                    capacity={formData.capacity}
                  />
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-white/40">
                        Base Price (ETH)
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        name="basePrice"
                        value={formData.basePrice}
                        onChange={handleInputChange}
                        className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-white/40">
                        Max Price (ETH)
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        name="maxPrice"
                        value={formData.maxPrice}
                        onChange={handleInputChange}
                        className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-white/40">
                      Curve Logic
                    </label>
                    <select
                      name="curveType"
                      value={formData.curveType}
                      onChange={handleInputChange}
                      className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
                    >
                      <option value="linear" className="bg-black">Linear (Constant ramp)</option>
                      <option value="exponential" className="bg-black">
                        Exponential (Early bird advantage)
                      </option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="group relative rounded-3xl border border-white/10 bg-black/40 p-8 backdrop-blur-3xl shadow-2xl overflow-hidden">
                <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 rounded-3xl blur opacity-30"></div>
                <div className="relative space-y-6">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                      <span className="text-lg">🎯</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-400">Step 4</p>
                      <h2 className="text-2xl font-black text-white tracking-tighter">Incentives</h2>
                    </div>
                  </div>
                  <p className="text-sm text-white/50 font-medium mb-6">{onboardingTips[4]}</p>
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-white/40">
                        Effort Score Threshold
                      </label>
                      <input
                        type="number"
                        name="rewardThreshold"
                        value={formData.rewardThreshold}
                        onChange={handleInputChange}
                        className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
                      />
                      <p className="text-xs text-white/40">
                        Riders must beat this score to earn rewards.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-white/40">
                        Reward Amount (SPIN)
                      </label>
                      <input
                        type="number"
                        name="rewardAmount"
                        value={formData.rewardAmount}
                        onChange={handleInputChange}
                        className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
                      />
                    </div>
                  </div>

                  {/* Sui Toggle - Enhanced */}
                  <div className="group/toggle relative rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-6 overflow-hidden">
                    <div className="absolute -inset-1 bg-cyan-500/5 blur-xl opacity-50"></div>
                    <div className="relative flex items-center justify-between">
                      <div className="flex gap-4">
                        <div className="h-12 w-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                          <span className="text-xl">💧</span>
                        </div>
                        <div>
                          <h4 className="font-black text-white uppercase tracking-wider text-sm">Enable Sui Performance Node</h4>
                          <p className="text-xs text-white/40 mt-1">High-frequency telemetry & live leaderboards.</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setFormData(prev => ({ ...prev, suiPerformance: !prev.suiPerformance }))}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${formData.suiPerformance ? 'bg-cyan-500 shadow-lg shadow-cyan-500/30' : 'bg-white/10 border border-white/10'}`}
                      >
                        <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${formData.suiPerformance ? 'translate-x-7' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="group relative rounded-3xl border border-white/10 bg-black/40 p-8 backdrop-blur-3xl shadow-2xl overflow-hidden">
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-purple-500/10 rounded-3xl blur opacity-30"></div>
                <div className="relative space-y-6">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                      <span className="text-lg">🚀</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-purple-400">Step 5</p>
                      <h2 className="text-2xl font-black text-white tracking-tighter">Review & Deploy</h2>
                    </div>
                  </div>
                  <p className="text-sm text-white/50 font-medium mb-6">{onboardingTips[5]}</p>
                  
                  {/* Contract Spec Summary - Enhanced */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <div className="grid gap-4">
                      <div className="flex justify-between items-center py-2 border-b border-white/5">
                        <span className="text-xs font-black uppercase tracking-widest text-white/40">Class</span>
                        <span className="font-bold text-white">
                          {formData.name}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-white/5">
                        <span className="text-xs font-black uppercase tracking-widest text-white/40">Ticket Supply</span>
                        <span className="font-bold text-white">
                          {formData.capacity}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-white/5">
                        <span className="text-xs font-black uppercase tracking-widest text-white/40">Pricing Range</span>
                        <span className="font-bold text-white">
                          {formData.basePrice} - {formData.maxPrice} ETH
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-xs font-black uppercase tracking-widest text-white/40">Rewards</span>
                        <span className="font-bold text-white">
                          {formData.rewardAmount} SPIN @ {formData.rewardThreshold}{" "}
                          Effort
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
                    <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-blue-400">i</span>
                    </div>
                    <p className="text-sm text-blue-200">
                      Deploying will create a new SpinClass contract and mint the
                      ownership NFT to your wallet.
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
                    <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg">🎓</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-amber-200">Try Before You Deploy</p>
                      <p className="text-sm text-amber-300/70">Preview your class with AI coaching and see how it feels.</p>
                    </div>
                    <button
                      onClick={startPractice}
                      disabled={!selectedRoute || !userAddress}
                      className="rounded-xl bg-amber-500/20 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-amber-300 hover:bg-amber-500/30 transition disabled:opacity-50"
                    >
                      Practice Run
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-6">
              <button
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="rounded-full border border-white/10 bg-white/5 px-8 py-3 text-xs font-black uppercase tracking-widest text-white/40 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                ← Back
              </button>
              {step < 5 ? (
                <button
                  onClick={() => setStep((s) => Math.min(5, s + 1))}
                  className="rounded-full bg-white px-8 py-3 text-xs font-black uppercase tracking-widest text-black shadow-lg shadow-white/20 transition hover:bg-gray-100 hover:scale-105"
                >
                  Next Step →
                </button>
              ) : (
                <button
                  onClick={() => {
                    createClass({
                      name: formData.name,
                      symbol: "SPIN",
                      metadata: JSON.stringify({ name: formData.name, date: formData.date }),
                      startTime: Math.floor(new Date(formData.date).getTime() / 1000),
                      endTime: Math.floor(new Date(formData.date).getTime() / 1000) + 3600,
                      maxRiders: formData.capacity,
                      basePrice: formData.basePrice.toString(),
                      maxPrice: formData.maxPrice.toString(),
                      instructor: userAddress || "0x0000000000000000000000000000000000000000",
                      treasury: userAddress || "0x0000000000000000000000000000000000000000",
                      incentiveEngine: INCENTIVE_ENGINE_ADDRESS as `0x${string}`,
                      spinToken: SPIN_TOKEN_ADDRESS as `0x${string}`,
                    });
                  }}
                  disabled={isPending || !userAddress}
                  className="group relative rounded-full bg-[linear-gradient(135deg,#6d7cff,#9b7bff)] px-10 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-500/30 transition hover:opacity-90 hover:scale-105 disabled:opacity-50 overflow-hidden"
                >
                  <span className="relative z-10">{isPending ? "Deploying..." : "Deploy Contract"}</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}
            </div>

            {hash && (
              <div className="group relative mt-6 rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-3xl overflow-hidden">
                <div className="absolute -inset-1 bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-green-500/10 rounded-2xl blur opacity-30"></div>
                <div className="relative">
                  <p className="text-xs font-black uppercase tracking-widest text-white/40 mb-2">Transaction Hash</p>
                  <p className="font-mono text-sm text-indigo-400 break-all">{hash}</p>
                  {isSuccess && (
                    <div className="flex items-center gap-2 mt-3">
                      <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                      <p className="text-sm font-bold text-green-400">✨ Class contract deployed successfully!</p>
                    </div>
                  )}
                  {deployError && (
                    <div className="flex items-center gap-2 mt-3">
                      <span className="h-2 w-2 rounded-full bg-red-400" />
                      <p className="text-sm font-bold text-red-400">❌ Deployment failed: {deployError.message}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Summary */}
          <div className="hidden lg:block">
            <div className="sticky top-10 space-y-6">
              <SurfaceCard
                eyebrow="Preview"
                title="Contract Spec"
                className="bg-[color:var(--surface-strong)]"
              >
                <div className="mt-4 space-y-3">
                  <Tag>ERC-721 Tickets</Tag>
                  <Tag>ERC-20 Rewards</Tag>
                  <Tag>Pull Payments</Tag>
                </div>
                <div className="mt-6">
                  <p className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
                    Est. Revenue
                  </p>
                  <p className="mt-1 text-2xl font-bold text-[color:var(--foreground)]">
                    {(
                      formData.capacity *
                      ((formData.basePrice + formData.maxPrice) / 2)
                    ).toFixed(3)}{" "}
                    ETH
                  </p>
                  <p className="text-xs text-[color:var(--muted)]">
                    @ 100% sellout (avg price)
                  </p>
                </div>
              </SurfaceCard>

              {/* Route Info Card (Replaced placeholder) */}
              <SurfaceCard
                eyebrow="Route Info"
                title={selectedRoute?.name || "No route selected"}
                description={selectedRoute ? `${selectedRoute.estimatedDistance.toFixed(1)}km • ${selectedRoute.estimatedDuration}min • +${selectedRoute.elevationGain}m` : "Go back to select a route"}
                className={selectedRoute ? "border-green-500/30 bg-green-500/5" : "border-dashed bg-transparent"}
              >
                {selectedRoute ? (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-green-400">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Route attached and ready
                    </div>
                    <div className="text-xs text-[color:var(--muted)]">
                      Will be uploaded to Walrus on deployment
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => setStep(0)}
                    className="mt-4 w-full rounded-lg border border-[color:var(--border)] py-2 text-xs text-[color:var(--muted)] hover:bg-[color:var(--surface)]"
                  >
                    ← Back to route selection
                  </button>
                )}
              </SurfaceCard>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
