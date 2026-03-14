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
} as const;

type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

interface AnalyticsEvent {
  name: AnalyticsEventName;
  timestamp: number;
  path?: string;
  payload: AnalyticsPayload;
}

const STORAGE_KEY = 'spinchain:analytics:events';
const MAX_EVENTS = 100;

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

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('spinchain:analytics', { detail: event }));
  }
}
