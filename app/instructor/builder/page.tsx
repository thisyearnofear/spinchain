"use client";

import { useState } from "react";
import { PrimaryNav } from "../../components/nav";
import {
  BulletList,
  GlassCard,
  SectionHeader,
  SurfaceCard,
  Tag,
} from "../../components/ui";
import { useCreateClass } from "../../hooks/use-create-class";
import { INCENTIVE_ENGINE_ADDRESS } from "../../lib/contracts";
import { useAccount } from "wagmi";

type ClassFormData = {
  name: string;
  date: string;
  capacity: number;
  basePrice: number;
  maxPrice: number;
  curveType: "linear" | "exponential";
  rewardThreshold: number;
  rewardAmount: number;
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
    <div className="relative h-64 w-full overflow-hidden rounded-xl border border-white/10 bg-black/40 p-4">
      <div className="absolute left-4 top-4 z-10">
        <p className="text-xs font-medium uppercase tracking-wider text-white/50">
          Price Trajectory
        </p>
        <p className="text-lg font-bold text-white">
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
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<ClassFormData>({
    name: "Morning Mountain Climb",
    date: "2026-03-12T09:00",
    capacity: 50,
    basePrice: 0.02,
    maxPrice: 0.08,
    curveType: "linear",
    rewardThreshold: 150,
    rewardAmount: 20,
  });

  const steps = [
    { number: 1, title: "Basics" },
    { number: 2, title: "Economics" },
    { number: 3, title: "Rewards" },
    { number: 4, title: "Deploy" },
  ];

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? parseFloat(value) : value,
    }));
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1a2550,transparent_55%),radial-gradient(circle_at_80%_20%,#2a1d5a,transparent_40%)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-10 lg:px-12">
        <div className="rounded-3xl border border-white/10 bg-[color:var(--surface)]/80 px-8 py-10 backdrop-blur">
          <PrimaryNav />
        </div>

        {/* Header */}
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">Class Builder</h1>
            <p className="mt-1 text-white/60">
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
                      : "bg-white/5 text-white/40"
                  }`}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/20 text-xs">
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
            {step === 1 && (
              <GlassCard className="space-y-6 p-8">
                <SectionHeader
                  eyebrow="Step 1"
                  title="Class Details"
                  description="Set the foundational metadata for your class."
                />
                <div className="grid gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/80">
                      Class Name
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-white placeholder:text-white/20 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white/80">
                        Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        name="date"
                        value={formData.date}
                        onChange={handleInputChange}
                        className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white/80">
                        Max Capacity
                      </label>
                      <input
                        type="number"
                        name="capacity"
                        value={formData.capacity}
                        onChange={handleInputChange}
                        className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-white focus:border-indigo-500 focus:outline-none"
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
                    <label className="text-sm font-medium text-white/80">
                      Base Price (ETH)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      name="basePrice"
                      value={formData.basePrice}
                      onChange={handleInputChange}
                      className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/80">
                      Max Price (ETH)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      name="maxPrice"
                      value={formData.maxPrice}
                      onChange={handleInputChange}
                      className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/80">
                    Curve Logic
                  </label>
                  <select
                    name="curveType"
                    value={formData.curveType}
                    onChange={handleInputChange}
                    className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-white focus:border-indigo-500 focus:outline-none"
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
                    <label className="text-sm font-medium text-white/80">
                      Effort Score Threshold
                    </label>
                    <input
                      type="number"
                      name="rewardThreshold"
                      value={formData.rewardThreshold}
                      onChange={handleInputChange}
                      className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-white focus:border-indigo-500 focus:outline-none"
                    />
                    <p className="text-xs text-white/50">
                      Riders must beat this score to earn rewards.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/80">
                      Reward Amount (SPIN)
                    </label>
                    <input
                      type="number"
                      name="rewardAmount"
                      value={formData.rewardAmount}
                      onChange={handleInputChange}
                      className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
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
                <div className="grid gap-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
                  <div className="flex justify-between border-b border-white/10 pb-2">
                    <span className="text-white/60">Class</span>
                    <span className="font-semibold text-white">
                      {formData.name}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-2">
                    <span className="text-white/60">Ticket Supply</span>
                    <span className="font-semibold text-white">
                      {formData.capacity}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-2">
                    <span className="text-white/60">Pricing Range</span>
                    <span className="font-semibold text-white">
                      {formData.basePrice} - {formData.maxPrice} ETH
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Rewards</span>
                    <span className="font-semibold text-white">
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
              </GlassCard>
            )}

            <div className="flex justify-between pt-4">
              <button
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                disabled={step === 1}
                className="rounded-full border border-white/10 px-6 py-2 text-sm font-medium text-white/70 transition hover:bg-white/5 disabled:opacity-50"
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
                  className="rounded-full bg-[linear-gradient(135deg,#6d7cff,#9b7bff)] px-8 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:opacity-90 disabled:opacity-50"
                >
                  {isPending ? "Deploying..." : "Deploy Contract"}
                </button>
              )}
            </div>

            {hash && (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                <p>Transaction Hash: <span className="font-mono text-xs text-indigo-300">{hash}</span></p>
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
                  <p className="text-xs uppercase tracking-widest text-white/50">
                    Est. Revenue
                  </p>
                  <p className="mt-1 text-2xl font-bold text-white">
                    {(
                      formData.capacity *
                      ((formData.basePrice + formData.maxPrice) / 2)
                    ).toFixed(3)}{" "}
                    ETH
                  </p>
                  <p className="text-xs text-white/40">
                    @ 100% sellout (avg price)
                  </p>
                </div>
              </SurfaceCard>

              <SurfaceCard
                eyebrow="Route World"
                title="Linked Content"
                description="Select a world to attach to this class."
                className="border-dashed bg-transparent"
              >
                <div className="mt-4 flex h-24 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm text-white/60">
                  No world selected
                </div>
                <button className="mt-3 w-full rounded-lg border border-white/10 py-2 text-xs text-white/70 hover:bg-white/5">
                  Choose from library
                </button>
              </SurfaceCard>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
