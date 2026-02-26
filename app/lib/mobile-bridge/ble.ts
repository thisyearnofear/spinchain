// Mobile BLE Bridge - Unified BLE interface for web + native
// Works with Web Bluetooth (desktop) or Capacitor BLE (mobile native)

import { isNativeApp, hasNativeBluetooth } from './platform';
import { bleService } from '../ble/service';
import type { FitnessMetrics, BleDevice, SavedDevice, ConnectionStatus, ConnectionQuality } from '../ble/types';

// Re-export types for convenience
export type { FitnessMetrics, BleDevice, SavedDevice, ConnectionStatus, ConnectionQuality };

// Unified BLE interface
export interface UnifiedBleService {
  // State
  getMetrics(): FitnessMetrics | null;
  getStatus(): ConnectionStatus;
  getDevice(): BleDevice | null;
  getConnectionQuality(): ConnectionQuality;
  getSavedDevices(): SavedDevice[];
  
  // Actions
  scanAndConnect(): Promise<BleDevice | null>;
  connect(): Promise<BleDevice | null>;
  disconnect(): void;
  autoConnect(): Promise<boolean>;
  removeSavedDevice(deviceId: string): void;
  clearSavedDevices(): void;
}

// Web Bluetooth implementation (existing)
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
  
  removeSavedDevice(deviceId: string): void {
    bleService.removeSavedDevice(deviceId);
  }
  
  clearSavedDevices(): void {
    bleService.clearSavedDevices();
  }
}

// Native BLE implementation (Capacitor - placeholder for when package is installed)
class NativeBleService implements UnifiedBleService {
  private metrics: FitnessMetrics | null = null;
  private status: ConnectionStatus = 'disconnected';
  private device: BleDevice | null = null;
  
  // TODO: Implement with @capacitor-community/bluetooth-le
  // For now, this is a placeholder that shows what native would look like
  
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
    // Native BLE would use actual RSSI
    if (this.status === 'connected' && this.metrics) {
      return { strength: 'excellent', percentage: 100, label: 'Excellent' };
    }
    return { strength: 'none', percentage: 0, label: 'No connection' };
  }
  
  getSavedDevices(): SavedDevice[] {
    // Use same localStorage as web
    try {
      const stored = localStorage.getItem('spinchain:saved-devices');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }
  
  async scanAndConnect(): Promise<BleDevice | null> {
    // TODO: Implement native BLE scan
    console.warn('[NativeBLE] Not implemented - install @capacitor-community/bluetooth-le');
    this.status = 'error';
    return null;
  }
  
  async connect(): Promise<BleDevice | null> {
    return this.scanAndConnect();
  }
  
  disconnect(): void {
    this.status = 'disconnected';
    this.device = null;
    this.metrics = null;
  }
  
  async autoConnect(): Promise<boolean> {
    const saved = this.getSavedDevices();
    if (saved.length === 0) return false;
    return this.scanAndConnect().then(d => !!d);
  }
  
  removeSavedDevice(deviceId: string): void {
    const saved = this.getSavedDevices().filter(d => d.id !== deviceId);
    localStorage.setItem('spinchain:saved-devices', JSON.stringify(saved));
  }
  
  clearSavedDevices(): void {
    localStorage.removeItem('spinchain:saved-devices');
  }
}

// Factory function - returns appropriate implementation based on platform
let bleInstance: UnifiedBleService | null = null;

export function getUnifiedBleService(): UnifiedBleService {
  if (!bleInstance) {
    if (isNativeApp()) {
      console.log('[BLE] Using Native BLE (Capacitor)');
      bleInstance = new NativeBleService();
    } else {
      console.log('[BLE] Using Web Bluetooth');
      bleInstance = new WebBleService();
    }
  }
  return bleInstance;
}

// React hook for unified BLE
export function useUnifiedBle() {
  const service = getUnifiedBleService();
  
  return {
    // State getters
    metrics: service.getMetrics(),
    status: service.getStatus(),
    device: service.getDevice(),
    connectionQuality: service.getConnectionQuality(),
    savedDevices: service.getSavedDevices(),
    
    // Actions
    scanAndConnect: service.scanAndConnect.bind(service),
    connect: service.connect.bind(service),
    disconnect: service.disconnect.bind(service),
    autoConnect: service.autoConnect.bind(service),
    removeSavedDevice: service.removeSavedDevice.bind(service),
    clearSavedDevices: service.clearSavedDevices.bind(service),
  };
}

// Check if BLE is available on current platform
export function isBleAvailable(): boolean {
  if (isNativeApp()) {
    return true; // Native has BLE
  }
  return hasNativeBluetooth(); // Web has Web Bluetooth
}

// Get recommended connection method
export function getConnectionRecommendation(): {
  method: 'native' | 'web' | 'none';
  message: string;
  action?: string;
} {
  const info = isNativeApp();
  
  if (info) {
    return {
      method: 'native',
      message: 'Using native Bluetooth for best experience',
      action: 'Connect your bike'
    };
  }
  
  if (hasNativeBluetooth()) {
    return {
      method: 'web',
      message: 'Web Bluetooth available',
      action: 'Scan for devices'
    };
  }
  
  return {
    method: 'none',
    message: 'Bluetooth not available in this browser',
    action: 'Use desktop Chrome for BLE'
  };
}
