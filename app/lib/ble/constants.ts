// BLE Constants - Single source of truth for all BLE-related values
// Following DRY principle: All UUIDs and constants in one place

// Fitness Machine Service (FTMS) UUIDs
export const BLE_SERVICES = {
  FITNESS_MACHINE: '00001826-0000-1000-8000-00805f9b34fb',
  CYCLING_POWER: '00001818-0000-1000-8000-00805f9b34fb',
  HEART_RATE: '0000180d-0000-1000-8000-00805f9b34fb',
  DEVICE_INFORMATION: '0000180a-0000-1000-8000-00805f9b34fb',
} as const;

// Characteristic UUIDs for FTMS
export const BLE_CHARACTERISTICS = {
  // Fitness Machine Service characteristics
  FITNESS_MACHINE_FEATURE: '00002acc-0000-1000-8000-00805f9b34fb',
  TRAINING_STATUS: '00002ad3-0000-1000-8000-00805f9b34fb',
  SUPPORTED_POWER_RANGE: '00002ad8-0000-1000-8000-00805f9b34fb',
  SUPPORTED_HEART_RATE_RANGE: '00002ad7-0000-1000-8000-00805f9b34fb',
  
  // Cycling Power Service characteristics
  CYCLING_POWER_MEASUREMENT: '00002a63-0000-1000-8000-00805f9b34fb',
  CYCLING_POWER_FEATURE: '00002a65-0000-1000-8000-00805f9b34fb',
  
  // Heart Rate Service characteristics
  HEART_RATE_MEASUREMENT: '00002a37-0000-1000-8000-00805f9b34fb',
  
  // Device Information characteristics
  MANUFACTURER_NAME: '00002a29-0000-1000-8000-00805f9b34fb',
  MODEL_NUMBER: '00002a24-0000-1000-8000-00805f9b34fb',
} as const;

// Device filtering criteria
export const DEVICE_FILTERS = {
  // Schwinn IC4 and similar fitness equipment
  ACCEPTED_NAMES: ['IC4', 'C6', 'Schwinn', 'Bowflex', 'Keiser', 'Peloton'],
  ACCEPTED_SERVICES: [BLE_SERVICES.FITNESS_MACHINE],
} as const;

// Connection parameters
export const CONNECTION_CONFIG = {
  SCAN_DURATION: 10000, // 10 seconds
  RECONNECT_ATTEMPTS: 3,
  RECONNECT_DELAY: 2000, // 2 seconds
  HEARTBEAT_INTERVAL: 5000, // 5 seconds
} as const;

// Data parsing configuration
export const DATA_CONFIG = {
  POWER_SCALE: 1, // Watts
  CADENCE_SCALE: 1, // RPM
  HEART_RATE_SCALE: 1, // BPM
  UPDATE_INTERVAL: 1000, // 1 second
} as const;