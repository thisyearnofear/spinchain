"use client";

import { motion } from "framer-motion";
import { FadeIn } from "@/app/components/ui/scroll-animations";
import { MagneticButton } from "@/app/components/ui/animated-card";

export function FinalCTASection() {
  return (
    <FadeIn>
      <section className="rounded-3xl border border-[color:var(--border)] bg-gradient-to-br from-[color:var(--surface)] to-[color:var(--surface-strong)] p-6 md:p-8 lg:p-12 text-center relative overflow-hidden" aria-label="Get started call to action">
        {/* Animated background */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-[color:var(--accent)]/5 via-transparent to-[color:var(--accent-strong)]/5"
          animate={{
            x: ["-100%", "100%"],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "linear",
          }}
        />

        <div className="relative">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-[color:var(--foreground)] mb-3 md:mb-4">
            Ready to start?
          </h2>
          <p className="text-sm md:text-base text-[color:var(--muted)] mb-6 md:mb-8 max-w-xl mx-auto">
            Join our growing community and be part of the future of fitness.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4">
            <MagneticButton className="w-full sm:w-auto">
              <a
                href="/rider"
                className="inline-block w-full px-6 md:px-8 py-2.5 md:py-3 rounded-full bg-[color:var(--accent)] text-white font-semibold hover:opacity-90 transition-opacity"
              >
                Start Riding
              </a>
            </MagneticButton>
            <MagneticButton className="w-full sm:w-auto">
              <a
                href="#instructor-modes"
                className="inline-block w-full px-6 md:px-8 py-2.5 md:py-3 rounded-full border border-[color:var(--border)] text-[color:var(--foreground)] font-medium hover:border-[color:var(--accent)]/50 transition-colors"
              >
                Become an Instructor
              </a>
            </MagneticButton>
          </div>
        </div>
      </section>
    </FadeIn>
  );
}