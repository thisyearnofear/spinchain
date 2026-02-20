"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { PrimaryNav } from "@/app/components/layout/nav";
import { SurfaceCard, Tag } from "@/app/components/ui/ui";
import { useToast } from "@/app/components/ui/toast";
import {
  listPendingSettlements,
  upsertPendingSettlement,
  markPendingSettlementSettled,
  type PendingYellowSettlement,
} from "@/app/lib/rewards";
import { useYellowSettlement } from "@/app/hooks/evm/use-yellow-settlement";

export default function InstructorYellowSettlementsPage() {
  const toast = useToast();
  const { address, isConnected } = useAccount();

  const [items, setItems] = useState<PendingYellowSettlement[]>([]);

  const yellow = useYellowSettlement();

  useEffect(() => {
    setItems(listPendingSettlements());

    const interval = setInterval(() => {
      setItems(listPendingSettlements());
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  const myPending = useMemo(() => {
    if (!address) return [];
    return items.filter(
      (x) => x.instructor.toLowerCase() === address.toLowerCase() && x.status !== "settled"
    );
  }, [items, address]);

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />

      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pb-20 pt-10 lg:px-12">
        <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 px-8 py-10 backdrop-blur">
          <PrimaryNav />
        </div>

        <SurfaceCard
          eyebrow="Yellow"
          title="Pending settlements"
          description="Co-sign rider sessions and settle rewards on Avalanche."
          className="bg-[color:var(--surface-strong)]"
        >
          <div className="mt-4 flex flex-wrap gap-2">
            <Tag>Fuji</Tag>
            <Tag>EIP-712</Tag>
            <Tag>Permissionless settlement</Tag>
          </div>

          {!isConnected && (
            <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-200">Connect your wallet to co-sign settlements.</p>
            </div>
          )}

          <div className="mt-6 grid gap-4">
            {myPending.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface)]/40 p-6 text-sm text-[color:var(--muted)]">
                No pending Yellow settlements.
              </div>
            ) : (
              myPending.map((p) => (
                <div
                  key={p.id}
                  className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                        Channel
                      </div>
                      <div className="mt-1 font-mono text-xs text-[color:var(--foreground)] break-all">
                        {p.channelId}
                      </div>
                      <div className="mt-2 text-sm text-[color:var(--muted)]">
                        Rider: <span className="font-mono">{p.rider}</span>
                      </div>
                      <div className="text-sm text-[color:var(--muted)]">
                        Reward: <span className="text-[color:var(--foreground)]">{p.finalReward.toString()}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        className="rounded-xl border border-[color:var(--border)] px-4 py-2 text-sm text-[color:var(--foreground)] hover:bg-[color:var(--surface-strong)]"
                        onClick={() => {
                          navigator.clipboard.writeText(p.channelId);
                          toast.info("Copied", "Channel id copied to clipboard");
                        }}
                      >
                        Copy
                      </button>

                      {!p.instructorSignature ? (
                        <button
                          className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-50"
                          disabled={!yellow.canInstructorSign(p)}
                          onClick={async () => {
                            try {
                              const sig = await yellow.signFinalState({
                                channelId: p.channelId,
                                classId: p.classId,
                                rider: p.rider,
                                instructor: p.instructor,
                                finalReward: p.finalReward,
                                effortScore: p.effortScore,
                              });

                              const next: PendingYellowSettlement = {
                                ...p,
                                instructorSignature: sig,
                                status: "instructor_signed",
                                updatedAt: Date.now(),
                              };
                              upsertPendingSettlement(next);
                              setItems(listPendingSettlements());
                              toast.success("Co-signed", "Instructor signature added");
                            } catch (e) {
                              toast.error("Failed to sign", e instanceof Error ? e.message : String(e));
                            }
                          }}
                        >
                          Co-sign
                        </button>
                      ) : (
                        <button
                          className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                          onClick={() => {
                            yellow.settleOnChain(p);
                          }}
                        >
                          Settle on-chain
                        </button>
                      )}
                    </div>
                  </div>

                  {p.instructorSignature && (
                    <div className="mt-3 text-xs text-emerald-300">
                      Instructor signature present ✓
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </SurfaceCard>
      </main>
    </div>
  );
}
