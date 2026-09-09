/** Process-local admission control; callers share one instance per provider pool.
 * There is no queue or retry: rejection must reach the owning feature's fallback.
 * This is not a distributed rate limiter or spend reservation.
 */
export class ProviderConcurrency {
  private active = 0

  constructor(private readonly limit: number) {
    if (!Number.isSafeInteger(limit) || limit <= 0) {
      throw new Error('Invalid provider concurrency limit')
    }
  }

  /** Hold the permit until transport AND response handling finish, including cancellation. */
  acquire(): (() => void) | null {
    if (this.active >= this.limit) return null
    this.active += 1
    let released = false
    return () => {
      if (released) return
      released = true
      this.active -= 1
    }
  }
}
