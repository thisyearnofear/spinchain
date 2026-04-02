"use client";

import { motion } from "framer-motion";
import { FadeIn } from "@/app/components/ui/scroll-animations";

const proofPillars = [
  {
    title: "Try before signup",
    description: "The rider path already supports a free demo ride, so visitors can feel the experience before creating an account.",
  },
  {
    title: "Clear persona split",
    description: "The landing flow now makes riders and instructors choose the path that matches their goal instead of pushing one generic funnel.",
  },
  {
    title: "Transparent product stage",
    description: "We removed future-looking stats and replaced them with honest value props that set the right expectations for early users.",
  },
];

export function SocialProofSection() {
  return (
    <FadeIn>
      <section className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/50 p-6 text-center md:p-8" aria-label="Conversion trust signals">
        <div className="mx-auto mb-8 max-w-2xl">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--accent)]">
            Why this converts better
          </p>
          <h2 className="text-2xl font-bold text-[color:var(--foreground)] md:text-3xl">
            A sharper first impression for early users
          </h2>
          <p className="mt-3 text-sm text-[color:var(--muted)] md:text-base">
            Instead of stretching for social proof that does not exist yet, this section focuses on the reasons a visitor can trust the next step.
          </p>
        </div>

        <div className="grid gap-4 text-left md:grid-cols-3">
          {proofPillars.map((pillar, index) => (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              viewport={{ once: true }}
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/70 p-5"
            >
              <p className="text-sm font-semibold text-[color:var(--foreground)] md:text-base">{pillar.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted)]">{pillar.description}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </FadeIn>
  );
}
