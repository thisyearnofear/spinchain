/**
 * Experience Level — Adaptive UI system that recognizes rider proficiency
 * and adjusts complexity, coach style, and interface density accordingly.
 *
 * Core insight: A first-time rider needs hand-holding. A veteran rider
 * needs speed. The interface should scale complexity based on experience.
 *
 * Experience Tiers:
 *   TIER_0 = NEWBIE     — 0-2 rides. Full tutorials, explicit coach, simplified HUD
 *   TIER_1 = DEVELOPER  — 3-9 rides. Reduced guidance, feature discovery begins
 *   TIER_2 = RACER      — 10-29 rides. Minimal HUD, data-driven coach, gesture controls
 *   TIER_3 = VETERAN    — 30+ rides. Ultra-minimal, predictive coach, keyboard shortcuts
 *
 * Adaptation surfaces:
 * - Tutorial frequency (high → none)
 * - HUD complexity (full → compact → minimal)
 * - Coach message style (guiding → concise → silent)
 * - Feature discovery (prompts → hints → nothing)
 * - UI interaction modes (tap-heavy → gesture/keyboard)
 */

// ─── Types ───────────────────────────────────────────────────────────

export type ExperienceTier = 0 | 1 | 2 | 3;

export interface ExperienceConfig {
  tier: ExperienceTier;
  label: string;
  totalRides: number;
  tutorialFrequency: 'full' | 'reduced' | 'none';
  hudComplexity: 'full' | 'compact' | 'minimal';
  coachStyle: 'guiding' | 'concise' | 'silent';
  showFeatureDiscovery: boolean;
  gestureControlsDefault: boolean;
  keyboardShortcutsDefault: boolean;
  coachMessageLength: number; // max words per message
  coachMessageInterval: number; // min seconds between messages
}

// ─── Experience Configuration ────────────────────────────────────────

export const EXPERIENCE_CONFIGS: Record<ExperienceTier, ExperienceConfig> = {
  0: { // NEWBIE
    tier: 0,
    label: 'New Rider',
    totalRides: 0,
    tutorialFrequency: 'full',
    hudComplexity: 'full',
    coachStyle: 'guiding',
    showFeatureDiscovery: true,
    gestureControlsDefault: false,
    keyboardShortcutsDefault: false,
    coachMessageLength: 40,
    coachMessageInterval: 60,
  },
  1: { // DEVELOPER
    tier: 1,
    label: 'Developing Rider',
    totalRides: 3,
    tutorialFrequency: 'reduced',
    hudComplexity: 'compact',
    coachStyle: 'guiding',
    showFeatureDiscovery: true,
    gestureControlsDefault: false,
    keyboardShortcutsDefault: false,
    coachMessageLength: 35,
    coachMessageInterval: 45,
  },
  2: { // RACER
    tier: 2,
    label: 'Racer',
    totalRides: 10,
    tutorialFrequency: 'none',
    hudComplexity: 'compact',
    coachStyle: 'concise',
    showFeatureDiscovery: false,
    gestureControlsDefault: true,
    keyboardShortcutsDefault: true,
    coachMessageLength: 25,
    coachMessageInterval: 30,
  },
  3: { // VETERAN
    tier: 3,
    label: 'Veteran',
    totalRides: 30,
    tutorialFrequency: 'none',
    hudComplexity: 'minimal',
    coachStyle: 'concise',
    showFeatureDiscovery: false,
    gestureControlsDefault: true,
    keyboardShortcutsDefault: true,
    coachMessageLength: 15,
    coachMessageInterval: 20,
  },
};

// ─── Persistent User Profile ─────────────────────────────────────────

const STORAGE_KEY = 'spinchain-experience';

interface ExperienceProfile {
  version: number;
  totalRides: number;
  currentTier: ExperienceTier;
  lastRideDate: string | null;
  preferredTheme: string;
  preferredCoach: string;
  tutorialDismissed: string[]; // IDs of dismissed tutorials
  featureFlags: Record<string, boolean>;
}

function loadProfile(): ExperienceProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultProfile();
    const parsed = JSON.parse(raw);
    return { ...createDefaultProfile(), ...parsed };
  } catch {
    return createDefaultProfile();
  }
}

function saveProfile(profile: ExperienceProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Storage unavailable
  }
}

function createDefaultProfile(): ExperienceProfile {
  return {
    version: 1,
    totalRides: 0,
    currentTier: 0,
    lastRideDate: null,
    preferredTheme: 'neon',
    preferredCoach: 'data',
    tutorialDismissed: [],
    featureFlags: {},
  };
}

// ─── Tier Calculation ────────────────────────────────────────────────

function calculateTier(totalRides: number): ExperienceTier {
  if (totalRides >= 30) return 3;
  if (totalRides >= 10) return 2;
  if (totalRides >= 3) return 1;
  return 0;
}

// ─── Public API ──────────────────────────────────────────────────────

export class ExperienceManager {
  private profile: ExperienceProfile;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.profile = loadProfile();
    // Ensure currentTier matches actual totalRides
    this.profile.currentTier = calculateTier(this.profile.totalRides);
  }

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
    saveProfile(this.profile);
  }

  // ─── Record Ride ─────────────────────────────────────────────
  recordRide() {
    this.profile.totalRides++;
    this.profile.lastRideDate = new Date().toISOString().split('T')[0];
    this.profile.currentTier = calculateTier(this.profile.totalRides);
    this.notify();
  }

  // ─── Get Profile ─────────────────────────────────────────────
  getProfile(): ExperienceProfile {
    return { ...this.profile };
  }

  // ─── Get Config ──────────────────────────────────────────────
  getConfig(): ExperienceConfig {
    return EXPERIENCE_CONFIGS[this.profile.currentTier];
  }

  // ─── Get Current Tier ────────────────────────────────────────
  getCurrentTier(): ExperienceTier {
    return this.profile.currentTier;
  }

  getTotalRides(): number {
    return this.profile.totalRides;
  }

  isFirstRider(): boolean {
    return this.profile.totalRides <= 1;
  }

  isVeteran(): boolean {
    return this.profile.totalRides >= 30;
  }

  // ─── Tutorial Management ─────────────────────────────────────
  dismissTutorial(tutorialId: string) {
    if (!this.profile.tutorialDismissed.includes(tutorialId)) {
      this.profile.tutorialDismissed.push(tutorialId);
      this.save();
    }
  }

  shouldShowTutorial(tutorialId: string): boolean {
    if (this.profile.tutorialDismissed.includes(tutorialId)) return false;
    
    // Tutorials only shown to new riders or reduced for veterans
    const config = this.getConfig();
    if (config.tutorialFrequency === 'none') return false;
    if (config.tutorialFrequency === 'reduced' && this.profile.tutorialDismissed.length > 3) return false;
    
    return true;
  }

  // ─── Feature Discovery ───────────────────────────────────────
  shouldShowFeatureDiscovery(featureId: string): boolean {
    if (!this.getConfig().showFeatureDiscovery) return false;
    if (this.profile.featureFlags[featureId]) return false;
    return true;
  }

  markFeatureDiscovered(featureId: string) {
    this.profile.featureFlags[featureId] = true;
    this.save();
  }

  // ─── Reset (for testing) ─────────────────────────────────────
  reset() {
    localStorage.removeItem(STORAGE_KEY);
    this.profile = createDefaultProfile();
    this.notify();
  }
}

// ─── Singleton Instance ──────────────────────────────────────────────

export const experienceManager = new ExperienceManager();

// ─── React Hook ──────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';

export function useExperience() {
  const [profile, setProfile] = useState<ExperienceProfile>(() => experienceManager.getProfile());
  const [config, setConfig] = useState<ExperienceConfig>(() => experienceManager.getConfig());

  const refresh = useCallback(() => {
    setProfile(experienceManager.getProfile());
    setConfig(experienceManager.getConfig());
  }, []);

  useEffect(() => {
    return experienceManager.subscribe(refresh);
  }, [refresh]);

  const dismissTutorial = useCallback((tutorialId: string) => {
    experienceManager.dismissTutorial(tutorialId);
    setProfile(experienceManager.getProfile());
  }, []);

  const markFeatureDiscovered = useCallback((featureId: string) => {
    experienceManager.markFeatureDiscovered(featureId);
  }, []);

  return {
    profile,
    config,
    currentTier: profile.currentTier,
    totalRides: profile.totalRides,
    isFirstRider: profile.totalRides <= 1,
    isVeteran: profile.totalRides >= 30,
    shouldShowTutorial: (id: string) => experienceManager.shouldShowTutorial(id),
    shouldShowFeatureDiscovery: (id: string) => experienceManager.shouldShowFeatureDiscovery(id),
    dismissTutorial,
    markFeatureDiscovered,
    refresh,
  };
}