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

export function RiderQuiz({ onComplete, onSkip }: RiderQuizProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const setProfile = useRiderProfile((s) => s.setProfile);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (!mounted) return null;

  const step = quizSteps[currentStep];
  const isLastStep = currentStep === quizSteps.length - 1;
  const progress = ((currentStep + 1) / quizSteps.length) * 100;

  const handleAnswer = (value: string) => {
    const newAnswers = { ...answers, [step.id]: value };
    setAnswers(newAnswers);

    if (isLastStep) {
      setProfile({
        goal: newAnswers.goal as FitnessGoal,
        experience: newAnswers.experience as ExperienceLevel,
        frequency: newAnswers.frequency as RideFrequency,
        motivation: newAnswers.motivation as Motivation,
        coachPersonality: newAnswers.coach as CoachPersonality,
        createdAt: Date.now(),
      });
      localStorage.setItem(RIDER_QUIZ_KEY, "true");
    } else {
      setTimeout(() => setCurrentStep(currentStep + 1), 300);
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
      <QuizShell onSkip={handleSkip} progress={100}>
        <div className="text-center">
          <CoachyMascot mood="celebrating" size={100} className="mx-auto mb-4" />
          <h2 className="text-2xl font-black text-white mb-2">
            Your ride plan is ready! 🎉
          </h2>
          <p className="text-sm text-white/60 mb-6">
            Based on your answers, here&apos;s what we recommend:
          </p>

          <div className="grid grid-cols-2 gap-3 mb-6 text-left">
            <SummaryCard label="Difficulty" value={difficulty} emoji="⛰️" />
            <SummaryCard label="Duration" value={`${duration} min`} emoji="⏱️" />
            <SummaryCard label="Coach style" value={COACH_LABELS[profile.coachPersonality!]} emoji="🎙️" />
            <SummaryCard label="Focus" value={GOAL_LABELS[profile.goal!]} emoji="🎯" />
          </div>

          {rides.length > 0 && (
            <div className="rounded-2xl border border-orange-400/30 bg-orange-500/10 px-4 py-3 mb-4">
              <p className="text-sm text-orange-200">
                🔥 {streak.daily}-day streak • {rides.length} rides completed
              </p>
            </div>
          )}

          <button
            onClick={handleStartRide}
            className="w-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg transition-transform active:scale-95 hover:shadow-xl"
          >
            Let&apos;s ride! 🚴
          </button>
        </div>
      </QuizShell>
    );
  }

  return (
    <QuizShell onSkip={handleSkip} progress={progress}>
      <div className="text-center">
        <CoachyMascot mood={step.coachyMood} size={90} className="mx-auto mb-4" />

        <h2 className="text-xl font-black text-white mb-1">{step.question}</h2>
        <p className="text-xs text-white/40 mb-5">Step {currentStep + 1} of {quizSteps.length}</p>

        <div className="space-y-2.5">
          {step.options.map((opt) => {
            const isSelected = answers[step.id] === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => handleAnswer(opt.value)}
                className={`w-full flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all active:scale-[0.98] ${
                  isSelected
                    ? "border-indigo-400 bg-indigo-500/20"
                    : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                }`}
              >
                <span className="text-2xl shrink-0">{opt.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{opt.label}</p>
                  {opt.description && (
                    <p className="text-xs text-white/50 mt-0.5">{opt.description}</p>
                  )}
                </div>
                {isSelected && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-indigo-400 text-lg shrink-0"
                  >
                    ✓
                  </motion.span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </QuizShell>
  );
}

function QuizShell({ children, onSkip, progress }: { children: React.ReactNode; onSkip: () => void; progress: number }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-md rounded-3xl border border-white/15 bg-[color:var(--surface)] p-6 shadow-2xl md:p-8 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onSkip}
          className="absolute top-4 right-4 p-2 rounded-full text-white/40 hover:text-white/80 hover:bg-white/10 transition-all"
          aria-label="Skip quiz"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="h-1.5 rounded-full bg-white/10 mb-6 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={Math.round(progress)}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, emoji }: { label: string; value: string; emoji: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-white/40 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-white flex items-center gap-1.5">
        <span>{emoji}</span>
        <span className="capitalize">{value}</span>
      </p>
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
