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
  syncPendingWithSDK,
  formatReward,
  type PendingYellowSettlement,
} from "@/app/lib/rewards";
import { useYellowSettlement } from "@/app/hooks/evm/use-yellow-settlement";

export default function InstructorYellowSettlementsPage() {
  const toast = useToast();
  const { address, isConnected } = useAccount();

  const [items, setItems] = useState<PendingYellowSettlement[]>(() => listPendingSettlements());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  const yellow = useYellowSettlement();

  useEffect(() => {
    // Sync with Yellow SDK on mount
    if (address) {
      syncPendingWithSDK(address).then(() => {
        setItems(listPendingSettlements());
      });
    }

    const interval = setInterval(() => {
      setItems(listPendingSettlements());
    }, 3000);

    return () => clearInterval(interval);
  }, [address]);

  const myPending = useMemo(() => {
    if (!address) return [];
    return items.filter(
      (x) => x.instructor.toLowerCase() === address.toLowerCase() && x.status !== "settled"
    );
  }, [items, address]);

  const selectedItems = useMemo(() => {
    return myPending.filter((p) => selectedIds.has(p.id));
  }, [myPending, selectedIds]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds.size === myPending.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(myPending.map((p) => p.id)));
  };

  const handleBatchSign = async () => {
    if (selectedItems.length === 0) return;
    setIsProcessing(true);
    let count = 0;
    try {
      for (const p of selectedItems) {
        if (p.instructorSignature) continue;
        const sig = await yellow.signFinalState({
          channelId: p.channelId,
          classId: p.classId,
          rider: p.rider,
          instructor: p.instructor,
          finalReward: p.finalReward,
          effortScore: p.effortScore,
        });

        upsertPendingSettlement({
          ...p,
          instructorSignature: sig,
          status: "instructor_signed",
          updatedAt: Date.now(),
        });
        count++;
      }
      setItems(listPendingSettlements());
      toast.success("Batch Signed", `Successfully co-signed ${count} sessions`);
    } catch (e) {
      toast.error("Sign Failed", e instanceof Error ? e.message : String(e));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBatchSettle = async () => {
    const signed = selectedItems.filter((p) => p.instructorSignature);
    if (signed.length === 0) {
      toast.error("No signed items", "Select co-signed sessions to settle on-chain");
      return;
    }
    try {
      await yellow.batchSettleOnChain(signed);
    } catch (e) {
      toast.error("Settle Failed", e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />

      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pb-20 pt-10 lg:px-12">
        <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 px-8 py-10 backdrop-blur">
          <PrimaryNav />
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex-1">
            <SurfaceCard
              eyebrow="Yellow Network"
              title="Instructor Settlement Hub"
              description="Co-sign and batch-settle rider rewards via Yellow state channels."
              className="bg-[color:var(--surface-strong)]"
            >
              <div className="mt-4 flex flex-wrap gap-2">
                <Tag>Avalanche Fuji</Tag>
                <Tag>EIP-712</Tag>
                <Tag>Batch Processing</Tag>
                {clearNodeStatus(yellow.clearNodeConnected)}
              </div>

              {!isConnected && (
                <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                  Connect instructor wallet to authorize settlements.
                </div>
              )}

              {myPending.length > 0 && (
                <div className="mt-8 flex items-center justify-between border-b border-[color:var(--border)] pb-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === myPending.length && myPending.length > 0}
                      onChange={selectAll}
                      className="h-4 w-4 rounded border-[color:var(--border)] bg-transparent accent-indigo-500"
                    />
                    <span className="text-sm font-medium text-[color:var(--muted)]">
                      {selectedIds.size} selected
                    </span>
                  </div>

                  <div className="flex gap-2 items-center">
                    <BatchEfficiency count={selectedIds.size} />
                    <button
                      disabled={selectedIds.size === 0 || isProcessing}
                      onClick={handleBatchSign}
                      className="rounded-xl bg-indigo-500/20 px-4 py-2 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/30 disabled:opacity-50 transition-colors"
                    >
                      Batch Co-sign
                    </button>
                    <button
                      disabled={selectedIds.size === 0 || isProcessing}
                      onClick={handleBatchSettle}
                      className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                    >
                      Batch Settle On-chain
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-6 grid gap-4">
                {myPending.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface)]/40 p-12 text-center text-sm text-[color:var(--muted)]">
                    No pending settlements found for your address.
                  </div>
                ) : (
                  myPending.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => toggleSelect(p.id)}
                      className={`group relative cursor-pointer rounded-2xl border p-5 transition-all ${
                        selectedIds.has(p.id)
                          ? "border-indigo-500/50 bg-indigo-500/5"
                          : "border-[color:var(--border)] bg-[color:var(--surface)] hover:border-[color:var(--border-strong)]"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(p.id)}
                          readOnly
                          className="mt-1 h-4 w-4 rounded border-[color:var(--border)] bg-transparent accent-indigo-500"
                        />
                        
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-mono text-[color:var(--muted)]">
                              {p.channelId.slice(0, 12)}...{p.channelId.slice(-8)}
                            </div>
                            <div className="flex items-center gap-2">
                              {p.instructorSignature && (
                                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                  Signed
                                </span>
                              )}
                              <span className="text-xs font-bold text-[color:var(--foreground)]">
                                {formatReward(p.finalReward)} SPIN
                              </span>
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-3 gap-4">
                            <div>
                              <div className="text-[10px] uppercase text-[color:var(--muted)] mb-1">Participants</div>
                              <ParticipantBubbles participants={[p.rider, p.instructor]} />
                            </div>
                            <div>
                              <div className="text-[10px] uppercase text-[color:var(--muted)]">Effort</div>
                              <div className="text-xs font-semibold text-indigo-300">{(p.effortScore / 10).toFixed(1)}%</div>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase text-[color:var(--muted)]">Updates</div>
                              <div className="text-xs">{p.updates.length} points</div>
                            </div>
                          </div>

                          {/* Telemetry Sparkline Placeholder */}
                          <div className="mt-4 flex h-8 items-end gap-0.5 overflow-hidden rounded-lg bg-[color:var(--surface-strong)]/50 px-2 py-1">
                            {p.updates.slice(-30).map((u, i) => {
                              const height = Math.min(100, (u.heartRate / 200) * 100);
                              return (
                                <div 
                                  key={i} 
                                  className="flex-1 bg-indigo-500/40 rounded-t-sm" 
                                  style={{ height: `${height}%` }}
                                />
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </SurfaceCard>
          </div>

          <div className="w-full lg:w-80 flex flex-col gap-6">
            <SurfaceCard title="Network Stats" className="h-fit">
              <div className="space-y-4">
                <StatItem label="Active Channels" value={myPending.length.toString()} />
                <StatItem 
                  label="Total Pending" 
                  value={formatReward(myPending.reduce((s, x) => s + x.finalReward, BigInt(0)))} 
                  suffix=" SPIN"
                />
                <StatItem label="Avg Effort" value={
                  myPending.length > 0 
                    ? (myPending.reduce((s, x) => s + x.effortScore, 0) / (myPending.length * 10)).toFixed(1) + "%"
                    : "0%"
                } />
              </div>
            </SurfaceCard>

            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
              <h3 className="text-sm font-bold text-[color:var(--foreground)]">Security Note</h3>
              <p className="mt-2 text-xs text-[color:var(--muted)] leading-relaxed">
                Co-signing authorizes the minting of rewards on Avalanche. 
                Always verify the effort score matches the rider's actual performance 
                before signing. Batch settlement reduces gas costs for instructors.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatItem({ label, value, suffix = "" }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[color:var(--muted)]">{label}</span>
      <span className="text-sm font-semibold text-[color:var(--foreground)]">{value}<span className="text-[10px] ml-0.5 opacity-50">{suffix}</span></span>
    </div>
  );
}

function ParticipantBubbles({ participants }: { participants: string[] }) {
  return (
    <div className="flex -space-x-2 overflow-hidden">
      {participants.map((p, i) => (
        <div 
          key={p} 
          title={p}
          className="inline-block h-6 w-6 rounded-full ring-2 ring-[color:var(--surface)] bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30"
        >
          <span className="text-[10px] font-bold text-indigo-300">
            {i === 0 ? "R" : i === 1 ? "I" : "O"}
          </span>
        </div>
      ))}
    </div>
  );
}

function BatchEfficiency({ count }: { count: number }) {
  if (count <= 1) return null;
  const saving = Math.min(85, (1 - (1.5 / count)) * 100); // Rough gas saving formula for batching
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
      <span className="text-[10px] font-bold text-emerald-400">-{saving.toFixed(0)}% Gas</span>
    </div>
  );
}

function clearNodeStatus(connected?: boolean) {
  if (connected === undefined) return null;
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
      connected ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
      ClearNode {connected ? "Live" : "Offline"}
    </div>
  );
}
