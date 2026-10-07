import { test, expect } from "@playwright/test";

/**
 * A whole ride on a paired bike, with no simulator and no test hooks.
 *
 * `navigator.bluetooth` is replaced by a fake FTMS smart bike (Fitness Machine
 * Indoor Bike Data 0x2AD2 + Heart Rate 0x2A37) so the real stack runs end to
 * end: the start screen's Connect bike → Capacitor BleClient (web) →
 * BleService/BleParser → useBleData → coordinator.ingestBleMetrics →
 * TelemetryEngine's effort derivation → ride summary, coach memory and the
 * journey tier. The rider never touches the keyboard: if the bike's effort
 * didn't reach the coordinator, the practice route wouldn't move and the
 * ride would never finish.
 *
 * Receipt-first: the saved ride must read as *progress saved* only — no
 * proof verified, no settlement attempted.
 */

const LOCAL_ORIGIN = "http://127.0.0.1:3210";
const BIKE_NAME = "KICKR BIKE FAKE";
const WATTS = 245;
const HEART_RATE = 152;
// calculateEffortScore at these readings (HR weighted 0.6, power 0.4, each
// zone score capped at 500): 0.6 * 380 + 0.4 * 500.
const EXPECTED_EFFORT = 428;

test("a ride on a paired bike saves the bike's effort to progression", async ({ page }) => {
  test.setTimeout(240_000);

  const errors: string[] = [];
  page.on("pageerror", (e) => {
    // troika-three-text fetches fallback glyphs from a CDN, which the
    // loopback policy below aborts. That's the test's network, not the ride.
    if (/getFontsForString/.test(e.stack ?? "")) return;
    errors.push(String(e).slice(0, 200));
  });
  await page.route("**", (route) => {
    const url = route.request().url();
    return url.startsWith(LOCAL_ORIGIN) || url.startsWith("data:") || url.startsWith("blob:")
      ? route.continue()
      : route.abort();
  });
  await page.routeWebSocket("**", (socket) => socket.close());

  await page.addInitScript(
    ({ name, watts, heartRate }) => {
      try {
        window.localStorage.setItem("spinchain:onboarding:ride-tutorial", "true");
      } catch {
        // storage may be unavailable during prerender
      }

      const FTMS = "00001826-0000-1000-8000-00805f9b34fb";
      const INDOOR_BIKE_DATA = "00002ad2-0000-1000-8000-00805f9b34fb";
      const HR_SERVICE = "0000180d-0000-1000-8000-00805f9b34fb";
      const HR_MEASUREMENT = "00002a37-0000-1000-8000-00805f9b34fb";
      const notFound = () => new DOMException("No such service/characteristic", "NotFoundError");
      const props = { notify: true, read: false, write: false, writeWithoutResponse: false, broadcast: false, indicate: false, authenticatedSignedWrites: false, reliableWrite: false, writableAuxiliaries: false };

      const indoorBikeData = () => {
        // Flags 0x0044: instant speed (bit 0 clear), cadence (bit 2), power (bit 6).
        const v = new DataView(new ArrayBuffer(8));
        v.setUint16(0, 0x0044, true);
        v.setUint16(2, 3150, true); // 31.5 km/h
        v.setUint16(4, 88 * 2, true); // 88 rpm in 0.5 rpm
        v.setInt16(6, watts, true);
        return v;
      };
      const hrMeasurement = () => new DataView(new Uint8Array([0x00, heartRate]).buffer);

      const device = Object.assign(new EventTarget(), { id: "fake-kickr", name }) as EventTarget & {
        id: string;
        name: string;
        gatt: unknown;
      };
      const timers: number[] = [];
      const makeService = (uuid: string, charUuid: string, read: () => DataView) => {
        const service = { uuid, device, isPrimary: true } as Record<string, unknown>;
        const characteristic = Object.assign(new EventTarget(), {
          uuid: charUuid,
          service,
          properties: props,
          value: null as DataView | null,
          async startNotifications() {
            timers.push(
              window.setInterval(() => {
                characteristic.value = read();
                characteristic.dispatchEvent(new Event("characteristicvaluechanged"));
              }, 250),
            );
            return characteristic;
          },
          async stopNotifications() {
            return characteristic;
          },
          async getDescriptors() {
            return [];
          },
        });
        service.getCharacteristic = async (u: string) => {
          if (u.toLowerCase() !== charUuid) throw notFound();
          return characteristic;
        };
        service.getCharacteristics = async () => [characteristic];
        return service;
      };
      const services = [
        makeService(FTMS, INDOOR_BIKE_DATA, indoorBikeData),
        makeService(HR_SERVICE, HR_MEASUREMENT, hrMeasurement),
      ];
      const gatt = {
        device,
        connected: false,
        async connect() {
          gatt.connected = true;
          return gatt;
        },
        disconnect() {
          gatt.connected = false;
          timers.splice(0).forEach((t) => clearInterval(t));
          device.dispatchEvent(new Event("gattserverdisconnected"));
        },
        async getPrimaryService(uuid: string) {
          const found = services.find((s) => s.uuid === String(uuid).toLowerCase());
          if (!found) throw notFound();
          return found;
        },
        async getPrimaryServices() {
          return services;
        },
      };
      device.gatt = gatt;

      Object.defineProperty(navigator, "bluetooth", {
        configurable: true,
        value: Object.assign(new EventTarget(), {
          async getAvailability() {
            return true;
          },
          async requestDevice() {
            return device;
          },
          async getDevices() {
            return [device];
          },
        }),
      });
    },
    { name: BIKE_NAME, watts: WATTS, heartRate: HEART_RATE },
  );

  await page.goto("/rider/ride/demo", { waitUntil: "domcontentloaded" });
  // 2D Focus: software WebGL here renders 3D at a fraction of a frame per
  // second (same reason as device-ingest.spec.ts).
  const focus = page.getByRole("button", { name: "Switch to 2D Focus view" });
  await expect(focus).toBeVisible({ timeout: 30_000 });
  if ((await focus.getAttribute("aria-pressed")) !== "true") await focus.click();
  await page.getByRole("button", { name: "45 s" }).click();

  await page.getByRole("button", { name: "Connect bike" }).click();
  await expect(page.getByTestId("bike-status")).toHaveText(`${BIKE_NAME} connected`, { timeout: 15_000 });
  await expect(page.getByText("Pedal your bike to ride")).toBeVisible();

  const start = page.getByRole("button", { name: "Start ride", exact: true });
  await start.click();
  await expect(start).toBeHidden({ timeout: 30_000 });

  // The simulator is gone: no on-screen pedals, and no keyboard input is
  // sent at any point. Only the bike can move this ride.
  await expect(page.getByRole("button", { name: /^Left L$/ })).toHaveCount(0);
  await expect(page.getByTestId("ride-completion")).toBeVisible({ timeout: 180_000 });

  const ride = await page.evaluate(() => {
    const history = JSON.parse(localStorage.getItem("spinchain:rides:history:v2") ?? "[]");
    return Array.isArray(history) ? history[0] : (history.rides ?? [])[0];
  });
  expect(ride, "the finished ride must be saved locally").toBeTruthy();
  expect(ride.telemetrySource).toBe("live-bike");
  expect(ride.avgPower).toBeGreaterThan(WATTS * 0.8);
  expect(ride.avgHeartRate).toBeGreaterThan(HEART_RATE * 0.8);
  // A few 1 Hz samples can land before the first notification, so allow a
  // little under the steady-state score, never over.
  expect(ride.avgEffort).toBeGreaterThan(EXPECTED_EFFORT * 0.8);
  expect(ride.avgEffort).toBeLessThanOrEqual(EXPECTED_EFFORT);
  // Progress saved — not verified, not redeemed.
  expect(ride.proof).toMatchObject({ status: "idle", isVerified: false });
  expect(ride.settlement).toMatchObject({ attempted: false, status: "skipped" });

  const memory = await page.waitForFunction(
    () => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) ?? "";
        if (key.startsWith("spinchain:coach-memory:guest:") && key.endsWith(":cache")) {
          return JSON.parse(localStorage.getItem(key) ?? "null")?.memory ?? null;
        }
      }
      return null;
    },
    undefined,
    { timeout: 15_000 },
  );
  expect(await memory.jsonValue(), "coach memory must record the bike ride").toMatchObject({
    rides: 1,
    bestAvgPower: ride.avgPower,
  });

  await page.goto("/rider/journey", { waitUntil: "domcontentloaded" });
  // The journey tier is derived from saved rides; the card may sit in a
  // collapsed section, so assert it rendered rather than that it's on screen.
  await expect(page.getByText(`Avg effort ${ride.avgEffort}/1000 across 1 rides.`)).toBeAttached({
    timeout: 30_000,
  });

  expect(errors, `page errors: ${JSON.stringify(errors)}`).toEqual([]);
});
