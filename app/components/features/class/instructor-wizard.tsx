"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import {
  Bot,
  Brain,
  CheckCircle2,
  Rocket,
  Shield,
  TrendingUp,
  User,
  Zap,
} from "lucide-react";
import { LoadingButton } from "../../../components/ui/loading-button";
import { SurfaceCard, Tag } from "../../../components/ui/ui";
import { ConnectWallet } from "../wallet/connect-wallet";
import { useToast } from "@/app/components/ui/toast";
import {
  useInstructorClassDraft,
  type InstructorClassDraftFormData,
} from "@/app/hooks/instructor/use-class-draft";

type WizardStep = "basics" | "mode" | "route" | "pricing" | "review";

const WIZARD_STEPS: WizardStep[] = [
  "basics",
  "mode",
  "route",
  "pricing",
  "review",
];

const STEP_LABELS: Record<WizardStep, string> = {
  basics: "Basics",
  mode: "Mode",
  route: "Route",
  pricing: "Pricing",
  review: "Review",
};

const STEP_TITLES: Record<WizardStep, string> = {
  basics: "Class Foundation",
  mode: "Teaching Style",
  route: "Experience Design",
  pricing: "Pricing & Revenue",
  review: "Review Details",
};

const initialFormData: InstructorClassDraftFormData = {
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

function formatSavedAt(savedAt: number | null) {
  if (!savedAt) return "Not saved yet";

  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(savedAt);
}

function isPositivePrice(basePrice: string) {
  return Number.parseFloat(basePrice) > 0;
}

export function InstructorWizard() {
  const { isConnected } = useAccount();
  const toast = useToast();
  const [step, setStep] = useState<WizardStep>("basics");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReadyState, setShowReadyState] = useState(false);
  const {
    formData,
    draftStatus,
    lastSavedAt,
    wasRestored,
    isComplete,
    updateForm,
    saveDraft,
    resetDraft,
  } = useInstructorClassDraft(initialFormData);

  const currentIndex = WIZARD_STEPS.indexOf(step);
  const canContinue =
    step === "basics"
      ? formData.name.trim().length > 0 && formData.description.trim().length > 0
      : step === "pricing"
        ? isPositivePrice(formData.basePrice)
        : true;

  const handleNext = () => {
    if (!canContinue) {
      toast.warning("Complete this step first", "Add the minimum required information before continuing.");
      return;
    }

    if (currentIndex < WIZARD_STEPS.length - 1) {
      setStep(WIZARD_STEPS[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setStep(WIZARD_STEPS[currentIndex - 1]);
    }
  };

  const handleSaveDraft = () => {
    saveDraft("draft");
    setShowReadyState(false);
    toast.success("Draft saved", "You can return to this class plan from the instructor preview flow.");
  };

  const handlePreparePublish = async () => {
    if (!isComplete) {
      toast.warning("Finish the draft first", "Add a class name, description, and valid base price before publishing.");
      return;
    }

    if (!isConnected) {
      toast.warning("Connect a wallet to publish", "You can still save this draft now and publish once your wallet is connected.");
      return;
    }

    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 900));
    saveDraft("ready_to_publish");
    setIsSubmitting(false);
    setShowReadyState(true);
    toast.success("Draft ready to publish", "Open the advanced builder to connect the final publishing flow.");
  };

  const handleStartNewDraft = () => {
    resetDraft();
    setStep("basics");
    setShowReadyState(false);
    toast.info("Started a fresh draft", "The previous draft has been cleared from local storage.");
  };

  if (showReadyState) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-500/20 p-3 text-emerald-300">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <Tag color="green">Ready To Publish</Tag>
              <h2 className="mt-3 text-2xl font-bold text-[color:var(--foreground)]">
                Your class draft is saved and publish-ready.
              </h2>
            </div>
          </div>

          <p className="max-w-xl text-sm leading-relaxed text-[color:var(--muted)] md:text-base">
            We saved this class plan locally and marked it ready for the final publish step. The next handoff is the advanced builder, where you can connect the full route and onchain publishing flow.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <SurfaceCard className="p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Draft summary
              </p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-[color:var(--muted)]">Name</span>
                  <span className="font-medium text-[color:var(--foreground)]">{formData.name}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[color:var(--muted)]">Format</span>
                  <span className="font-medium text-[color:var(--foreground)]">
                    {formData.mode === "agentic" ? "Coachy-assisted" : "Human-led"}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[color:var(--muted)]">Base price</span>
                  <span className="font-medium text-[color:var(--foreground)]">{formData.basePrice} ETH</span>
                </div>
              </div>
            </SurfaceCard>

            <SurfaceCard className="p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                What happens next
              </p>
              <ul className="mt-3 space-y-2 text-sm text-[color:var(--muted)]">
                <li>Review the complete builder configuration</li>
                <li>Confirm route, schedule, and publish settings</li>
                <li>Use the connected wallet for the final publish step</li>
              </ul>
            </SurfaceCard>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/instructor/builder"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[color:var(--accent)] px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90"
            >
              <Rocket className="h-4 w-4" />
              Open Advanced Builder
            </Link>
            <button
              onClick={handleStartNewDraft}
              className="rounded-xl border border-[color:var(--border)] px-6 py-3 font-semibold text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--surface-strong)]"
            >
              Start New Draft
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--accent)]">
            Draft Workflow
          </p>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            {wasRestored
              ? `Restored saved draft · last saved ${formatSavedAt(lastSavedAt)}`
              : `Current draft · ${formatSavedAt(lastSavedAt)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {draftStatus === "ready_to_publish" && <Tag color="green">Previously Ready</Tag>}
          {!isConnected && <Tag color="amber">Wallet Needed To Publish</Tag>}
        </div>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between">
          {WIZARD_STEPS.map((wizardStep, index) => {
            const isActive = wizardStep === step;
            const isCompleted = currentIndex > index;

            return (
              <div key={wizardStep} className="flex items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    isActive
                      ? "bg-[color:var(--accent)] text-white ring-4 ring-[color:var(--accent)]/20"
                      : isCompleted
                        ? "bg-[color:var(--success)] text-white"
                        : "bg-[color:var(--surface-strong)] text-[color:var(--muted)]"
                  }`}
                >
                  {isCompleted ? "✓" : index + 1}
                </div>
                <span
                  className={`ml-2 hidden text-[10px] font-bold uppercase tracking-wider sm:block ${
                    isActive ? "text-[color:var(--foreground)]" : "text-[color:var(--muted)]"
                  }`}
                >
                  {STEP_LABELS[wizardStep]}
                </span>
                {index < WIZARD_STEPS.length - 1 && (
                  <div
                    className={`mx-2 h-px w-8 sm:mx-3 sm:w-10 ${isCompleted ? "bg-[color:var(--success)]" : "bg-[color:var(--border)]"}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/50 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <h2 className="mb-6 text-xl font-bold tracking-tight text-[color:var(--foreground)]">
          {STEP_TITLES[step]}
        </h2>

        {draftStatus === "ready_to_publish" && (
          <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <p className="text-sm font-semibold text-emerald-300">
              This draft was already marked ready to publish.
            </p>
            <p className="mt-1 text-xs text-emerald-200/80">
              Any new edit keeps the same draft but moves it back into draft mode until you review it again.
            </p>
          </div>
        )}

        {step === "basics" && (
          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--foreground)]">
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
              <label className="mb-2 block text-sm font-medium text-[color:var(--foreground)]">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => updateForm({ description: e.target.value })}
                placeholder="What riders can expect from this session..."
                rows={4}
                className="w-full resize-none rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-3 text-[color:var(--foreground)] placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent)] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-[color:var(--foreground)]">
                  Duration (min)
                </label>
                <select
                  value={formData.duration}
                  onChange={(e) => updateForm({ duration: Number.parseInt(e.target.value, 10) })}
                  className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-3 text-[color:var(--foreground)] focus:border-[color:var(--accent)] focus:outline-none"
                >
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>60 min</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[color:var(--foreground)]">
                  Max Riders
                </label>
                <select
                  value={formData.maxRiders}
                  onChange={(e) => updateForm({ maxRiders: Number.parseInt(e.target.value, 10) })}
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
        )}

        {step === "mode" && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <button
                onClick={() => updateForm({ mode: "standard", useAI: false })}
                className={`relative flex flex-col rounded-2xl border p-6 text-left transition-all ${
                  formData.mode === "standard"
                    ? "border-[color:var(--accent)] bg-[color:var(--accent)]/5"
                    : "border-[color:var(--border)] bg-[color:var(--surface-strong)]/50 hover:border-[color:var(--muted)]"
                }`}
              >
                <div className={`mb-4 w-fit rounded-lg p-2 ${formData.mode === "standard" ? "bg-[color:var(--accent)] text-white" : "bg-[color:var(--surface)] text-[color:var(--muted)]"}`}>
                  <User size={24} />
                </div>
                <h3 className="mb-2 font-bold text-[color:var(--foreground)]">Standard Class</h3>
                <p className="text-xs text-[color:var(--muted)]">
                  Keep the teaching flow human-led with direct control over pacing, energy, and rider cues.
                </p>
              </button>

              <button
                onClick={() => updateForm({ mode: "agentic", useAI: true })}
                className={`relative flex flex-col rounded-2xl border p-6 text-left transition-all ${
                  formData.mode === "agentic"
                    ? "border-indigo-500 bg-indigo-500/5"
                    : "border-[color:var(--border)] bg-[color:var(--surface-strong)]/50 hover:border-[color:var(--muted)]"
                }`}
              >
                <div className={`mb-4 w-fit rounded-lg p-2 ${formData.mode === "agentic" ? "bg-indigo-500 text-white" : "bg-[color:var(--surface)] text-[color:var(--muted)]"}`}>
                  <Bot size={24} />
                </div>
                <h3 className="mb-2 font-bold text-[color:var(--foreground)]">Coachy Mode</h3>
                <p className="text-xs text-[color:var(--muted)]">
                  Use AI-supported coaching to scale class delivery while preserving your preferred training style.
                </p>
              </button>
            </div>

            {formData.mode === "agentic" && (
              <div className="animate-in fade-in slide-in-from-top-2 space-y-4">
                <label className="block text-sm font-medium text-[color:var(--foreground)]">
                  Select Coachy&apos;s Personality
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "zen", label: "Zen", icon: "🧘" },
                    { id: "drill-sergeant", label: "Drill", icon: "⚡" },
                    { id: "data", label: "Quant", icon: "📊" },
                  ].map((personality) => (
                    <button
                      key={personality.id}
                      onClick={() => updateForm({ personality: personality.id as InstructorClassDraftFormData["personality"] })}
                      className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${
                        formData.personality === personality.id
                          ? "border-indigo-500 bg-indigo-500/20 text-[color:var(--foreground)]"
                          : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--muted)] hover:bg-[color:var(--surface-strong)]"
                      }`}
                    >
                      <span className="text-2xl">{personality.icon}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider">{personality.label}</span>
                    </button>
                  ))}
                </div>
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-[10px] text-blue-300">
                  <TrendingUp size={12} className="mr-2 inline" />
                  Coachy can adapt pacing cues to live rider effort while keeping the class structure consistent.
                </div>
              </div>
            )}
          </div>
        )}

        {step === "route" && (
          <div className="space-y-6">
            <SurfaceCard className="p-5">
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-[color:var(--accent)]/10 p-3">
                  <Brain className="text-[color:var(--accent)]" size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-[color:var(--foreground)]">Route preview</h3>
                  <p className="mt-2 text-sm text-[color:var(--muted)]">
                    This simplified wizard keeps route selection lightweight. The advanced builder will let you choose or create the exact world, elevation profile, and story beats.
                  </p>
                </div>
              </div>
            </SurfaceCard>

            <div className="grid gap-4 sm:grid-cols-2">
              <SurfaceCard className="p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">Current route concept</p>
                <h4 className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">Virtual Alpine Loop</h4>
                <p className="mt-2 text-sm text-[color:var(--muted)]">
                  Best for endurance-focused sessions with one major climb and a strong closing push.
                </p>
              </SurfaceCard>

              <SurfaceCard className="p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">What carries into publish</p>
                <ul className="mt-3 space-y-2 text-sm text-[color:var(--muted)]">
                  <li>Duration and rider capacity</li>
                  <li>Teaching mode and coaching style</li>
                  <li>Base pricing and dynamic pricing choice</li>
                </ul>
              </SurfaceCard>
            </div>
          </div>
        )}

        {step === "pricing" && (
          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--foreground)]">
                Base Price (ETH)
              </label>
              <input
                type="number"
                min="0"
                step="0.001"
                value={formData.basePrice}
                onChange={(e) => updateForm({ basePrice: e.target.value })}
                className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-3 text-[color:var(--foreground)] focus:border-[color:var(--accent)] focus:outline-none"
              />
              <p className="mt-2 text-xs text-[color:var(--muted)]">
                Use a realistic preview price now; you can refine the full pricing curve during publish.
              </p>
            </div>

            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)]/50 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={formData.enableDynamicPricing}
                  onChange={(e) => updateForm({ enableDynamicPricing: e.target.checked })}
                  className="mt-1 h-5 w-5 rounded border-[color:var(--border)] bg-[color:var(--surface-strong)] text-[color:var(--accent)] focus:ring-[color:var(--accent)]"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[color:var(--foreground)]">Smart Pricing</span>
                    <Tag>Demand Surge</Tag>
                  </div>
                  <span className="mt-1 block text-xs text-[color:var(--muted)]">
                    Adjust pricing dynamically as seats fill, then refine the exact rules in the advanced builder.
                  </span>
                </div>
              </label>
            </div>

            <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4">
              <div className="flex gap-3">
                <Shield className="shrink-0 text-green-500" size={18} />
                <p className="text-xs text-green-300">
                  Payouts, treasury split, and reward distribution belong in the publish step. This draft only captures the business intent so you can validate the class before launch.
                </p>
              </div>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <SurfaceCard className="p-4">
              <div className="mb-3 flex items-start justify-between">
                <h4 className="text-xs uppercase tracking-wider text-[color:var(--muted)]">Class Identity</h4>
                <Tag color={formData.mode === "agentic" ? "indigo" : "blue"}>
                  {formData.mode === "agentic" ? "🤖 Coachy" : "👤 Standard"}
                </Tag>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-[color:var(--muted)]">Name</span>
                  <span className="font-medium text-[color:var(--foreground)]">{formData.name || "Untitled"}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[color:var(--muted)]">Duration</span>
                  <span className="text-[color:var(--foreground)]">{formData.duration} min</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[color:var(--muted)]">Capacity</span>
                  <span className="text-[color:var(--foreground)]">{formData.maxRiders} riders</span>
                </div>
                {formData.mode === "agentic" && (
                  <div className="flex justify-between gap-4">
                    <span className="text-[color:var(--muted)]">Coachy personality</span>
                    <span className="capitalize text-indigo-400">{formData.personality.replace("-", " ")}</span>
                  </div>
                )}
              </div>
            </SurfaceCard>

            <SurfaceCard className="p-4">
              <h4 className="mb-3 text-xs uppercase tracking-wider text-[color:var(--muted)]">Pricing & Publish Readiness</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-[color:var(--muted)]">Base Price</span>
                  <span className="font-medium text-[color:var(--foreground)]">{formData.basePrice} ETH</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[color:var(--muted)]">Pricing Engine</span>
                  <span className="text-[color:var(--foreground)]">
                    {formData.enableDynamicPricing ? "Smart Pricing" : "Fixed"}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[color:var(--muted)]">Wallet status</span>
                  <span className={isConnected ? "text-emerald-400" : "text-amber-400"}>
                    {isConnected ? "Connected" : "Required to publish"}
                  </span>
                </div>
              </div>
            </SurfaceCard>

            {!isConnected ? (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-amber-300">Save the draft now, then connect a wallet to publish.</p>
                    <p className="mt-1 text-xs text-amber-200/80">
                      Publishing is intentionally gated until a wallet is connected, but drafting is fully available without it.
                    </p>
                  </div>
                  <div className="shrink-0">
                    <ConnectWallet />
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <p className="text-sm font-semibold text-emerald-300">Wallet connected. This draft can move into the publish handoff.</p>
                <p className="mt-1 text-xs text-emerald-200/80">
                  Continue to publish to save the draft as ready and hand it off to the advanced builder.
                </p>
              </div>
            )}

            <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-3 text-[10px] text-indigo-300">
              <Zap size={12} className="mr-2 inline" />
              This flow now saves a real draft and creates a clear next step instead of ending with a simulated alert.
            </div>
          </div>
        )}

        <div className="mt-10 flex flex-col gap-4 border-t border-[color:var(--border)] pt-6">
          <div className="flex flex-col gap-2 text-xs text-[color:var(--muted)] sm:flex-row sm:items-center sm:justify-between">
            <span>Draft status: {draftStatus === "ready_to_publish" ? "Ready to publish" : "In progress"}</span>
            <span>Last saved: {formatSavedAt(lastSavedAt)}</span>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            {step !== "basics" && (
              <button
                onClick={handleBack}
                className="rounded-xl border border-[color:var(--border)] px-8 py-3 font-semibold text-[color:var(--foreground)] transition-all hover:bg-[color:var(--surface-strong)]"
              >
                Back
              </button>
            )}

            <button
              onClick={handleSaveDraft}
              className="rounded-xl border border-[color:var(--border)] px-8 py-3 font-semibold text-[color:var(--foreground)] transition-all hover:bg-[color:var(--surface-strong)]"
            >
              Save Draft
            </button>

            {step !== "review" ? (
              <LoadingButton
                onClick={handleNext}
                className="flex-1 shadow-lg shadow-[color:var(--accent)]/20"
              >
                Continue
              </LoadingButton>
            ) : (
              <LoadingButton
                onClick={handlePreparePublish}
                isLoading={isSubmitting}
                className={`flex-1 shadow-lg ${formData.mode === "agentic" ? "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20" : "shadow-[color:var(--accent)]/20"}`}
              >
                {isConnected
                  ? formData.mode === "agentic"
                    ? "Continue To Publish With Coachy"
                    : "Continue To Publish"
                  : "Connect Wallet To Publish"}
              </LoadingButton>
            )}
          </div>

          {step === "basics" && !canContinue && (
            <p className="text-xs text-amber-400">
              Add a class name and description to unlock the next step.
            </p>
          )}
          {step === "pricing" && !canContinue && (
            <p className="text-xs text-amber-400">
              Set a valid base price before reviewing the draft.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
