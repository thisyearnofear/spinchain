/**
 * Milestones & Streaks — Persistent achievement tracking engine.
 *
 * The system that gives SpinChain its soul: it remembers who you are,
 * what you've done, and celebrates your progress across sessions.
 *
 * Core capabilities:
 * 1. **Streak tracking** — consecutive daily rides
 * 2. **Session milestones** — achievements within a single ride
 * 3. **Long-term milestones** — cumulative achievements across all rides
 * 4. **World memory** — persistent state that shapes the ride experience
 *
 * Storage: localStorage with structured schema and migration support.
 * Versioned to handle schema changes without losing user data.
 */

// ─── Types ───────────────────────────────────────────────────────────

export interface RideStats {
  date: string;            // ISO date
  durationSec: number;
  avgPower: number;
  maxPower: number;
  avgHR: number;
  maxHR: number;
  avgCadence: number;
  distance: number;        // meters
  calories: number;
  flowMinutes: number;     // time in flow state (tier >= 2)
  peakFlowTier: number;
  milestones?: string[];   // session milestone ids earned this ride
}

export interface SessionMilestone {
  id: string;
  type: 'duration' | 'power' | 'cadence' | 'hr' | 'distance' | 'flow' | 'streak' | 'personal-best';
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  title: string;
  description: string;
  value: number;
  target: number;
  timestamp: number;
  rideId?: string;
}

export interface UserMemory {
  version: number;
  totalRides: number;
  totalFlowMinutes: number;
  totalCalories: number;
  longestStreak: number;
  currentStreak: number;
  lastRideDate: string | null;
  firstRideDate: string | null;
  bestAvgPower: number;
  bestMaxPower: number;
  bestDuration: number;
  bestFlowMinutes: number;
  rides: Record<string, RideStats>; // date → stats
}

export type MilestoneTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export const MILESTONE_TIERS: Record<MilestoneTier, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  scale: number;
}> = {
  bronze: {
    label: 'Bronze',
    color: '#b45309',
    bgColor: 'rgba(180,83,9,0.1)',
    borderColor: 'rgba(180,83,9,0.4)',
    icon: '🥉',
    scale: 1,
  },
  silver: {
    label: 'Silver',
    color: '#475569',
    bgColor: 'rgba(71,85,105,0.1)',
    borderColor: 'rgba(71,85,105,0.4)',
    icon: '🥈',
    scale: 1.1,
  },
  gold: {
    label: 'Gold',
    color: '#ca8a04',
    bgColor: 'rgba(202,138,4,0.1)',
    borderColor: 'rgba(202,138,4,0.5)',
    icon: '🥇',
    scale: 1.2,
  },
  platinum: {
    label: 'Platinum',
    color: '#6366f1',
    bgColor: 'rgba(99,102,241,0.1)',
    borderColor: 'rgba(99,102,241,0.6)',
    icon: '💎',
    scale: 1.4,
  },
  diamond: {
    label: 'Diamond',
    color: '#a855f7',
    bgColor: 'rgba(168,85,247,0.15)',
    borderColor: 'rgba(168,85,247,0.7)',
    icon: '👑',
    scale: 1.6,
  },
};

// ─── Milestone Definitions ──────────────────────────────────────────

interface MilestoneDef {
  id: string;
  type: SessionMilestone['type'];
  tier: MilestoneTier;
  title: string;
  description: string;
  targetFn: (stats: { duration: number; power: number; maxPower: number; hr: number; maxHR: number; cadence: number; distance: number; flowMinutes: number; peakFlowTier: number }) => number;
}

export const SESSION_MILESTONES: MilestoneDef[] = [
  // Duration milestones
  { id: 'dur-5', type: 'duration', tier: 'bronze', title: 'First Strides', description: 'Rode for 5 minutes', targetFn: (s) => s.duration },
  { id: 'dur-15', type: 'duration', tier: 'silver', title: 'Getting Into It', description: '15-minute ride', targetFn: (s) => s.duration },
  { id: 'dur-30', type: 'duration', tier: 'gold', title: 'Solid Session', description: '30-minute ride', targetFn: (s) => s.duration },
  { id: 'dur-60', type: 'duration', tier: 'platinum', title: 'Iron Will', description: 'Full hour in the saddle', targetFn: (s) => s.duration },
  { id: 'dur-90', type: 'duration', tier: 'diamond', title: 'Endurance Legend', description: '90-minute epic', targetFn: (s) => s.duration },

  // Power milestones
  { id: 'pwr-100', type: 'power', tier: 'bronze', title: 'Picking Up', description: '100W sustained', targetFn: (s) => s.maxPower },
  { id: 'pwr-200', type: 'power', tier: 'silver', title: 'Power Surge', description: '200W max effort', targetFn: (s) => s.maxPower },
  { id: 'pwr-300', type: 'power', tier: 'gold', title: 'Peak Performance', description: '300W max effort', targetFn: (s) => s.maxPower },
  { id: 'pwr-400', type: 'power', tier: 'platinum', title: 'Red Zone', description: '400W — you\'re pushing limits', targetFn: (s) => s.maxPower },
  { id: 'pwr-500', type: 'power', tier: 'diamond', title: 'Anomaly Detected', description: '500W — are you okay?', targetFn: (s) => s.maxPower },

  // HR milestones
  { id: 'hr-160', type: 'hr', tier: 'silver', title: 'Heart of Fire', description: 'HR hit 160 bpm', targetFn: (s) => s.maxHR },
  { id: 'hr-180', type: 'hr', tier: 'gold', title: 'Max Capacity', description: 'HR hit 180 bpm', targetFn: (s) => s.maxHR },
  { id: 'hr-190', type: 'hr', tier: 'platinum', title: 'Edge of Human', description: 'HR hit 190 bpm', targetFn: (s) => s.maxHR },

  // Cadence milestones
  { id: 'cad-90', type: 'cadence', tier: 'bronze', title: 'Spinning', description: '90 RPM sustained', targetFn: (s) => s.cadence },
  { id: 'cad-100', type: 'cadence', tier: 'silver', title: 'Speed Merchant', description: '100 RPM sustained', targetFn: (s) => s.cadence },
  { id: 'cad-110', type: 'cadence', tier: 'gold', title: 'Legs of Steel', description: '110 RPM sustained', targetFn: (s) => s.cadence },
  { id: 'cad-120', type: 'cadence', tier: 'platinum', title: 'Human Engine', description: '120 RPM sustained', targetFn: (s) => s.cadence },

  // Flow milestones
  { id: 'flow-2', type: 'flow', tier: 'bronze', title: 'Found the Rhythm', description: '2 minutes in flow', targetFn: (s) => s.flowMinutes },
  { id: 'flow-5', type: 'flow', tier: 'silver', title: 'Flow State', description: '5 minutes in flow', targetFn: (s) => s.flowMinutes },
  { id: 'flow-10', type: 'flow', tier: 'gold', title: 'Deep Flow', description: '10 minutes in flow', targetFn: (s) => s.flowMinutes },
  { id: 'flow-15', type: 'flow', tier: 'platinum', title: 'Flow Master', description: '15 minutes in flow', targetFn: (s) => s.flowMinutes },
  { id: 'flow-20', type: 'flow', tier: 'diamond', title: 'Beyond Human', description: '20 minutes in flow', targetFn: (s) => s.flowMinutes },

  // Peak flow tier
  { id: 'flow-super', type: 'personal-best', tier: 'gold', title: 'Super Flow', description: 'Reached super flow tier', targetFn: (s) => s.peakFlowTier },
  { id: 'flow-mastery', type: 'personal-best', tier: 'platinum', title: 'Mastery Unlocked', description: 'Reached mastery tier', targetFn: (s) => s.peakFlowTier },
];

// ─── World Memory Storage ──────────────────────────────────────────

const STORAGE_KEY = 'spinchain-user-memory';
const STORAGE_VERSION = 1;

function loadMemory(): UserMemory {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultMemory();
    const parsed = JSON.parse(raw);
    // Migration: ensure version field exists
    if (parsed.version === undefined) {
      parsed.version = 0;
    }
    return { ...createDefaultMemory(), ...parsed };
  } catch {
    return createDefaultMemory();
  }
}

function saveMemory(memory: UserMemory): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // Storage full or unavailable — silent fail
  }
}

function createDefaultMemory(): UserMemory {
  return {
    version: STORAGE_VERSION,
    totalRides: 0,
    totalFlowMinutes: 0,
    totalCalories: 0,
    longestStreak: 0,
    currentStreak: 0,
    lastRideDate: null,
    firstRideDate: null,
    bestAvgPower: 0,
    bestMaxPower: 0,
    bestDuration: 0,
    bestFlowMinutes: 0,
    rides: {},
  };
}

// ─── Streak Calculation ─────────────────────────────────────────────

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function calculateStreak(memory: UserMemory): { current: number; longest: number } {
  const dates = Object.keys(memory.rides).sort().reverse();
  if (dates.length === 0) return { current: 0, longest: 0 };

  // Calculate current streak
  let current = 0;
  const checkDate = new Date();
  const todayStr = getTodayStr();
  const lastRideStr = memory.lastRideDate;

  // If last ride was yesterday (not today), streak might still be alive
  // If last ride was more than 1 day ago, streak is broken
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (lastRideStr !== todayStr && lastRideStr !== yesterdayStr) {
    return { current: 0, longest: memory.longestStreak };
  }

  // Count consecutive days backward
  while (true) {
    const dateStr = checkDate.toISOString().split('T')[0];
    if (memory.rides[dateStr]) {
      current++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return { current, longest: Math.max(memory.longestStreak, current) };
}

// ─── Milestone Detection ────────────────────────────────────────────

export function detectSessionMilestones(
  rideStats: { duration: number; power: number; maxPower: number; hr: number; maxHR: number; cadence: number; distance: number; flowMinutes: number; peakFlowTier: number },
  existingIds: string[],
): SessionMilestone[] {
  const newMilestones: SessionMilestone[] = [];

  for (const def of SESSION_MILESTONES) {
    if (existingIds.includes(def.id)) continue; // Already earned

    const achievedValue = def.targetFn(rideStats);
    if (achievedValue >= getMilestoneTarget(def.type, def.tier)) {
      newMilestones.push({
        id: def.id,
        type: def.type,
        tier: def.tier,
        title: def.title,
        description: def.description,
        value: achievedValue,
        target: getMilestoneTarget(def.type, def.tier),
        timestamp: Date.now(),
      });
    }
  }

  return newMilestones;
}

function getMilestoneTarget(type: SessionMilestone['type'], tier: MilestoneTier): number {
  switch (type) {
    case 'duration':
      switch (tier) {
        case 'bronze': return 300;     // 5 min
        case 'silver': return 900;     // 15 min
        case 'gold': return 1800;      // 30 min
        case 'platinum': return 3600;  // 60 min
        case 'diamond': return 5400;   // 90 min
      }
    case 'power':
      switch (tier) {
        case 'bronze': return 100;
        case 'silver': return 200;
        case 'gold': return 300;
        case 'platinum': return 400;
        case 'diamond': return 500;
      }
    case 'hr':
      switch (tier) {
        case 'silver': return 160;
        case 'gold': return 180;
        case 'platinum': return 190;
      }
    case 'cadence':
      switch (tier) {
        case 'bronze': return 90;
        case 'silver': return 100;
        case 'gold': return 110;
        case 'platinum': return 120;
      }
    case 'flow':
      switch (tier) {
        case 'bronze': return 2;
        case 'silver': return 5;
        case 'gold': return 10;
        case 'platinum': return 15;
        case 'diamond': return 20;
      }
    case 'personal-best':
      switch (tier) {
        case 'gold': return 3;   // super flow
        case 'platinum': return 4; // mastery
      }
    default:
      return 0;
  }
}

// ─── Public API ─────────────────────────────────────────────────────

export class MilestonesAndStreaks {
  private memory: UserMemory;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.memory = loadMemory();
  }

  // ─── Subscribe/Notify ────────────────────────────────────────
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify() {
    this.save();
    this.listeners.forEach(fn => fn());
  }

  private save() {
    saveMemory(this.memory);
  }

  // ─── Record Ride ─────────────────────────────────────────────
  recordRide(rideData: {
    durationSec: number;
    avgPower: number;
    maxPower: number;
    avgHR: number;
    maxHR: number;
    avgCadence: number;
    distance: number;
    calories: number;
    flowMinutes: number;
    peakFlowTier: number;
  }) {
    const today = getTodayStr();
    const isToday = this.memory.lastRideDate === today;

    // Update ride stats
    this.memory.rides[today] = {
      date: today,
      durationSec: rideData.durationSec,
      avgPower: Math.max(this.memory.rides[today]?.avgPower ?? 0, rideData.avgPower),
      maxPower: Math.max(this.memory.rides[today]?.maxPower ?? 0, rideData.maxPower),
      avgHR: rideData.avgHR,
      maxHR: Math.max(this.memory.rides[today]?.maxHR ?? 0, rideData.maxHR),
      avgCadence: rideData.avgCadence,
      distance: rideData.distance,
      calories: rideData.calories,
      flowMinutes: rideData.flowMinutes,
      peakFlowTier: Math.max(this.memory.rides[today]?.peakFlowTier ?? 0, rideData.peakFlowTier),
    };

    // Increment totals
    this.memory.totalRides++;
    this.memory.totalFlowMinutes += rideData.flowMinutes;
    this.memory.totalCalories += rideData.calories;
    this.memory.lastRideDate = today;
    if (!this.memory.firstRideDate) {
      this.memory.firstRideDate = today;
    }

    // Update bests
    this.memory.bestAvgPower = Math.max(this.memory.bestAvgPower, rideData.avgPower);
    this.memory.bestMaxPower = Math.max(this.memory.bestMaxPower, rideData.maxPower);
    this.memory.bestDuration = Math.max(this.memory.bestDuration, rideData.durationSec);
    this.memory.bestFlowMinutes = Math.max(this.memory.bestFlowMinutes, rideData.flowMinutes);

    // Recalculate streak
    const { current, longest } = calculateStreak(this.memory);
    this.memory.currentStreak = current;
    this.memory.longestStreak = longest;

    this.notify();
  }

  // ─── Get Memory ──────────────────────────────────────────────
  getMemory(): UserMemory {
    return { ...this.memory };
  }

  // ─── Get Current Stats ───────────────────────────────────────
  getCurrentStreak(): number {
    return this.memory.currentStreak;
  }

  getLongestStreak(): number {
    return this.memory.longestStreak;
  }

  getTotalRides(): number {
    return this.memory.totalRides;
  }

  getTotalFlowMinutes(): number {
    return this.memory.totalFlowMinutes;
  }

  getBestAvgPower(): number {
    return this.memory.bestAvgPower;
  }

  getBestMaxPower(): number {
    return this.memory.bestMaxPower;
  }

  getFirstRideDate(): string | null {
    return this.memory.firstRideDate;
  }

  // ─── Milestone Detection ─────────────────────────────────────
  getUnearnedMilestones(): string[] {
    // Check which session milestones haven't been earned in this session
    return SESSION_MILESTONES.map(d => d.id).filter(id => !this.memory.rides[getTodayStr()]?.milestones?.includes(id));
  }

  detectAndRecordMilestones(rideData: {
    duration: number;
    avgPower: number;
    maxPower: number;
    hr: number;
    maxHR: number;
    cadence: number;
    distance: number;
    flowMinutes: number;
    peakFlowTier: number;
  }): SessionMilestone[] {
    const existingIds = this.memory.rides[getTodayStr()]?.milestones ?? [];
    const newMilestones = detectSessionMilestones(
      {
        duration: rideData.duration,
        power: rideData.avgPower,
        maxPower: rideData.maxPower,
        hr: rideData.hr,
        maxHR: rideData.maxHR,
        cadence: rideData.cadence,
        distance: rideData.distance,
        flowMinutes: rideData.flowMinutes,
        peakFlowTier: rideData.peakFlowTier,
      },
      existingIds,
    );

    if (newMilestones.length > 0) {
      // Record new milestones
      if (!this.memory.rides[getTodayStr()]) {
        this.memory.rides[getTodayStr()] = {
          date: getTodayStr(),
          durationSec: rideData.duration * 60,
          avgPower: rideData.avgPower,
          maxPower: rideData.maxPower,
          avgHR: rideData.hr,
          maxHR: rideData.maxHR,
          avgCadence: rideData.cadence,
          distance: rideData.distance,
          calories: 0,
          flowMinutes: rideData.flowMinutes,
          peakFlowTier: rideData.peakFlowTier,
          milestones: [],
        };
      }

      const todayRide = this.memory.rides[getTodayStr()];
      todayRide.milestones = [...(todayRide.milestones ?? []), ...newMilestones.map(m => m.id)];
      this.notify();
    }

    return newMilestones;
  }

  // ─── Reset (for testing) ─────────────────────────────────────
  reset() {
    localStorage.removeItem(STORAGE_KEY);
    this.memory = createDefaultMemory();
    this.notify();
  }
}

// ─── Singleton Instance ─────────────────────────────────────────────

export const milestonesAndStreaks = new MilestonesAndStreaks();

// ─── React Hook ─────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';

export function useMilestones() {
  const [memory, setMemory] = useState<UserMemory>(() => milestonesAndStreaks.getMemory());
  const [currentMilestones, setCurrentMilestones] = useState<SessionMilestone[]>([]);
  const pendingMilestonesRef = useRef<SessionMilestone[]>([]);

  const refresh = useCallback(() => {
    setMemory(milestonesAndStreaks.getMemory());
  }, []);

  useEffect(() => {
    return milestonesAndStreaks.subscribe(refresh);
  }, [refresh]);

  // Detect milestones on new ride completion
  const detectMilestones = useCallback((rideData: {
    duration: number;
    avgPower: number;
    maxPower: number;
    hr: number;
    maxHR: number;
    cadence: number;
    distance: number;
    flowMinutes: number;
    peakFlowTier: number;
  }) => {
    const newMilestones = milestonesAndStreaks.detectAndRecordMilestones(rideData);
    pendingMilestonesRef.current = newMilestones;
    return newMilestones;
  }, []);

  // Get milestone for tier (for UI rendering)
  const getMilestoneStyle = useCallback((tier: MilestoneTier) => MILESTONE_TIERS[tier], []);

  // Ref read is intentional: expose pending milestones for render without triggering re-renders.
  /* eslint-disable react-hooks/refs */
  return {
    memory,
    currentMilestones,
    pendingMilestones: pendingMilestonesRef.current,
    streak: milestonesAndStreaks.getCurrentStreak(),
    longestStreak: milestonesAndStreaks.getLongestStreak(),
    totalRides: milestonesAndStreaks.getTotalRides(),
    totalFlowMinutes: milestonesAndStreaks.getTotalFlowMinutes(),
    bestAvgPower: milestonesAndStreaks.getBestAvgPower(),
    bestMaxPower: milestonesAndStreaks.getBestMaxPower(),
    detectMilestones,
    getMilestoneStyle,
    refresh,
  };
  /* eslint-enable react-hooks/refs */
}