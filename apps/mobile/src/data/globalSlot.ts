/** Process-wide slots that survive Metro remounts. Not durable learner storage. */
export function globalSlot<T>(key: symbol): {
  get(): T | undefined
  set(value: T | undefined): void
} {
  return {
    get() {
      return (globalThis as Record<symbol, T | undefined>)[key]
    },
    set(value) {
      ;(globalThis as Record<symbol, T | undefined>)[key] = value
    },
  }
}

/** Reuse a live value or the in-flight open after a remount of this module. */
export function retainGlobal<T>(
  keys: { value: symbol; opening: symbol },
  open: () => Promise<T>,
): Promise<T> {
  const values = globalSlot<T>(keys.value)
  const openings = globalSlot<Promise<T>>(keys.opening)
  const existing = values.get()
  if (existing !== undefined) return Promise.resolve(existing)
  const inFlight = openings.get()
  if (inFlight) return inFlight
  const pending = open()
    .then((value) => {
      values.set(value)
      return value
    })
    .finally(() => {
      if (openings.get() === pending) openings.set(undefined)
    })
  openings.set(pending)
  return pending
}
