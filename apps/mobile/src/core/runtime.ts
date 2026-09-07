/** The sole transport boundary; implementations always execute the compiled Rust core. */
export interface CoreRuntime {
  coreCall(request: unknown): unknown
}

export function jsonRuntime(call: (request: string) => string): CoreRuntime {
  return {
    coreCall(request) {
      const response = JSON.parse(call(JSON.stringify(request))) as {
        ok?: unknown
        error?: string
      }
      if (typeof response.error === 'string') throw new Error(response.error)
      if (!Object.hasOwn(response, 'ok')) throw new Error('Invalid canonical core response')
      return response.ok
    },
  }
}
