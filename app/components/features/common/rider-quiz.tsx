"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CoachyMascot, type CoachyMood } from "@/app/components/ui/coachy-mascot";
import {
  useRiderProfile,
  type FitnessGoal,
  type ExperienceLevel,
  type RideFrequency,
  type Motivation,
  type CoachPersonality,
  GOAL_LABELS,
  EXPERIENCE_LABELS,
  FREQUENCY_LABELS,
  MOTIVATION_LABELS,
  COACH_LABELS,
  getRecommendedDifficulty,
  getRecommendedDuration,
  mapCoachPersonalityToEngine,
  getRecommendedRideName,
} from "@/app/stores/rider-profile-store";
import { getRideHistory, getStreakStats } from "@/app/lib/analytics/ride-history";
import { getDemoRideUrl } from "@/app/hooks/evm/use-class-data";
import { useAccount } from "wagmi";
import { useProfile, getDisplayName, formatAddress } from "@/app/hooks/common/use-profile";

export const RIDER_QUIZ_KEY = "spinchain-rider-quiz-completed";

interface QuizStep {
  id: string;
  question: string;
  coachyMood: CoachyMood;
  options: { value: string; label: string; emoji: string; description?: string }[];
}

const quizSteps: QuizStep[] = [
  {
    id: "goal",
    question: "What brings you here?",
    coachyMood: "welcoming",
    options: [
      { value: "endurance", label: GOAL_LABELS["endurance"], emoji: "💪", description: "Build stamina and cardiovascular health" },
      { value: "weight-loss", label: GOAL_LABELS["weight-loss"], emoji: "🔥", description: "Burn calories and shed pounds" },
      { value: "event-training", label: GOAL_LABELS["event-training"], emoji: "🏆", description: "Prepare for a race or event" },
      { value: "curious", label: GOAL_LABELS["curious"], emoji: "🤔", description: "Just exploring what SpinChain is" },
    ],
  },
  {
    id: "experience",
    question: "How would you describe your cycling experience?",
    coachyMood: "thinking",
    options: [
      { value: "beginner", label: EXPERIENCE_LABELS["beginner"], emoji: "🌱", description: "New to indoor cycling" },
      { value: "intermediate", label: EXPERIENCE_LABELS["intermediate"], emoji: "🚴", description: "Ride regularly, know the basics" },
      { value: "advanced", label: EXPERIENCE_LABELS["advanced"], emoji: "⚡", description: "Experienced rider, want a challenge" },
    ],
  },
  {
    id: "frequency",
    question: "How often do you ride?",
    coachyMood: "coaching",
    options: [
      { value: "first-time", label: FREQUENCY_LABELS["first-time"], emoji: "👋" },
      { value: "1-2-week", label: FREQUENCY_LABELS["1-2-week"], emoji: "📅" },
      { value: "3-4-week", label: FREQUENCY_LABELS["3-4-week"], emoji: "🔥" },
      { value: "daily", label: FREQUENCY_LABELS["daily"], emoji: "⚡" },
    ],
  },
  {
    id: "motivation",
    question: "What keeps you pedaling?",
    coachyMood: "cheering",
    options: [
      { value: "competition", label: MOTIVATION_LABELS["competition"], emoji: "🏁", description: "Chasing PRs and beating the leaderboard" },
      { value: "data", label: MOTIVATION_LABELS["data"], emoji: "📊", description: "Numbers, zones, and performance metrics" },
      { value: "coaching", label: MOTIVATION_LABELS["coaching"], emoji: "🎙️", description: "Guided instruction and form tips" },
      { value: "vibes", label: MOTIVATION_LABELS["vibes"], emoji: "🎵", description: "Great music and immersive atmosphere" },
    ],
  },
  {
    id: "coach",
    question: "Pick your coach personality",
    coachyMood: "celebrating",
    options: [
      { value: "drill-sergeant", label: COACH_LABELS["drill-sergeant"], emoji: "🎖️", description: "Pushes you hard, no excuses" },
      { value: "zen-master", label: COACH_LABELS["zen-master"], emoji: "🧘", description: "Calm guidance, mindful pacing" },
      { value: "data-analyst", label: COACH_LABELS["data-analyst"], emoji: "📈", description: "Metrics-driven, precision coaching" },
    ],
  },
];

interface RiderQuizProps {
  onComplete?: () => void;
  onSkip?: () => void;
}

const stepThemes: Record<string, { glow: string; accent: string; gradient: string }> = {
  goal:         { glow: "rgba(109,124,255,0.15)",  accent: "#6d7cff", gradient: "from-[#6d7cff]/20 to-transparent" },
  experience:   { glow: "rgba(139,92,246,0.15)",  accent: "#8b5cf6", gradient: "from-[#8b5cf6]/20 to-transparent" },
  frequency:    { glow: "rgba(6,182,212,0.15)",   accent: "#22d3ee", gradient: "from-[#22d3ee]/20 to-transparent" },
  motivation:   { glow: "rgba(245,158,11,0.15)",  accent: "#fbbf24", gradient: "from-[#fbbf24]/20 to-transparent" },
  coach:        { glow: "rgba(16,185,129,0.15)",  accent: "#34d399", gradient: "from-[#34d399]/20 to-transparent" },
};

export function RiderQuiz({ onComplete, onSkip }: RiderQuizProps) {
  const router = useRouter();
  const { address } = useAccount();
  const { profile: ensProfile } = useProfile(address);
  const [currentStep, setCurrentStep] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [direction, setDirection] = useState(1);
  const setProfile = useRiderProfile((s) => s.setProfile);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const prefill = sessionStorage.getItem("spinchain-quiz-prefill");
    if (prefill) {
      try {
        const data = JSON.parse(prefill);
        const prefilled: Record<string, string> = {};
        if (data.goal) prefilled.goal = data.goal;
        if (data.experience) prefilled.experience = data.experience;
        if (data.frequency) prefilled.frequency = data.frequency;
        if (data.motivation) prefilled.motivation = data.motivation;
        if (data.coach) prefilled.coach = data.coach;
        if (Object.keys(prefilled).length > 0) {
          setAnswers(prefilled);
        }
      } catch {
        // ignore
      }
      sessionStorage.removeItem("spinchain-quiz-prefill");
    }
  }, []);

  if (!mounted) return null;

  const step = quizSteps[currentStep];
  const isLastStep = currentStep === quizSteps.length - 1;
  const theme = stepThemes[step.id] ?? stepThemes.goal;

  const handleAnswer = (value: string) => {
    const newAnswers = { ...answers, [step.id]: value };
    setAnswers(newAnswers);

    if (isLastStep) {
      const displayName = ensProfile
        ? getDisplayName(ensProfile, address ?? "")
        : address
          ? formatAddress(address)
          : null;

      setProfile({
        goal: newAnswers.goal as FitnessGoal,
        experience: newAnswers.experience as ExperienceLevel,
        frequency: newAnswers.frequency as RideFrequency,
        motivation: newAnswers.motivation as Motivation,
        coachPersonality: newAnswers.coach as CoachPersonality,
        displayName,
        createdAt: new Date().getTime(),
      });
      localStorage.setItem(RIDER_QUIZ_KEY, "true");
    } else {
      setDirection(1);
      setTimeout(() => setCurrentStep(currentStep + 1), 280);
    }
  };

  const handleSkip = () => {
    localStorage.setItem(RIDER_QUIZ_KEY, "true");
    onSkip?.();
  };

  if (isLastStep && answers[step.id]) {
    const profile = {
      goal: answers.goal as FitnessGoal,
      experience: answers.experience as ExperienceLevel,
      frequency: answers.frequency as RideFrequency,
      motivation: answers.motivation as Motivation,
      coachPersonality: answers.coach as CoachPersonality,
    };
    const difficulty = getRecommendedDifficulty(profile);
    const duration = getRecommendedDuration(profile);
    const rides = getRideHistory();
    const streak = getStreakStats(rides);
    const rideName = getRecommendedRideName(difficulty);
    const coachEngine = mapCoachPersonalityToEngine(profile.coachPersonality ?? null);

    const handleStartRide = () => {
      onComplete?.();
      router.push(getDemoRideUrl({
        name: rideName,
        duration,
        coachPersonality: coachEngine,
      }));
    };

    return (
      <QuizShell onSkip={handleSkip} stepId={step.id} theme={theme}>
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          className="flex flex-col items-center text-center"
        >
          <CoachyMascot mood="celebrating" size={88} className="mb-3" />

          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[color:var(--muted)] mb-2">
            Your ride plan
          </p>
          <h2 className="text-3xl font-black leading-tight text-[color:var(--foreground)] mb-1">
            Let&apos;s ride
          </h2>
          <p className="text-sm text-[color:var(--muted)] mb-8">
            Based on your answers, here&apos;s what we recommend
          </p>

          <div className="flex flex-col gap-1.5 w-full mb-6">
            <SummaryRow label="Difficulty" value={difficulty} emoji="⛰️" accent={theme.accent} />
            <SummaryRow label="Duration" value={`${duration} min`} emoji="⏱️" accent={theme.accent} />
            <SummaryRow label="Coach style" value={COACH_LABELS[profile.coachPersonality!]} emoji="🎙️" accent={theme.accent} />
            <SummaryRow label="Focus" value={GOAL_LABELS[profile.goal!]} emoji="🎯" accent={theme.accent} />
          </div>

          {rides.length > 0 && (
            <div className="mb-5 text-sm text-orange-300">
              🔥 {streak.daily}-day streak • {rides.length} rides completed
            </div>
          )}

          <button
            onClick={handleStartRide}
            className="w-full rounded-full px-6 py-4 text-base font-bold text-white transition-transform active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${theme.accent}, ${stepThemes.coach.accent})`,
              boxShadow: `0 8px 32px ${theme.glow}`,
            }}
          >
            Start your first ride →
          </button>
        </motion.div>
      </QuizShell>
    );
  }

  return (
    <QuizShell onSkip={handleSkip} stepId={step.id} theme={theme}>
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step.id}
          custom={direction}
          initial={{ opacity: 0, x: 60 * direction }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -60 * direction }}
          transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
          className="flex flex-col items-center text-center"
        >
          <CoachyMascot mood={step.coachyMood} size={80} className="mb-3" />

          <p className="text-[10px] font-bold uppercase tracking-[0.3em] mb-3" style={{ color: theme.accent }}>
            Step {currentStep + 1} of {quizSteps.length}
          </p>

          <h2 className="text-2xl font-black leading-tight text-[color:var(--foreground)] mb-6">
            {step.question}
          </h2>

          <div className="flex flex-col gap-2 w-full">
            {step.options.map((opt, i) => {
              const isSelected = answers[step.id] === opt.value;
              return (
                <motion.button
                  key={opt.value}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + i * 0.04, duration: 0.3 }}
                  onClick={() => handleAnswer(opt.value)}
                  className="group w-full flex items-center gap-3 rounded-full px-5 py-3.5 text-left transition-all active:scale-[0.97]"
                  style={{
                    background: isSelected
                      ? `linear-gradient(90deg, ${theme.accent}25, transparent)`
                      : "transparent",
                    border: `1px solid ${isSelected ? theme.accent + "60" : "var(--border)"}`,
                  }}
                >
                  <span className="text-xl shrink-0 transition-transform group-hover:scale-110" style={{ filter: `drop-shadow(0 0 8px ${isSelected ? theme.accent + "80" : "transparent"})` }}>
                    {opt.emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[color:var(--foreground)]">{opt.label}</p>
                    {opt.description && (
                      <p className="text-xs text-[color:var(--muted)] mt-0.5">{opt.description}</p>
                    )}
                  </div>
                  {isSelected && (
                    <motion.span
                      initial={{ scale: 0, rotate: -90 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      className="text-base shrink-0"
                      style={{ color: theme.accent }}
                    >
                      ✓
                    </motion.span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>
    </QuizShell>
  );
}

interface QuizShellProps {
  children: React.ReactNode;
  onSkip: () => void;
  stepId: string;
  theme: { glow: string; accent: string; gradient: string };
}

function QuizShell({ children, onSkip, stepId, theme }: QuizShellProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      style={{
        background: `radial-gradient(ellipse at 50% 30%, ${theme.glow} 0%, transparent 60%), var(--background)`,
      }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          key={stepId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className={`absolute -top-1/4 -right-1/4 w-[60vw] h-[60vw] rounded-full blur-[120px] bg-gradient-to-br ${theme.gradient}`}
        />
      </div>

      <div className="relative w-full max-w-md px-2 py-8 md:py-12 max-h-[92vh] overflow-y-auto">
        <div className="absolute top-0 right-2 flex items-center gap-2">
          <span className="text-[10px] font-medium text-[color:var(--muted)]/60 hidden sm:inline">Personalize your experience</span>
          <button
            onClick={onSkip}
            className="text-xs font-medium text-[color:var(--muted)] hover:text-[color:var(--foreground)] transition-colors px-3 py-1.5 rounded-full border border-[color:var(--border)] hover:border-[color:var(--border-strong)]"
            aria-label="Skip quiz"
          >
            Maybe later
          </button>
        </div>

        {children}
      </div>
    </motion.div>
  );
}

function SummaryRow({ label, value, emoji, accent }: { label: string; value: string; emoji: string; accent: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[color:var(--border)] last:border-0">
      <span className="text-base shrink-0">{emoji}</span>
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--muted)] flex-1 text-left">{label}</span>
      <span className="text-sm font-bold capitalize" style={{ color: accent }}>{value}</span>
    </div>
  );
}

export function useNeedsQuiz(): boolean {
  const [needs, setNeeds] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(RIDER_QUIZ_KEY);
    Promise.resolve().then(() => setNeeds(!completed));
  }, []);

  return needs;
}

export function resetQuiz() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(RIDER_QUIZ_KEY);
    useRiderProfile.getState().reset();
  }
}
