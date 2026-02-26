// BLE Service - Core service layer for all BLE operations
// Following Core Principles: Single source of truth, DRY, CLEAN separation

/// <reference types="web-bluetooth" />

import { 
  BLE_SERVICES, 
  BLE_CHARACTERISTICS, 
  DEVICE_FILTERS,
  CONNECTION_CONFIG,
  DATA_CONFIG
} from './constants';
import type { 
  BleDevice, 
  RawBleData, 
  FitnessMetrics, 
  ConnectionStatus, 
  BleError,
  BleServiceConfig,
  BleServiceState,
  BleServiceCallbacks,
  SavedDevice
} from './types';

// Storage key for saved devices
const SAVED_DEVICES_KEY = 'spinchain:saved-devices';
const MAX_SAVED_DEVICES = 5;

export class BleService {
  private static instance: BleService;
  private state: BleServiceState;
  private config: Required<BleServiceConfig>;
  private callbacks: BleServiceCallbacks;
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private updateInterval: NodeJS.Timeout | null = null;

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

  // Public API methods
  public async scanAndConnect(): Promise<BleDevice | null> {
    if (!this.isBluetoothAvailable()) {
      this.handleError('PERMISSION_DENIED', 'Bluetooth not available or permission denied');
      return null;
    }

    try {
      this.updateStatus('scanning');
      this.state.isScanning = true;
      this.notifyStatusChange();

      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: [...DEVICE_FILTERS.ACCEPTED_SERVICES] as BluetoothServiceUUID[] }
        ],
        optionalServices: [
          BLE_SERVICES.CYCLING_POWER,
          BLE_SERVICES.HEART_RATE,
          BLE_SERVICES.DEVICE_INFORMATION
        ]
      });

      this.state.isScanning = false;
      
      if (device) {
        return await this.connectToDevice(device);
      }
      
      return null;
    } catch (error) {
      this.state.isScanning = false;
      this.handleError('CONNECTION_FAILED', (error as Error).message);
      return null;
    }
  }

  public async connectToDevice(device: BluetoothDevice): Promise<BleDevice | null> {
    try {
      this.updateStatus('connecting');
      
      this.device = device;
      this.server = await device.gatt?.connect() || null;

      if (!this.server) {
        throw new Error('Failed to connect to GATT server');
      }

      const bleDevice: BleDevice = {
        id: device.id,
        name: device.name || 'Unknown Device',
        rssi: 0, // Not available in Web Bluetooth API
        connected: true,
        services: await this.discoverServices()
      };

      this.state.device = bleDevice;
      this.updateStatus('connected');
      this.state.isConnected = true;
      
      await this.setupNotifications();
      this.startMetricsUpdates();
      
      // Save device to memory for quick reconnect
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
    if (this.server) {
      this.server.disconnect();
      this.server = null;
    }
    
    if (this.device) {
      this.device = null;
    }
    
    this.stopMetricsUpdates();
    this.updateStatus('disconnected');
    this.state.isConnected = false;
    
    // Get device ID before clearing state
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
    return typeof navigator !== 'undefined' && 
           navigator.bluetooth !== undefined &&
           typeof navigator.bluetooth.requestDevice === 'function';
  }

  private defaultDeviceFilter(device: BleDevice): boolean {
    const name = device.name.toLowerCase();
    return DEVICE_FILTERS.ACCEPTED_NAMES.some(accepted => 
      name.includes(accepted.toLowerCase())
    );
  }

  private async discoverServices(): Promise<string[]> {
    if (!this.server) return [];
    
    try {
      const services = await this.server.getPrimaryServices();
      return services.map(service => service.uuid);
    } catch (error) {
      console.warn('Failed to discover services:', error);
      return [];
    }
  }

  private async setupNotifications(): Promise<void> {
    if (!this.server) return;

    try {
      // Setup power measurements
      const powerService = await this.server.getPrimaryService(BLE_SERVICES.CYCLING_POWER);
      const powerCharacteristic = await powerService.getCharacteristic(
        BLE_CHARACTERISTICS.CYCLING_POWER_MEASUREMENT
      );
      await powerCharacteristic.startNotifications();
      powerCharacteristic.addEventListener('characteristicvaluechanged', 
        this.handlePowerData.bind(this));

      // Setup heart rate measurements
      const hrService = await this.server.getPrimaryService(BLE_SERVICES.HEART_RATE);
      const hrCharacteristic = await hrService.getCharacteristic(
        BLE_CHARACTERISTICS.HEART_RATE_MEASUREMENT
      );
      await hrCharacteristic.startNotifications();
      hrCharacteristic.addEventListener('characteristicvaluechanged',
        this.handleHeartRateData.bind(this));

    } catch (error) {
      console.warn('Failed to setup notifications:', error);
    }
  }

  private handlePowerData(event: Event): void {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic;
    if (characteristic?.value) {
      this.parseAndEmitMetrics({ power: characteristic.value });
    }
  }

  private handleHeartRateData(event: Event): void {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic;
    if (characteristic?.value) {
      this.parseAndEmitMetrics({ heartRate: characteristic.value });
    }
  }

  private parseAndEmitMetrics(rawData: RawBleData): void {
    try {
      const metrics = this.parseFitnessMetrics(rawData);
      this.state.metrics = metrics;
      this.callbacks.onMetricsUpdate?.(metrics);
    } catch (error) {
      this.handleError('PARSING_ERROR', (error as Error).message);
    }
  }

  private parseFitnessMetrics(rawData: RawBleData): FitnessMetrics {
    const now = Date.now();
    
    return {
      power: rawData.power ? this.parsePowerData(rawData.power) : (this.state.metrics?.power || 0),
      cadence: rawData.cadence ? this.parseCadenceData(rawData.cadence) : (this.state.metrics?.cadence || 0),
      heartRate: rawData.heartRate ? this.parseHeartRateData(rawData.heartRate) : (this.state.metrics?.heartRate || 0),
      speed: rawData.speed ? this.parseSpeedData(rawData.speed) : (this.state.metrics?.speed || 0),
      distance: rawData.distance ? this.parseDistanceData(rawData.distance) : (this.state.metrics?.distance || 0),
      timestamp: now
    };
  }

  // Data parsing methods (simplified - would need full FTMS specification)
  private parsePowerData(data: DataView): number {
    // Simplified parsing - actual implementation would follow FTMS spec
    return data.getUint16(0, true) * DATA_CONFIG.POWER_SCALE;
  }

  private parseCadenceData(data: DataView): number {
    return data.getUint16(0, true) * DATA_CONFIG.CADENCE_SCALE;
  }

  private parseHeartRateData(data: DataView): number {
    const flags = data.getUint8(0);
    const is16Bit = (flags & 0x01) === 0x01;
    return is16Bit ? data.getUint16(1, true) : data.getUint8(1);
  }

  private parseSpeedData(data: DataView): number {
    return data.getUint16(0, true) / 100; // km/h
  }

  private parseDistanceData(data: DataView): number {
    return data.getUint32(0, true) / 1000; // km
  }

  private startMetricsUpdates(): void {
    this.stopMetricsUpdates();
    this.updateInterval = setInterval(() => {
      // Trigger any periodic updates or state checks
      if (this.state.device && !this.state.isConnected) {
        this.reconnect();
      }
    }, this.config.updateInterval);
  }

  private stopMetricsUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  private async reconnect(): Promise<void> {
    if (!this.config.autoReconnect || !this.device) return;
    
    for (let i = 0; i < this.config.reconnectAttempts; i++) {
      try {
        await this.connectToDevice(this.device);
        return;
      } catch (error) {
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
      this.updateStatus('connecting');
      
      // Try to connect to the saved device
      // Note: Web Bluetooth can't directly connect by ID, need to scan and match
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: [...DEVICE_FILTERS.ACCEPTED_SERVICES] as BluetoothServiceUUID[] }
        ],
        optionalServices: [
          BLE_SERVICES.CYCLING_POWER,
          BLE_SERVICES.HEART_RATE,
          BLE_SERVICES.DEVICE_INFORMATION
        ]
      });

      // Check if it's the same device we want
      if (device.id === lastDevice.id) {
        this.state.isScanning = false;
        const connected = await this.connectToDevice(device);
        return !!connected;
      }

      // Different device - connect anyway (user may have swapped)
      this.state.isScanning = false;
      const connected = await this.connectToDevice(device);
      return !!connected;
      
    } catch (error) {
      this.state.isScanning = false;
      this.handleError('CONNECTION_FAILED', (error as Error).message);
      return false;
    }
  }
}

// Export singleton instance
export const bleService = BleService.getInstance();
