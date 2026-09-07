import { getCore } from '../core/loader'
import { deviceClock } from '../lib/clock'

export function nextRuntimeHlc(previous: string | null, nodeId: string): string {
  const parts = previous?.split(':')
  if (
    parts &&
    (parts.length !== 3 ||
      !/^-?\d+$/.test(parts[0] ?? '') ||
      !/^\d+$/.test(parts[1] ?? '') ||
      !Number.isSafeInteger(Number(parts[0])) ||
      !Number.isSafeInteger(Number(parts[1])) ||
      !parts[2])
  )
    throw new Error('Invalid persisted clock')
  const result = getCore().coreCall({
    op: 'hlc_tick',
    last: parts
      ? { physical: Number(parts[0]), logical: Number(parts[1]), node_id: parts[2] }
      : { physical: 0, logical: 0, node_id: nodeId },
    wall_ms: deviceClock.now(),
    node_id: nodeId,
  }) as { physical: number; logical: number; node_id: string }
  return `${String(result.physical)}:${String(result.logical).padStart(4, '0')}:${result.node_id}`
}
