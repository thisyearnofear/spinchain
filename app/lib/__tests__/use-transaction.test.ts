// @vitest-environment jsdom
// useTransaction receipt-state regression tests.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const wagmi = vi.hoisted(() => ({
  write: {
    writeContract: vi.fn(),
    data: undefined as `0x${string}` | undefined,
    error: null as Error | null,
    isPending: false,
    isError: false,
    reset: vi.fn(),
  },
  receipt: {
    data: undefined as { status: "success" | "reverted" } | undefined,
    isLoading: false,
    isError: false,
    error: null as Error | null,
  },
  toast: { error: vi.fn(), success: vi.fn(), loading: vi.fn() },
}));

vi.mock("wagmi", () => ({
  useWriteContract: () => wagmi.write,
  useWaitForTransactionReceipt: () => wagmi.receipt,
}));

vi.mock("@/app/components/ui/toast", () => ({
  useToast: () => wagmi.toast,
}));

import { useTransaction } from "@/app/hooks/evm/use-transaction";

function render(onSuccess = vi.fn(), onError = vi.fn()) {
  return renderHook(() =>
    useTransaction({
      successMessage: "ok",
      pendingMessage: "pending",
      onSuccess,
      onError,
    }),
  );
}

describe("useTransaction", () => {
  beforeEach(() => {
    wagmi.write.writeContract.mockClear();
    wagmi.write.reset.mockClear();
    wagmi.write.data = undefined;
    wagmi.write.error = null;
    wagmi.write.isPending = false;
    wagmi.write.isError = false;
    wagmi.receipt.data = undefined;
    wagmi.receipt.isLoading = false;
    wagmi.receipt.isError = false;
    wagmi.receipt.error = null;
    wagmi.toast.error.mockClear();
    wagmi.toast.success.mockClear();
    wagmi.toast.loading.mockClear();
  });

  it("surfaces a wallet rejection as an error and calls onError", () => {
    const onError = vi.fn();
    const { result, rerender } = render(undefined, onError);
    expect(result.current.error).toBeNull();

    wagmi.write.isError = true;
    wagmi.write.error = new Error("User rejected the request");
    rerender();

    expect(result.current.error?.message).toContain("rejected");
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isPending).toBe(false);
    expect(onError).toHaveBeenCalled();
  });

  it("treats a reverted receipt as an error, never success", () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const { result, rerender } = render(onSuccess, onError);

    wagmi.write.data = "0xabc" as `0x${string}`;
    wagmi.receipt.data = { status: "reverted" };
    rerender();

    expect(result.current.isSuccess).toBe(false);
    expect(result.current.error?.message).toMatch(/reverted/i);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
  });

  it("reports isSuccess and fires onSuccess only on a confirmed receipt", () => {
    const onSuccess = vi.fn();
    const { result, rerender } = render(onSuccess);

    // Receipt still pending.
    wagmi.write.data = "0xabc" as `0x${string}`;
    wagmi.receipt.isLoading = true;
    rerender();
    expect(result.current.isPending).toBe(true);
    expect(result.current.isSuccess).toBe(false);
    expect(onSuccess).not.toHaveBeenCalled();

    wagmi.receipt.isLoading = false;
    wagmi.receipt.data = { status: "success" };
    rerender();
    expect(result.current.isPending).toBe(false);
    expect(result.current.isSuccess).toBe(true);
    expect(onSuccess).toHaveBeenCalledWith("0xabc");
  });

  it("reset() clears write state so retries start clean", () => {
    const { result } = render();
    result.current.reset();
    expect(wagmi.write.reset).toHaveBeenCalledTimes(1);
  });

  it("fires success notifications exactly once across rerenders with fresh inline options", () => {
    const onSuccess = vi.fn();
    const { result, rerender } = render(onSuccess);

    wagmi.write.data = "0xabc" as `0x${string}`;
    wagmi.receipt.data = { status: "success" };
    rerender();
    rerender();
    rerender();

    expect(result.current.isSuccess).toBe(true);
    expect(wagmi.toast.success).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("fires a reverted receipt error exactly once across rerenders", () => {
    const onError = vi.fn();
    const { rerender } = render(undefined, onError);

    wagmi.write.data = "0xabc" as `0x${string}`;
    wagmi.receipt.data = { status: "reverted" };
    rerender();
    rerender();
    rerender();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(wagmi.toast.error).toHaveBeenCalledTimes(1);
  });

  it("surfaces a receipt fetch error", () => {
    const onError = vi.fn();
    const { result, rerender } = render(undefined, onError);

    wagmi.write.data = "0xabc" as `0x${string}`;
    wagmi.receipt.isError = true;
    wagmi.receipt.error = new Error("RPC timeout");
    rerender();

    expect(result.current.error?.message).toBe("RPC timeout");
    expect(result.current.isSuccess).toBe(false);
    expect(onError).toHaveBeenCalled();
  });

  it("reset() after a confirmed receipt reports idle even while the receipt hook still returns the old receipt", () => {
    const onSuccess = vi.fn();
    const { result, rerender } = render(onSuccess);

    wagmi.write.data = "0xabc" as `0x${string}`;
    wagmi.receipt.data = { status: "success" };
    rerender();
    expect(result.current.isSuccess).toBe(true);

    result.current.reset();
    wagmi.write.data = undefined;
    wagmi.write.error = null;
    rerender();

    expect(result.current.isSuccess).toBe(false);
    expect(result.current.error).toBeNull();
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});
