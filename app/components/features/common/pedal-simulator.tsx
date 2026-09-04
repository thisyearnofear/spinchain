'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useDeviceType } from '../../../lib/responsive';
import { ANALYTICS_EVENTS, trackEvent } from '@/app/lib/analytics/events';
import { useTelemetryStore, selectPower, selectHeartRate } from '@/app/stores/telemetry-store';
import { useCoachingStore } from '@/app/stores/coaching-store';
import { useRideStore } from '@/app/stores/ride-store';
import { computePhaseTheme, phaseAccent, phaseLabel, cadenceToIntensity, type IntervalPhase } from '@/app/lib/phase-theme';
import { SpinDripChip } from '@/app/components/features/ride/spin-drip-chip';
import { useUIStore } from '@/app/stores/ui-store';
import { useSensoryStore } from '@/app/stores/sensory-store';
import {
  formatPracticeClock,
  toPracticeWallElapsed,
} from '@/app/lib/practice-demo';

/** MM:SS clock formatting for the practice-bar time chip. */
function formatClock(sec: number): string {
    const s = Math.max(0, Math.floor(sec));
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

interface PedalSimulatorProps {
    isActive: boolean;
    onMetricsUpdate: (metrics: {
        heartRate: number;
        power: number;
        cadence: number;
        speed: number;
        effort: number;
    }) => void;
    /** When true, the keyboard input + metrics loop keep running (so stats
     *  still update) but the on-screen widget is not rendered — used when the
     *  HUD is collapsed to minimal/zen mode for a clean riding scene. */
    visuallyHidden?: boolean;
    /** When true (practice/simulator mode), the widget doubles as the
     *  integrated ride bar: live Power/HR/phase chips are embedded so the
     *  HUD's compact stack, tap-zone, and coach card don't stack on top of
     *  the pedal controls at the bottom of the screen. */
    showRideMetrics?: boolean;
    className?: string;
}

type Leg = 'left' | 'right' | null;

function haptic(ms: number) {
    try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(ms);
        }
    } catch { /* not supported */ }
}

export function PedalSimulator({ isActive, onMetricsUpdate, visuallyHidden = false, showRideMetrics = false, className = '' }: PedalSimulatorProps) {
    const deviceType = useDeviceType();
    const [activeLeg, setActiveLeg] = useState<Leg>(null);
    const [showInstructions, setShowInstructions] = useState(true);
    const [cadence, setCadence] = useState(0);

    // Integrated-bar chips (showRideMetrics). Subscribed before the
    // visuallyHidden early return to keep hook order stable.
    const ridePower = useTelemetryStore(selectPower);
    const rideHeartRate = useTelemetryStore(selectHeartRate);
    const ridePhase = useCoachingStore((s) => s.currentInterval?.phase ?? null);
    const rideElapsed = useRideStore((s) => s.elapsedTime);
    const rideProgressPct = useRideStore((s) => s.rideProgress);
    const session = useRideStore((s) => s.session);
    const isPracticeMode = useUIStore((s) => s.isPracticeMode) || !!session?.isPractice;
    const classDurationSec = (session?.duration ?? 45) * 60;
    const demoWallElapsed = isPracticeMode
        ? toPracticeWallElapsed(rideElapsed, classDurationSec)
        : rideElapsed;
    const rideTheme = computePhaseTheme(ridePhase as IntervalPhase, 500);
    const phaseAccentClasses = phaseAccent(ridePhase as IntervalPhase);
    const phaseText = phaseLabel(ridePhase as IntervalPhase);

    const crankAngle = useRef(0);
    const [crankDeg, setCrankDeg] = useState(0);
    const pedalTimestamps = useRef<number[]>([]);
    const lastPedalLeg = useRef<'left' | 'right'>('right');
    const metricsInterval = useRef<NodeJS.Timeout | null>(null);
    const animFrame = useRef<number | null>(null);
    const latestCadence = useRef(0);
    const baseMetrics = useRef({ heartRate: 100, power: 80, effort: 120 });
    const didTrackKeyboardHint = useRef(false);
    const didTrackTouchOnlyGate = useRef(false);
    const keyActivity = useRef({ strokes: 0, windowStart: 0 });
    const repeatThrottle = useRef<Record<string, number>>({});
    // keydown → first-commit latency instrumentation (Change 4)
    const firstStrokeAt = useRef<number | null>(null);
    // Throttle for immediate per-stroke metric computation (Change 2):
    // ~11Hz ceiling matches the downstream 10Hz commit throttle.
    const lastImmediateCompute = useRef(0);
    // Last calculateMetrics timestamp — dt source for rate-independent blends.
    const lastComputeAt = useRef(0);
    const onMetricsUpdateRef = useRef(onMetricsUpdate);
    // Keep ref updated with latest callback - intentional pattern
     
    // eslint-disable-next-line react-hooks/refs
    onMetricsUpdateRef.current = onMetricsUpdate;

    const calculateMetrics = useCallback((updateState = true) => {
        const now = Date.now();
        // dt-aware smoothing: calculateMetrics now runs at 2Hz (interval) up to
        // ~11Hz (per-stroke), so fixed per-call coefficients would converge at
        // a tap-rate-dependent speed. Use alpha = 1 - exp(-dt / tau) —
        // rate-independent, tuned in milliseconds. dt capped so a long idle
        // gap doesn't produce a giant step.
        const dt = Math.min(2000, Math.max(1, now - (lastComputeAt.current || now - 500)));
        lastComputeAt.current = now;
        const recentPedals = pedalTimestamps.current.filter(t => now - t < 10000);
        pedalTimestamps.current = recentPedals;

        // "Stopped" = no stroke in the last second. The 10s window below
        // smooths cadence but would otherwise coast for up to 10s after the
        // last pedal stroke — effort must feel like a live throttle.
        // A single stroke is NOT stopped: we assume a provisional nominal
        // cadence (60rpm) so the first keystroke produces a live world
        // response instead of a discarded sample.
        const stopped =
            recentPedals.length < 1 ||
            now - recentPedals[recentPedals.length - 1] > 1000;

        if (stopped) {
            baseMetrics.current.heartRate = Math.max(80, baseMetrics.current.heartRate - 2);
            baseMetrics.current.power = Math.max(0, baseMetrics.current.power - 5);
            // Fast decay (~150/s) so the world halts soon after pedaling stops.
            baseMetrics.current.effort = Math.max(100, baseMetrics.current.effort - 75);
            latestCadence.current = 0;
            // Abandon any pending latency measurement — the commit that
            // follows will carry cadence 0, so the clock would only go stale.
            firstStrokeAt.current = null;
            if (updateState) setCadence(0);
            return { heartRate: Math.round(baseMetrics.current.heartRate), power: Math.round(baseMetrics.current.power), cadence: 0, speed: 0, effort: Math.round(baseMetrics.current.effort) };
        }

        const intervals: number[] = [];
        for (let i = 1; i < recentPedals.length; i++) intervals.push(recentPedals[i] - recentPedals[i - 1]);
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        // With one timestamp there is no interval to average — assume a
        // nominal 60rpm so the first stroke already drives the world.
        const clampedCadence = recentPedals.length < 2
            ? 60
            : Math.min(Math.max(Math.round(60000 / avgInterval), 0), 140);

        latestCadence.current = clampedCadence;
        // Widget UI (cadence ring, leg highlight) re-renders on the 500ms
        // interval only — the per-stroke fast path updates the ref the crank
        // rAF loop reads, avoiding a PedalSimulator re-render per keystroke.
        if (updateState) setCadence(clampedCadence);

        const targetPower = Math.round(clampedCadence * 2.5 + Math.random() * 20);
        // Asymmetric smoothing (fast attack / slow release) expressed as time
        // constants. taus are the dt-equivalents of the original 500ms-tick
        // coefficients (release) and of the 1.5s-to-80% attack target.
        // Each metric picks its own side by comparing against its own target
        // — a single shared `rising` flag would flip with targetPower's
        // random jitter and make HR alternate between taus call-to-call.
        const blend = (cur: number, target: number, tauAttack: number, tauRelease: number) =>
            cur + (target - cur) * (1 - Math.exp(-dt / (target > cur ? tauAttack : tauRelease)));
        baseMetrics.current.power = blend(baseMetrics.current.power, targetPower, 980, 1400);
        const targetHR = Math.min(180, 100 + clampedCadence * 0.6);
        baseMetrics.current.heartRate = blend(baseMetrics.current.heartRate, targetHR, 2240, 9750);
        const targetEffort = Math.round((baseMetrics.current.heartRate + baseMetrics.current.power) * 0.8);
        // Effort drives route progress (see comment below) — fastest attack.
        baseMetrics.current.effort = blend(baseMetrics.current.effort, targetEffort, 460, 720);
        const speed = (baseMetrics.current.power / 10) + 15;

        return { heartRate: Math.round(baseMetrics.current.heartRate), power: Math.round(baseMetrics.current.power), cadence: clampedCadence, speed: Math.round(speed * 10) / 10, effort: Math.round(baseMetrics.current.effort) };
    }, []);

    // Latency instrumentation (Change 4): the clock must span keystroke →
    // store commit with cadence > 0 — which passes through the coordinator's
    // ~100ms shouldCommit gate — so it ends in a telemetry-store subscription,
    // NOT in calculateMetrics (which runs synchronously on the keystroke and
    // would structurally log ~0ms).
    useEffect(() => {
        if (!isActive) return;
        const unsub = useTelemetryStore.subscribe((state) => {
            const committedCadence = state.snapshot?.cadence ?? 0;
            if (committedCadence > 0 && firstStrokeAt.current !== null) {
                trackEvent(ANALYTICS_EVENTS.SIMULATOR_INPUT_LATENCY, {
                    ms: Math.round(performance.now() - firstStrokeAt.current),
                });
                firstStrokeAt.current = null;
            }
        });
        return unsub;
    }, [isActive]);

    // Animate crank rotation (skip when visually hidden — no on-screen widget)
    useEffect(() => {
        if (!isActive || visuallyHidden) return;
        let last = performance.now();
        const tick = (now: number) => {
            const dt = now - last;
            last = now;
            const degsPerMs = (latestCadence.current / 60) * 360 / 1000;
            crankAngle.current = (crankAngle.current + degsPerMs * dt) % 360;
            setCrankDeg(crankAngle.current);
            animFrame.current = requestAnimationFrame(tick);
        };
        animFrame.current = requestAnimationFrame(tick);
        return () => { if (animFrame.current) cancelAnimationFrame(animFrame.current); };
    }, [isActive, visuallyHidden]);

    const recordPedalStroke = useCallback((leg: 'left' | 'right') => {
        lastPedalLeg.current = leg;
        pedalTimestamps.current.push(Date.now());
        // First stroke after a stop: start the latency clock (performance.now
        // — same clock as the measurement endpoint in calculateMetrics).
        if (latestCadence.current === 0 && firstStrokeAt.current === null) {
            firstStrokeAt.current = performance.now();
        }
        // Per-stroke impulse cue (Change 1): bumped even when the widget is
        // visually hidden, so the world responds within one frame via
        // useFrame readers instead of waiting for the 500ms metrics interval.
        // Uses the monotonic strokeSeq counter, NOT latestEvent — that slot
        // has React subscribers (HUD overlay, flow background) and carries
        // low-frequency cues that per-stroke events must not clobber.
        useSensoryStore.getState().bumpStrokeSeq();
        // Immediate metric computation (throttled) so the first commit with
        // cadence > 0 lands < 100ms after the keystroke instead of 0–500ms.
        // updateState=false: no setCadence on the fast path (the 500ms
        // interval owns widget re-renders); the store commit flows through
        // onMetricsUpdate regardless.
        const nowPerf = performance.now();
        if (nowPerf - lastImmediateCompute.current > 90) {
            lastImmediateCompute.current = nowPerf;
            onMetricsUpdateRef.current(calculateMetrics(false));
        }
        haptic(25);
        setActiveLeg(leg);
        setTimeout(() => setActiveLeg(null), 150);
        if (showInstructions) setShowInstructions(false);
    }, [showInstructions, calculateMetrics]);

    // Keyboard controls - enable on desktop and tablet, disable on pure touch mobile
    useEffect(() => {
        if (!isActive) return;
        
        // Check if this is a touch-only device (actual mobile without keyboard)
        // We want to allow keyboard on devices that have both touch AND keyboard (e.g., tablets, laptops with touch)
        const hasTouchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isPureMobileTouch = deviceType === 'mobile' && hasTouchSupport;

        if (!isPureMobileTouch && !didTrackKeyboardHint.current) {
            didTrackKeyboardHint.current = true;
            trackEvent(ANALYTICS_EVENTS.SIMULATOR_KEYBOARD_HINT_VIEWED, {
                deviceType,
            });
        }
        
        // Skip keyboard only on pure mobile touch devices (no keyboard attached)
        if (isPureMobileTouch) {
            if (!didTrackTouchOnlyGate.current) {
                didTrackTouchOnlyGate.current = true;
                trackEvent(ANALYTICS_EVENTS.SIMULATOR_INPUT_SKIPPED_TOUCH_ONLY, {
                    deviceType,
                });
            }
            return;
        }
        
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't capture if user is typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.target instanceof HTMLElement && e.target.isContentEditable) return;
            
            // Allow key repeats but throttle them to ~150ms to simulate sustained pedaling
            if (e.repeat) {
                const now = Date.now();
                const last = repeatThrottle.current[e.key] || 0;
                if (now - last < 150) return;
                repeatThrottle.current[e.key] = now;
            }

            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
                e.preventDefault();
                recordPedalStroke('left');
            }
            else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
                e.preventDefault();
                recordPedalStroke('right');
            }
            else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
                e.preventDefault();
                // ArrowUp alternates legs automatically for easier one-key pedaling
                const nextLeg = lastPedalLeg.current === 'left' ? 'right' : 'left';
                recordPedalStroke(nextLeg);
            }
            else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
                e.preventDefault();
                // ArrowDown also pedals (slower intent) — alternates legs
                const nextLeg = lastPedalLeg.current === 'left' ? 'right' : 'left';
                recordPedalStroke(nextLeg);
            } else {
                return;
            }

            const now = Date.now();
            if (now - keyActivity.current.windowStart > 10000) {
                keyActivity.current.windowStart = now;
                keyActivity.current.strokes = 0;
            }
            keyActivity.current.strokes += 1;
            if (keyActivity.current.strokes === 1 || keyActivity.current.strokes % 12 === 0) {
                trackEvent(ANALYTICS_EVENTS.SIMULATOR_INPUT_ACTIVITY, {
                    deviceType,
                    strokesInWindow: keyActivity.current.strokes,
                });
            }
        };
        
        // Use capture phase to ensure we get the events first
        window.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
    }, [isActive, deviceType, recordPedalStroke]);

    // Metrics loop — use ref for callback to avoid restarting the interval on every parent re-render
    useEffect(() => {
        if (!isActive) { if (metricsInterval.current) clearInterval(metricsInterval.current); return; }
        // Fresh ride: reset the blend clock so the first tick doesn't blend
        // against a stale dt (the 2s cap makes this benign, just cleaner).
        lastComputeAt.current = 0;
        lastImmediateCompute.current = 0;
        metricsInterval.current = setInterval(() => { onMetricsUpdateRef.current(calculateMetrics()); }, 500);
        return () => { if (metricsInterval.current) clearInterval(metricsInterval.current); };
    }, [isActive, calculateMetrics]);

    if (!isActive || visuallyHidden) return null;

    // Shared intensity ramp (phase-theme.ts) — one color language for every
    // "how hard am I going" signal.
    const zone = cadenceToIntensity(cadence);

    // Animated crank SVG
    const CrankVisual = ({ size = 80 }: { size?: number }) => {
        const r = size / 2;
        const armLen = r * 0.52;
        const ringR = r - 7;
        const circ = 2 * Math.PI * ringR;
        const pct = Math.min(cadence / 120, 1);
        const lx = r + Math.cos((crankDeg + 180) * Math.PI / 180) * armLen;
        const ly = r + Math.sin((crankDeg + 180) * Math.PI / 180) * armLen;
        const rx = r + Math.cos(crankDeg * Math.PI / 180) * armLen;
        const ry = r + Math.sin(crankDeg * Math.PI / 180) * armLen;

        return (
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {/* Background disc */}
                <circle cx={r} cy={r} r={r - 2} fill="rgba(0,0,0,0.45)" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" />
                {/* Track ring */}
                <circle cx={r} cy={r} r={ringR} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4" />
                {/* Cadence progress ring */}
                <circle
                    cx={r} cy={r} r={ringR}
                    fill="none"
                    stroke={zone.color}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${circ * pct} ${circ}`}
                    strokeDashoffset={circ * 0.25}
                    style={{ transition: 'stroke-dasharray 0.3s ease, stroke 0.4s ease' }}
                />
                {/* Crank arms */}
                <line x1={r} y1={r} x2={lx} y2={ly} stroke="rgba(255,255,255,0.55)" strokeWidth="3" strokeLinecap="round" />
                <line x1={r} y1={r} x2={rx} y2={ry} stroke="rgba(255,255,255,0.55)" strokeWidth="3" strokeLinecap="round" />
                {/* Pedal dots */}
                <circle cx={lx} cy={ly} r="5" fill={activeLeg === 'left' ? '#60a5fa' : 'rgba(255,255,255,0.35)'} style={{ transition: 'fill 0.1s' }} />
                <circle cx={rx} cy={ry} r="5" fill={activeLeg === 'right' ? '#4ade80' : 'rgba(255,255,255,0.35)'} style={{ transition: 'fill 0.1s' }} />
                {/* Hub */}
                <circle cx={r} cy={r} r="5" fill="white" opacity="0.85" />
            </svg>
        );
    };

    // ── MOBILE ───────────────────────────────────────────────────────────────
    if (deviceType === 'mobile') {
        return (
            <div className={`fixed bottom-0 inset-x-0 pointer-events-auto z-20 ${className}`}>
                <div className="relative bg-black/50 backdrop-blur-2xl border-t border-white/10 px-4 pt-3 pb-6">
                    {/* Ride progress hairline (practice mode) */}
                    {showRideMetrics && (
                        <div className="absolute inset-x-0 top-0 h-0.5 bg-white/5">
                            <div className="h-full overflow-hidden rounded-full">
                                <div
                                    className="h-full rounded-full origin-left transition-[width] duration-500"
                                    style={{ width: `${rideProgressPct}%`, backgroundColor: rideTheme.color }}
                                />
                            </div>
                            <span
                                className="absolute -top-2 -translate-x-1/2 text-[11px] leading-none transition-[left] duration-500"
                                style={{ left: `${rideProgressPct}%` }}
                                aria-hidden
                            >
                                🚴
                            </span>
                        </div>
                    )}

                    {/* Crank + cadence */}
                    <div className="flex items-center justify-center gap-5 mb-3">
                        <CrankVisual size={68} />
                        <div className="text-center">
                            <p className="text-4xl font-bold tabular-nums leading-none" style={{ color: zone.color, transition: 'color 0.4s' }}>
                                {cadence}
                            </p>
                            <p className="text-[10px] uppercase tracking-widest text-white/35 mt-0.5">RPM</p>
                            <p className="text-xs font-semibold mt-1" style={{ color: zone.color, transition: 'color 0.4s' }}>
                                {zone.label}
                            </p>
                        </div>
                    </div>

                    {/* Integrated ride metrics (practice mode) */}
                    {showRideMetrics && (
                        <div className="flex items-center justify-center gap-2 mb-3">
                            <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1 border border-white/10 bg-white/5">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: rideTheme.color }} />
                                <span className={`text-[9px] font-black uppercase tracking-widest ${phaseAccentClasses.text}`}>{phaseText}</span>
                            </div>
                            {isPracticeMode ? (
                                <>
                                    <div className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-amber-300">Demo</span>
                                    </div>
                                    <div className="rounded-full px-2.5 py-1 border border-white/10 bg-white/5">
                                        <span className="text-[10px] font-black tabular-nums text-white/70">
                                            {formatPracticeClock(demoWallElapsed)}
                                            <span className="text-white/35"> · {Math.round(rideProgressPct)}%</span>
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <div className="rounded-full px-2.5 py-1 border border-white/10 bg-white/5">
                                    <span className="text-[10px] font-black tabular-nums text-white/70">{formatClock(rideElapsed)}</span>
                                </div>
                            )}
                            <div className="rounded-full px-2.5 py-1 border border-white/10 bg-white/5">
                                <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">W </span>
                                <span className="text-sm font-black tabular-nums text-yellow-300">{ridePower}</span>
                            </div>
                            <div className="rounded-full px-2.5 py-1 border border-white/10 bg-white/5">
                                <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">BPM </span>
                                <span className="text-sm font-black tabular-nums text-rose-300">{rideHeartRate}</span>
                            </div>
                        </div>
                    )}

                    {showInstructions && (
                        <p className="text-center text-xs text-white/45 mb-2 animate-pulse">
                            Tap L &amp; R alternately to pedal 🚴
                        </p>
                    )}

                    {/* Pedal buttons */}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onTouchStart={(e) => { e.preventDefault(); recordPedalStroke('left'); }}
                            className={`
                                relative rounded-2xl border-2 py-7 font-bold
                                transition-all duration-100 active:scale-95 touch-manipulation select-none
                                ${activeLeg === 'left'
                                    ? 'bg-blue-500 border-blue-400 text-white shadow-lg shadow-blue-500/50 scale-[0.97]'
                                    : 'bg-blue-500/12 border-blue-500/35 text-blue-300'
                                }
                            `}
                        >
                            <span className="absolute top-2 left-3 text-[10px] uppercase tracking-widest opacity-45">Left</span>
                            <span className="block text-3xl leading-none">🦵</span>
                            <span className="block text-sm mt-1 opacity-60">L</span>
                        </button>

                        <button
                            onTouchStart={(e) => { e.preventDefault(); recordPedalStroke('right'); }}
                            className={`
                                relative rounded-2xl border-2 py-7 font-bold
                                transition-all duration-100 active:scale-95 touch-manipulation select-none
                                ${activeLeg === 'right'
                                    ? 'bg-green-500 border-green-400 text-white shadow-lg shadow-green-500/50 scale-[0.97]'
                                    : 'bg-green-500/12 border-green-500/35 text-green-300'
                                }
                            `}
                        >
                            <span className="absolute top-2 right-3 text-[10px] uppercase tracking-widest opacity-45">Right</span>
                            <span className="block text-3xl leading-none">🦵</span>
                            <span className="block text-sm mt-1 opacity-60">R</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── DESKTOP ──────────────────────────────────────────────────────────────
    return (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 pointer-events-none z-20 ${className}`}>
            <div className="relative overflow-hidden flex items-center gap-4 px-5 py-3 rounded-2xl bg-black/50 backdrop-blur-2xl border border-white/12 shadow-2xl">
                {/* Ride progress hairline (practice mode) */}
                {showRideMetrics && (
                    <div className="absolute inset-x-0 top-0 h-0.5 bg-white/5">
                        <div className="h-full overflow-hidden rounded-full">
                            <div
                                className="h-full rounded-full origin-left transition-[width] duration-500"
                                style={{ width: `${rideProgressPct}%`, backgroundColor: rideTheme.color }}
                            />
                        </div>
                        <span
                            className="absolute top-1 -translate-x-1/2 text-[11px] leading-none transition-[left] duration-500"
                            style={{ left: `${rideProgressPct}%` }}
                            aria-hidden
                        >
                            🚴
                        </span>
                    </div>
                )}

                <CrankVisual size={60} />

                <div className="text-center min-w-[48px]">
                    <p className="text-2xl font-bold tabular-nums leading-none" style={{ color: zone.color, transition: 'color 0.4s' }}>
                        {cadence}
                    </p>
                    <p className="text-[9px] uppercase tracking-widest text-white/35">RPM</p>
                    <p className="text-[10px] font-semibold mt-0.5" style={{ color: zone.color, transition: 'color 0.4s' }}>{zone.label}</p>
                </div>

                <div className="w-px h-9 bg-white/12" />

                <div className="flex items-center gap-2">
                    <div className={`
                        flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-100
                        ${activeLeg === 'left' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/40 scale-110' : 'bg-blue-500/12 text-blue-300'}
                    `}>
                        <kbd className="text-xs font-mono">←</kbd>
                        <span className="text-sm font-medium">L</span>
                    </div>
                    <div className={`
                        flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-100
                        ${activeLeg === 'right' ? 'bg-green-500 text-white shadow-lg shadow-green-500/40 scale-110' : 'bg-green-500/12 text-green-300'}
                    `}>
                        <span className="text-sm font-medium">R</span>
                        <kbd className="text-xs font-mono">→</kbd>
                    </div>
                </div>

                {showInstructions && (
                    <p className="text-[11px] text-white/35 animate-pulse ml-1">← → or A D</p>
                )}

                {/* Integrated ride metrics (practice mode) */}
                {showRideMetrics && (
                    <>
                        <div className="w-px h-9 bg-white/12" />

                        <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1 border border-white/10 bg-white/5">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: rideTheme.color }} />
                            <span className={`text-[9px] font-black uppercase tracking-widest ${phaseAccentClasses.text}`}>{phaseText}</span>
                        </div>

                        <div className="text-center min-w-[44px]">
                            <p className="text-base font-black tabular-nums leading-none text-yellow-300">{ridePower}</p>
                            <p className="text-[10px] uppercase tracking-widest text-white/30 mt-0.5">Watts</p>
                        </div>

                        <div className="text-center min-w-[44px]">
                            <p className="text-base font-black tabular-nums leading-none text-rose-300">{rideHeartRate}</p>
                            <p className="text-[10px] uppercase tracking-widest text-white/30 mt-0.5">BPM</p>
                        </div>

                        {isPracticeMode ? (
                            <>
                                <div className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-1">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-300">Demo</span>
                                </div>
                                <div className="text-center min-w-[52px]">
                                    <p className="text-base font-black tabular-nums leading-none text-white/80">
                                        {formatPracticeClock(demoWallElapsed)}
                                    </p>
                                    <p className="text-[10px] uppercase tracking-widest text-white/30 mt-0.5">
                                        {Math.round(rideProgressPct)}%
                                    </p>
                                </div>
                            </>
                        ) : (
                            <div className="text-center min-w-[44px]">
                                <p className="text-base font-black tabular-nums leading-none text-white/80">{formatClock(rideElapsed)}</p>
                                <p className="text-[10px] uppercase tracking-widest text-white/30 mt-0.5">Time</p>
                            </div>
                        )}

                        {/* Live SPIN accrual — reward loop visible in practice mode */}
                        <SpinDripChip />
                    </>
                )}
            </div>
        </div>
    );
}
