# SpinChain: BLE Integration

## BLE Fitness Equipment Integration Guide

### Overview
This integration enables your SpinChain web app to connect to Bluetooth Low Energy (BLE) fitness equipment like Schwinn IC4, Bowflex C6, and similar spin bikes that support the Fitness Machine Service (FTMS) protocol.

### Architecture Following Core Principles

#### 1. ENHANCEMENT FIRST
- Built upon existing responsive ride components
- Extended existing hook patterns (useTransaction → useBleData)
- Enhanced UI components with BLE status indicators

#### 2. AGGRESSIVE CONSOLIDATION
- Single BLE service instance (singleton pattern)
- Centralized error handling and parsing
- Unified configuration in constants file

#### 3. PREVENT BLOAT
- Modular file structure with clear separation
- Only essential features included
- No unnecessary dependencies

#### 4. DRY (Don't Repeat Yourself)
- Single source of truth for BLE UUIDs and constants
- Reused error handling patterns
- Centralized type definitions

#### 5. CLEAN Separation of Concerns
- Service layer: `app/lib/ble/service.ts`
- Hook layer: `app/lib/hooks/use-ble-data.ts`
- Component layer: `app/components/ble/`
- Type layer: `app/lib/ble/types.ts`

#### 6. MODULAR Design
- Composable components and hooks
- Independent modules with clear interfaces
- Testable service layer

#### 7. PERFORMANT
- Efficient connection management
- Caching of device information
- Optimized data parsing

#### 8. ORGANIZED
- Domain-driven file structure
- Predictable naming conventions
- Clear import/export patterns

### File Structure

```
app/
├── lib/
│   ├── ble/
│   │   ├── constants.ts      # BLE UUIDs and configuration
│   │   ├── service.ts        # Core BLE service (singleton)
│   │   ├── types.ts          # TypeScript interfaces
│   │   └── parser.ts         # Data parsing utilities
│   └── hooks/
│       ├── use-ble-data.ts   # Main BLE hook
│       └── ble.ts            # Hook exports
├── components/
│   └── ble/
│       ├── device-selector.tsx  # Device connection UI
│       └── index.ts             # Component exports
└── rider/ride/[classId]/
    └── enhanced-page.tsx        # BLE-integrated ride page
```

### Key Components

#### 1. BLE Service (`app/lib/ble/service.ts`)
- Singleton BLE connection manager
- Handles device scanning, connection, and data streaming
- Implements automatic reconnection
- Manages GATT service discovery

#### 2. useBleData Hook (`app/lib/hooks/use-ble-data.ts`)
- React hook following existing patterns
- Integrates with toast notifications
- Provides real-time metrics updates
- Handles connection state management

#### 3. DeviceSelector Component (`app/components/ble/device-selector.tsx`)
- UI component for device connection
- Visual feedback for connection status
- Real-time metrics display
- Error handling and recovery

#### 4. Enhanced Ride Page (`app/rider/ride/[classId]/enhanced-page.tsx`)
- Integration example showing BLE data in action
- Responsive design with device-specific layouts
- Real-time metrics overlay
- Slide-in device management panel

### Usage Examples

#### Basic Integration
```typescript
import { useBleData } from '@/lib/hooks/ble';

function MyComponent() {
  const {
    metrics,
    status,
    isConnected,
    scanAndConnect
  } = useBleData();

  return (
    <div>
      {isConnected && metrics && (
        <div>
          <p>Power: {metrics.power}W</p>
          <p>Heart Rate: {metrics.heartRate} BPM</p>
        </div>
      )}
      <button onClick={scanAndConnect}>
        Connect Device
      </button>
    </div>
  );
}
```

#### Advanced Integration with Error Handling
```typescript
import { useBleData } from '@/lib/hooks/ble';

function AdvancedComponent() {
  const {
    metrics,
    status,
    device,
    error,
    scanAndConnect,
    disconnect
  } = useBleData({
    autoConnect: false,
    onSuccess: (metrics) => {
      console.log('New metrics:', metrics);
      // Update your application state
    },
    onError: (error) => {
      console.error('BLE Error:', error);
      // Handle specific error cases
    }
  });

  // Render based on connection state
  if (status === 'connected') {
    return <ConnectedView metrics={metrics} device={device} onDisconnect={disconnect} />;
  }

  return <ConnectView onConnect={scanAndConnect} />;
}
```

### Supported Devices

The integration works with fitness equipment that supports:
- **Fitness Machine Service (FTMS)** - `00001826-0000-1000-8000-00805f9b34fb`
- **Cycling Power Service** - `00001818-0000-1000-8000-00805f9b34fb`
- **Heart Rate Service** - `0000180d-0000-1000-8000-00805f9b34fb`

Tested devices include:
- Schwinn IC4
- Bowflex C6
- Other FTMS-compatible equipment

### Browser Requirements

- **Chrome/Edge**: Full Web Bluetooth support
- **Safari**: Limited support (iOS 16+)
- **Firefox**: No Web Bluetooth support

### Error Handling

The system provides comprehensive error handling:
- Permission denied errors
- Device not found
- Connection failures
- Service/characteristic not found
- Data parsing errors

Errors are categorized and provide user-friendly messages through the existing toast system.

### Performance Considerations

- **Connection Management**: Efficient reconnection with exponential backoff
- **Data Updates**: Configurable update intervals (default: 1 second)
- **Memory Usage**: Proper cleanup of event listeners and intervals
- **Battery Optimization**: Smart scanning with timeout limits

### Testing

To test the integration:
1. Ensure you have a compatible BLE device
2. Use Chrome/Edge browser on desktop
3. Grant Bluetooth permissions when prompted
4. Test connection and data streaming

### Future Enhancements

Potential areas for expansion:
- Additional fitness equipment protocols
- Advanced metrics analysis
- Workout data logging and export
- Integration with fitness tracking services
- Multi-device support

### Troubleshooting

#### Common Issues:
1. **Device not found**: Ensure device is powered on and in pairing mode
2. **Connection fails**: Check browser compatibility and Bluetooth permissions
3. **No data**: Verify device supports required GATT services
4. **Performance issues**: Adjust update intervals in configuration

#### Debug Information:
Enable development mode to see detailed connection logs and device information in the component debug panel.