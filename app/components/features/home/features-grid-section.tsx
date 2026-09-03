"use client";

import { m } from "framer-motion";
import { SurfaceCard } from "@/app/components/ui/ui";
import { FadeIn } from "@/app/components/ui/scroll-animations";
import { Bike, Route, Shield, Users } from "lucide-react";

const riderFeatures = [
  { icon: Route, label: "Immersive 3D routes" },
  { icon: Shield, label: "Private workout data" },
  { icon: Bike, label: "Bike, HR, or keyboard" },
  { icon: Users, label: "Ride with friends" },
];

const instructorFeatures = [
  { icon: Route, label: "Build branded classes" },
  { icon: Shield, label: "Own your audience" },
  { icon: Bike, label: "AI-assisted coaching" },
  { icon: Users, label: "Fair revenue splits" },
];

export function FeaturesGridSection() {
  return (
    <section className="grid gap-4 md:grid-cols-2 md:gap-6">
      <FadeIn direction="left">
        <SurfaceCard
          title="For Riders"
          description="Every route is a world that responds to your effort. Ride solo or with friends — your data stays yours."
          className="h-full rounded-3xl"
        >
          <div className="mt-5 grid gap-2 md:mt-6 md:gap-3">
            {riderFeatures.map((item) => (
              <m.div
                key={item.label}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: riderFeatures.indexOf(item) * 0.1 }}
                viewport={{ once: true }}
                className="flex items-center gap-3 text-xs text-[color:var(--foreground)]/80 md:text-sm"
              >
                <item.icon className="h-4 w-4 text-[color:var(--accent)]" />
                {item.label}
              </m.div>
            ))}
          </div>
        </SurfaceCard>
      </FadeIn>

      <FadeIn direction="right">
        <SurfaceCard
          title="For Instructors"
          description="Create classes, set your terms, and build a direct relationship with riders."
          className="h-full rounded-3xl bg-[color:var(--surface-strong)]"
        >
          <div className="mt-5 grid gap-2 md:mt-6 md:gap-3">
            {instructorFeatures.map((item) => (
              <m.div
                key={item.label}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: instructorFeatures.indexOf(item) * 0.1 }}
                viewport={{ once: true }}
                className="flex items-center gap-3 text-xs text-[color:var(--foreground)]/80 md:text-sm"
              >
                <item.icon className="h-4 w-4 text-[color:var(--accent)]" />
                {item.label}
              </m.div>
            ))}
          </div>
        </SurfaceCard>
      </FadeIn>
    </section>
  );
}
