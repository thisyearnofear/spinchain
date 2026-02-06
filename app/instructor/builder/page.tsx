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
import { INCENTIVE_ENGINE_ADDRESS } from "@/app/lib/contracts";
import { useAccount } from "wagmi";
import type { SavedRoute } from "@/app/lib/route-library";
import type { GpxSummary } from "@/app/routes/builder/gpx-uploader";

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
    <div className="relative h-64 w-full overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-4">
      <div className="absolute left-4 top-4 z-10">
        <p className="text-xs font-medium uppercase tracking-wider text-[color:var(--muted)]">
          Price Trajectory
        </p>
        <p className="text-lg font-bold text-[color:var(--foreground)]">
          {data.basePrice} ETH → {data.maxPrice} ETH
        </p>
      </div>

      <svg className="h-full w-full" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6ef3c6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#6ef3c6" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#ffffff"
          strokeOpacity="0.1"
        />
        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          stroke="#ffffff"
          strokeOpacity="0.1"
        />

        {/* The Curve */}
        <path d={areaD} fill="url(#curveGradient)" />
        <path
          d={pathD}
          fill="none"
          stroke="#6ef3c6"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Labels */}
        <text
          x={width - padding}
          y={height - 5}
          textAnchor="end"
          fontSize="10"
          fill="rgba(255,255,255,0.5)"
        >
          {capacity} sold
        </text>
        <text
          x={padding}
          y={height - 5}
          textAnchor="start"
          fontSize="10"
          fill="rgba(255,255,255,0.5)"
        >
          0 sold
        </text>
      </svg>
    </div>
  );
}

export default function InstructorBuilderPage() {
  const { address: userAddress } = useAccount();
  const { createClass, isPending, isSuccess, error: deployError, hash } = useCreateClass();
  const {
    deployClassWithRoute,
    deploymentStep,
    isPending: isDeploying,
    isSuccess: deploySuccess
  } = useClassWithRoute();

  const [step, setStep] = useState(0); // Start at 0 for route selection
  const [selectedRoute, setSelectedRoute] = useState<SavedRoute | null>(null);
  const [gpxSummary, setGpxSummary] = useState<GpxSummary | null>(null);
  
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
    { number: 0, title: "Route" },      // NEW
    { number: 1, title: "Basics" },
    { number: 2, title: "Economics" },
    { number: 3, title: "AI & Rewards" }, // Enhanced
    { number: 4, title: "Deploy" },
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
    });

    window.location.href = `/rider/ride/practice-${Date.now()}?${params.toString()}`;
  };

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-10 lg:px-12">
        <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 px-8 py-10 backdrop-blur">
          <PrimaryNav />
        </div>

        {/* Header */}
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold text-[color:var(--foreground)]">Class Builder</h1>
            <p className="mt-1 text-[color:var(--muted)]">
              Configure your programmable class contract.
            </p>
          </div>
          <div className="flex gap-2">
            {steps.map((s) => (
              <div
                key={s.number}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${step === s.number
                  ? "bg-indigo-500 text-white"
                  : step > s.number
                    ? "bg-indigo-500/20 text-indigo-300"
                    : "bg-[color:var(--surface)] text-[color:var(--muted)]"
                  }`}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--surface-strong)] text-xs">
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
              <RouteSelectionStep
                onRouteSelected={handleRouteSelected}
                selectedRoute={selectedRoute}
              />
            )}

            {step === 1 && (
              <GlassCard className="space-y-6 p-8">
                <SectionHeader
                  eyebrow="Step 1"
                  title="Class Details"
                  description="Set the foundational metadata for your class."
                />
                <div className="grid gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[color:var(--foreground)]">
                      Class Name
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-3 text-[color:var(--foreground)] placeholder:text-[color:var(--muted)] focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[color:var(--foreground)]">
                        Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        name="date"
                        value={formData.date}
                        onChange={handleInputChange}
                        className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-3 text-[color:var(--foreground)] focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[color:var(--foreground)]">
                        Max Capacity
                      </label>
                      <input
                        type="number"
                        name="capacity"
                        value={formData.capacity}
                        onChange={handleInputChange}
                        className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-3 text-[color:var(--foreground)] focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </GlassCard>
            )}

            {step === 2 && (
              <GlassCard className="space-y-6 p-8">
                <SectionHeader
                  eyebrow="Step 2"
                  title="Token Economics"
                  description="Define how ticket prices react to demand."
                />
                <PricingCurveVisualizer
                  data={formData}
                  capacity={formData.capacity}
                />
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[color:var(--foreground)]">
                      Base Price (ETH)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      name="basePrice"
                      value={formData.basePrice}
                      onChange={handleInputChange}
                      className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-3 text-[color:var(--foreground)] focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[color:var(--foreground)]">
                      Max Price (ETH)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      name="maxPrice"
                      value={formData.maxPrice}
                      onChange={handleInputChange}
                      className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-3 text-[color:var(--foreground)] focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[color:var(--foreground)]">
                    Curve Logic
                  </label>
                  <select
                    name="curveType"
                    value={formData.curveType}
                    onChange={handleInputChange}
                    className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-3 text-[color:var(--foreground)] focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="linear">Linear (Constant ramp)</option>
                    <option value="exponential">
                      Exponential (Early bird advantage)
                    </option>
                  </select>
                </div>
              </GlassCard>
            )}

            {step === 3 && (
              <GlassCard className="space-y-6 p-8">
                <SectionHeader
                  eyebrow="Step 3"
                  title="Incentives"
                  description="Program the conditions for rider rewards."
                />
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[color:var(--foreground)]">
                      Effort Score Threshold
                    </label>
                    <input
                      type="number"
                      name="rewardThreshold"
                      value={formData.rewardThreshold}
                      onChange={handleInputChange}
                      className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-3 text-[color:var(--foreground)] focus:border-indigo-500 focus:outline-none"
                    />
                    <p className="text-xs text-[color:var(--muted)]">
                      Riders must beat this score to earn rewards.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[color:var(--foreground)]">
                      Reward Amount (SPIN)
                    </label>
                    <input
                      type="number"
                      name="rewardAmount"
                      value={formData.rewardAmount}
                      onChange={handleInputChange}
                      className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-3 text-[color:var(--foreground)] focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Sui Toggle */}
                <div className="flex items-center justify-between rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                  <div className="flex gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-cyan-500/20 text-cyan-400">
                      💧
                    </div>
                    <div>
                      <h4 className="font-semibold text-[color:var(--foreground)]">Enable Sui Performance Node</h4>
                      <p className="text-xs text-[color:var(--muted)]">High-frequency telemetry & live leaderboards.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, suiPerformance: !prev.suiPerformance }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.suiPerformance ? 'bg-cyan-500' : 'bg-[color:var(--surface-strong)]'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.suiPerformance ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </GlassCard>
            )}

            {step === 4 && (
              <GlassCard className="space-y-6 p-8">
                <SectionHeader
                  eyebrow="Step 4"
                  title="Review & Deploy"
                  description="Verify configuration before deploying to blockchain."
                />
                <div className="grid gap-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 text-sm">
                  <div className="flex justify-between border-b border-[color:var(--border)] pb-2">
                    <span className="text-[color:var(--muted)]">Class</span>
                    <span className="font-semibold text-[color:var(--foreground)]">
                      {formData.name}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[color:var(--border)] pb-2">
                    <span className="text-[color:var(--muted)]">Ticket Supply</span>
                    <span className="font-semibold text-[color:var(--foreground)]">
                      {formData.capacity}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[color:var(--border)] pb-2">
                    <span className="text-[color:var(--muted)]">Pricing Range</span>
                    <span className="font-semibold text-[color:var(--foreground)]">
                      {formData.basePrice} - {formData.maxPrice} ETH
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[color:var(--muted)]">Rewards</span>
                    <span className="font-semibold text-[color:var(--foreground)]">
                      {formData.rewardAmount} SPIN @ {formData.rewardThreshold}{" "}
                      Effort
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-blue-200">
                  <div className="grid h-6 w-6 place-items-center rounded-full bg-blue-500/20 text-xs font-bold">
                    i
                  </div>
                  <p>
                    Deploying will create a new SpinClass contract and mint the
                    ownership NFT to your wallet.
                  </p>
                </div>
                <div className="flex items-center gap-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                  <div className="grid h-6 w-6 place-items-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-400">
                    🎓
                  </div>
                  <div className="flex-1">
                    <p className="text-amber-200 font-medium">Try Before You Deploy</p>
                    <p className="text-amber-300/70">Preview your class with AI coaching and see how it feels.</p>
                  </div>
                  <button
                    onClick={startPractice}
                    disabled={!selectedRoute || !userAddress}
                    className="rounded-lg bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-500/30 transition disabled:opacity-50"
                  >
                    Practice Run
                  </button>
                </div>
              </GlassCard>
            )}

            <div className="flex justify-between pt-4">
              <button
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                disabled={step === 1}
                className="rounded-full border border-[color:var(--border)] px-6 py-2 text-sm font-medium text-[color:var(--muted)] transition hover:bg-[color:var(--surface)] disabled:opacity-50"
              >
                Back
              </button>
              {step < 4 ? (
                <button
                  onClick={() => setStep((s) => Math.min(4, s + 1))}
                  className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-white/10 transition hover:bg-gray-100"
                >
                  Next Step
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
                      treasury: userAddress || "0x0000000000000000000000000000000000000000",
                      incentiveEngine: INCENTIVE_ENGINE_ADDRESS as `0x${string}`,
                    });
                  }}
                  disabled={isPending || !userAddress}
                  className="rounded-full bg-[linear-gradient(135deg,#6d7cff,#9b7bff)] px-8 py-2 text-sm font-semibold text-[color:var(--foreground)] shadow-lg shadow-indigo-500/30 transition hover:opacity-90 disabled:opacity-50"
                >
                  {isPending ? "Deploying..." : "Deploy Contract"}
                </button>
              )}
            </div>

            {hash && (
              <div className="mt-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 text-sm text-[color:var(--muted)]">
                <p>Transaction Hash: <span className="font-mono text-xs text-indigo-500">{hash}</span></p>
                {isSuccess && <p className="mt-2 text-green-400 font-medium">✨ Class contract deployed successfully!</p>}
                {deployError && <p className="mt-2 text-red-400 font-medium">❌ Deployment failed: {deployError.message}</p>}
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
