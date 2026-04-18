// Mobile BLE Bridge - unified BLE interface for web + native
// Uses Web Bluetooth service on web and Capacitor BLE on native apps.

import { useMemo } from 'react';

import { BleClient } from '@capacitor-community/bluetooth-le';
import { isNativeApp, hasNativeBluetooth } from './platform';
import { bleService } from '../ble/service';
import { BLE_SERVICES, BLE_CHARACTERISTICS } from '../ble/constants';
import { BleParser, BleEncoder } from '../ble/parser';
import { ANALYTICS_EVENTS, trackEvent } from '../analytics/events';
import { getHealthService, type HealthData } from './health';
import { backgroundManager } from './background';
import type {
  FitnessMetrics,
  BleDevice,
  SavedDevice,
  ConnectionStatus,
  ConnectionQuality,
  BleError,
  BleServiceCallbacks,
} from '../ble/types';

const SAVED_DEVICES_KEY = 'spinchain:saved-devices';
const MAX_SAVED_DEVICES = 5;

// Re-export types for convenience
export type {
  FitnessMetrics,
  BleDevice,
  SavedDevice,
  ConnectionStatus,
  ConnectionQuality,
};

export interface UnifiedBleService {
  // State
  getMetrics(): FitnessMetrics | null;
  getStatus(): ConnectionStatus;
  getDevice(): BleDevice | null;
  getConnectionQuality(): ConnectionQuality;
  getSavedDevices(): SavedDevice[];
  setCallbacks(callbacks: BleServiceCallbacks): void;

  // Actions
  scanAndConnect(): Promise<BleDevice | null>;
  connect(): Promise<BleDevice | null>;
  disconnect(): void;
  autoConnect(): Promise<boolean>;
  setResistance(level: number): Promise<boolean>;
  removeSavedDevice(deviceId: string): void;
  clearSavedDevices(): void;
}

class WebBleService implements UnifiedBleService {
  getMetrics(): FitnessMetrics | null {
    return bleService.getCurrentMetrics();
  }

  getStatus(): ConnectionStatus {
    return bleService.getState().status;
  }

  getDevice(): BleDevice | null {
    return bleService.getState().device;
  }

  getConnectionQuality(): ConnectionQuality {
    return bleService.getConnectionQuality();
  }

  getSavedDevices(): SavedDevice[] {
    return bleService.getSavedDevices();
  }

  setCallbacks(callbacks: BleServiceCallbacks): void {
    bleService.setCallbacks(callbacks);
  }

  async scanAndConnect(): Promise<BleDevice | null> {
    return bleService.scanAndConnect();
  }

  async connect(): Promise<BleDevice | null> {
    return bleService.scanAndConnect();
  }

  disconnect(): void {
    bleService.disconnect();
  }

  async autoConnect(): Promise<boolean> {
    return bleService.autoConnect();
  }

  async setResistance(level: number): Promise<boolean> {
    return bleService.setResistance(level);
  }

  removeSavedDevice(deviceId: string): void {
    bleService.removeSavedDevice(deviceId);
  }

  clearSavedDevices(): void {
    bleService.clearSavedDevices();
  }
}

class NativeBleService implements UnifiedBleService {
  private metrics: FitnessMetrics | null = null;
  private status: ConnectionStatus = 'disconnected';
  private device: BleDevice | null = null;
  private callbacks: BleServiceCallbacks = {};
  private initialized = false;
  private lastRssi: number | null = null;
  private notificationStreams: Array<{ service: string; characteristic: string }> = [];
  private metricsWatchdog: ReturnType<typeof setInterval> | null = null;
  private metricsWatchdogLastRecovery = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 3;
  private userInitiatedDisconnect = false;

  getMetrics(): FitnessMetrics | null {
    return this.metrics;
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  getDevice(): BleDevice | null {
    return this.device;
  }

  getConnectionQuality(): ConnectionQuality {
    if (this.status !== 'connected' || !this.device) {
      return { strength: 'none', percentage: 0, label: 'No connection' };
    }

    if (typeof this.lastRssi === 'number') {
      if (this.lastRssi >= -60) return { strength: 'excellent', percentage: 100, label: 'Excellent' };
      if (this.lastRssi >= -70) return { strength: 'good', percentage: 75, label: 'Good' };
      if (this.lastRssi >= -80) return { strength: 'fair', percentage: 50, label: 'Fair' };
      return { strength: 'poor', percentage: 25, label: 'Poor' };
    }

    const timeSinceUpdate = this.metrics ? Date.now() - this.metrics.timestamp : Number.POSITIVE_INFINITY;
    if (timeSinceUpdate < 2000) return { strength: 'excellent', percentage: 100, label: 'Excellent' };
    if (timeSinceUpdate < 5000) return { strength: 'good', percentage: 75, label: 'Good' };
    if (timeSinceUpdate < 10000) return { strength: 'fair', percentage: 50, label: 'Fair' };
    return { strength: 'poor', percentage: 25, label: 'Poor' };
  }

  getSavedDevices(): SavedDevice[] {
    if (typeof window === 'undefined') return [];
    try {
      const stored = window.localStorage.getItem(SAVED_DEVICES_KEY);
      if (!stored) return [];
      const devices = JSON.parse(stored) as SavedDevice[];
      return devices.sort((a, b) => b.lastConnected - a.lastConnected);
    } catch {
      return [];
    }
  }

  setCallbacks(callbacks: BleServiceCallbacks): void {
    this.callbacks = { ...callbacks };
  }

  async scanAndConnect(): Promise<BleDevice | null> {
    await this.initialize();
    this.updateStatus('scanning');

    try {
      const selected = await BleClient.requestDevice({
        services: [BLE_SERVICES.FITNESS_MACHINE],
        optionalServices: [
          BLE_SERVICES.CYCLING_POWER,
          BLE_SERVICES.HEART_RATE,
          BLE_SERVICES.DEVICE_INFORMATION,
        ],
      });

      return await this.connectNativeDevice(selected.deviceId, selected.name);
    } catch (error) {
      this.handleNativeError(error);
      return null;
    }
  }

  async connect(): Promise<BleDevice | null> {
    const autoConnected = await this.autoConnect();
    if (autoConnected) {
      return this.device;
    }
    return this.scanAndConnect();
  }

  disconnect(): void {
    void this.disconnectInternal();
  }

  async autoConnect(): Promise<boolean> {
    await this.initialize();
    const saved = this.getSavedDevices();
    if (saved.length === 0) return false;

    for (const candidate of saved) {
      try {
        const known = await BleClient.getDevices([candidate.id]);
        const target = known.find((item) => item.deviceId === candidate.id);
        if (!target) continue;

        const connected = await this.connectNativeDevice(target.deviceId, target.name ?? candidate.name);
        return !!connected;
      } catch {
        // Try next saved device
      }
    }

    return false;
  }

  async setResistance(level: number): Promise<boolean> {
    if (!this.device || this.status !== 'connected') return false;

    try {
      // 1. Request control
      const reqCmd = BleEncoder.encodeRequestControl();
      await BleClient.write(
        this.device.id,
        BLE_SERVICES.FITNESS_MACHINE,
        BLE_CHARACTERISTICS.FITNESS_MACHINE_CONTROL_POINT,
        new DataView(reqCmd.buffer)
      );

      // 2. Set resistance
      const resCmd = BleEncoder.encodeSetResistance(level);
      await BleClient.write(
        this.device.id,
        BLE_SERVICES.FITNESS_MACHINE,
        BLE_CHARACTERISTICS.FITNESS_MACHINE_CONTROL_POINT,
        new DataView(resCmd.buffer)
      );

      if (this.metrics) {
        this.metrics = { ...this.metrics, resistance: level };
      }
      return true;
    } catch (error) {
      console.warn('[NativeBle] Failed to set resistance:', error);
      return false;
    }
  }

  removeSavedDevice(deviceId: string): void {
    if (typeof window === 'undefined') return;
    const saved = this.getSavedDevices().filter((device) => device.id !== deviceId);
    window.localStorage.setItem(SAVED_DEVICES_KEY, JSON.stringify(saved));
  }

  clearSavedDevices(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(SAVED_DEVICES_KEY);
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;
    await BleClient.initialize({ androidNeverForLocation: true });
    this.initialized = true;
  }


  private async connectNativeDevice(deviceId: string, name?: string): Promise<BleDevice | null> {
    this.updateStatus('connecting');
    this.userInitiatedDisconnect = false;

    try {
      await BleClient.connect(
        deviceId,
        () => {
          this.handleUnexpectedDisconnect(deviceId);
        },
        { timeout: 15000 },
      );

      // Start background session for native persistence
      backgroundManager.startSession({
        id: `ride-${deviceId}-${Date.now()}`,
        onPause: () => console.log("[BleService] Entering background..."),
        onResume: () => console.log("[BleService] Resumed from background."),
      });

      const services = await BleClient.getServices(deviceId);
      const serviceUuids = services.map((service) => service.uuid);

      const mapped: BleDevice = {
        id: deviceId,
        name: name || 'Unknown Device',
        rssi: 0,
        connected: true,
        services: serviceUuids,
      };

      this.device = mapped;
      this.metrics = null;
      this.lastRssi = null;

      await this.startTelemetryNotifications(deviceId);
      await this.refreshRssi(deviceId);
      this.saveDevice(mapped);
      this.startMetricsWatchdog();
      this.reconnectAttempts = 0;

      this.updateStatus('connected');
      this.callbacks.onDeviceConnected?.(mapped);
      this.callbacks.onStatusChange?.(this.status);
      return mapped;
    } catch (_error) {
      return null;
    }
  }

  private async startTelemetryNotifications(deviceId: string): Promise<void> {
    this.notificationStreams = [];

    let hasStream = false;
    let hasHeartRate = false;

    const attach = async (
      service: string,
      characteristic: string,
      onValue: (value: DataView) => void,
    ): Promise<void> => {
      try {
        await BleClient.startNotifications(deviceId, service, characteristic, onValue);
        this.notificationStreams.push({ service, characteristic });
        hasStream = true;
        if (service === BLE_SERVICES.HEART_RATE) hasHeartRate = true;
      } catch {
        // Keep trying other service/characteristic pairs.
      }
    };

    await attach(
      BLE_SERVICES.FITNESS_MACHINE,
      BLE_CHARACTERISTICS.INDOOR_BIKE_DATA,
      (value) => this.mergeMetrics(BleParser.parseIndoorBikeData(value)),
    );

    await attach(
      BLE_SERVICES.CYCLING_POWER,
      BLE_CHARACTERISTICS.CYCLING_POWER_MEASUREMENT,
      (value) => this.mergeMetrics(BleParser.parseCyclingPower(value)),
    );

    await attach(
      BLE_SERVICES.HEART_RATE,
      BLE_CHARACTERISTICS.HEART_RATE_MEASUREMENT,
      (value) => this.mergeMetrics({ heartRate: BleParser.parseHeartRate(value) }),
    );

    // iOS Production Readiness: HealthKit Fallback for Heart Rate
    const health = getHealthService();
    if (!hasHeartRate && health.isAvailable()) {
      console.log("[NativeBle] BLE Heart Rate missing, starting HealthKit bridge fallback...");
      health.startHeartRateStreaming((data: HealthData) => {
        if (data.heartRate) {
          this.mergeMetrics({ heartRate: data.heartRate });
        }
      }).catch(err => console.error("[NativeBle] HealthKit bridge error:", err));
    }

    if (!hasStream) {
      throw new Error('No supported telemetry notifications available on this device');
    }
  }

  private mergeMetrics(next: Partial<FitnessMetrics>): void {
    const current = this.metrics;

    this.metrics = {
      power: next.power ?? current?.power ?? 0,
      cadence: next.cadence ?? current?.cadence ?? 0,
      heartRate: next.heartRate ?? current?.heartRate ?? 0,
      speed: next.speed ?? current?.speed ?? 0,
      distance: next.distance ?? current?.distance ?? 0,
      timestamp: Date.now(),
    };

    this.callbacks.onMetricsUpdate?.(this.metrics);
  }

  private async refreshRssi(deviceId: string): Promise<void> {
    try {
      this.lastRssi = await BleClient.readRssi(deviceId);
      if (this.device) {
        this.device = { ...this.device, rssi: this.lastRssi };
      }
    } catch {
      this.lastRssi = null;
    }
  }

  private handleUnexpectedDisconnect(deviceId: string): void {
    if (this.userInitiatedDisconnect) {
      return;
    }

    const lastKnownName = this.device?.name;
    this.stopMetricsWatchdog();
    backgroundManager.stopSession();
    this.status = 'disconnected';
    this.device = null;
    this.metrics = null;
    this.lastRssi = null;
    this.notificationStreams = [];
    this.callbacks.onDeviceDisconnected?.(deviceId);
    this.callbacks.onStatusChange?.(this.status);
    this.scheduleReconnect(deviceId, lastKnownName);
  }

  private async disconnectInternal(): Promise<void> {
    this.userInitiatedDisconnect = true;
    const deviceId = this.device?.id;
    this.stopMetricsWatchdog();
    this.clearReconnectTimer();
    backgroundManager.stopSession();

    if (deviceId) {
      for (const stream of this.notificationStreams) {
        try {
          await BleClient.stopNotifications(deviceId, stream.service, stream.characteristic);
        } catch {
          // Best-effort cleanup.
        }
      }

      try {
        await BleClient.disconnect(deviceId);
      } catch {
        // Best-effort cleanup.
      }
    }

    this.notificationStreams = [];
    this.status = 'disconnected';
    this.device = null;
    this.metrics = null;
    this.lastRssi = null;
    if (deviceId) {
      this.callbacks.onDeviceDisconnected?.(deviceId);
    }
    this.callbacks.onStatusChange?.(this.status);
  }

  private updateStatus(status: ConnectionStatus): void {
    this.status = status;
    this.callbacks.onStatusChange?.(status);
  }

  private saveDevice(device: BleDevice): void {
    if (typeof window === 'undefined') return;
    const saved = this.getSavedDevices().filter((entry) => entry.id !== device.id);
    saved.unshift({
      id: device.id,
      name: device.name,
      lastConnected: Date.now(),
      services: device.services,
    });
    window.localStorage.setItem(SAVED_DEVICES_KEY, JSON.stringify(saved.slice(0, MAX_SAVED_DEVICES)));
  }

  private handleNativeError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    const normalized = message.toLowerCase();

    let type: BleError['type'] = 'CONNECTION_FAILED';
    if (normalized.includes('cancel')) type = 'DEVICE_NOT_FOUND';
    if (normalized.includes('permission') || normalized.includes('denied')) type = 'PERMISSION_DENIED';

    this.status = 'error';
    const payload: BleError = {
      type,
      message,
      device: this.device?.id,
      timestamp: Date.now(),
    };
    this.callbacks.onError?.(payload);
    this.callbacks.onStatusChange?.(this.status);
  }

  private startMetricsWatchdog(): void {
    this.stopMetricsWatchdog();
    this.metricsWatchdog = setInterval(() => {
      if (this.status !== 'connected' || !this.device || !this.metrics) return;

      const ageMs = Date.now() - this.metrics.timestamp;
      if (ageMs < 15000) return;

      const now = Date.now();
      if (now - this.metricsWatchdogLastRecovery < 15000) return;
      this.metricsWatchdogLastRecovery = now;
      void this.recoverTelemetryStream('stale-metrics');
    }, 5000);
  }

  private stopMetricsWatchdog(): void {
    if (this.metricsWatchdog) {
      clearInterval(this.metricsWatchdog);
      this.metricsWatchdog = null;
    }
  }

  private async recoverTelemetryStream(reason: 'stale-metrics' | 'reconnect'): Promise<void> {
    if (!this.device) return;
    const deviceId = this.device.id;

    trackEvent(ANALYTICS_EVENTS.TELEMETRY_RECOVERY_STARTED, { reason });

    try {
      for (const stream of this.notificationStreams) {
        try {
          await BleClient.stopNotifications(deviceId, stream.service, stream.characteristic);
        } catch {
          // Best-effort cleanup.
        }
      }
      await this.startTelemetryNotifications(deviceId);
      await this.refreshRssi(deviceId);
      trackEvent(ANALYTICS_EVENTS.TELEMETRY_RECOVERY_SUCCEEDED, { reason });
    } catch {
      trackEvent(ANALYTICS_EVENTS.TELEMETRY_RECOVERY_FAILED, { reason });
      this.scheduleReconnect(deviceId, this.device.name);
    }
  }

  private scheduleReconnect(deviceId: string, deviceName?: string): void {
    if (this.userInitiatedDisconnect) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      trackEvent(ANALYTICS_EVENTS.TELEMETRY_RECOVERY_FAILED, {
        reason: 'reconnect-limit',
      });
      return;
    }

    this.clearReconnectTimer();
    const delayMs = Math.min(1000 * 2 ** this.reconnectAttempts, 8000);
    this.reconnectTimer = setTimeout(async () => {
      if (this.userInitiatedDisconnect) return;

      this.reconnectAttempts += 1;
      this.updateStatus('connecting');
      const reconnected = await this.connectNativeDevice(deviceId, deviceName);
      if (!reconnected) {
        this.scheduleReconnect(deviceId, deviceName);
      } else {
        trackEvent(ANALYTICS_EVENTS.TELEMETRY_RECOVERY_SUCCEEDED, {
          reason: 'reconnect',
          attempts: this.reconnectAttempts,
        });
      }
    }, delayMs);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

let bleInstance: UnifiedBleService | null = null;

export function getUnifiedBleService(): UnifiedBleService {
  if (!bleInstance) {
    bleInstance = isNativeApp() ? new NativeBleService() : new WebBleService();
  }
  return bleInstance;
}

export function useUnifiedBle() {
  const service = getUnifiedBleService();
  return useMemo(() => ({
    metrics: service.getMetrics(),
    status: service.getStatus(),
    device: service.getDevice(),
    connectionQuality: service.getConnectionQuality(),
    savedDevices: service.getSavedDevices(),
    scanAndConnect: service.scanAndConnect.bind(service),
    connect: service.connect.bind(service),
    disconnect: service.disconnect.bind(service),
    autoConnect: service.autoConnect.bind(service),
    setResistance: service.setResistance.bind(service),
    removeSavedDevice: service.removeSavedDevice.bind(service),
    clearSavedDevices: service.clearSavedDevices.bind(service),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [service]);
}

export function isBleAvailable(): boolean {
  return isNativeApp() || hasNativeBluetooth();
}

export function getConnectionRecommendation(): {
  method: 'native' | 'web' | 'none';
  message: string;
  action?: string;
} {
  if (isNativeApp()) {
    return { method: 'native', message: 'Using native Bluetooth for best experience', action: 'Connect your bike' };
  }
  if (hasNativeBluetooth()) {
    return { method: 'web', message: 'Web Bluetooth available', action: 'Scan for devices' };
  }
  return { method: 'none', message: 'Bluetooth not available in this browser', action: 'Use desktop Chrome for BLE' };
}
