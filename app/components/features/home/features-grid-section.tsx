"use client";

import { m } from "framer-motion";
import { SurfaceCard } from "@/app/components/ui/ui";
import { FadeIn } from "@/app/components/ui/scroll-animations";
import { Route, Shield, Bike, Users } from "lucide-react";

// Rider-only: instructor economics live behind the nav mode switch, not on
// the rider persuasion surface (landing critique R2, P1-2).
const riderFeatures = [
  { icon: Route, label: "Immersive 3D routes" },
  { icon: Shield, label: "Private workout data" },
  { icon: Bike, label: "Bike, HR, or keyboard" },
  { icon: Users, label: "Ride with friends" },
];

export function FeaturesGridSection() {
  return (
    <section className="mx-auto w-full max-w-2xl">
      <FadeIn direction="up">
        <SurfaceCard
          title="Built for Riders"
          description="Every route is a world that responds to your effort. Ride solo or with friends — your data stays yours."
          className="h-full rounded-3xl"
        >
          <div className="mt-5 grid gap-2 sm:grid-cols-2 md:mt-6 md:gap-3">
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
    </section>
  );
}
