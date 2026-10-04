// @vitest-environment jsdom
// ZK claim reliability regression tests.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ZKProof } from "@/app/lib/zk/types";
import { getProver } from "@/app/lib/zk/prover";

const tx = vi.hoisted(() => ({
  write: vi.fn(),
  reset: vi.fn(),
  hash: undefined as `0x${string}` | undefined,
  isPending: false,
  isSuccess: false,
  error: null as Error | null,
}));

vi.mock("@/app/hooks/evm/use-transaction", () => ({
  useTransaction: () => tx,
}));

import { useZKClaim } from "@/app/hooks/evm/use-zk-claim";

const CLASS_ID = "0x7370696e636861696e2d636c61737300000000000000000000000000000000";
const RIDER = "0x1111111111111111111111111111111111111111";

function fakeNoirProof(score = 60): ZKProof {
  return {
    proof: new Uint8Array([1, 2, 3]),
    publicInputs: ["150", "30", "1", String(score), "1000", CLASS_ID, RIDER],
    circuitType: "effort_threshold",
    verifierAddress: "",
    backend: "noir",
  };
}

describe("useZKClaim", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_LEGACY_REWARD_CLAIMS", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    tx.write.mockClear();
    tx.reset.mockClear();
    tx.hash = undefined;
    tx.isPending = false;
    tx.isSuccess = false;
    tx.error = null;
  });

  it("rejects proof generation when no raw HR samples exist", async () => {
    const { result } = renderHook(() => useZKClaim());
    let outcome: Awaited<ReturnType<typeof result.current.generateProof>>;
    await act(async () => {
      outcome = await result.current.generateProof({
        heartRate: 160,
        threshold: 150,
        durationSeconds: 60,
        classId: CLASS_ID,
        riderId: RIDER,
        heartRateSamples: [],
      });
    });
    expect(outcome!.success).toBe(false);
    expect(outcome!.error).toContain("Recorded heart-rate samples");
    expect(tx.write).not.toHaveBeenCalled();
  });

  it("never submits a mock-backend proof on-chain", async () => {
    const { result } = renderHook(() => useZKClaim());
    let proofResult: Awaited<ReturnType<typeof result.current.generateProof>>;
    await act(async () => {
      proofResult = await result.current.generateProof({
        heartRate: 160,
        threshold: 150,
        durationSeconds: 60,
        classId: CLASS_ID,
        riderId: RIDER,
        heartRateSamples: new Array(60).fill(160),
      });
    });
    expect(proofResult!.success).toBe(true);
    // In this environment only the mock backend exists — the proof must be
    // labelled so it can never reach the contract.
    expect(proofResult!.proof!.backend).toBe("mock");

    await act(async () => {
      await expect(
        result.current.submitProof(
          {
            spinClass: CLASS_ID,
            rider: RIDER,
            rewardAmount: "0",
            classId: CLASS_ID,
          },
          proofResult!.proof!,
          proofResult!.proofs,
          60,
        ),
      ).rejects.toThrow(/Noir/i);
    });
    expect(tx.write).not.toHaveBeenCalled();

    // Full claim path: same guard, error surfaced to the UI.
    await act(async () => {
      await result.current.claimWithZK(
        {
          spinClass: CLASS_ID,
          rider: RIDER,
          rewardAmount: "0",
          classId: CLASS_ID,
        },
        {
          heartRate: 160,
          threshold: 150,
          durationSeconds: 60,
          heartRateSamples: new Array(60).fill(160),
        },
      );
    });
    expect(result.current.error?.message).toMatch(/Noir/i);
    expect(tx.write).not.toHaveBeenCalled();
  });

  it("verifies EVERY proof locally before submitting a batch", async () => {
    const { result } = renderHook(() => useZKClaim());
    const prover = getProver();
    const verifySpy = vi
      .spyOn(prover, "verify")
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false); // second proof invalid

    await act(async () => {
      await expect(
        result.current.submitProof(
          {
            spinClass: CLASS_ID,
            rider: RIDER,
            rewardAmount: "0",
            classId: CLASS_ID,
          },
          fakeNoirProof(60),
          [fakeNoirProof(60), fakeNoirProof(45)],
          105,
        ),
      ).rejects.toThrow(/verification failed/i);
    });
    expect(verifySpy).toHaveBeenCalledTimes(2);
    expect(tx.write).not.toHaveBeenCalled();
    verifySpy.mockRestore();
  });

  it("submits a batch of fully-verified Noir proofs", async () => {
    const { result } = renderHook(() => useZKClaim());
    const verifySpy = vi.spyOn(getProver(), "verify").mockResolvedValue(true);

    await act(async () => {
      await result.current.submitProof(
        {
          spinClass: CLASS_ID,
          rider: RIDER,
          rewardAmount: "0",
          classId: CLASS_ID,
        },
        fakeNoirProof(60),
        [fakeNoirProof(60), fakeNoirProof(60)],
        120,
      );
    });
    expect(tx.write).toHaveBeenCalledTimes(1);
    expect(tx.write.mock.calls[0][0].functionName).toBe("submitZKProofBatch");
    verifySpy.mockRestore();
  });

  it("submits the validated candidate, not a divergent proof argument", async () => {
    const { result } = renderHook(() => useZKClaim());
    const verifySpy = vi.spyOn(getProver(), "verify").mockResolvedValue(true);

    const validated = fakeNoirProof(60);
    const rogueArg = fakeNoirProof(45);
    await act(async () => {
      await result.current.submitProof(
        { spinClass: CLASS_ID, rider: RIDER, rewardAmount: "0", classId: CLASS_ID },
        rogueArg,
        [validated],
        60,
      );
    });

    expect(tx.write).toHaveBeenCalledTimes(1);
    const call = tx.write.mock.calls[0][0];
    expect(call.functionName).toBe("submitZKProof");
    // The submitted public inputs are the validated proof's (score 60 = 0x3c),
    // not the rogue argument's (45 = 0x2d).
    const submittedInputs = call.args[1] as `0x${string}`[];
    expect(submittedInputs[3]).toBe(`0x${"0".repeat(62)}3c`);
    verifySpy.mockRestore();
  });

  it("rejects a noir-marked proof when the real backend is unavailable", async () => {
    const { result } = renderHook(() => useZKClaim());
    // No spy: the real ZKProver in this environment has only the mock backend,
    // so a proof marked "noir" must fail verification rather than be
    // "verified" by the mock fallback.
    await act(async () => {
      await expect(
        result.current.submitProof(
          { spinClass: CLASS_ID, rider: RIDER, rewardAmount: "0", classId: CLASS_ID },
          fakeNoirProof(60),
          undefined,
          60,
        ),
      ).rejects.toThrow(/verification failed/i);
    });
    expect(tx.write).not.toHaveBeenCalled();
  });

  it("exposes pending/confirmed/error transaction states", () => {
    const { result, rerender } = renderHook(() => useZKClaim());
    expect(result.current.isPending).toBe(false);

    tx.isPending = true;
    rerender();
    expect(result.current.isPending).toBe(true);
    expect(result.current.isSuccess).toBe(false);

    // Confirmed = receipt success only.
    tx.isPending = false;
    tx.isSuccess = true;
    tx.hash = "0xdead";
    rerender();
    expect(result.current.isSuccess).toBe(true);

    // Rejected signature / reverted receipt surfaces as an error.
    tx.isSuccess = false;
    tx.error = new Error("User rejected the request");
    rerender();
    expect(result.current.error?.message).toContain("rejected");
  });
});
