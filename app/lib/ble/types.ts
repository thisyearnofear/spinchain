// BLE Types - Single source of truth for all BLE-related types
// Following DRY principle: All types centralized

// Core BLE device interface
export interface BleDevice {
  id: string;
  name: string;
  rssi: number;
  connected: boolean;
  services: string[];
}

// Raw BLE data from device
export interface RawBleData {
  power?: DataView;
  cadence?: DataView;
  heartRate?: DataView;
  speed?: DataView;
  distance?: DataView;
}

// Parsed fitness metrics
export interface FitnessMetrics {
  power: number; // watts
  cadence: number; // RPM
  heartRate: number; // BPM
  speed: number; // km/h
  distance: number; // km
  timestamp: number; // Unix timestamp
}

// Connection status states
export type ConnectionStatus = 
  | 'disconnected'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'error';

// Error types specific to BLE
export type BleErrorType = 
  | 'PERMISSION_DENIED'
  | 'DEVICE_NOT_FOUND'
  | 'CONNECTION_FAILED'
  | 'SERVICE_NOT_FOUND'
  | 'CHARACTERISTIC_NOT_FOUND'
  | 'NOTIFICATION_FAILED'
  | 'PARSING_ERROR'
  | 'UNKNOWN';

// BLE error interface
export interface BleError {
  type: BleErrorType;
  message: string;
  device?: string;
  timestamp: number;
}

// Configuration options for BLE service
export interface BleServiceConfig {
  autoReconnect?: boolean;
  reconnectAttempts?: number;
  updateInterval?: number;
  filterDevices?: (device: BleDevice) => boolean;
}

// Service state
export interface BleServiceState {
  status: ConnectionStatus;
  device: BleDevice | null;
  metrics: FitnessMetrics | null;
  error: BleError | null;
  isScanning: boolean;
  isConnected: boolean;
}

// Callback functions for service events
export interface BleServiceCallbacks {
  onMetricsUpdate?: (metrics: FitnessMetrics) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
  onError?: (error: BleError) => void;
  onDeviceConnected?: (device: BleDevice) => void;
  onDeviceDisconnected?: (deviceId: string) => void;
}