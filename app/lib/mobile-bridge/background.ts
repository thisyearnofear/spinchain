// Mobile Background Bridge - session persistence
// Ensures telemetry and state channels remain active in background.

"use client";

import { App } from '@capacitor/app';
import { isNativeApp } from './platform';
import { trackEvent, ANALYTICS_EVENTS } from '../analytics/events';

export interface BackgroundSession {
  id: string;
  onPause?: () => void;
  onResume?: () => void;
}

class BackgroundManager {
  private activeSession: BackgroundSession | null = null;
  private isInitialized = false;

  initialize() {
    if (!isNativeApp() || this.isInitialized) return;

    App.addListener('appStateChange', (event: { isActive: boolean }) => {
      const { isActive } = event;
      console.log(`[BackgroundManager] App state changed. IsActive: ${isActive}`);

      if (isActive) {
        this.activeSession?.onResume?.();
        trackEvent(ANALYTICS_EVENTS.SESSION_RESUMED, { sessionId: this.activeSession?.id });
      } else {
        this.activeSession?.onPause?.();
        trackEvent(ANALYTICS_EVENTS.SESSION_PAUSED, { sessionId: this.activeSession?.id });

        // In a real implementation with @capacitor/background-task:
        // const taskId = await BackgroundTask.beforeExit(async () => {
        //   console.log("[BackgroundManager] Performing background cleanup/sync");
        //   BackgroundTask.finish({ taskId });
        // });
      }
    });

    this.isInitialized = true;
  }

  startSession(session: BackgroundSession) {
    this.activeSession = session;
    console.log(`[BackgroundManager] Session started: ${session.id}`);
  }

  stopSession() {
    console.log(`[BackgroundManager] Session stopped: ${this.activeSession?.id}`);
    this.activeSession = null;
  }
}

export const backgroundManager = new BackgroundManager();
