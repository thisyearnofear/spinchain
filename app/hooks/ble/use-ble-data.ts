// useBLEData hook - Following existing hook patterns and Core Principles
// Enhancement First: Extends existing transaction patterns
// DRY: Reuses error handling and state management patterns

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { bleService } from "@/app/lib/ble/service";
import type { 
  FitnessMetrics, 
  ConnectionStatus, 
  BleError, 
  BleDevice,
  BleServiceCallbacks,
  SavedDevice,
  ConnectionQuality
} from "@/app/lib/ble/types";
import { useToast } from "@/app/components/ui/toast";

// Type for BLE transaction args (following useTransaction pattern)
interface BleTransactionArgs {
  action: 'connect' | 'disconnect' | 'scan';
  deviceId?: string;
}

interface UseBleDataOptions {
  autoConnect?: boolean;
  onSuccess?: (metrics: FitnessMetrics) => void;
  onError?: (error: BleError) => void;
}

interface UseBleDataReturn {
  // State
  metrics: FitnessMetrics | null;
  status: ConnectionStatus;
  device: BleDevice | null;
  error: BleError | null;
  isScanning: boolean;
  isConnected: boolean;
  savedDevices: SavedDevice[];
  connectionQuality: ConnectionQuality;
  
  // Actions
  connect: () => Promise<boolean>;
  disconnect: () => void;
  scanAndConnect: () => Promise<boolean>;
  quickConnect: () => Promise<boolean>;
  removeSavedDevice: (deviceId: string) => void;
  clearSavedDevices: () => void;
  clearError: () => void;
  
  // Loading states
  isPending: boolean;
}

export function useBleData(options: UseBleDataOptions = {}): UseBleDataReturn {
  const toast = useToast();
  const [metrics, setMetrics] = useState<FitnessMetrics | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [device, setDevice] = useState<BleDevice | null>(null);
  const [error, setError] = useState<BleError | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [savedDevices, setSavedDevices] = useState<SavedDevice[]>([]);
  
  const callbacksRef = useRef<BleServiceCallbacks>({});
  
  // Load saved devices on mount
  useEffect(() => {
    setSavedDevices(bleService.getSavedDevices());
  }, []);

  // Initialize service callbacks
  useEffect(() => {
    callbacksRef.current = {
      onMetricsUpdate: (newMetrics) => {
        setMetrics(newMetrics);
        options.onSuccess?.(newMetrics);
      },
      
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
        setIsScanning(newStatus === 'scanning');
        setIsConnected(newStatus === 'connected');
        setIsPending(newStatus === 'connecting' || newStatus === 'scanning');
      },
      
      onError: (bleError) => {
        setError(bleError);
        const parsedError = parseBleError(bleError);
        
        toast.error(
          parsedError.title,
          parsedError.message
        );
        
        options.onError?.(bleError);
      },
      
      onDeviceConnected: (connectedDevice) => {
        setDevice(connectedDevice);
        setSavedDevices(bleService.getSavedDevices()); // Refresh saved devices
        toast.success('Device Connected!', `${connectedDevice.name} is now connected`);
      },
      
      onDeviceDisconnected: (deviceId) => {
        setDevice(null);
        setMetrics(null);
        toast.info('Device Disconnected', 'Fitness equipment disconnected');
      }
    };

    bleService.setCallbacks(callbacksRef.current);

    return () => {
      bleService.setCallbacks({});
    };
  }, [toast, options.onSuccess, options.onError]);

  // Action methods - defined before useEffect to avoid reference issues
  const scanAndConnect = useCallback(async (): Promise<boolean> => {
    setIsPending(true);
    toast.loading('Scanning for devices...', 'Looking for fitness equipment');
    
    try {
      const connectedDevice = await bleService.scanAndConnect();
      setIsPending(false);
      return !!connectedDevice;
    } catch (err) {
      setIsPending(false);
      return false;
    }
  }, [toast]);

  const connect = useCallback(async (): Promise<boolean> => {
    setIsPending(true);
    toast.loading('Connecting to device...', 'Please wait');
    
    try {
      const connectedDevice = await bleService.scanAndConnect();
      setIsPending(false);
      return !!connectedDevice;
    } catch (err) {
      setIsPending(false);
      return false;
    }
  }, [toast]);

  // Auto-connect if requested
  useEffect(() => {
    if (options.autoConnect && status === 'disconnected') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      scanAndConnect();
    }
  }, [options.autoConnect, status, scanAndConnect]);

  const disconnect = useCallback((): void => {
    bleService.disconnect();
    setMetrics(null);
    setDevice(null);
    setError(null);
  }, []);

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  // Quick connect to last used device
  const quickConnect = useCallback(async (): Promise<boolean> => {
    const saved = bleService.getSavedDevices();
    if (saved.length === 0) {
      toast.info('No saved devices', 'Connect a device first to enable quick connect');
      return false;
    }
    
    setIsPending(true);
    toast.loading('Quick connecting...', `Connecting to ${saved[0].name}`);
    
    try {
      const connected = await bleService.autoConnect();
      setIsPending(false);
      return connected;
    } catch (err) {
      setIsPending(false);
      return false;
    }
  }, [toast]);
  
  // Remove a saved device
  const removeSavedDevice = useCallback((deviceId: string): void => {
    bleService.removeSavedDevice(deviceId);
    setSavedDevices(bleService.getSavedDevices());
  }, []);
  
  // Clear all saved devices
  const clearSavedDevices = useCallback((): void => {
    bleService.clearSavedDevices();
    setSavedDevices([]);
  }, []);
  
  // Get connection quality (computed from data freshness)
  const getConnectionQuality = useCallback(() => {
    return bleService.getConnectionQuality();
  }, []);
  
  // Return current state and actions
  return {
    // State
    metrics,
    status,
    device,
    error,
    isScanning,
    isConnected,
    savedDevices,
    connectionQuality: getConnectionQuality(),
    
    // Actions
    connect,
    disconnect,
    scanAndConnect,
    quickConnect,
    removeSavedDevice,
    clearSavedDevices,
    clearError,
    
    // Loading state
    isPending,
  };
}

// Error parsing utilities (following existing error pattern)
export type BleErrorCategory = 
  | 'PERMISSION_DENIED'
  | 'DEVICE_NOT_FOUND'
  | 'CONNECTION_FAILED'
  | 'SERVICE_NOT_FOUND'
  | 'CHARACTERISTIC_NOT_FOUND'
  | 'NOTIFICATION_FAILED'
  | 'PARSING_ERROR'
  | 'UNKNOWN';

export interface BleErrorDetails {
  category: BleErrorCategory;
  title: string;
  message: string;
  isRecoverable: boolean;
}

function categorizeBleError(error: BleError): BleErrorCategory {
  switch (error.type) {
    case 'PERMISSION_DENIED': return 'PERMISSION_DENIED';
    case 'DEVICE_NOT_FOUND': return 'DEVICE_NOT_FOUND';
    case 'CONNECTION_FAILED': return 'CONNECTION_FAILED';
    case 'SERVICE_NOT_FOUND': return 'SERVICE_NOT_FOUND';
    case 'CHARACTERISTIC_NOT_FOUND': return 'CHARACTERISTIC_NOT_FOUND';
    case 'NOTIFICATION_FAILED': return 'NOTIFICATION_FAILED';
    case 'PARSING_ERROR': return 'PARSING_ERROR';
    default: return 'UNKNOWN';
  }
}

const BLE_ERROR_MESSAGES: Record<BleErrorCategory, Omit<BleErrorDetails, 'category'>> = {
  PERMISSION_DENIED: {
    title: 'Bluetooth Permission Required',
    message: 'Please enable Bluetooth permissions in your browser settings.',
    isRecoverable: false,
  },
  DEVICE_NOT_FOUND: {
    title: 'Device Not Found',
    message: 'No compatible fitness equipment found. Make sure your device is nearby and powered on.',
    isRecoverable: true,
  },
  CONNECTION_FAILED: {
    title: 'Connection Failed',
    message: 'Unable to connect to the device. Please try again.',
    isRecoverable: true,
  },
  SERVICE_NOT_FOUND: {
    title: 'Service Not Available',
    message: 'Required fitness services not found on this device.',
    isRecoverable: false,
  },
  CHARACTERISTIC_NOT_FOUND: {
    title: 'Data Not Available',
    message: 'The device doesn\'t support the required data measurements.',
    isRecoverable: false,
  },
  NOTIFICATION_FAILED: {
    title: 'Data Stream Error',
    message: 'Failed to start real-time data streaming.',
    isRecoverable: true,
  },
  PARSING_ERROR: {
    title: 'Data Parsing Error',
    message: 'Received invalid data from the device.',
    isRecoverable: true,
  },
  UNKNOWN: {
    title: 'Connection Error',
    message: 'An unexpected error occurred with the fitness equipment.',
    isRecoverable: true,
  },
};

export function parseBleError(error: BleError): BleErrorDetails {
  const category = categorizeBleError(error);
  
  return {
    category,
    ...BLE_ERROR_MESSAGES[category],
  };
}