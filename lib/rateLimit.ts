export type RateLimitResult = { allowed: boolean; remaining: number; retryAfter?: number };

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;
const BURST = 120;

const buckets = new Map<string, { count: number; resetAt: number; burstUntil: number }>();

export function rateLimit(key: string, now = Date.now()): RateLimitResult {
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + WINDOW_MS, burstUntil: now + 10_000 };
    buckets.set(key, b);
  }
  const limit = now < b.burstUntil ? BURST : MAX_PER_WINDOW;
  b.count += 1;
  if (b.count > limit) {
    return { allowed: false, remaining: 0, retryAfter: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  return { allowed: true, remaining: limit - b.count };
}

export function sweepRateLimits(now = Date.now()) {
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
  }
}

const INTERVAL = setInterval(() => sweepRateLimits(), 60_000);
INTERVAL.unref?.();
