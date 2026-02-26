// Mobile Bridge - Unified mobile-native interface
// Provides platform detection and unified BLE access

export { 
  getPlatformInfo, 
  isNativeApp, 
  isMobile, 
  hasNativeBluetooth,
  type Platform,
  type PlatformInfo 
} from './platform';

export {
  getUnifiedBleService,
  useUnifiedBle,
  isBleAvailable,
  getConnectionRecommendation,
  type UnifiedBleService,
  // Re-export types
  type FitnessMetrics,
  type BleDevice,
  type SavedDevice,
  type ConnectionStatus,
  type ConnectionQuality
} from './ble';
