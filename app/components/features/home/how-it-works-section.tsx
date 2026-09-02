"use client";

import { useRef, useState } from "react";
import { m } from "framer-motion";
import { Tag } from "@/app/components/ui/ui";
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
    description: "Choose from live or on-demand cycling classes with immersive 3D routes",
  },
  {
    step: "2",
    title: "Ride & Compete",
    description: "Use your bike, heart rate monitor, or keyboard simulator to ride in real-time",
  },
  {
    step: "3",
    title: "Earn Rewards",
    description: "Your effort is verified with zero-knowledge proofs and rewarded automatically",
  },
];

const STICKERS = ["🚴", "⚡️", "🧘", "🔥", "💨", "🌬️", "🎯"];

export function HowItWorksSection() {
  const rootRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const [scrubProgress, setScrubProgress] = useState(0);
  const [stickerIdx, setStickerIdx] = useState<number[]>([0, 0, 0]);

  useGSAP(
    () => {
      if (!rootRef.current) return;
      ScrollTrigger.create({
        trigger: rootRef.current,
        start: "top 70%",
        end: "bottom 30%",
        scrub: 1.2,
        onUpdate: (self) => {
          progressRef.current = self.progress;
          setScrubProgress(self.progress);
        },
      });
    },
    { scope: rootRef },
  );

  return (
    <section ref={rootRef}>
      <FadeIn direction="up">
        <div className="text-center mb-10 md:mb-12">
          <Tag>Simple as 1-2-3</Tag>
          <h2 className="text-2xl md:text-3xl font-bold text-[color:var(--foreground)] mt-4">
            How It Works
          </h2>
        </div>
      </FadeIn>
      <StaggerContainer className="grid gap-4 md:gap-6 md:grid-cols-3" staggerDelay={0.15}>
        {howItWorks.map((item, idx) => (
          <div
            key={item.step}
            className="group relative rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/50 p-5 md:p-6 text-center hover:border-[color:var(--accent)]/30 transition-colors overflow-hidden"
            onClick={() => {
              const next = [...stickerIdx];
              next[idx] = (next[idx] + 1) % STICKERS.length;
              setStickerIdx(next);
              const el = document.getElementById(`sticker-${idx}`);
              if (el) {
                gsap.fromTo(el, { scale: 0 }, { scale: 1, duration: 1, ease: "elastic.out(1.2, 0.8)" });
              }
            }}
            role="button"
            tabIndex={0}
            title="Click to cycle sticker"
          >
            <m.span
              className="inline-flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full bg-[color:var(--accent)]/10 text-[color:var(--accent)] font-semibold mb-3 md:mb-4 relative"
              whileHover={{ scale: 1.1, rotate: 5 }}
            >
              {item.step}
              <span
                id={`sticker-${idx}`}
                className="absolute -right-1 -top-1 text-sm pointer-events-none"
                aria-hidden="true"
              >
                {STICKERS[stickerIdx[idx]]}
              </span>
            </m.span>
            <h3 className="text-base md:text-lg font-semibold text-[color:var(--foreground)] mb-2">
              {item.title}
            </h3>
            <p className="text-xs md:text-sm text-[color:var(--muted)]">
              {item.description}
            </p>
          </div>
        ))}
      </StaggerContainer>

      {/* Scroll-scrubbed route — road fills as you read, effort aura via canvas mask */}
      <div className="mt-10 rounded-2xl border border-white/10 bg-black/20 backdrop-blur-xl p-4 md:p-6 overflow-hidden relative">
        <div className="absolute inset-0 opacity-40">
          <EffortAuraCanvas intensity={scrubProgress} />
        </div>
        <div className="relative flex items-center justify-between mb-3">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Your route, unfolding as you scroll</p>
          <span className="text-xs font-mono text-white/60">{Math.round(scrubProgress * 100)}%</span>
        </div>
        <svg viewBox="0 0 400 80" className="w-full h-[80px] relative" preserveAspectRatio="none" aria-hidden="true">
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
          {/* Rider dot */}
          <circle
            cx={20 + scrubProgress * 360 - Math.sin(scrubProgress * Math.PI * 2) * 10}
            cy={60 - scrubProgress * 30 - Math.cos(scrubProgress * Math.PI * 1.5) * 10}
            r="6"
            fill="#6d7cff"
            stroke="white"
            strokeWidth="2"
          />
        </svg>
        <p className="mt-2 text-center text-[10px] text-white/30">Scroll through the steps → the road draws itself</p>
      </div>
    </section>
  );
}