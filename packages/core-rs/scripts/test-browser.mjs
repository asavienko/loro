// Transport parity against both compiled WASM targets (no TypeScript algorithm oracle).
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import init, { core_call as browserCall } from '../pkg-web/loro_core.js'
import bytes from '../pkg-web/bytes.js'
const require = createRequire(import.meta.url)
const { core_call: nodeCall, merge_row } = require('../pkg/loro_core.js')
await init({ module_or_path: bytes })
assert.equal(typeof merge_row, 'function')
const requests = [
  { op: 'normalize', text: 'СОФИЯ и café и ñ' },
  { op: 'match_tokens', heard: ['как', 'си'], target: ['Как', 'си'], revealed: 0, fuzzy: false },
  { op: 'cloze_mask', tokens: ['Искам', 'вода'], target_locale: 'bg-BG', eligible_indices: [1] },
  { op: 'fsrs_initialize', declared: 'Med', tags: [], at_ms: 0 },
  { op: 'hlc_tick', last: { physical: 10, logical: 0, node_id: 'a' }, wall_ms: 9, node_id: 'a' },
  { op: 'automaticity', reps_today: 3, target: 4 },
  { op: 'not_an_operation' },
]
for (const request of requests) {
  const json = JSON.stringify(request)
  assert.deepEqual(JSON.parse(browserCall(json)), JSON.parse(nodeCall(json)))
}
const state = JSON.parse(nodeCall(JSON.stringify(requests[3]))).ok
assert.ok(state)
const review = JSON.stringify({ op: 'fsrs_review', state, grade: 'Good', at_ms: 86400000 })
assert.deepEqual(JSON.parse(browserCall(review)), JSON.parse(nodeCall(review)))
assert.ok(JSON.parse(browserCall(review)).ok)
console.log(`Browser/Node canonical parity: ${requests.length + 1} operations passed`)
