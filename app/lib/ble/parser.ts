import { FitnessMetrics } from './types';

export class BleParser {
  /**
   * Parses FTMS (Fitness Machine Service) Indoor Bike Data (0x2AD2)
   * The structure is dynamic based on the Flags field (first 2 bytes).
   */
  public static parseIndoorBikeData(value: DataView): Partial<FitnessMetrics> {
    const result: Partial<FitnessMetrics> = {};
    let offset = 0;

    // 1. Read Flags (2 bytes, Little Endian)
    const flags = value.getUint16(offset, true);
    offset += 2;

    // Flag Bits (Reference: FTMS Specs)
    const moreData = (flags & (1 << 0)) === 0; // 0 = More Data NOT present (Instant Speed) ? No, Bit 0: 0=Instant Speed, 1=Avg Speed
    // Actually:
    // Bit 0: More Data (0 = Instant Speed, 1 = Average Speed is usually how it's defined in other specs, 
    // but in FTMS Indoor Bike:
    // Bit 0: 0 = Instant Speed present
    // Bit 1: 1 = Average Speed present
    // Bit 2: 1 = Instant Cadence present
    // Bit 3: 1 = Average Cadence present
    // Bit 4: 1 = Total Distance present
    // Bit 5: 1 = Resistance Level present
    // Bit 6: 1 = Instant Power present
    // Bit 7: 1 = Average Power present
    // Bit 8: 1 = Expended Energy present
    // Bit 9: 1 = Heart Rate present
    // Bit 10: 1 = Metabolic Equivalent present
    // Bit 11: 1 = Elapsed Time present
    // Bit 12: 1 = Remaining Time present

    // Let's strictly follow the bit sequence to increment offset
    
    // Bit 0: Instant Speed (Uint16, 0.01 km/h)
    // NOTE: If bit 0 is 0, Instant Speed IS present. Wait, FTMS spec says:
    // "Bit 0: More Data" is usually for other characteristics. 
    // For Indoor Bike Data 0x2AD2:
    // Bit 0: 0 = Instant Speed field is present.
    if ((flags & (1 << 0)) === 0) {
      const rawSpeed = value.getUint16(offset, true);
      result.speed = parseFloat((rawSpeed * 0.01).toFixed(2));
      offset += 2;
    }

    // Bit 1: Average Speed (Uint16, 0.01 km/h)
    if ((flags & (1 << 1)) !== 0) {
      // We skip reading it into our metrics for now, but must advance offset
      offset += 2;
    }

    // Bit 2: Instant Cadence (Uint16, 0.5 rpm)
    if ((flags & (1 << 2)) !== 0) {
      const rawCadence = value.getUint16(offset, true);
      result.cadence = Math.floor(rawCadence * 0.5);
      offset += 2;
    }

    // Bit 3: Average Cadence (Uint16, 0.5 rpm)
    if ((flags & (1 << 3)) !== 0) {
      offset += 2;
    }

    // Bit 4: Total Distance (Uint24, 1 meter)
    if ((flags & (1 << 4)) !== 0) {
      // Uint24 is 3 bytes. DataView doesn't have getUint24.
      const low = value.getUint16(offset, true);
      const high = value.getUint8(offset + 2);
      const rawDistance = (high << 16) | low;
      result.distance = parseFloat((rawDistance / 1000).toFixed(3)); // Convert to km
      offset += 3;
    }

    // Bit 5: Resistance Level (Sint16, unitless)
    if ((flags & (1 << 5)) !== 0) {
      offset += 2;
    }

    // Bit 6: Instant Power (Sint16, 1 Watt)
    if ((flags & (1 << 6)) !== 0) {
      const rawPower = value.getInt16(offset, true);
      result.power = rawPower;
      offset += 2;
    }

    // Bit 7: Average Power (Sint16, 1 Watt)
    if ((flags & (1 << 7)) !== 0) {
      offset += 2;
    }

    // Bit 8: Expended Energy (Total: Uint16, Per Hour: Uint16, Minute: Uint8) -> Total 5 bytes
    if ((flags & (1 << 8)) !== 0) {
      offset += 5; 
    }

    // Bit 9: Heart Rate (Uint8, 1 bpm)
    if ((flags & (1 << 9)) !== 0) {
      const rawHr = value.getUint8(offset);
      result.heartRate = rawHr;
      offset += 1;
    }
    
    // We stop here as we have the core metrics.
    
    return result;
  }

  /**
   * Parses standard Heart Rate Measurement (0x2A37)
   */
  public static parseHeartRate(value: DataView): number {
    const flags = value.getUint8(0);
    // Bit 0: 0 = Uint8, 1 = Uint16
    const is16Bit = (flags & 0x01) === 0x01;
    
    if (is16Bit) {
      return value.getUint16(1, true);
    }
    return value.getUint8(1);
  }

  /**
   * Parses Cycling Power Measurement (0x2A63)
   * This is a backup if FTMS is not used, but CPS (Cycling Power Service) is used.
   */
  public static parseCyclingPower(value: DataView): Partial<FitnessMetrics> {
    const result: Partial<FitnessMetrics> = {};
    let offset = 0;
    
    const flags = value.getUint16(offset, true);
    offset += 2;
    
    // Bits 0-5 define the content.
    // CPS is complex, but the mandatory field is Instant Power (Sint16) at the start
    
    const rawPower = value.getInt16(offset, true);
    result.power = rawPower;
    offset += 2;
    
    // Bit 0: Pedal Power Balance present
    if ((flags & (1 << 0)) !== 0) {
      offset += 1; // 1 byte? Actually it's usually 1 byte percentage
    }
    
    // Bit 1: Accumulated Torque present
    if ((flags & (1 << 1)) !== 0) {
        offset += 2; 
    }

    // Bit 2: Accumulated Torque Source (already handled in bit 1 logic usually) or distinct
    // Skipping complex CPS parsing for now as IC4 uses FTMS primarily.
    
    return result;
  }
}
