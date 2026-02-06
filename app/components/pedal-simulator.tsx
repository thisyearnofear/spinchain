'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useDeviceType } from '../lib/responsive';

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

export function PedalSimulator({ isActive, onMetricsUpdate, className = '' }: PedalSimulatorProps) {
    const deviceType = useDeviceType();
    const [activeLeg, setActiveLeg] = useState<Leg>(null);
    const [showInstructions, setShowInstructions] = useState(true);

    // Pedal stroke tracking
    const pedalTimestamps = useRef<number[]>([]);
    const lastPedalLeg = useRef<'left' | 'right'>('right');
    const metricsInterval = useRef<NodeJS.Timeout>();

    // Base metrics that evolve over time
    const baseMetrics = useRef({
        heartRate: 100,
        power: 80,
        effort: 120,
    });

    const calculateMetrics = useCallback(() => {
        const now = Date.now();
        const recentPedals = pedalTimestamps.current.filter(t => now - t < 10000); // Last 10 seconds
        pedalTimestamps.current = recentPedals;

        if (recentPedals.length < 2) {
            // No recent activity - metrics decline
            baseMetrics.current.heartRate = Math.max(80, baseMetrics.current.heartRate - 2);
            baseMetrics.current.power = Math.max(0, baseMetrics.current.power - 5);
            baseMetrics.current.effort = Math.max(100, baseMetrics.current.effort - 3);

            return {
                heartRate: Math.round(baseMetrics.current.heartRate),
                power: Math.round(baseMetrics.current.power),
                cadence: 0,
                speed: 0,
                effort: Math.round(baseMetrics.current.effort),
            };
        }

        // Calculate cadence from pedal intervals
        const intervals: number[] = [];
        for (let i = 1; i < recentPedals.length; i++) {
            intervals.push(recentPedals[i] - recentPedals[i - 1]);
        }

        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const cadence = Math.round(60000 / avgInterval); // RPM

        // Clamp cadence to realistic range
        const clampedCadence = Math.min(Math.max(cadence, 0), 140);

        // Power increases with cadence (simplified power curve)
        const targetPower = Math.round(clampedCadence * 2.5 + Math.random() * 20);
        baseMetrics.current.power = baseMetrics.current.power * 0.7 + targetPower * 0.3; // Smooth transition

        // Heart rate gradually increases with effort
        const targetHR = Math.min(180, 100 + clampedCadence * 0.6);
        baseMetrics.current.heartRate = baseMetrics.current.heartRate * 0.95 + targetHR * 0.05;

        // Effort score (combination of HR and power)
        const targetEffort = Math.round((baseMetrics.current.heartRate + baseMetrics.current.power) * 0.8);
        baseMetrics.current.effort = baseMetrics.current.effort * 0.9 + targetEffort * 0.1;

        // Speed based on power
        const speed = (baseMetrics.current.power / 10) + 15;

        return {
            heartRate: Math.round(baseMetrics.current.heartRate),
            power: Math.round(baseMetrics.current.power),
            cadence: clampedCadence,
            speed: Math.round(speed * 10) / 10,
            effort: Math.round(baseMetrics.current.effort),
        };
    }, []);

    const recordPedalStroke = useCallback((leg: 'left' | 'right') => {
        // Only count alternating strokes for realistic cadence
        if (lastPedalLeg.current === leg && pedalTimestamps.current.length > 0) {
            return; // Same leg twice in a row - ignore
        }

        lastPedalLeg.current = leg;
        pedalTimestamps.current.push(Date.now());

        // Visual feedback
        setActiveLeg(leg);
        setTimeout(() => setActiveLeg(null), 150);

        // Hide instructions after first pedal
        if (showInstructions) {
            setShowInstructions(false);
        }
    }, [showInstructions]);

    // Keyboard controls
    useEffect(() => {
        if (!isActive || deviceType === 'mobile') return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.repeat) return; // Ignore key repeat

            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
                e.preventDefault();
                recordPedalStroke('left');
            } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
                e.preventDefault();
                recordPedalStroke('right');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isActive, deviceType, recordPedalStroke]);

    // Continuous metrics update
    useEffect(() => {
        if (!isActive) {
            if (metricsInterval.current) {
                clearInterval(metricsInterval.current);
            }
            return;
        }

        metricsInterval.current = setInterval(() => {
            const metrics = calculateMetrics();
            onMetricsUpdate(metrics);
        }, 500); // Update every 500ms

        return () => {
            if (metricsInterval.current) {
                clearInterval(metricsInterval.current);
            }
        };
    }, [isActive, calculateMetrics, onMetricsUpdate]);

    if (!isActive) return null;

    // Mobile: Touch buttons
    if (deviceType === 'mobile') {
        return (
            <div className={`fixed bottom-20 inset-x-0 pointer-events-auto ${className}`}>
                <div className="max-w-2xl mx-auto px-4">
                    {showInstructions && (
                        <div className="mb-3 text-center animate-bounce">
                            <p className="text-sm text-white/70 font-medium">
                                Tap buttons to pedal 🚴
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onTouchStart={(e) => {
                                e.preventDefault();
                                recordPedalStroke('left');
                            }}
                            className={`
                relative rounded-2xl border-2 py-12 font-bold text-lg
                transition-all active:scale-95 touch-manipulation
                ${activeLeg === 'left'
                                    ? 'bg-blue-500 border-blue-400 text-white scale-95 shadow-lg shadow-blue-500/50'
                                    : 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                                }
              `}
                        >
                            <div className="absolute top-3 left-3 text-xs uppercase tracking-wider opacity-60">
                                Left
                            </div>
                            <div className="text-4xl mb-2">🦵</div>
                            <div>L</div>
                        </button>

                        <button
                            onTouchStart={(e) => {
                                e.preventDefault();
                                recordPedalStroke('right');
                            }}
                            className={`
                relative rounded-2xl border-2 py-12 font-bold text-lg
                transition-all active:scale-95 touch-manipulation
                ${activeLeg === 'right'
                                    ? 'bg-green-500 border-green-400 text-white scale-95 shadow-lg shadow-green-500/50'
                                    : 'bg-green-500/20 border-green-500/50 text-green-300'
                                }
              `}
                        >
                            <div className="absolute top-3 right-3 text-xs uppercase tracking-wider opacity-60">
                                Right
                            </div>
                            <div className="text-4xl mb-2">🦵</div>
                            <div>R</div>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Desktop: Keyboard indicator
    return (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 pointer-events-none ${className}`}>
            {showInstructions && (
                <div className="mb-4 text-center animate-bounce">
                    <p className="text-sm text-white/70 font-medium">
                        Press ← → or A D keys to pedal 🚴
                    </p>
                </div>
            )}

            <div className="flex items-center gap-4 px-6 py-3 rounded-full bg-black/60 backdrop-blur-xl border border-white/20">
                <div className={`
          flex items-center gap-2 px-4 py-2 rounded-lg transition-all
          ${activeLeg === 'left'
                        ? 'bg-blue-500 text-white scale-110 shadow-lg shadow-blue-500/50'
                        : 'bg-blue-500/20 text-blue-300'
                    }
        `}>
                    <kbd className="text-xs font-mono">←</kbd>
                    <span className="text-sm font-medium">Left</span>
                </div>

                <div className="w-px h-8 bg-white/20" />

                <div className={`
          flex items-center gap-2 px-4 py-2 rounded-lg transition-all
          ${activeLeg === 'right'
                        ? 'bg-green-500 text-white scale-110 shadow-lg shadow-green-500/50'
                        : 'bg-green-500/20 text-green-300'
                    }
        `}>
                    <span className="text-sm font-medium">Right</span>
                    <kbd className="text-xs font-mono">→</kbd>
                </div>
            </div>
        </div>
    );
}
