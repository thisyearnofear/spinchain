/**
 * Context-Aware Palette — Adapts the ride world to environmental context.
 *
 * The world should feel connected to the rider's real-world conditions.
 * A sunrise ride looks different from a midnight session. Rain changes
 * the atmosphere. Seasonal colors shift naturally.
 *
 * Context Dimensions:
 * 1. Time of Day — dawn/dusk/day/night palettes
 * 2. Ambient Light — brightness adjustment for glare/harsh light
 * 3. Weather — rain particles, fog density, sky color (future GPS)
 * 4. Season — subtle color temperature shifts
 * 5. Location — terrain association (mountains vs coastal — future)
 */

// ─── Types ───────────────────────────────────────────────────────────

export type TimeOfDay = 'dawn' | 'morning' | 'afternoon' | 'dusk' | 'evening' | 'night';
export type WeatherCondition = 'clear' | 'cloudy' | 'rain' | 'fog' | 'snow' | 'unknown';

export interface ContextProfile {
  timeOfDay: TimeOfDay;
  ambientLux: number;        // 0-100000 lux
  weather: WeatherCondition;
  temperature: number;       // Celsius
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  location: {
    latitude: number;
    longitude: number;
    elevation: number;
  } | null;
}

export interface ContextPalette {
  // Sky colors
  skyTop: string;
  skyBottom: string;
  horizonGlow: string;

  // Fog/atmosphere
  fogColor: string;
  fogDensity: number;

  // World tint
  worldTint: string;
  worldTintOpacity: number;

  // Lighting
  ambientIntensity: number;
  pointLightIntensity: number;
  pointLightColor: string;

  // Weather effects
  rainIntensity: number;
  snowIntensity: number;
  extraFogDensity: number;

  // UI adaptation
  uiBrightness: number;      // 0-1 scale for UI element brightness
  uiOpacity: number;
}

// ─── Time of Day Detection ──────────────────────────────────────────

export function getTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 20) return 'dusk';
  if (hour >= 20 && hour < 22) return 'evening';
  return 'night';
}

export function getSeason(month: number): 'spring' | 'summer' | 'autumn' | 'winter' {
  // Northern hemisphere (can be adjusted for southern)
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

// ─── Context Palette Generation ──────────────────────────────────────

export function generateContextProfile(
  location?: { lat?: number; lng?: number },
): ContextProfile {
  const now = new Date();
  const hour = now.getHours();
  const month = now.getMonth();

  return {
    timeOfDay: getTimeOfDay(hour),
    ambientLux: estimateAmbientLux(hour),
    weather: 'unknown', // Would use weather API or device sensors
    temperature: 20, // Placeholder
    season: getSeason(month),
    location: location ? {
      latitude: location.lat ?? 0,
      longitude: location.lng ?? 0,
      elevation: 0,
    } : null,
  };
}

function estimateAmbientLux(hour: number): number {
  // Rough estimate based on time of day
  if (hour >= 6 && hour < 8) return 5000; // Dawn
  if (hour >= 8 && hour < 16) return 20000; // Day
  if (hour >= 16 && hour < 19) return 8000; // Afternoon/Dusk
  if (hour >= 19 && hour < 21) return 2000; // Evening
  return 100; // Night
}

// ─── Context-Aware Palettes ──────────────────────────────────────────

const TIME_OF_DAY_PALETTES: Record<TimeOfDay, {
  skyTop: string;
  skyBottom: string;
  horizonGlow: string;
  fogColor: string;
  ambientIntensity: number;
  pointLightColor: string;
}> = {
  dawn: {
    skyTop: '#1a1040',
    skyBottom: '#ff6b35',
    horizonGlow: '#ff8c42',
    fogColor: '#2a1a30',
    ambientIntensity: 0.4,
    pointLightColor: '#ffa07a',
  },
  morning: {
    skyTop: '#1e3a8a',
    skyBottom: '#60a5fa',
    horizonGlow: '#93c5fd',
    fogColor: '#1a2040',
    ambientIntensity: 0.8,
    pointLightColor: '#ffffff',
  },
  afternoon: {
    skyTop: '#0ea5e9',
    skyBottom: '#bae6fd',
    horizonGlow: '#e0f2fe',
    fogColor: '#0f172a',
    ambientIntensity: 1.0,
    pointLightColor: '#ffffff',
  },
  dusk: {
    skyTop: '#1e1b4b',
    skyBottom: '#f97316',
    horizonGlow: '#fb923c',
    fogColor: '#2a1520',
    ambientIntensity: 0.5,
    pointLightColor: '#ffa07a',
  },
  evening: {
    skyTop: '#0f172a',
    skyBottom: '#312e81',
    horizonGlow: '#6366f1',
    fogColor: '#0f1020',
    ambientIntensity: 0.3,
    pointLightColor: '#818cf8',
  },
  night: {
    skyTop: '#020617',
    skyBottom: '#0f172a',
    horizonGlow: '#1e293b',
    fogColor: '#050810',
    ambientIntensity: 0.2,
    pointLightColor: '#9b7bff',
  },
};

const SEASONAL_TINTS: Record<string, string> = {
  spring: '#90ee90',  // Green tint
  summer: '#ffffe0',  // Warm yellow
  autumn: '#ffa500',  // Orange tint
  winter: '#b0e0e6',  // Cool blue
};

const WEATHER_ADJUSTMENTS: Record<WeatherCondition, {
  extraFogDensity: number;
  rainIntensity: number;
  snowIntensity: number;
  ambientMultiplier: number;
}> = {
  clear: { extraFogDensity: 0, rainIntensity: 0, snowIntensity: 0, ambientMultiplier: 1.0 },
  cloudy: { extraFogDensity: 5, rainIntensity: 0, snowIntensity: 0, ambientMultiplier: 0.7 },
  rain: { extraFogDensity: 10, rainIntensity: 1.0, snowIntensity: 0, ambientMultiplier: 0.5 },
  fog: { extraFogDensity: 20, rainIntensity: 0, snowIntensity: 0, ambientMultiplier: 0.4 },
  snow: { extraFogDensity: 8, rainIntensity: 0, snowIntensity: 1.0, ambientMultiplier: 0.8 },
  unknown: { extraFogDensity: 0, rainIntensity: 0, snowIntensity: 0, ambientMultiplier: 1.0 },
};

export function generateContextPalette(
  profile: ContextProfile,
): ContextPalette {
  const todPalette = TIME_OF_DAY_PALETTES[profile.timeOfDay];
  const weatherAdj = WEATHER_ADJUSTMENTS[profile.weather];
  const seasonalTint = SEASONAL_TINTS[profile.season];

  // Apply seasonal tint to sky colors
  const skyTop = blendColors(todPalette.skyTop, seasonalTint, 0.1);
  const skyBottom = blendColors(todPalette.skyBottom, seasonalTint, 0.1);

  // Apply weather adjustments
  const ambientIntensity = todPalette.ambientIntensity * weatherAdj.ambientMultiplier;
  const fogDensity = 40 + weatherAdj.extraFogDensity;

  // Ambient light affects UI brightness
  const uiBrightness = Math.min(1, profile.ambientLux / 20000);
  const uiOpacity = Math.max(0.5, uiBrightness * 0.8 + 0.2);

  return {
    skyTop,
    skyBottom,
    horizonGlow: todPalette.horizonGlow,
    fogColor: todPalette.fogColor,
    fogDensity,
    worldTint: seasonalTint,
    worldTintOpacity: 0.05,
    ambientIntensity,
    pointLightIntensity: 1 + (1 - ambientIntensity),
    pointLightColor: todPalette.pointLightColor,
    rainIntensity: weatherAdj.rainIntensity,
    snowIntensity: weatherAdj.snowIntensity,
    extraFogDensity: weatherAdj.extraFogDensity,
    uiBrightness,
    uiOpacity,
  };
}

function blendColors(color1: string, color2: string, ratio: number): string {
  // Simple color blending
  const parse = (c: string) => {
    const hex = c.replace('#', '');
    return [
      parseInt(hex.substring(0, 2), 16),
      parseInt(hex.substring(2, 4), 16),
      parseInt(hex.substring(4, 6), 16),
    ];
  };

  const [r1, g1, b1] = parse(color1);
  const [r2, g2, b2] = parse(color2);

  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ─── React Hook ──────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';

export function useContextAware() {
  const [context, setContext] = useState<ContextProfile>(() => generateContextProfile());
  const [palette, setPalette] = useState<ContextPalette>(() => generateContextPalette(context));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(() => {
    const newContext = generateContextProfile();
    setContext(newContext);
    setPalette(generateContextPalette(newContext));
  }, []);

  // Update context every minute (time changes)
  useEffect(() => {
    refresh(); // Initial
    timerRef.current = setInterval(refresh, 60000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refresh]);

  // Manual update for weather/location changes
  const updateWeather = useCallback((weather: WeatherCondition) => {
    setContext(prev => ({ ...prev, weather }));
  }, []);

  const updateLocation = useCallback((lat: number, lng: number) => {
    setContext(prev => ({
      ...prev,
      location: { latitude: lat, longitude: lng, elevation: 0 },
    }));
  }, []);

  return {
    context,
    palette,
    refresh,
    updateWeather,
    updateLocation,
  };
}