/**
 * DeviceEngine — Manages BLE device connection, simulator control, and
 * keyboard input as sources of telemetry data.
 *
 * Design rules:
 * - Abstracts the telemetry source (BLE vs simulator vs keyboard) behind a
 *   unified interface.
 * - Emits device connection/disconnection events on the EventBus.
 * - Does NOT couple to any specific BLE library — integrations are injected.
 */

import { EventBus } from "./event-bus";
import type { DeviceStatus, TelemetrySnapshot } from "./types";

/** Callback type for when the device provides new telemetry data */
export type TelemetryCallback = (update: Partial<TelemetrySnapshot>) => void;

export class DeviceEngine {
  private status: DeviceStatus = {
    type: "none",
    connected: false,
    hint: null,
  };

  /** BLE metrics callback — wired externally from the BLE integration */
  onTelemetry: TelemetryCallback | null = null;

  /** Simulator metrics callback — wired externally from the simulator UI */
  onSimulatorTelemetry: TelemetryCallback | null = null;

  private disposed = false;

  constructor(private readonly bus: EventBus) {}

  // ─── Status ────────────────────────────────────────────────────

  get currentStatus(): Readonly<DeviceStatus> {
    return this.status;
  }

  get isConnected(): boolean {
    return this.status.connected;
  }

  get type(): DeviceStatus["type"] {
    return this.status.type;
  }

  // ─── BLE Connection ────────────────────────────────────────────

  /** Called when a BLE device connects */
  connectBle(): void {
    if (this.disposed) return;
    this.status = { type: "ble", connected: true, hint: null };
    this.bus.emit("device:connected", { ...this.status });
  }

  /** Called when a BLE device disconnects */
  disconnectBle(): void {
    if (this.disposed) return;
    this.status = { type: "none", connected: false, hint: null };
    this.bus.emit("device:disconnected", {});
  }

  /** Called by BLE integration when new metrics arrive */
  handleBleMetrics(metrics: Partial<TelemetrySnapshot>): void {
    if (!this.status.connected) {
      this.connectBle();
    }
    this.onTelemetry?.(metrics);
  }

  // ─── Simulator ─────────────────────────────────────────────────

  /** Activates the simulator as the telemetry source */
  connectSimulator(hint?: string): void {
    if (this.disposed) return;
    this.status = {
      type: "simulator",
      connected: true,
      hint: hint ?? null,
    };
    this.bus.emit("device:connected", { ...this.status });
  }

  /** Disconnects the simulator */
  disconnectSimulator(): void {
    if (this.disposed) return;
    this.status = { type: "none", connected: false, hint: null };
    this.bus.emit("device:disconnected", {});
  }

  /** Called by simulator UI when new metrics arrive */
  handleSimulatorMetrics(
    metrics: Partial<TelemetrySnapshot> & {
      heartRate: number;
      power: number;
      cadence: number;
      speed: number;
      effort: number;
    },
  ): void {
    if (this.status.type !== "simulator") {
      this.connectSimulator();
    }
    this.onSimulatorTelemetry?.(metrics);
  }

  // ─── Keyboard Control ──────────────────────────────────────────

  /** Sets status to keyboard-only mode (e.g., demo/guest with keyboard shifting) */
  setKeyboardMode(hint: string): void {
    if (this.disposed) return;
    this.status = { type: "keyboard", connected: true, hint };
    this.bus.emit("device:connected", { ...this.status });
  }

  // ─── Lifecycle ─────────────────────────────────────────────────

  dispose(): void {
    this.disposed = true;
    this.onTelemetry = null;
    this.onSimulatorTelemetry = null;
    this.status = { type: "none", connected: false, hint: null };
  }
}
