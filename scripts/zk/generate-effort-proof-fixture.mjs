// Generates the Foundry fixture for EffortThresholdVerifier integration tests
// (real UltraHonk proofs from synthetic telemetry, beta.22 toolchain).
// Usage: node scripts/zk/generate-effort-proof-fixture.mjs [--check-toolchain]
// Output: contracts/evm/test/fixtures/effort_proof.json

import {
  mkdtempSync,
  cpSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CIRCUIT_DIR = join(root, "circuits/effort_threshold");
const SHIPPED_ARTIFACT = join(
  root,
  "public/circuits/effort_threshold/target/effort_threshold.json",
);
const OUT_PATH = join(root, "contracts/evm/test/fixtures/effort_proof.json");
const BB_BIN = join(
  root,
  "node_modules/@aztec/bb.js/dest/node/bin/index.js",
);

// Must match VK_HASH in contracts/evm/src-honk/HonkVerifier.sol.
const EXPECTED_VK_HASH =
  "2183fc97ccd831ee6f7ac309ba555add98f6745e972b0a35cdddc70cd86fe6d6";

// Test rider identity (Foundry test address, not a real wallet).
const RIDER = "0x00000000000000000000000000000000000000f1";
const CLASS_ID =
  "0x" + Buffer.from("spinchain-fixture-class").toString("hex").padEnd(64, "0");

// Both cases output [1, 60, 1000] (avg effort saturates the 0-1000 scale).
const CASES = [
  { label: "hr160", heartRate: 160, threshold: 150, minDuration: 30 },
  { label: "hr170", heartRate: 170, threshold: 150, minDuration: 30 },
];

function toField(value) {
  return "0x" + BigInt(value).toString(16).padStart(64, "0");
}

function readPublicInputs(file) {
  const buf = readFileSync(file);
  const inputs = [];
  for (let i = 0; i + 32 <= buf.length; i += 32) {
    inputs.push(BigInt("0x" + buf.subarray(i, i + 32).toString("hex")));
  }
  return inputs;
}

async function main() {
  execFileSync("nargo", ["--version"], { stdio: "pipe" });

  // Copy only Nargo.toml + src — never target/ or .env.
  const work = mkdtempSync(join(tmpdir(), "effort-fixture-"));
  const dir = join(work, "effort_threshold");
  mkdirSync(dir, { recursive: true });
  cpSync(join(CIRCUIT_DIR, "Nargo.toml"), join(dir, "Nargo.toml"));
  cpSync(join(CIRCUIT_DIR, "src"), join(dir, "src"), { recursive: true });

  execFileSync("nargo", ["compile"], { cwd: dir, stdio: "inherit" });

  // Regenerate the keccak VK via bb write_vk from the freshly compiled
  // bytecode and check its hash against HonkVerifier.sol.
  execFileSync(
    process.execPath,
    [
      BB_BIN,
      "write_vk",
      "-b", "target/effort_threshold.json",
      "-o", "target/vk_fresh",
      "-t", "evm",
    ],
    { cwd: dir, stdio: "inherit" },
  );
  const vkHash = readFileSync(join(dir, "target/vk_fresh/vk_hash"))
    .toString("hex");
  if (vkHash !== EXPECTED_VK_HASH) {
    throw new Error(
      `VK hash mismatch: got ${vkHash}, expected ${EXPECTED_VK_HASH}. ` +
        "The local toolchain does not produce the circuit HonkVerifier.sol verifies.",
    );
  }

  const vkPath = join(dir, "target/vk_fresh/vk");

  // Witness generation mirrors the browser prover path (installed noir_js
  // against the shipped artifact).
  const { Noir } = await import("@noir-lang/noir_js");
  const circuit = JSON.parse(readFileSync(SHIPPED_ARTIFACT, "utf-8"));
  const noir = new Noir(circuit);

  if (process.argv.includes("--check-toolchain")) {
    const { returnValue } = await noir.execute({
      input: {
        heart_rates: new Array(60).fill(160),
        num_points: 60,
        threshold: 150,
        min_duration: 30,
      },
    });
    const rv = Array.isArray(returnValue)
      ? returnValue
      : [returnValue.threshold_met, returnValue.seconds_above, returnValue.effort_score];
    const outputs = rv.map((v) => Number(v === true ? 1 : v));
    if (outputs.join(",") !== "1,60,1000") {
      throw new Error(`Toolchain check failed: outputs=[${outputs}], expected [1,60,1000]`);
    }
    console.log(
      `[check-toolchain] VK hash ${vkHash} OK; witness outputs=[${outputs}]`,
    );
    return;
  }

  const proofs = [];
  for (const testCase of CASES) {
    const { witness } = await noir.execute({
      input: {
        heart_rates: new Array(60).fill(testCase.heartRate),
        num_points: 60,
        threshold: testCase.threshold,
        min_duration: testCase.minDuration,
      },
    });
    writeFileSync(join(dir, `target/witness_${testCase.label}.gz`), witness);
    execFileSync(
      process.execPath,
      [
        BB_BIN,
        "prove",
        "-b", "target/effort_threshold.json",
        "-w", `target/witness_${testCase.label}.gz`,
        "-k", vkPath,
        "-o", `target/proof_${testCase.label}`,
        "-t", "evm",
      ],
      { cwd: dir, stdio: "inherit" },
    );

    const proof = readFileSync(
      join(dir, `target/proof_${testCase.label}/proof`),
    );
    // [threshold_met, seconds_above, effort_score]
    const outputs = readPublicInputs(
      join(dir, `target/proof_${testCase.label}/public_inputs`),
    );
    if (outputs.length !== 3) {
      throw new Error(`Expected 3 public outputs, got ${outputs.length}`);
    }
    console.log(
      `[fixture] ${testCase.label}: outputs=[${outputs.join(", ")}] proofBytes=${proof.length}`,
    );

    // [threshold, minDuration, thresholdMet, secondsAbove, effortScore, classId, rider]
    proofs.push({
      label: testCase.label,
      proofHex: proof.toString("hex"),
      publicInputsHex: [
        toField(testCase.threshold),
        toField(testCase.minDuration),
        toField(outputs[0]),
        toField(outputs[1]),
        toField(outputs[2]),
        CLASS_ID,
        toField(BigInt(RIDER)),
      ].map((value) => value.slice(2)),
    });
  }

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(
    OUT_PATH,
    JSON.stringify({ rider: RIDER, classIdHex: CLASS_ID.slice(2), proofs }, null, 2) + "\n",
  );
  console.log(`[fixture] wrote ${OUT_PATH}`);
}

main();
