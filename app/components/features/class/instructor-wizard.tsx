"use client";

import { useState } from "react";
import { LoadingButton } from "../../../components/ui/loading-button";
import { SurfaceCard, Tag } from "../../../components/ui/ui";
import { Brain, Zap, Shield, TrendingUp, User, Bot } from "lucide-react";

type WizardStep = "basics" | "mode" | "route" | "pricing" | "review";

interface ClassFormData {
  name: string;
  description: string;
  duration: number;
  maxRiders: number;
  basePrice: string;
  mode: "standard" | "agentic";
  personality: "zen" | "drill-sergeant" | "data";
  enableDynamicPricing: boolean;
  useAI: boolean;
}

const initialFormData: ClassFormData = {
  name: "",
  description: "",
  duration: 45,
  maxRiders: 20,
  basePrice: "0.01",
  mode: "standard",
  personality: "drill-sergeant",
  enableDynamicPricing: true,
  useAI: true,
};

export function InstructorWizard() {
  const [step, setStep] = useState<WizardStep>("basics");
  const [formData, setFormData] = useState<ClassFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateForm = (updates: Partial<ClassFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    const steps: WizardStep[] = [
      "basics",
      "mode",
      "route",
      "pricing",
      "review",
    ];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const steps: WizardStep[] = [
      "basics",
      "mode",
      "route",
      "pricing",
      "review",
    ];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    // Simulate submission - in real app, this would call EVM + Sui
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsSubmitting(false);
    alert(
      formData.mode === "agentic"
        ? "Agentic Class Deployed to Sui & Avalanche!"
        : "Class created successfully!",
    );
  };

  const renderStep = () => {
    switch (step) {
      case "basics":
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Class Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateForm({ name: e.target.value })}
                placeholder="e.g., Alpine Sunrise Challenge"
                className="w-full rounded-xl border border-(--border) bg-(--surface-strong) px-4 py-3 text-foreground placeholder:text-(--muted) focus:border-(--accent) focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => updateForm({ description: e.target.value })}
                placeholder="What riders can expect..."
                rows={3}
                className="w-full rounded-xl border border-(--border) bg-(--surface-strong) px-4 py-3 text-foreground placeholder:text-(--muted) focus:border-(--accent) focus:outline-none resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Duration (min)
                </label>
                <select
                  value={formData.duration}
                  onChange={(e) =>
                    updateForm({ duration: parseInt(e.target.value) })
                  }
                  className="w-full rounded-xl border border-(--border) bg-(--surface-strong) px-4 py-3 text-foreground focus:border-(--accent) focus:outline-none"
                >
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>60 min</option>
                  <option value={90}>90 min</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Max Riders
                </label>
                <select
                  value={formData.maxRiders}
                  onChange={(e) =>
                    updateForm({ maxRiders: parseInt(e.target.value) })
                  }
                  className="w-full rounded-xl border border-(--border) bg-(--surface-strong) px-4 py-3 text-foreground focus:border-(--accent) focus:outline-none"
                >
                  <option value={10}>10 riders</option>
                  <option value={20}>20 riders</option>
                  <option value={50}>50 riders</option>
                  <option value={100}>100 riders</option>
                </select>
              </div>
            </div>
          </div>
        );

      case "mode":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => updateForm({ mode: "standard" })}
                className={`relative flex flex-col p-6 rounded-2xl border text-left transition-all ${
                  formData.mode === "standard"
                    ? "border-[color:var(--accent)] bg-[color:var(--accent)]/5"
                    : "border-[color:var(--border)] bg-[color:var(--surface-strong)]/50 hover:border-[color:var(--muted)]"
                }`}
              >
                <div
                  className={`p-2 rounded-lg mb-4 w-fit ${formData.mode === "standard" ? "bg-[color:var(--accent)] text-white" : "bg-[color:var(--surface)] text-[color:var(--muted)]"}`}
                >
                  <User size={24} />
                </div>
                <h3 className="font-bold text-[color:var(--foreground)] mb-2">
                  Standard Class
                </h3>
                <p className="text-xs text-[color:var(--muted)]">
                  Manual control over pacing, music, and engagement.
                </p>
                {formData.mode === "standard" && (
                  <div className="absolute top-4 right-4 text-[color:var(--accent)]">
                    ✓
                  </div>
                )}
              </button>

              <button
                onClick={() => updateForm({ mode: "agentic" })}
                className={`relative flex flex-col p-6 rounded-2xl border text-left transition-all ${
                  formData.mode === "agentic"
                    ? "border-indigo-500 bg-indigo-500/5"
                    : "border-[color:var(--border)] bg-[color:var(--surface-strong)]/50 hover:border-[color:var(--muted)]"
                }`}
              >
                <div
                  className={`p-2 rounded-lg mb-4 w-fit ${formData.mode === "agentic" ? "bg-indigo-500 text-white" : "bg-[color:var(--surface)] text-[color:var(--muted)]"}`}
                >
                  <Bot size={24} />
                </div>
                <h3 className="font-bold text-[color:var(--foreground)] mb-2">
                  Coachy Mode
                </h3>
                <p className="text-xs text-[color:var(--muted)]">
                  Let Coachy run your classes automatically with personalized coaching for each rider.
                </p>
                {formData.mode === "agentic" && (
                  <div className="absolute top-4 right-4 text-indigo-500">
                    ✓
                  </div>
                )}
              </button>
            </div>

            {formData.mode === "agentic" && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Select Coachy&apos;s Personality
                  </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "zen", label: "Zen", icon: "🧘" },
                    { id: "drill-sergeant", label: "Drill", icon: "⚡" },
                    { id: "data", label: "Quant", icon: "📊" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() =>
                        updateForm({
                          personality: p.id as
                            | "zen"
                            | "drill-sergeant"
                            | "data",
                        })
                      }
                      className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${
                        formData.personality === p.id
                          ? "border-indigo-500 bg-indigo-500/20 text-foreground"
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
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-300">
                  <TrendingUp size={12} className="inline mr-2" />
                  Agent will automatically adjust resistance via Sui Move based
                  on 10Hz rider telemetry.
                </div>
              </div>
            )}
          </div>
        );

      case "route":
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)]/50 p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-[color:var(--accent)]/10 p-3">
                  <Brain className="text-[color:var(--accent)]" size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-[color:var(--foreground)] mb-1">
                    AI Route Generation
                  </h3>
                  <p className="text-sm text-[color:var(--muted)] mb-4">
                    Let our AI create an immersive route with story beats based
                    on your description.
                  </p>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.useAI}
                      onChange={(e) => updateForm({ useAI: e.target.checked })}
                      className="h-5 w-5 rounded border-[color:var(--border)] bg-[color:var(--surface-strong)] text-[color:var(--accent)] focus:ring-[color:var(--accent)]"
                    />
                    <span className="text-sm text-[color:var(--foreground)]">
                      Generate AI route & story beats
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {!formData.useAI && (
              <div className="rounded-2xl border border-dashed border-[color:var(--border)] p-8 text-center">
                <span className="text-4xl mb-4 block">🗺️</span>
                <p className="text-[color:var(--muted)] mb-4">
                  Or manual GPX upload / Route Builder
                </p>
                <a
                  href="/routes/builder"
                  className="inline-flex items-center gap-2 rounded-xl bg-[color:var(--surface-strong)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] hover:bg-[color:var(--surface-elevated)] transition-colors"
                >
                  Open Route Builder
                </a>
              </div>
            )}
          </div>
        );

      case "pricing":
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-[color:var(--foreground)] mb-2">
                Base Ticket Price (ETH)
              </label>
              <input
                type="text"
                value={formData.basePrice}
                onChange={(e) => updateForm({ basePrice: e.target.value })}
                placeholder="0.01"
                className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-3 text-[color:var(--foreground)] placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent)] focus:outline-none"
              />
            </div>

            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)]/50 p-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enableDynamicPricing}
                  onChange={(e) =>
                    updateForm({ enableDynamicPricing: e.target.checked })
                  }
                  className="mt-1 h-5 w-5 rounded border-[color:var(--border)] bg-[color:var(--surface-strong)] text-[color:var(--accent)] focus:ring-[color:var(--accent)]"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[color:var(--foreground)]">
                      Uniswap v4 Hooks
                    </span>
                    <Tag>Demand Surge</Tag>
                  </div>
                  <span className="block text-xs text-[color:var(--muted)] mt-1">
                    Coachy will manage class pricing automatically. Prices surge for last
                    seats and drop for early bookings.
                  </span>
                </div>
              </label>
            </div>

            <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-4">
              <div className="flex gap-3">
                <Shield className="text-green-500 shrink-0" size={18} />
                <p className="text-xs text-green-300">
                  Payouts are settled instantly upon class completion. Revenue
                  is split automatically between instructor, treasury, and
                  rewards pool.
                </p>
              </div>
            </div>
          </div>
        );

      case "review":
        return (
          <div className="space-y-4">
            <SurfaceCard className="p-4">
              <div className="flex justify-between items-start mb-3">
                <h4 className="text-xs uppercase tracking-wider text-(--muted)">
                  Class Identity
                </h4>
                  <Tag color={formData.mode === "agentic" ? "indigo" : "blue"}>
                  {formData.mode === "agentic" ? "🤖 Coachy" : "👤 Standard"}
                </Tag>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[color:var(--muted)]">Name</span>
                  <span className="text-[color:var(--foreground)] font-medium">
                    {formData.name || "Untitled"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[color:var(--muted)]">Duration</span>
                  <span className="text-[color:var(--foreground)]">
                    {formData.duration} min
                  </span>
                </div>
                {formData.mode === "agentic" && (
                  <div className="flex justify-between">
                    <span className="text-[color:var(--muted)]">Coachy</span>
                    <span className="text-indigo-400 capitalize">
                      {formData.personality.replace("-", " ")}
                    </span>
                  </div>
                )}
              </div>
            </SurfaceCard>

            <SurfaceCard className="p-4">
              <h4 className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-3">
                Economics
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[color:var(--muted)]">Base Price</span>
                  <span className="text-[color:var(--foreground)] font-medium">
                    {formData.basePrice} ETH
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[color:var(--muted)]">
                    Pricing Engine
                  </span>
                  <span className="text-[color:var(--foreground)]">
                    {formData.enableDynamicPricing
                      ? "Uniswap v4 Hook"
                      : "Fixed"}
                  </span>
                </div>
              </div>
            </SurfaceCard>

            <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-300">
              <Zap size={12} className="inline mr-2" />
              Deployment will trigger a transaction on Avalanche (Class Ticket
              NFT) and initialize state on Sui (Performance Layer).
            </div>
          </div>
        );
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {["Basics", "Mode", "Route", "Pricing", "Review"].map((label, i) => {
            const steps: WizardStep[] = [
              "basics",
              "mode",
              "route",
              "pricing",
              "review",
            ];
            const isActive = steps[i] === step;
            const isCompleted = steps.indexOf(step) > i;
            return (
              <div key={label} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all ${
                    isActive
                      ? "bg-[color:var(--accent)] text-white ring-4 ring-[color:var(--accent)]/20"
                      : isCompleted
                        ? "bg-[color:var(--success)] text-white"
                        : "bg-[color:var(--surface-strong)] text-[color:var(--muted)]"
                  }`}
                >
                  {isCompleted ? "✓" : i + 1}
                </div>
                <span
                  className={`ml-2 text-[10px] font-bold uppercase tracking-wider hidden sm:block ${
                    isActive
                      ? "text-[color:var(--foreground)]"
                      : "text-[color:var(--muted)]"
                  }`}
                >
                  {label}
                </span>
                {i < 4 && (
                  <div
                    className={`w-8 sm:w-10 h-px mx-2 sm:mx-3 ${isCompleted ? "bg-[color:var(--success)]" : "bg-[color:var(--border)]"}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content Container */}
      <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/50 backdrop-blur-xl p-6 sm:p-8 shadow-2xl">
        <h2 className="text-xl font-bold text-[color:var(--foreground)] mb-6 tracking-tight">
          {step === "basics" && "Class Foundation"}
          {step === "mode" && "Teaching Architecture"}
          {step === "route" && "Experience Design"}
          {step === "pricing" && "Economic Configuration"}
          {step === "review" && "Final Settlement Review"}
        </h2>

        {renderStep()}

        {/* Actions */}
        <div className="flex gap-3 mt-10">
          {step !== "basics" && (
            <button
              onClick={handleBack}
              className="px-8 py-3 rounded-xl border border-[color:var(--border)] text-[color:var(--foreground)] font-semibold hover:bg-[color:var(--surface-strong)] transition-all"
            >
              Back
            </button>
          )}
          {step !== "review" ? (
            <LoadingButton
              onClick={handleNext}
              className="flex-1 shadow-lg shadow-[color:var(--accent)]/20"
            >
              Continue
            </LoadingButton>
          ) : (
            <LoadingButton
              onClick={handleSubmit}
              isLoading={isSubmitting}
              className={`flex-1 shadow-lg ${formData.mode === "agentic" ? "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20" : "shadow-[color:var(--accent)]/20"}`}
            >
              {formData.mode === "agentic"
                ? "Launch with Coachy"
                : "Create Class"}
            </LoadingButton>
          )}
        </div>
      </div>
    </div>
  );
}
