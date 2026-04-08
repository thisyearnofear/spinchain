const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

function evictExpired(): void {
  const now = Date.now();
  for (const [key, w] of windows) {
    if (w.resetAt <= now) windows.delete(key);
  }
}

export function checkRateLimit(ip: string): { allowed: boolean; retryAfterMs: number } {
  evictExpired();
  const now = Date.now();
  const w = windows.get(ip);

  if (!w || now > w.resetAt) {
    windows.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (w.count >= MAX_REQUESTS) {
    return { allowed: false, retryAfterMs: w.resetAt - now };
  }

  w.count++;
  return { allowed: true, retryAfterMs: 0 };
}
