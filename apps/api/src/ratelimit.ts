/** Token bucket per key. Units are "segments judged", so a long document costs more. */
export class RateLimiter {
  #buckets = new Map<string, { tokens: number; at: number }>();
  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
  ) {}

  take(key: string, cost: number, now = Date.now()): boolean {
    const b = this.#buckets.get(key) ?? { tokens: this.capacity, at: now };
    const elapsed = (now - b.at) / 1000;
    b.tokens = Math.min(this.capacity, b.tokens + elapsed * this.refillPerSecond);
    b.at = now;
    if (b.tokens < cost) {
      this.#buckets.set(key, b);
      return false;
    }
    b.tokens -= cost;
    this.#buckets.set(key, b);
    return true;
  }
}
