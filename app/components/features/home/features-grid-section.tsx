"use client";

import { motion } from "framer-motion";
import { SurfaceCard } from "@/app/components/ui/ui";
import { FadeIn } from "@/app/components/ui/scroll-animations";

const riderFeatures = [
  "3D immersive routes",
  "Private health data",
  "Instant SPIN rewards",
  "Compete with friends",
];

const instructorFeatures = [
  "Dynamic ticket pricing",
  "Automatic revenue splits",
  "Sponsor reward pools",
  "AI-powered route creation",
];

export function FeaturesGridSection() {
  return (
    <section className="grid gap-4 md:gap-6 lg:grid-cols-2">
      <FadeIn direction="left">
        <SurfaceCard
          eyebrow="For Riders"
          title="Ride anywhere, earn everywhere"
          description="From Alpine climbs to city sprints—every route is an immersive experience. Your effort is private, your rewards are real."
          className="rounded-3xl h-full"
        >
          <div className="mt-5 md:mt-6 grid gap-2 md:gap-3">
            {riderFeatures.map((item, i) => (
              <motion.div
                key={item}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="flex items-center gap-3 text-xs md:text-sm text-[color:var(--foreground)]/80"
              >
                <motion.span
                  className="h-2 w-2 rounded-full bg-[color:var(--accent)]"
                  whileHover={{ scale: 1.5 }}
                />
                {item}
              </motion.div>
            ))}
          </div>
        </SurfaceCard>
      </FadeIn>

      <FadeIn direction="right">
        <SurfaceCard
          eyebrow="For Instructors"
          title="Your class, your economics"
          description="Set your own pricing, keep more of what you earn, and build a community that values your craft."
          className="rounded-3xl bg-[color:var(--surface-strong)] h-full"
        >
          <div className="mt-5 md:mt-6 grid gap-2 md:gap-3">
            {instructorFeatures.map((item, i) => (
              <motion.div
                key={item}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="flex items-center gap-3 text-xs md:text-sm text-[color:var(--foreground)]/80"
              >
                <motion.span
                  className="h-2 w-2 rounded-full bg-[color:var(--accent)]"
                  whileHover={{ scale: 1.5 }}
                />
                {item}
              </motion.div>
            ))}
          </div>
        </SurfaceCard>
      </FadeIn>
    </section>
  );
}