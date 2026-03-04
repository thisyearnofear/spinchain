// BLE Service - Core service layer for all BLE operations
// Uses @capacitor-community/bluetooth-le for cross-platform support (iOS, Android, Web)
// Following Core Principles: Single source of truth, DRY, CLEAN separation

import { BleClient, BleDevice as CapBleDevice } from '@capacitor-community/bluetooth-le';
import {
  BLE_SERVICES,
  BLE_CHARACTERISTICS,
  DEVICE_FILTERS,
  CONNECTION_CONFIG,
  DATA_CONFIG
} from './constants';
import { BleParser } from './parser';
import type {
  BleDevice,
  FitnessMetrics,
  ConnectionStatus,
  BleError,
  BleServiceConfig,
  BleServiceState,
  BleServiceCallbacks,
  SavedDevice,
  ConnectionQuality
} from './types';

// Storage key for saved devices
const SAVED_DEVICES_KEY = 'spinchain:saved-devices';
const MAX_SAVED_DEVICES = 5;

export class BleService {
  private static instance: BleService;
  private state: BleServiceState;
  private config: Required<BleServiceConfig>;
  private callbacks: BleServiceCallbacks;
  private deviceId: string | null = null;
  private updateInterval: NodeJS.Timeout | null = null;
  private initialized = false;

  private constructor() {
    this.state = {
      status: 'disconnected',
      device: null,
      metrics: null,
      error: null,
      isScanning: false,
      isConnected: false
    };

    this.config = {
      autoReconnect: true,
      reconnectAttempts: CONNECTION_CONFIG.RECONNECT_ATTEMPTS,
      updateInterval: DATA_CONFIG.UPDATE_INTERVAL,
      filterDevices: this.defaultDeviceFilter
    };

    this.callbacks = {};
  }

  // Singleton pattern - single source of truth
  public static getInstance(): BleService {
    if (!BleService.instance) {
      BleService.instance = new BleService();
    }
    return BleService.instance;
  }

  // Configuration methods
  public configure(config: BleServiceConfig): void {
    this.config = { ...this.config, ...config };
  }

  public setCallbacks(callbacks: BleServiceCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  // Initialise the Capacitor BLE plugin (idempotent)
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    await BleClient.initialize({ androidNeverForLocation: true });
    this.initialized = true;
  }

  // Public API methods
  public async scanAndConnect(): Promise<BleDevice | null> {
    try {
      await this.ensureInitialized();
      this.updateStatus('scanning');
      this.state.isScanning = true;
      this.notifyStatusChange();

      // requestDevice shows the native OS picker on iOS/Android; falls back to browser picker on web
      const capDevice: CapBleDevice = await BleClient.requestDevice({
        services: [...DEVICE_FILTERS.ACCEPTED_SERVICES],
        optionalServices: [
          BLE_SERVICES.CYCLING_POWER,
          BLE_SERVICES.HEART_RATE,
          BLE_SERVICES.DEVICE_INFORMATION
        ]
      });

      this.state.isScanning = false;
      return await this.connectToDeviceById(capDevice.deviceId, capDevice.name ?? 'Unknown Device');
    } catch (error) {
      this.state.isScanning = false;
      this.handleError('CONNECTION_FAILED', (error as Error).message);
      return null;
    }
  }

  public async connectToDevice(device: { deviceId: string; name?: string }): Promise<BleDevice | null> {
    return this.connectToDeviceById(device.deviceId, device.name ?? 'Unknown Device');
  }

  private async connectToDeviceById(deviceId: string, name: string): Promise<BleDevice | null> {
    try {
      await this.ensureInitialized();
      this.updateStatus('connecting');
      this.deviceId = deviceId;

      await BleClient.connect(deviceId, (id) => this.handleDisconnect(id));

      const services = await this.discoverServices(deviceId);

      const bleDevice: BleDevice = {
        id: deviceId,
        name,
        rssi: 0,
        connected: true,
        services
      };

      this.state.device = bleDevice;

      await this.setupNotifications(deviceId);
      this.updateStatus('connected');
      this.state.isConnected = true;
      this.startMetricsUpdates();

      this.saveDevice(bleDevice);
      this.callbacks.onDeviceConnected?.(bleDevice);
      this.notifyStatusChange();

      return bleDevice;
    } catch (error) {
      this.handleError('CONNECTION_FAILED', (error as Error).message);
      return null;
    }
  }

  public disconnect(): void {
    if (this.deviceId) {
      BleClient.disconnect(this.deviceId).catch(() => {});
      this.deviceId = null;
    }

    this.stopMetricsUpdates();
    this.updateStatus('disconnected');
    this.state.isConnected = false;

    const deviceId = this.state.device?.id;
    this.state.device = null;

    if (deviceId) {
      this.callbacks.onDeviceDisconnected?.(deviceId);
    }

    this.notifyStatusChange();
  }

  public getCurrentMetrics(): FitnessMetrics | null {
    return this.state.metrics;
  }

  public getState(): BleServiceState {
    return { ...this.state };
  }

  // Private helper methods
  private isBluetoothAvailable(): boolean {
    // Capacitor BLE works on iOS, Android, and modern desktop browsers
    return typeof window !== 'undefined';
  }

  private defaultDeviceFilter(device: BleDevice): boolean {
    const name = device.name.toLowerCase();
    return DEVICE_FILTERS.ACCEPTED_NAMES.some(accepted => 
      name.includes(accepted.toLowerCase())
    );
  }

  private async discoverServices(deviceId: string): Promise<string[]> {
    try {
      const result = await BleClient.getServices(deviceId);
      return result.map(s => s.uuid);
    } catch (error) {
      console.warn('Failed to discover services:', error);
      return [];
    }
  }

  private async setupNotifications(deviceId: string): Promise<void> {
    let hasActiveStream = false;

    try {
      // FTMS indoor bike data (speed/cadence/power/distance)
      await BleClient.startNotifications(
        deviceId,
        BLE_SERVICES.FITNESS_MACHINE,
        BLE_CHARACTERISTICS.INDOOR_BIKE_DATA,
        (value) => this.mergeMetrics(BleParser.parseIndoorBikeData(value))
      );
      hasActiveStream = true;
    } catch (error) {
      console.warn('Failed to setup FTMS indoor bike notifications:', error);
    }

    try {
      // Cycling Power Service
      await BleClient.startNotifications(
        deviceId,
        BLE_SERVICES.CYCLING_POWER,
        BLE_CHARACTERISTICS.CYCLING_POWER_MEASUREMENT,
        (value) => this.mergeMetrics(BleParser.parseCyclingPower(value))
      );
      hasActiveStream = true;
    } catch (error) {
      console.warn('Failed to setup power notifications:', error);
    }

    try {
      // Heart Rate Service
      await BleClient.startNotifications(
        deviceId,
        BLE_SERVICES.HEART_RATE,
        BLE_CHARACTERISTICS.HEART_RATE_MEASUREMENT,
        (value) => this.mergeMetrics({ heartRate: BleParser.parseHeartRate(value) })
      );
      hasActiveStream = true;
    } catch (error) {
      console.warn('Failed to setup heart rate notifications:', error);
    }

    if (!hasActiveStream) {
      throw new Error('No supported telemetry notification stream found');
    }
  }

  private handleDisconnect(deviceId: string): void {
    this.stopMetricsUpdates();
    this.updateStatus('disconnected');
    this.state.isConnected = false;
    this.state.device = null;
    this.deviceId = null;
    this.callbacks.onDeviceDisconnected?.(deviceId);
    this.notifyStatusChange();

    if (this.config.autoReconnect) {
      this.reconnect(deviceId);
    }
  }

  private mergeMetrics(next: Partial<FitnessMetrics>): void {
    try {
      const current = this.state.metrics;
      const merged: FitnessMetrics = {
        power: next.power ?? current?.power ?? 0,
        cadence: next.cadence ?? current?.cadence ?? 0,
        heartRate: next.heartRate ?? current?.heartRate ?? 0,
        speed: next.speed ?? current?.speed ?? 0,
        distance: next.distance ?? current?.distance ?? 0,
        timestamp: Date.now(),
      };
      this.state.metrics = merged;
      this.callbacks.onMetricsUpdate?.(merged);
    } catch (error) {
      this.handleError('PARSING_ERROR', (error as Error).message);
    }
  }

  private startMetricsUpdates(): void {
    this.stopMetricsUpdates();
    this.updateInterval = setInterval(() => {
      // Trigger any periodic updates or state checks
      if (this.deviceId && !this.state.isConnected) {
        this.reconnect(this.deviceId);
      }
    }, this.config.updateInterval);
  }

  private stopMetricsUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  private async reconnect(deviceId: string): Promise<void> {
    if (!this.config.autoReconnect) return;

    for (let i = 0; i < this.config.reconnectAttempts; i++) {
      try {
        const saved = this.getSavedDevices().find(d => d.id === deviceId);
        await this.connectToDeviceById(deviceId, saved?.name ?? 'Unknown Device');
        return;
      } catch {
        await new Promise(resolve => setTimeout(resolve, CONNECTION_CONFIG.RECONNECT_DELAY));
      }
    }

    this.handleError('CONNECTION_FAILED', 'Failed to reconnect after multiple attempts');
  }

  // State management methods
  private updateStatus(status: ConnectionStatus): void {
    this.state.status = status;
    this.notifyStatusChange();
  }

  private handleError(type: BleError['type'], message: string): void {
    const error: BleError = {
      type,
      message,
      device: this.state.device?.id,
      timestamp: Date.now()
    };
    
    this.state.error = error;
    this.callbacks.onError?.(error);
    this.notifyStatusChange();
  }

  private notifyStatusChange(): void {
    this.callbacks.onStatusChange?.(this.state.status);
  }

  // ============================================================================
  // Device Memory - Remember previously paired devices for quick reconnect
  // ============================================================================

  /**
   * Get all saved devices (sorted by last connected, newest first)
   */
  public getSavedDevices(): SavedDevice[] {
    try {
      const stored = localStorage.getItem(SAVED_DEVICES_KEY);
      if (!stored) return [];
      const devices: SavedDevice[] = JSON.parse(stored);
      return devices.sort((a, b) => b.lastConnected - a.lastConnected);
    } catch {
      return [];
    }
  }

  /**
   * Save a device after successful connection
   */
  private saveDevice(device: BleDevice): void {
    try {
      const saved = this.getSavedDevices();
      
      // Remove if already exists (will re-add with new timestamp)
      const filtered = saved.filter(d => d.id !== device.id);
      
      // Add to front with current timestamp
      filtered.unshift({
        id: device.id,
        name: device.name,
        lastConnected: Date.now(),
        services: device.services,
      });
      
      // Keep only last MAX_SAVED_DEVICES
      const trimmed = filtered.slice(0, MAX_SAVED_DEVICES);
      localStorage.setItem(SAVED_DEVICES_KEY, JSON.stringify(trimmed));
    } catch (error) {
      console.warn('[BLE] Failed to save device:', error);
    }
  }

  /**
   * Remove a device from memory
   */
  public removeSavedDevice(deviceId: string): void {
    try {
      const saved = this.getSavedDevices().filter(d => d.id !== deviceId);
      localStorage.setItem(SAVED_DEVICES_KEY, JSON.stringify(saved));
    } catch (error) {
      console.warn('[BLE] Failed to remove device:', error);
    }
  }

  /**
   * Clear all saved devices
   */
  public clearSavedDevices(): void {
    try {
      localStorage.removeItem(SAVED_DEVICES_KEY);
    } catch (error) {
      console.warn('[BLE] Failed to clear devices:', error);
    }
  }

  /**
   * Auto-connect to last used device
   * Returns true if attempting connection, false if no saved devices
   */
  public async autoConnect(): Promise<boolean> {
    const saved = this.getSavedDevices();
    if (saved.length === 0) return false;

    const lastDevice = saved[0];
    
    if (!this.isBluetoothAvailable()) {
      this.handleError('PERMISSION_DENIED', 'Bluetooth not available');
      return false;
    }

    try {
      await this.ensureInitialized();
      this.updateStatus('connecting');
      // Capacitor BLE supports direct connect by device ID — no re-scan needed
      const connected = await this.connectToDeviceById(lastDevice.id, lastDevice.name);
      return !!connected;
    } catch (error) {
      this.handleError('CONNECTION_FAILED', (error as Error).message);
      return false;
    }
  }

  // ============================================================================
  // Connection Quality - Signal strength visualization
  // ============================================================================

  /**
   * Get connection quality based on data freshness
   * Web Bluetooth doesn't provide RSSI, so we infer from data updates
   */
  public getConnectionQuality(): ConnectionQuality {
    if (!this.state.isConnected || !this.state.metrics) {
      return { strength: 'none', percentage: 0, label: 'No connection' };
    }

    const now = Date.now();
    const lastUpdate = this.state.metrics.timestamp;
    const timeSinceUpdate = now - lastUpdate;

    // If data arrived within last 2 seconds = excellent
    if (timeSinceUpdate < 2000) {
      return { strength: 'excellent', percentage: 100, label: 'Excellent' };
    }
    // 2-5 seconds = good
    if (timeSinceUpdate < 5000) {
      return { strength: 'good', percentage: 75, label: 'Good' };
    }
    // 5-10 seconds = fair
    if (timeSinceUpdate < 10000) {
      return { strength: 'fair', percentage: 50, label: 'Fair' };
    }
    // >10 seconds = poor
    return { strength: 'poor', percentage: 25, label: 'Poor' };
  }
}

// Export singleton instance
export const bleService = BleService.getInstance();
