"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface InstructorMode {
  id: "human" | "agent";
  icon: string;
  title: string;
  subtitle: string;
  description: string;
  features: string[];
  cta: string;
  href: string;
  color: string;
}

const modes: InstructorMode[] = [
  {
    id: "human",
    icon: "🎓",
    title: "Human Instructor",
    subtitle: "Craft Your Classes",
    description: "Design immersive experiences, curate playlists, and build your community with full creative control.",
    features: [
      "Create custom route worlds",
      "Set your own pricing",
      "Direct rider relationships",
      "Live class hosting"
    ],
    cta: "Start Teaching",
    href: "/instructor",
    color: "from-indigo-500 to-purple-500"
  },
  {
    id: "agent",
    icon: "🤖",
    title: "AI Agent",
    subtitle: "Deploy Autonomous Coaching",
    description: "Launch an AI-powered instructor that adapts to each rider, manages pricing, and optimizes engagement 24/7.",
    features: [
      "Real-time difficulty adjustment",
      "Dynamic pricing optimization",
      "Personalized coaching at scale",
      "Cross-chain performance tracking"
    ],
    cta: "Deploy Agent",
    href: "/instructor/ai",
    color: "from-cyan-500 to-blue-500"
  }
];

// Pre-generate random particle values to avoid Math.random() in render
const PARTICLE_COUNT = 6;
const particleData = Array.from({ length: PARTICLE_COUNT }, () => ({
  x: Math.random() * 100,
  y: Math.random() * 100,
  duration: 3 + Math.random() * 2,
}));

export function InstructorModeSelector() {
  const [activeMode, setActiveMode] = useState<"human" | "agent">("human");
  const [isHovered, setIsHovered] = useState(false);

  const currentMode = modes.find(m => m.id === activeMode)!;

  return (
    <div className="w-full">
      {/* Toggle Switch */}
      <div className="flex justify-center mb-8">
        <div 
          className="relative flex p-1 rounded-full bg-[color:var(--surface-strong)] border border-[color:var(--border)]"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Animated background pill */}
          <motion.div
            className={`absolute top-1 bottom-1 rounded-full bg-gradient-to-r ${currentMode.color} opacity-20`}
            initial={false}
            animate={{
              x: activeMode === "human" ? 4 : "100%",
              width: "calc(50% - 4px)",
              left: activeMode === "human" ? 0 : -4
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
          
          {modes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setActiveMode(mode.id)}
              className={`relative z-10 flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-colors ${
                activeMode === mode.id
                  ? "text-[color:var(--foreground)]"
                  : "text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
              }`}
            >
              <span className="text-lg">{mode.icon}</span>
              <span className="hidden sm:inline">{mode.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Mode Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeMode}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="relative overflow-hidden rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]"
        >
          {/* Animated gradient background */}
          <motion.div
            className={`absolute inset-0 bg-gradient-to-br ${currentMode.color} opacity-5`}
            animate={{
              opacity: isHovered ? 0.1 : 0.05
            }}
            transition={{ duration: 0.5 }}
          />

          {/* Floating particles effect */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particleData.map((particle, i) => (
              <motion.div
                key={i}
                className={`absolute w-2 h-2 rounded-full bg-gradient-to-r ${currentMode.color} opacity-30`}
                initial={{
                  x: particle.x + "%",
                  y: particle.y + "%",
                }}
                animate={{
                  y: [null, "-20%"],
                  opacity: [0.3, 0]
                }}
                transition={{
                  duration: particle.duration,
                  repeat: Infinity,
                  delay: i * 0.5,
                  ease: "linear"
                }}
              />
            ))}
          </div>

          <div className="relative p-8 lg:p-12">
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              {/* Left: Content */}
              <div>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[color:var(--surface-strong)] border border-[color:var(--border)] mb-6"
                >
                  <span className="text-2xl">{currentMode.icon}</span>
                  <span className="text-sm font-medium text-[color:var(--muted)]">
                    {currentMode.subtitle}
                  </span>
                </motion.div>

                <motion.h3
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="text-3xl lg:text-4xl font-bold text-[color:var(--foreground)] mb-4"
                >
                  {currentMode.title}
                </motion.h3>

                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-lg text-[color:var(--muted)] mb-6"
                >
                  {currentMode.description}
                </motion.p>

                <motion.ul
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.25 }}
                  className="space-y-3 mb-8"
                >
                  {currentMode.features.map((feature, i) => (
                    <motion.li
                      key={feature}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.25 + i * 0.05 }}
                      className="flex items-center gap-3 text-[color:var(--foreground)]"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${currentMode.color}`} />
                      {feature}
                    </motion.li>
                  ))}
                </motion.ul>

                <motion.a
                  href={currentMode.href}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r ${currentMode.color} text-white font-semibold shadow-lg transition-shadow hover:shadow-xl`}
                >
                  {currentMode.cta}
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </motion.a>
              </div>

              {/* Right: Visual */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="relative aspect-square rounded-2xl overflow-hidden bg-[color:var(--surface-strong)] border border-[color:var(--border)]"
              >
                {/* Placeholder for instructor/agent image */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <span className="text-8xl">{currentMode.icon}</span>
                    <p className="mt-4 text-sm text-[color:var(--muted)]">
                      {activeMode === "human" 
                        ? "[Your instructor photo here]" 
                        : "[AI visualization here]"}
                    </p>
                  </div>
                </div>

                {/* Animated ring */}
                <motion.div
                  className={`absolute inset-4 rounded-xl border-2 border-dashed border-gradient-to-r ${currentMode.color} opacity-30`}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  style={{ borderStyle: "dashed" }}
                />

                {/* Status indicator */}
                <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[color:var(--surface)] border border-[color:var(--border)]">
                  <motion.span
                    className={`w-2 h-2 rounded-full bg-gradient-to-r ${currentMode.color}`}
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <span className="text-xs text-[color:var(--muted)]">
                    {activeMode === "human" ? "Ready to teach" : "AI training complete"}
                  </span>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Comparison hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center text-sm text-[color:var(--muted)] mt-6"
      >
        Not sure?{" "}
        <a href="/instructor" className="text-[color:var(--accent)] hover:underline">
          Compare both options →
        </a>
      </motion.p>
    </div>
  );
}
