type AnalyticsValue = string | number | boolean | null | undefined;
type AnalyticsPayload = Record<string, AnalyticsValue>;

export const ANALYTICS_EVENTS = {
  RIDE_ENTRY_VIEWED: 'ride_entry_viewed',
  TELEMETRY_CONNECT_CTA_CLICKED: 'telemetry_connect_cta_clicked',
  TELEMETRY_CONNECT_SUCCESS: 'telemetry_connect_success',
  TELEMETRY_CONNECT_FAILED: 'telemetry_connect_failed',
  TELEMETRY_LIVE_READY: 'telemetry_live_ready',
  TELEMETRY_RECOVERY_STARTED: 'telemetry_recovery_started',
  TELEMETRY_RECOVERY_SUCCEEDED: 'telemetry_recovery_succeeded',
  TELEMETRY_RECOVERY_FAILED: 'telemetry_recovery_failed',
  RIDE_START_BLOCKED_NO_TELEMETRY: 'ride_start_blocked_no_telemetry',
  RIDE_STARTED: 'ride_started',
  RIDE_COMPLETED: 'ride_completed',
  PREMIUM_UPSELL_VIEWED: 'premium_upsell_viewed',
  PREMIUM_UPSELL_CLICKED: 'premium_upsell_clicked',
  SESSION_RESUMED: 'session_resumed',
  SESSION_PAUSED: 'session_paused',
  WIDGET_TOGGLED: 'widget_toggled',
  WIDGET_MINIMIZED: 'widget_minimized',
  WIDGET_RESTORED: 'widget_restored',
  WIDGET_DRAGGED: 'widget_dragged',
  WIDGET_LAYOUT_RESET: 'widget_layout_reset',
  SIMULATOR_KEYBOARD_HINT_VIEWED: 'simulator_keyboard_hint_viewed',
  SIMULATOR_INPUT_ACTIVITY: 'simulator_input_activity',
  SIMULATOR_INPUT_SKIPPED_TOUCH_ONLY: 'simulator_input_skipped_touch_only',
  RIDE_SYNC_SUCCESS: 'ride_sync_success',
} as const;

type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

interface AnalyticsEvent {
  name: AnalyticsEventName;
  timestamp: number;
  path?: string;
  payload: AnalyticsPayload;
}

const STORAGE_KEY = 'spinchain:analytics:events';
const SESSION_KEY = 'spinchain:session:id';
const MAX_EVENTS = 100;
const SYNC_BATCH_SIZE = 10;
const SYNC_INTERVAL = 30000; // 30 seconds

// Get or create session ID
function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

// Sync events to server
async function syncEventsToServer(events: AnalyticsEvent[]): Promise<void> {
  if (typeof window === 'undefined' || events.length === 0) return;
  
  try {
    const response = await fetch('/api/analytics/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events,
        sessionId: getSessionId(),
      }),
    });
    
    if (!response.ok) {
      console.warn('Analytics sync failed:', response.status);
    }
  } catch (error) {
    // Best-effort - don't block UI on sync failures
    console.warn('Analytics sync error:', error);
  }
}

// Background sync loop
let syncTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingSync = false;

function scheduleSync(): void {
  if (pendingSync) return;
  
  if (syncTimeout) clearTimeout(syncTimeout);
  
  syncTimeout = setTimeout(async () => {
    pendingSync = true;
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      const parsed: AnalyticsEvent[] = existing ? JSON.parse(existing) : [];
      
      if (parsed.length >= SYNC_BATCH_SIZE) {
        const toSync = parsed.slice(0, SYNC_BATCH_SIZE);
        await syncEventsToServer(toSync);
        
        // Remove synced events
        const remaining = parsed.slice(SYNC_BATCH_SIZE);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
      }
    } finally {
      pendingSync = false;
      scheduleSync(); // Schedule next sync
    }
  }, SYNC_INTERVAL);
}

function persistEvent(event: AnalyticsEvent): void {
  if (typeof window === 'undefined') return;

  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    const parsed = existing ? (JSON.parse(existing) as AnalyticsEvent[]) : [];
    parsed.push(event);
    if (parsed.length > MAX_EVENTS) {
      parsed.splice(0, parsed.length - MAX_EVENTS);
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    
    // Trigger sync if we have enough events
    if (parsed.length >= SYNC_BATCH_SIZE) {
      scheduleSync();
    }
  } catch {
    // Best-effort analytics persistence.
  }
}

export function trackEvent(name: AnalyticsEventName, payload: AnalyticsPayload = {}): void {
  const event: AnalyticsEvent = {
    name,
    timestamp: Date.now(),
    path: typeof window !== 'undefined' ? window.location.pathname : undefined,
    payload,
  };

  persistEvent(event);
  
  // Immediately sync important events
  const importantEvents: AnalyticsEventName[] = [
    ANALYTICS_EVENTS.RIDE_STARTED,
    ANALYTICS_EVENTS.RIDE_COMPLETED,
    ANALYTICS_EVENTS.RIDE_ENTRY_VIEWED,
    ANALYTICS_EVENTS.TELEMETRY_CONNECT_SUCCESS,
    ANALYTICS_EVENTS.TELEMETRY_CONNECT_FAILED,
  ];
  
  if (importantEvents.includes(name)) {
    syncEventsToServer([event]);
  } else {
    // Schedule background sync for other events
    scheduleSync();
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('spinchain:analytics', { detail: event }));
  }
}

// Manual sync trigger (call when user is about to leave)
export function flushAnalytics(): void {
  if (typeof window === 'undefined') return;
  
  const existing = localStorage.getItem(STORAGE_KEY);
  const parsed: AnalyticsEvent[] = existing ? JSON.parse(existing) : [];
  
  if (parsed.length > 0) {
    syncEventsToServer(parsed).then(() => {
      localStorage.setItem(STORAGE_KEY, '[]');
    });
  }
}

// Get session ID for debugging
export function getAnalyticsSessionId(): string {
  return getSessionId();
}
