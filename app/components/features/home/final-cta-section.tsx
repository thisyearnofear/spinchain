"use client";

import { motion } from "framer-motion";
import Link from "next/link";
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
            Pick the path that matches your intent
          </h2>
          <p className="text-sm md:text-base text-[color:var(--muted)] mb-6 md:mb-8 max-w-xl mx-auto">
            Riders should start with the demo and upcoming classes. Instructors should preview the builder and teaching options before deciding how to launch.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4">
            <MagneticButton className="w-full sm:w-auto">
              <Link
                href="/rider/ride/demo?mode=practice&demo=true&auto=true&name=Accelerator+Pitch"
                className="inline-flex items-center justify-center gap-2 w-full px-6 md:px-8 py-2.5 md:py-3 rounded-full bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-strong)] text-white font-bold shadow-lg shadow-[color:var(--accent)]/30 hover:shadow-xl hover:shadow-[color:var(--accent)]/40 transition-[box-shadow] duration-150 active:scale-95"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
                Watch Demo Ride
              </Link>
            </MagneticButton>
            <MagneticButton className="w-full sm:w-auto">
              <Link
                href="/instructor"
                className="inline-block w-full px-6 md:px-8 py-2.5 md:py-3 rounded-full border border-[color:var(--border)] text-[color:var(--foreground)] font-medium hover:border-[color:var(--accent)]/50 transition-colors"
              >
                Preview instructor flow
              </Link>
            </MagneticButton>
          </div>
        </div>
      </section>
    </FadeIn>
  );
}
