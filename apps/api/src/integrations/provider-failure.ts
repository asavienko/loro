/** How a model provider's one attempt failed: a code, and nothing a provider, prompt or key said. */

export type ProviderFailureCode =
  | 'configuration'
  | 'input'
  | 'cancelled'
  | 'timeout'
  | 'unavailable'
  | 'rate_limited'
  | 'capacity'
  | 'invalid_output'

/** Never retain provider bodies, credentials, prompts, or underlying error causes. */
export class ProviderFailure extends Error {
  constructor(readonly code: ProviderFailureCode) {
    super(`Provider request failed: ${code}`)
    this.name = 'ProviderFailure'
  }
}
