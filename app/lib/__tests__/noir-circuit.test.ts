// Executes the shipped compiled circuit under the installed @noir-lang/noir_js.
// Synthetic inputs only; no chain, no network.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Noir } from "@noir-lang/noir_js";

const circuit = JSON.parse(
  readFileSync(
    path.resolve(
      __dirname,
      "../../../public/circuits/effort_threshold/target/effort_threshold.json",
    ),
    "utf-8",
  ),
);

describe("shipped effort_threshold circuit executes on installed noir_js", () => {
  it("returns [1, 60, 1000] for 60x160bpm, threshold 150, min 30", async () => {
    const noir = new Noir(circuit);
    const { witness, returnValue } = await noir.execute({
      input: {
        heart_rates: new Array(60).fill(160),
        num_points: 60,
        threshold: 150,
        min_duration: 30,
      },
    });

    expect(witness).toBeInstanceOf(Uint8Array);
    expect(witness.length).toBeGreaterThan(0);

    const rv = returnValue as
      | { threshold_met: unknown; seconds_above: unknown; effort_score: unknown }
      | [unknown, unknown, unknown];
    const [thresholdMet, secondsAbove, effortScore] = Array.isArray(rv)
      ? rv
      : [rv.threshold_met, rv.seconds_above, rv.effort_score];
    expect(Number(thresholdMet === true ? 1 : thresholdMet)).toBe(1);
    expect(Number(secondsAbove)).toBe(60);
    expect(Number(effortScore)).toBe(1000);
  });
});
