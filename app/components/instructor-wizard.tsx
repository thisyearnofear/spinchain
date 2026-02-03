"use client";

import { useState } from "react";
import { LoadingButton } from "./loading-button";
import { SurfaceCard } from "./ui";

type WizardStep = "basics" | "route" | "pricing" | "review";

interface ClassFormData {
  name: string;
  description: string;
  duration: number;
  maxRiders: number;
  basePrice: string;
  enableDynamicPricing: boolean;
  useAI: boolean;
}

const initialFormData: ClassFormData = {
  name: "",
  description: "",
  duration: 45,
  maxRiders: 20,
  basePrice: "0.01",
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
    const steps: WizardStep[] = ["basics", "route", "pricing", "review"];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const steps: WizardStep[] = ["basics", "route", "pricing", "review"];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    // Simulate submission
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsSubmitting(false);
    alert("Class created successfully!");
  };

  const renderStep = () => {
    switch (step) {
      case "basics":
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-[color:var(--foreground)] mb-2">
                Class Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateForm({ name: e.target.value })}
                placeholder="e.g., Alpine Sunrise Challenge"
                className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-3 text-[color:var(--foreground)] placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[color:var(--foreground)] mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => updateForm({ description: e.target.value })}
                placeholder="What riders can expect..."
                rows={3}
                className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-3 text-[color:var(--foreground)] placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent)] focus:outline-none resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[color:var(--foreground)] mb-2">
                  Duration (min)
                </label>
                <select
                  value={formData.duration}
                  onChange={(e) => updateForm({ duration: parseInt(e.target.value) })}
                  className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-3 text-[color:var(--foreground)] focus:border-[color:var(--accent)] focus:outline-none"
                >
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>60 min</option>
                  <option value={90}>90 min</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[color:var(--foreground)] mb-2">
                  Max Riders
                </label>
                <select
                  value={formData.maxRiders}
                  onChange={(e) => updateForm({ maxRiders: parseInt(e.target.value) })}
                  className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-3 text-[color:var(--foreground)] focus:border-[color:var(--accent)] focus:outline-none"
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

      case "route":
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)]/50 p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-[color:var(--accent)]/10 p-3">
                  <span className="text-2xl">🤖</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-[color:var(--foreground)] mb-1">
                    AI Route Generation
                  </h3>
                  <p className="text-sm text-[color:var(--muted)] mb-4">
                    Let our AI create an immersive route based on your class description and duration.
                  </p>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.useAI}
                      onChange={(e) => updateForm({ useAI: e.target.checked })}
                      className="h-5 w-5 rounded border-[color:var(--border)] bg-[color:var(--surface-strong)] text-[color:var(--accent)] focus:ring-[color:var(--accent)]"
                    />
                    <span className="text-sm text-[color:var(--foreground)]">
                      Generate AI route
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {!formData.useAI && (
              <div className="rounded-2xl border border-dashed border-[color:var(--border)] p-8 text-center">
                <span className="text-4xl mb-4 block">🗺️</span>
                <p className="text-[color:var(--muted)] mb-4">
                  Or build your own route using our route builder
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
                Base Price (ETH)
              </label>
              <input
                type="text"
                value={formData.basePrice}
                onChange={(e) => updateForm({ basePrice: e.target.value })}
                placeholder="0.01"
                className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-3 text-[color:var(--foreground)] placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent)] focus:outline-none"
              />
              <p className="mt-2 text-xs text-[color:var(--muted)]">
                Recommended: 0.01 ETH for a 45-min class
              </p>
            </div>

            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)]/50 p-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enableDynamicPricing}
                  onChange={(e) => updateForm({ enableDynamicPricing: e.target.checked })}
                  className="mt-1 h-5 w-5 rounded border-[color:var(--border)] bg-[color:var(--surface-strong)] text-[color:var(--accent)] focus:ring-[color:var(--accent)]"
                />
                <div>
                  <span className="block text-sm font-medium text-[color:var(--foreground)]">
                    Enable Dynamic Pricing
                  </span>
                  <span className="block text-xs text-[color:var(--muted)] mt-1">
                    Prices automatically adjust based on demand. Early birds get discounts, last-minute buyers pay premium.
                  </span>
                </div>
              </label>
            </div>

            <div className="rounded-xl bg-[color:var(--success)]/10 p-4">
              <p className="text-sm text-[color:var(--success)]">
                💡 You keep 85% of all ticket sales. The remaining 15% goes to the protocol and sponsors pool.
              </p>
            </div>
          </div>
        );

      case "review":
        return (
          <div className="space-y-4">
            <SurfaceCard className="p-4">
              <h4 className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-3">
                Class Details
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[color:var(--muted)]">Name</span>
                  <span className="text-[color:var(--foreground)]">{formData.name || "Untitled"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[color:var(--muted)]">Duration</span>
                  <span className="text-[color:var(--foreground)]">{formData.duration} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[color:var(--muted)]">Max Riders</span>
                  <span className="text-[color:var(--foreground)]">{formData.maxRiders}</span>
                </div>
              </div>
            </SurfaceCard>

            <SurfaceCard className="p-4">
              <h4 className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-3">
                Pricing
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[color:var(--muted)]">Base Price</span>
                  <span className="text-[color:var(--foreground)]">{formData.basePrice} ETH</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[color:var(--muted)]">Dynamic Pricing</span>
                  <span className="text-[color:var(--foreground)]">
                    {formData.enableDynamicPricing ? "Enabled" : "Disabled"}
                  </span>
                </div>
              </div>
            </SurfaceCard>

            <SurfaceCard className="p-4">
              <h4 className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-3">
                Route
              </h4>
              <p className="text-sm text-[color:var(--foreground)]">
                {formData.useAI ? "AI-generated route" : "Custom route (builder)"}
              </p>
            </SurfaceCard>
          </div>
        );
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {["Basics", "Route", "Pricing", "Review"].map((label, i) => {
            const steps: WizardStep[] = ["basics", "route", "pricing", "review"];
            const isActive = steps[i] === step;
            const isCompleted = steps.indexOf(step) > i;
            return (
              <div key={label} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[color:var(--accent)] text-white"
                      : isCompleted
                      ? "bg-[color:var(--success)] text-white"
                      : "bg-[color:var(--surface-strong)] text-[color:var(--muted)]"
                  }`}
                >
                  {isCompleted ? "✓" : i + 1}
                </div>
                <span
                  className={`ml-2 text-sm hidden sm:block ${
                    isActive ? "text-[color:var(--foreground)]" : "text-[color:var(--muted)]"
                  }`}
                >
                  {label}
                </span>
                {i < 3 && (
                  <div className="w-8 sm:w-12 h-px bg-[color:var(--border)] mx-2 sm:mx-4" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-[color:var(--foreground)] mb-6">
          {step === "basics" && "Class Basics"}
          {step === "route" && "Choose Route"}
          {step === "pricing" && "Set Pricing"}
          {step === "review" && "Review & Create"}
        </h2>

        {renderStep()}

        {/* Actions */}
        <div className="flex gap-3 mt-8">
          {step !== "basics" && (
            <button
              onClick={handleBack}
              className="px-6 py-3 rounded-xl border border-[color:var(--border)] text-[color:var(--foreground)] font-medium hover:bg-[color:var(--surface-strong)] transition-colors"
            >
              Back
            </button>
          )}
          {step !== "review" ? (
            <LoadingButton
              onClick={handleNext}
              className="flex-1"
            >
              Continue
            </LoadingButton>
          ) : (
            <LoadingButton
              onClick={handleSubmit}
              isLoading={isSubmitting}
              className="flex-1"
            >
              Create Class
            </LoadingButton>
          )}
        </div>
      </div>
    </div>
  );
}
