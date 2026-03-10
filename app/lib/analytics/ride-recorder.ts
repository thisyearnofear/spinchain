/**
 * RideRecorder - Record and export session data
 * 
 * CORE FEATURE: TCX (Training Center XML) Export
 * Generates industry-standard activity files for Strava, Garmin, etc.
 */

import type { FitnessMetrics } from "../ble/types";

export interface RideRecordPoint {
  timestamp: number;
  heartRate: number;
  power: number;
  cadence: number;
  speed: number;
  distance: number;
  latitude?: number;
  longitude?: number;
  altitude?: number;
}

export interface RideRecordMetadata {
  id: string;
  name: string;
  startTime: number;
  instructor?: string;
  notes?: string;
}

/**
 * Generates a TCX XML string from a list of record points.
 * TCX is widely supported and easier to generate in JS than binary FIT.
 */
export function generateTCX(metadata: RideRecordMetadata, points: RideRecordPoint[]): string {
  const startISO = new Date(metadata.startTime).toISOString();
  const totalTime = points.length > 0 ? (points[points.length - 1].timestamp - points[0].timestamp) / 1000 : 0;
  const totalDistance = points.length > 0 ? points[points.length - 1].distance * 1000 : 0;
  const maxHr = Math.max(...points.map(p => p.heartRate), 0);
  const avgHr = points.length > 0 ? Math.round(points.reduce((s, p) => s + p.heartRate, 0) / points.length) : 0;

  let trackpoints = "";
  points.forEach(p => {
    const iso = new Date(p.timestamp).toISOString();
    trackpoints += `
            <Trackpoint>
              <Time>${iso}</Time>
              ${p.latitude && p.longitude ? `
              <Position>
                <LatitudeDegrees>${p.latitude}</LatitudeDegrees>
                <LongitudeDegrees>${p.longitude}</LongitudeDegrees>
              </Position>` : ""}
              ${p.altitude ? `<AltitudeMeters>${p.altitude}</AltitudeMeters>` : ""}
              <DistanceMeters>${(p.distance * 1000).toFixed(1)}</DistanceMeters>
              <HeartRateBpm>
                <Value>${p.heartRate}</Value>
              </HeartRateBpm>
              <Cadence>${p.cadence}</Cadence>
              <Extensions>
                <TPX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2">
                  <Watts>${p.power}</Watts>
                  <Speed>${(p.speed / 3.6).toFixed(2)}</Speed>
                </TPX>
              </Extensions>
            </Trackpoint>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase 
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" 
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Activities>
    <Activity Sport="Biking">
      <Id>${startISO}</Id>
      <Lap StartTime="${startISO}">
        <TotalTimeSeconds>${totalTime.toFixed(1)}</TotalTimeSeconds>
        <DistanceMeters>${totalDistance.toFixed(1)}</DistanceMeters>
        <MaximumHeartRateBpm>
          <Value>${maxHr}</Value>
        </MaximumHeartRateBpm>
        <AverageHeartRateBpm>
          <Value>${avgHr}</Value>
        </AverageHeartRateBpm>
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>
          ${trackpoints}
        </Track>
        <Notes>${metadata.name}${metadata.instructor ? ` with ${metadata.instructor}` : ""}</Notes>
      </Lap>
      <Creator xsi:type="Device_t">
        <Name>SpinChain AI</Name>
        <UnitId>0</UnitId>
        <ProductID>0</ProductID>
        <Version>
          <VersionMajor>1</VersionMajor>
          <VersionMinor>0</VersionMinor>
        </Version>
      </Creator>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;
}

/**
 * Triggers a browser download of the generated TCX file.
 */
export function downloadTCX(metadata: RideRecordMetadata, points: RideRecordPoint[]): void {
  const tcx = generateTCX(metadata, points);
  const blob = new Blob([tcx], { type: "application/vnd.garmin.tcx+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const filename = `ride-${metadata.id || Date.now()}.tcx`;
  
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
