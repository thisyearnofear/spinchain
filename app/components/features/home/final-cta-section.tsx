"use client";

import Link from "next/link";
import { FadeIn } from "@/app/components/ui/scroll-animations";
import { getDemoRideUrl } from "@/app/hooks/evm/use-class-data";
import { Play } from "lucide-react";

export function FinalCTASection() {
  return (
    <FadeIn>
      <section className="relative overflow-hidden rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 text-center md:p-8 lg:p-12" aria-label="Get started">
        <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--accent)]/5 via-transparent to-[color:var(--accent-strong)]/5" />

        <div className="relative">
          <h2 className="mb-3 text-2xl font-bold text-[color:var(--foreground)] md:mb-4 md:text-3xl lg:text-4xl">
            Feel the world react to your effort
          </h2>
          <p className="mx-auto mb-6 max-w-xl text-sm text-[color:var(--muted)] md:mb-8 md:text-base">
            Start with the free demo. No wallet, no signup, no friction — just a bike, a keyboard, and a world that moves with you.
          </p>
          <Link
            href={getDemoRideUrl({ name: "Accelerator Pitch" })}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--accent)] px-8 py-3 font-bold text-white shadow-lg shadow-[color:var(--accent)]/30 transition-[transform,box-shadow] duration-150 hover:scale-105 hover:shadow-xl hover:shadow-[color:var(--accent)]/40 active:scale-95 md:px-10 md:py-4"
          >
            <Play className="h-4 w-4 fill-current" />
            Try a Demo Ride
          </Link>
        </div>
      </section>
    </FadeIn>
  );
}
