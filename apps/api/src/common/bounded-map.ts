/** Insertion-order map that drops the oldest entry when it exceeds `max`. */
export class BoundedMap<V> {
  private readonly map = new Map<string, V>()

  constructor(private readonly max: number) {}

  get(key: string): V | undefined {
    return this.map.get(key)
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) this.map.delete(key)
    this.map.set(key, value)
    if (this.map.size > this.max) {
      const oldest = this.map.keys().next().value
      if (oldest !== undefined) this.map.delete(oldest)
    }
  }

  get size(): number {
    return this.map.size
  }
}
