"use client";

import { motion } from "framer-motion";
import { FadeIn } from "@/app/components/ui/scroll-animations";

const stats = [
  { value: "$2.4M", label: "Rewards paid" },
  { value: "50K+", label: "Classes" },
  { value: "1,200+", label: "Instructors" },
];

export function SocialProofSection() {
  return (
    <FadeIn>
      <section className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/50 p-6 md:p-8 text-center" aria-label="Community social proof">
        <div className="flex items-center justify-center gap-3 md:gap-4 mb-5 md:mb-6">
          <div className="flex -space-x-3">
            {[1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1, type: "spring" }}
                viewport={{ once: true }}
                className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-strong)] border-2 border-[color:var(--background)]"
              />
            ))}
          </div>
          <p className="text-sm md:text-base text-[color:var(--muted)]">
            <span className="text-[color:var(--foreground)] font-semibold">10,000+</span> riders earning rewards <span className="text-[10px] text-[color:var(--accent)]">(Year 1 target)</span>
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 md:gap-8 max-w-lg mx-auto">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              viewport={{ once: true }}
            >
              <p className="text-2xl md:text-3xl font-bold text-[color:var(--foreground)]">{stat.value}</p>
              <p className="text-xs text-[color:var(--muted)] mt-1">{stat.label}</p>
              <p className="text-[10px] text-[color:var(--accent)] font-medium mt-0.5">Year 1 target</p>
            </motion.div>
          ))}
        </div>
      </section>
    </FadeIn>
  );
}