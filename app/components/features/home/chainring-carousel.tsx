"use client";

import { useRef, useState, useEffect } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
// @ts-expect-error — lottie-react types use export = but runtime has default
import Lottie from "lottie-react";

gsap.registerPlugin(useGSAP);

import sprintExternal from "@/public/lotties/cycle.json";

// Cycling Lotties — 4 distinct JSONs, no network after build, cheap.
// Endurance/Recovery/Mind are inline pulses; Sprint uses high-quality MIT open-source cycle.json (saadpasta gist, 11KB, 720° wheel rotation).
const makePulseLottie = (rgb: [number, number, number], shape: "circle" | "star" | "heart" | "wave" = "circle") => ({
  v: "5.7.4" as const,
  fr: 30,
  ip: 0,
  op: 60,
  w: 100,
  h: 100,
  nm: `Pulse-${shape}`,
  ddd: 0,
  assets: [] as never[],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: shape,
      sr: 1,
      ks: {
        o: { a: 1, k: [{ t: 0, s: [45] }, { t: 30, s: [95] }, { t: 60, s: [45] }] as unknown as never, ix: 11 },
        r: { a: 0, k: 0, ix: 10 },
        p: { a: 0, k: [50, 50, 0], ix: 2 },
        a: { a: 0, k: [0, 0, 0], ix: 1 },
        s: { a: 1, k: [{ t: 0, s: [85, 85, 100] }, { t: 30, s: [105, 105, 100] }, { t: 60, s: [85, 85, 100] }] as unknown as never, ix: 6 },
      },
      ao: 0,
      shapes:
        shape === "star"
          ? [
              {
                ty: "sr" as const,
                p: { a: 0, k: [0, 0], ix: 3 },
                ir: { a: 0, k: 12, ix: 6 } as never,
                is: { a: 0, k: 80, ix: 7 } as never,
                or: { a: 0, k: 28, ix: 8 } as never,
                os: { a: 0, k: 0, ix: 9 } as never,
                r: { a: 0, k: 0, ix: 10 } as never,
                pt: { a: 0, k: 5, ix: 11 } as never,
                nm: "Star 1",
              },
              { ty: "fl" as const, c: { a: 0, k: [...rgb, 1] as unknown as never, ix: 4 }, o: { a: 0, k: 100, ix: 5 }, r: 1, nm: "Fill 1" },
            ]
          : shape === "heart"
            ? [
                {
                  ty: "sh" as const,
                  ks: {
                    a: 0,
                    k: {
                      i: [
                        [0, -12],
                        [12, 0],
                        [0, 12],
                        [-12, 0],
                      ],
                      o: [
                        [12, 0],
                        [0, 12],
                        [-12, 0],
                        [0, -12],
                      ],
                      v: [
                        [0, -14],
                        [18, -6],
                        [0, 18],
                        [-18, -6],
                      ],
                      c: true,
                    } as unknown as never,
                    ix: 2,
                  } as never,
                  nm: "Heart 1",
                },
                { ty: "fl" as const, c: { a: 0, k: [...rgb, 1] as unknown as never, ix: 4 }, o: { a: 0, k: 100, ix: 5 }, r: 1, nm: "Fill 1" },
              ]
            : shape === "wave"
              ? [
                  {
                    ty: "sh" as const,
                    ks: {
                      a: 0,
                      k: {
                        i: [
                          [0, 0],
                          [8, -8],
                          [8, 8],
                          [8, -8],
                          [0, 0],
                        ],
                        o: [
                          [8, 8],
                          [8, -8],
                          [8, 8],
                          [0, 0],
                          [0, 0],
                        ],
                        v: [
                          [-28, 0],
                          [-14, -8],
                          [0, 0],
                          [14, 8],
                          [28, 0],
                        ],
                        c: false,
                      } as unknown as never,
                      ix: 2,
                    } as never,
                  } as never,
                  {
                    ty: "st" as const,
                    c: { a: 0, k: [...rgb, 1] as unknown as never, ix: 3 },
                    o: { a: 0, k: 100, ix: 4 },
                    w: { a: 0, k: 6, ix: 5 } as never,
                    lc: 2 as never,
                    lj: 2 as never,
                    nm: "Stroke 1",
                  },
                ]
              : [
                  {
                    ty: "el" as const,
                    p: { a: 0, k: [0, 0], ix: 3 },
                    s: { a: 0, k: [62, 62], ix: 2 },
                    nm: "Ellipse 1",
                  },
                  { ty: "fl" as const, c: { a: 0, k: [...rgb, 1] as unknown as never, ix: 4 }, o: { a: 0, k: 100, ix: 5 }, r: 1, nm: "Fill 1" },
                ],
      ip: 0,
      op: 60,
      st: 0,
    },
  ],
});

const enduranceLottie = makePulseLottie([0.2, 0.85, 0.55], "circle"); // emerald — steady ring
const sprintLottie = sprintExternal as unknown as ReturnType<typeof makePulseLottie>; // MIT 488-bicycle-outline, 720° wheels
const recoveryLottie = makePulseLottie([0.38, 0.71, 0.98], "heart"); // sky — heart
const mindLottie = makePulseLottie([0.62, 0.52, 0.98], "wave"); // violet — breath wave

const PROGRAMS = [
  {
    id: "endurance",
    label: "Endurance",
    accent: "from-emerald-400 to-teal-500",
    bg: "bg-emerald-500/10",
    description: "Long, steady — build your engine.",
    interaction: "Mountain leans into your cursor → handlebar tilt",
    lottie: enduranceLottie,
  },
  {
    id: "sprint",
    label: "Sprint",
    accent: "from-red-500 to-orange-500",
    bg: "bg-red-500/10",
    description: "Short, sharp — chase the line.",
    interaction: "Tap the balloon → breath pops",
    lottie: sprintLottie,
  },
  {
    id: "recovery",
    label: "Recovery",
    accent: "from-sky-400 to-blue-500",
    bg: "bg-sky-500/10",
    description: "Easy spin — let the body catch up.",
    interaction: "Masked aura follows you",
    lottie: recoveryLottie,
  },
  {
    id: "interval",
    label: "Mind",
    accent: "from-violet-400 to-indigo-500",
    bg: "bg-violet-500/10",
    description: "Cadence + breath, together.",
    interaction: "Move across the sea → draft ripples",
    lottie: mindLottie,
  },
] as const;

export function ChainringCarousel() {
  const [active, setActive] = useState(0);
  const wheelRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const rotateTo = (index: number) => {
    if (!wheelRef.current) return;
    // Pause all Lotties, then resume active
    gsap.killTweensOf(wheelRef.current);
    gsap.to(wheelRef.current, {
      rotation: -index * 90,
      duration: 0.7,
      ease: "power3.out",
      onStart: () => {
        // could pause Lotties here if using lottieRef API
      },
    });
    setActive(index);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    startX.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > 40) {
      const dir = dx > 0 ? -1 : 1;
      const next = (activeRef.current + dir + PROGRAMS.length) % PROGRAMS.length;
      rotateTo(next);
    }
    isDragging.current = false;
  };

  // Draft ripple for Mind — gentle wave on pointer move (like Maxima sea)
  const [draftRipple, setDraftRipple] = useState<{ x: number; y: number; id: number } | null>(null);
  const onWheelMouseMove = (e: React.MouseEvent) => {
    if (activeRef.current !== 3) return; // only Mind
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    setDraftRipple({ x, y, id });
    setTimeout(() => setDraftRipple(null), 800);
  };

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") rotateTo((activeRef.current + 1) % PROGRAMS.length);
      if (e.key === "ArrowLeft") rotateTo((activeRef.current - 1 + PROGRAMS.length) % PROGRAMS.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="w-full flex flex-col items-center gap-6 py-6">
      {/* Wheel — 4 rotated sections inside a wrapper, like Maxima */}
      <div className="relative h-[320px] w-[320px] md:h-[380px] md:w-[380px]">
        {/* Outer chainring */}
        <div className="absolute inset-0 rounded-full border border-white/10 bg-black/20 backdrop-blur-xl shadow-[inset_0_0_40px_rgba(255,255,255,0.05)]" />
        <div className="absolute inset-[18px] rounded-full border border-dashed border-white/10" />
        {/* Center hub */}
        <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-zinc-800 to-black border border-white/10 flex items-center justify-center">
          <div className="h-3 w-3 rounded-full bg-white/80" />
        </div>

        <div
          ref={wheelRef}
          className="absolute inset-0 cursor-grab active:cursor-grabbing touch-none"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onMouseMove={onWheelMouseMove}
          style={{ transform: `rotate(${-active * 90}deg)` }}
          aria-label="Drag to rotate chainring"
          role="region"
        >
          {PROGRAMS.map((p, i) => {
            const angle = i * 90;
            const isActive = i === active;
            return (
              <div
                key={p.id}
                className="absolute left-1/2 top-1/2 h-[140px] w-[140px] -ml-[70px] -mt-[70px]"
                style={{ transform: `rotate(${angle}deg) translate(0, -110px) rotate(${-angle + active * 90}deg)` }}
              >
                <div
                  className={`h-full w-full rounded-2xl border backdrop-blur-xl p-3 flex flex-col items-center justify-center text-center transition-all duration-300 ${
                    isActive
                      ? `bg-white border-white/20 shadow-xl scale-105`
                      : `bg-black/40 border-white/5 scale-95 opacity-60`
                  }`}
                  style={{ pointerEvents: isActive ? "auto" : "none" }}
                >
                  <div className={`h-14 w-14 rounded-xl bg-gradient-to-br ${p.accent} p-[1px] mb-2`}>
                    <div className="h-full w-full rounded-[10px] bg-black flex items-center justify-center overflow-hidden">
                      <Lottie animationData={p.lottie} loop autoplay style={{ width: 48, height: 48 }} />
                    </div>
                  </div>
                  <p className={`text-xs font-black uppercase tracking-widest ${isActive ? "text-black" : "text-white"}`}>{p.label}</p>
                  <p className={`mt-1 text-[10px] leading-tight ${isActive ? "text-black/60" : "text-white/40"}`}>{p.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Arrows */}
        <button
          onClick={() => rotateTo((active - 1 + PROGRAMS.length) % PROGRAMS.length)}
          className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/10 backdrop-blur border border-white/15 text-white hover:bg-white hover:text-black transition-colors flex items-center justify-center"
          aria-label="Previous"
        >
          ‹
        </button>
        <button
          onClick={() => rotateTo((active + 1) % PROGRAMS.length)}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/10 backdrop-blur border border-white/15 text-white hover:bg-white hover:text-black transition-colors flex items-center justify-center"
          aria-label="Next"
        >
          ›
        </button>

        {/* Draft ripple — only for Mind, like Maxima sea */}
        {draftRipple && (
          <div
            key={draftRipple.id}
            className="absolute h-12 w-12 -ml-6 -mt-6 rounded-full border border-violet-400/40 pointer-events-none"
            style={{ left: draftRipple.x, top: draftRipple.y }}
            ref={(el) => {
              if (el) gsap.fromTo(el, { scale: 0, opacity: 0.6 }, { scale: 2.2, opacity: 0, duration: 0.8, ease: "power2.out" });
            }}
          />
        )}
      </div>

      {/* Active detail — route-free, carousel owns no page re-render */}
      <div className="text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Drag the ring or use ← →</p>
        <p className="mt-1 text-xs text-white/60 italic">{PROGRAMS[active].interaction}</p>
      </div>
    </div>
  );
}
