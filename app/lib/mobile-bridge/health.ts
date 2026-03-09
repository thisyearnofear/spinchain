// Mobile Health Bridge - unified health data interface
// Integrates with Apple HealthKit on iOS for heart rate and workout data.

"use client";

import { isNativeApp, getPlatformInfo } from './platform';
import { trackEvent, ANALYTICS_EVENTS } from '../analytics/events';

export interface HealthData {
  heartRate?: number;
  timestamp: number;
  source: 'healthkit' | 'googlefit' | 'sensor';
}

export interface HealthService {
  isAvailable(): boolean;
  requestPermission(): Promise<boolean>;
  startHeartRateStreaming(onUpdate: (data: HealthData) => void): Promise<void>;
  stopHeartRateStreaming(): void;
}

class WebHealthService implements HealthService {
  isAvailable(): boolean { return false; }
  async requestPermission(): Promise<boolean> { return false; }
  async startHeartRateStreaming(): Promise<void> { }
  stopHeartRateStreaming(): void { }
}

class NativeHealthService implements HealthService {
  private isStreaming = false;
  private updateInterval: ReturnType<typeof setInterval> | null = null;

  isAvailable(): boolean {
    const { platform } = getPlatformInfo();
    return platform === 'ios';
  }

  async requestPermission(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    
    try {
      // In a real implementation, we would use:
      // await HealthKit.requestAuthorization({ read: ['heart_rate'] });
      console.log("[HealthService] Permission requested");
      return true;
    } catch (err) {
      console.error("[HealthService] Permission failed:", err);
      return false;
    }
  }

  async startHeartRateStreaming(onUpdate: (data: HealthData) => void): Promise<void> {
    if (this.isStreaming) return;
    this.isStreaming = true;

    trackEvent(ANALYTICS_EVENTS.TELEMETRY_RECOVERY_STARTED, { source: 'healthkit' });

    // Mock implementation for development; would use native HealthKit bridge in production.
    this.updateInterval = setInterval(() => {
      onUpdate({
        heartRate: 70 + Math.floor(Math.random() * 20),
        timestamp: Date.now(),
        source: 'healthkit'
      });
    }, 2000);
  }

  stopHeartRateStreaming(): void {
    this.isStreaming = false;
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}

let healthInstance: HealthService | null = null;

export function getHealthService(): HealthService {
  if (!healthInstance) {
    healthInstance = isNativeApp() ? new NativeHealthService() : new WebHealthService();
  }
  return healthInstance;
}
