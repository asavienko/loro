/** Platform-neutral JSON adapters; every algorithm executes in the Rust core. */
import { callCore } from './coreRuntime'
export { coreAvailable } from './coreRuntime'

// Rust validates inputs and owns the schema; this generic types the decoded native return.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function coreCall<T>(method: string, input: unknown): T {
  return JSON.parse(callCore(method, JSON.stringify(input))) as T
}

export interface CoreHlc {
  readonly physical: number
  readonly logical: number
  readonly node_id: string
}
export interface CoreRow {
  readonly entity: string
  readonly id: string
  readonly fields: Readonly<Record<string, { readonly v: unknown; readonly hlc: CoreHlc }>>
  readonly deleted_at: number | null
}
export interface CoreRowOp extends CoreRow {
  readonly classes: Readonly<
    Record<string, 'Lww' | 'Max' | 'LatestReview' | 'AppendOnly' | 'Tombstone'>
  >
}
export interface CoreMergeOutcome {
  readonly row: CoreRow
  readonly changed: boolean
  readonly conflicts: readonly string[]
}
export function nextHlc(wallMs: number, previous: string | null, nodeId: string): string {
  return coreCall('hlc_tick', { wallMs, previous, nodeId })
}
export function receiveHlc(
  wallMs: number,
  previous: string,
  remote: string,
  nodeId: string,
): string {
  return coreCall('hlc_receive', { wallMs, previous, remote, nodeId })
}
export function mergeRow(local: CoreRow, remote: CoreRowOp): CoreMergeOutcome {
  return coreCall('merge_row', { local, remote })
}
