"use client";

import { useRef, useState } from "react";
import { m } from "framer-motion";
import { FadeIn, StaggerContainer } from "@/app/components/ui/scroll-animations";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { EffortAuraCanvas } from "@/app/components/ui/effort-aura-canvas";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

const howItWorks = [
  {
    step: "1",
    title: "Pick a Class",
    description: "Choose from live or on-demand cycling classes with immersive 3D routes.",
  },
  {
    step: "2",
    title: "Pedal",
    description: "Use your bike, heart rate monitor, or keyboard simulator to ride in real time.",
  },
  {
    step: "3",
    title: "Watch the World React",
    description: "The road, fog, and lights transform with your effort — no setup, no wallet required.",
  },
];

export function HowItWorksSection() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [scrubProgress, setScrubProgress] = useState(0);

  useGSAP(
    () => {
      if (!rootRef.current) return;
      let raf: number | null = null;
      let latestProgress = 0;

      ScrollTrigger.create({
        trigger: rootRef.current,
        start: "top 70%",
        end: "bottom 30%",
        scrub: 1.2,
        onUpdate: (self) => {
          latestProgress = self.progress;
          if (raf == null) {
            raf = requestAnimationFrame(() => {
              setScrubProgress(latestProgress);
              raf = null;
            });
          }
        },
      });
    },
    { scope: rootRef },
  );

  const dotFill = "var(--accent)";

  return (
    <section ref={rootRef}>
      <FadeIn direction="up">
        <div className="mb-10 text-center md:mb-12">
          <h2 className="text-2xl font-bold text-[color:var(--foreground)] md:text-3xl">
            How It Works
          </h2>
        </div>
      </FadeIn>
      <StaggerContainer className="grid gap-4 md:grid-cols-3 md:gap-6" staggerDelay={0.15}>
        {howItWorks.map((item) => (
          <div
            key={item.step}
            className="group relative overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5 text-center transition-colors hover:border-[color:var(--accent)]/30 md:p-6"
          >
            <m.span
              className="relative mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--accent)]/10 font-semibold text-[color:var(--accent)] md:mb-4 md:h-12 md:w-12"
              whileHover={{ scale: 1.1, rotate: 5 }}
            >
              {item.step}
            </m.span>
            <h3 className="mb-2 text-base font-semibold text-[color:var(--foreground)] md:text-lg">
              {item.title}
            </h3>
            <p className="text-xs text-[color:var(--muted)] md:text-sm">
              {item.description}
            </p>
          </div>
        ))}
      </StaggerContainer>

      <div className="relative mt-10 overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-4 md:p-6">
        <div className="absolute inset-0 opacity-40">
          <EffortAuraCanvas intensity={scrubProgress} />
        </div>
        <div className="relative mb-3 flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
            Your effort shapes the road
          </p>
          <span className="font-mono text-xs text-white/60">{Math.round(scrubProgress * 100)}%</span>
        </div>
        <svg viewBox="0 0 400 80" className="relative h-[80px] w-full" preserveAspectRatio="none" aria-hidden="true">
          <path
            d="M 20 60 Q 100 20 200 40 T 380 30"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M 20 60 Q 100 20 200 40 T 380 30"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="1000"
            strokeDashoffset={1000 - scrubProgress * 1000}
            style={{ transition: "stroke-dashoffset 0.1s linear" }}
          />
          <circle
            cx={20 + scrubProgress * 360 - Math.sin(scrubProgress * Math.PI * 2) * 10}
            cy={60 - scrubProgress * 30 - Math.cos(scrubProgress * Math.PI * 1.5) * 10}
            r="6"
            fill={dotFill}
            stroke="white"
            strokeWidth="2"
          />
        </svg>
      </div>
    </section>
  );
}
