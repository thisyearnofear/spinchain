/**
 * EventBus — Typed publish/subscribe for cross-engine communication.
 *
 * Design rules:
 * - Engines never import other engines directly; they communicate through
 *   the EventBus.
 * - All events are explicitly typed in the `RideEvents` interface (no catch-all).
 * - Subscription returns an unsubscribe function for cleanup.
 *
 * Usage:
 *   bus.on("telemetry:ingest", (data) => { ... });
 *   bus.emit("telemetry:ingest", { heartRate: 150 });
 *   const unsub = bus.on("ride:started", handler);
 *   unsub(); // unsubscribe
 */

type EventHandler<T = unknown> = (data: T) => void;

export interface RideEvents {
  "ride:started": { classId: string; duration: number };
  "ride:paused": Record<string, never>;
  "ride:resumed": Record<string, never>;
  "ride:stopped": { summary: unknown | null };

  "lifecycle:tick": { elapsed: number; progress: number };
  "lifecycle:complete": Record<string, never>;

  "telemetry:ingest": Record<string, unknown>;
  "telemetry:committed": Record<string, unknown>;

  "device:connected": { type: "ble" | "simulator" | "keyboard" | "none"; connected: boolean };
  "device:disconnected": Record<string, never>;

  "interval:changed": { index: number; phase: string; interval: Record<string, unknown> };

  "coaching:message": { text: string; source: string };
  "coaching:sound": { type: string };

  "rewards:started": Record<string, never>;
  "rewards:tick": { accumulated: bigint };
  "rewards:finalized": Record<string, never>;

  "sui:session-started": { sessionId: string };
  "sui:session-ended": { sessionId: string };

  "visualization:mode-changed": { mode: string };
  "visualization:degraded": { fromMode: string; toMode: string; fps: number };
}

export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();
  private disposed = false;

  on<K extends keyof RideEvents>(
    event: K,
    handler: (data: RideEvents[K]) => void,
  ): () => void {
    if (this.disposed) {
      console.warn("[EventBus] Attempted to subscribe after dispose:", event);
      return () => {};
    }

    if (!this.handlers.has(event as string)) {
      this.handlers.set(event as string, new Set());
    }
    this.handlers.get(event as string)!.add(handler as EventHandler);

    return () => {
      this.handlers.get(event as string)?.delete(handler as EventHandler);
    };
  }

  emit<K extends keyof RideEvents>(event: K, data: RideEvents[K]): void {
    if (this.disposed) return;

    const handlers = this.handlers.get(event as string);
    if (!handlers || handlers.size === 0) return;

    // Defensive copy to avoid issues if handlers modify the set during iteration
    for (const handler of Array.from(handlers)) {
      try {
        handler(data);
      } catch (err) {
        console.error(`[EventBus] Error in handler for "${event}":`, err);
      }
    }
  }

  /** Removes all listeners. Called by coordinator.dispose(). */
  dispose(): void {
    this.disposed = true;
    this.handlers.clear();
  }
}
