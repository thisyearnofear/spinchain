'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useDeviceType } from '../../../lib/responsive';
import { ANALYTICS_EVENTS, trackEvent } from '@/app/lib/analytics/events';

interface PedalSimulatorProps {
    isActive: boolean;
    onMetricsUpdate: (metrics: {
        heartRate: number;
        power: number;
        cadence: number;
        speed: number;
        effort: number;
    }) => void;
    className?: string;
}

type Leg = 'left' | 'right' | null;

function getCadenceZone(cadence: number): { label: string; color: string; ringColor: string; glowClass: string } {
    if (cadence === 0)  return { label: 'Rest',   color: 'text-white/40',   ringColor: 'rgba(255,255,255,0.15)', glowClass: '' };
    if (cadence < 60)   return { label: 'Easy',   color: 'text-blue-400',   ringColor: '#60a5fa',               glowClass: 'shadow-blue-500/40' };
    if (cadence < 80)   return { label: 'Steady', color: 'text-green-400',  ringColor: '#4ade80',               glowClass: 'shadow-green-500/40' };
    if (cadence < 100)  return { label: 'Push',   color: 'text-yellow-400', ringColor: '#facc15',               glowClass: 'shadow-yellow-500/40' };
    return                     { label: 'Sprint', color: 'text-red-400',    ringColor: '#f87171',               glowClass: 'shadow-red-500/40' };
}

function haptic(ms: number) {
    try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(ms);
        }
    } catch { /* not supported */ }
}

export function PedalSimulator({ isActive, onMetricsUpdate, className = '' }: PedalSimulatorProps) {
    const deviceType = useDeviceType();
    const [activeLeg, setActiveLeg] = useState<Leg>(null);
    const [showInstructions, setShowInstructions] = useState(true);
    const [cadence, setCadence] = useState(0);

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

    const calculateMetrics = useCallback(() => {
        const now = Date.now();
        const recentPedals = pedalTimestamps.current.filter(t => now - t < 10000);
        pedalTimestamps.current = recentPedals;

        if (recentPedals.length < 2) {
            baseMetrics.current.heartRate = Math.max(80, baseMetrics.current.heartRate - 2);
            baseMetrics.current.power = Math.max(0, baseMetrics.current.power - 5);
            baseMetrics.current.effort = Math.max(100, baseMetrics.current.effort - 3);
            latestCadence.current = 0;
            setCadence(0);
            return { heartRate: Math.round(baseMetrics.current.heartRate), power: Math.round(baseMetrics.current.power), cadence: 0, speed: 0, effort: Math.round(baseMetrics.current.effort) };
        }

        const intervals: number[] = [];
        for (let i = 1; i < recentPedals.length; i++) intervals.push(recentPedals[i] - recentPedals[i - 1]);
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const clampedCadence = Math.min(Math.max(Math.round(60000 / avgInterval), 0), 140);

        latestCadence.current = clampedCadence;
        setCadence(clampedCadence);

        const targetPower = Math.round(clampedCadence * 2.5 + Math.random() * 20);
        baseMetrics.current.power = baseMetrics.current.power * 0.7 + targetPower * 0.3;
        const targetHR = Math.min(180, 100 + clampedCadence * 0.6);
        baseMetrics.current.heartRate = baseMetrics.current.heartRate * 0.95 + targetHR * 0.05;
        const targetEffort = Math.round((baseMetrics.current.heartRate + baseMetrics.current.power) * 0.8);
        baseMetrics.current.effort = baseMetrics.current.effort * 0.9 + targetEffort * 0.1;
        const speed = (baseMetrics.current.power / 10) + 15;

        return { heartRate: Math.round(baseMetrics.current.heartRate), power: Math.round(baseMetrics.current.power), cadence: clampedCadence, speed: Math.round(speed * 10) / 10, effort: Math.round(baseMetrics.current.effort) };
    }, []);

    // Animate crank rotation
    useEffect(() => {
        if (!isActive) return;
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
    }, [isActive]);

    const recordPedalStroke = useCallback((leg: 'left' | 'right') => {
        lastPedalLeg.current = leg;
        pedalTimestamps.current.push(Date.now());
        haptic(25);
        setActiveLeg(leg);
        setTimeout(() => setActiveLeg(null), 150);
        if (showInstructions) setShowInstructions(false);
    }, [showInstructions]);

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

    // Metrics loop
    useEffect(() => {
        if (!isActive) { if (metricsInterval.current) clearInterval(metricsInterval.current); return; }
        metricsInterval.current = setInterval(() => { onMetricsUpdate(calculateMetrics()); }, 500);
        return () => { if (metricsInterval.current) clearInterval(metricsInterval.current); };
    }, [isActive, calculateMetrics, onMetricsUpdate]);

    if (!isActive) return null;

    const zone = getCadenceZone(cadence);

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
                    stroke={zone.ringColor}
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
                <div className="bg-black/50 backdrop-blur-2xl border-t border-white/10 px-4 pt-3 pb-6">

                    {/* Crank + cadence */}
                    <div className="flex items-center justify-center gap-5 mb-3">
                        <CrankVisual size={68} />
                        <div className="text-center">
                            <p className={`text-4xl font-bold tabular-nums leading-none ${zone.color}`} style={{ transition: 'color 0.4s' }}>
                                {cadence}
                            </p>
                            <p className="text-[10px] uppercase tracking-widest text-white/35 mt-0.5">RPM</p>
                            <p className={`text-xs font-semibold mt-1 ${zone.color}`} style={{ transition: 'color 0.4s' }}>
                                {zone.label}
                            </p>
                        </div>
                    </div>

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
            <div className="flex items-center gap-4 px-5 py-3 rounded-2xl bg-black/50 backdrop-blur-2xl border border-white/12 shadow-2xl">
                <CrankVisual size={60} />

                <div className="text-center min-w-[48px]">
                    <p className={`text-2xl font-bold tabular-nums leading-none ${zone.color}`} style={{ transition: 'color 0.4s' }}>
                        {cadence}
                    </p>
                    <p className="text-[9px] uppercase tracking-widest text-white/35">RPM</p>
                    <p className={`text-[10px] font-semibold mt-0.5 ${zone.color}`}>{zone.label}</p>
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
            </div>
        </div>
    );
}
