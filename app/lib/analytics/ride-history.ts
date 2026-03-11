export interface RideProofSummary {
  mode: "zk-batch" | "yellow-stream" | "none";
  isVerified: boolean;
  privacyScore: number;
  privacyLevel: "high" | "medium" | "low";
}

export interface RideSummary {
  id: string;
  classId: string;
  className: string;
  instructor: string;
  completedAt: number;
  durationSec: number;
  avgHeartRate: number;
  avgPower: number;
  avgEffort: number;
  spinEarned: number;
  telemetrySource: "live-bike" | "simulator" | "estimated";
  effortTier: "bronze" | "silver" | "gold" | "platinum";
  zones: {
    recovery: number;
    endurance: number;
    threshold: number;
    sprint: number;
  };
  proof: RideProofSummary;
  onChain?: {
    attempted: boolean;
    txHash?: `0x${string}`;
    status: "pending" | "confirmed" | "failed" | "skipped";
  };
}

const STORAGE_KEY = "spinchain:rides:history:v1";
const MAX_RIDES = 200;

function safeParse(input: string | null): RideSummary[] {
  if (!input) return [];
  try {
    const parsed = JSON.parse(input);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getRideHistory(): RideSummary[] {
  if (typeof window === "undefined") return [];
  const rides = safeParse(window.localStorage.getItem(STORAGE_KEY));
  return rides.sort((a, b) => b.completedAt - a.completedAt);
}

export function saveRideSummary(summary: RideSummary): RideSummary[] {
  if (typeof window === "undefined") return [];
  const existing = getRideHistory().filter((r) => r.id !== summary.id);
  const next = [summary, ...existing].slice(0, MAX_RIDES);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function getStreakStats(rides: RideSummary[]) {
  if (!rides.length) return { daily: 0, weekly: 0, activeToday: false };
  const daySet = new Set(
    rides.map((ride) => {
      const date = new Date(ride.completedAt);
      return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
    }),
  );

  const now = new Date();
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  let daily = 0;
  for (let offset = 0; offset < 365; offset += 1) {
    const d = new Date(startOfToday - offset * 86_400_000);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
    if (!daySet.has(key)) break;
    daily += 1;
  }

  const weekSet = new Set(
    rides.map((ride) => {
      const d = new Date(ride.completedAt);
      const onejan = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const week = Math.ceil((((d.getTime() - onejan.getTime()) / 86_400_000) + onejan.getUTCDay() + 1) / 7);
      return `${d.getUTCFullYear()}-${week}`;
    }),
  );
  let weekly = 0;
  for (let offset = 0; offset < 52; offset += 1) {
    const d = new Date(startOfToday - offset * 7 * 86_400_000);
    const onejan = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((d.getTime() - onejan.getTime()) / 86_400_000) + onejan.getUTCDay() + 1) / 7);
    const key = `${d.getUTCFullYear()}-${week}`;
    if (!weekSet.has(key)) break;
    weekly += 1;
  }

  return { daily, weekly, activeToday: daily > 0 };
}

export function getPRs(rides: RideSummary[]) {
  return {
    bestEffort: rides.reduce((acc, r) => Math.max(acc, r.avgEffort), 0),
    bestPower: rides.reduce((acc, r) => Math.max(acc, r.avgPower), 0),
    bestDuration: rides.reduce((acc, r) => Math.max(acc, r.durationSec), 0),
    bestSpin: rides.reduce((acc, r) => Math.max(acc, r.spinEarned), 0),
  };
}

export function getBadges(rides: RideSummary[]) {
  const prs = getPRs(rides);
  const latest = rides[0];
  if (!latest) return [] as string[];
  const badges: string[] = [];
  if (latest.avgEffort >= prs.bestEffort) badges.push("PR Effort");
  if (latest.avgPower >= prs.bestPower) badges.push("PR Power");
  if (latest.zones.threshold + latest.zones.sprint >= 50) badges.push("Zone Hunter");
  if (latest.avgEffort >= 800) badges.push("Tier Elite");
  else if (latest.avgEffort >= 650) badges.push("Tier Strong");
  return badges;
}

export function getClassLeaderboard(rides: RideSummary[], classId: string) {
  return rides
    .filter((ride) => ride.classId === classId)
    .sort((a, b) => b.avgEffort - a.avgEffort)
    .slice(0, 10)
    .map((ride, index) => ({
      rank: index + 1,
      riderLabel: `Rider-${ride.id.slice(-4)}`,
      effort: ride.avgEffort,
      spin: ride.spinEarned,
      verified: ride.proof.isVerified,
      proofType: ride.proof.mode,
    }));
}
