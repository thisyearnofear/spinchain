import type { FitnessMetrics } from './types';

export class BleParser {
  /**
   * Parse FTMS Indoor Bike Data (0x2AD2).
   */
  public static parseIndoorBikeData(value: DataView): Partial<FitnessMetrics> {
    const parsed: Partial<FitnessMetrics> = {};
    let offset = 0;
    const flags = value.getUint16(offset, true);
    offset += 2;

    // Bit 0 = 0 means instant speed present (Uint16, 0.01 km/h)
    if ((flags & (1 << 0)) === 0) {
      parsed.speed = Number((value.getUint16(offset, true) * 0.01).toFixed(2));
      offset += 2;
    }

    // Bit 1 average speed present (skip)
    if ((flags & (1 << 1)) !== 0) offset += 2;

    // Bit 2 instant cadence present (Uint16, 0.5 rpm)
    if ((flags & (1 << 2)) !== 0) {
      parsed.cadence = Math.floor(value.getUint16(offset, true) * 0.5);
      offset += 2;
    }

    // Bit 3 average cadence present (skip)
    if ((flags & (1 << 3)) !== 0) offset += 2;

    // Bit 4 total distance present (Uint24, meters)
    if ((flags & (1 << 4)) !== 0) {
      const low = value.getUint16(offset, true);
      const high = value.getUint8(offset + 2);
      const meters = (high << 16) | low;
      parsed.distance = Number((meters / 1000).toFixed(3));
      offset += 3;
    }

    // Bit 5 resistance level present (skip)
    if ((flags & (1 << 5)) !== 0) offset += 2;

    // Bit 6 instant power present (Sint16, watts)
    if ((flags & (1 << 6)) !== 0) {
      parsed.power = value.getInt16(offset, true);
      offset += 2;
    }

    // Bit 7 average power present (skip)
    if ((flags & (1 << 7)) !== 0) offset += 2;

    // Bit 8 expended energy present (skip 5 bytes)
    if ((flags & (1 << 8)) !== 0) offset += 5;

    // Bit 9 heart rate present (Uint8 bpm)
    if ((flags & (1 << 9)) !== 0) {
      parsed.heartRate = value.getUint8(offset);
    }

    return parsed;
  }

  /**
   * Parse standard Heart Rate Measurement (0x2A37).
   */
  public static parseHeartRate(value: DataView): number {
    const flags = value.getUint8(0);
    const is16Bit = (flags & 0x01) === 0x01;
    return is16Bit ? value.getUint16(1, true) : value.getUint8(1);
  }

  /**
   * Parse Cycling Power Measurement (0x2A63).
   */
  public static parseCyclingPower(value: DataView): Partial<FitnessMetrics> {
    if (value.byteLength < 4) return {};
    return { power: value.getInt16(2, true) };
  }
}
