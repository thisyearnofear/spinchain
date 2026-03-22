"use client";

import { motion } from "framer-motion";
import { Tag } from "@/app/components/ui/ui";
import { FadeIn, StaggerContainer } from "@/app/components/ui/scroll-animations";

const howItWorks = [
  {
    step: "1",
    title: "Book a Class",
    description: "Choose from live or on-demand cycling classes",
  },
  {
    step: "2",
    title: "Ride & Connect",
    description: "Join via your bike, heart rate monitor, or app",
  },
  {
    step: "3",
    title: "Earn Instantly",
    description: "Get rewarded automatically based on your effort",
  },
];

export function HowItWorksSection() {
  return (
    <section>
      <FadeIn direction="up">
        <div className="text-center mb-10 md:mb-12">
          <Tag>Simple as 1-2-3</Tag>
          <h2 className="text-2xl md:text-3xl font-bold text-[color:var(--foreground)] mt-4">
            How It Works
          </h2>
        </div>
      </FadeIn>
      <StaggerContainer className="grid gap-4 md:gap-6 md:grid-cols-3" staggerDelay={0.15}>
        {howItWorks.map((item) => (
          <div
            key={item.step}
            className="group rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/50 p-5 md:p-6 text-center hover:border-[color:var(--accent)]/30 transition-colors"
          >
            <motion.span
              className="inline-flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full bg-[color:var(--accent)]/10 text-[color:var(--accent)] font-semibold mb-3 md:mb-4"
              whileHover={{ scale: 1.1, rotate: 5 }}
            >
              {item.step}
            </motion.span>
            <h3 className="text-base md:text-lg font-semibold text-[color:var(--foreground)] mb-2">
              {item.title}
            </h3>
            <p className="text-xs md:text-sm text-[color:var(--muted)]">
              {item.description}
            </p>
          </div>
        ))}
      </StaggerContainer>
    </section>
  );
}