/** Production gate, separate from structural validation of draft content. F-08. */
import { readFileSync, existsSync } from 'node:fs'
import { buildReviewPacket } from './reviewPacket.js'
import { validateReviewRecord } from './reviewRecords.js'

const packet = buildReviewPacket()
const recordPath = new URL(`../reviews/${packet.materialSha256}.json`, import.meta.url)
if (!existsSync(recordPath)) {
  throw new Error(
    'F-08 release blocked: no exact-digest bilingual review record exists for the bundled material. See packages/content/reviews/README.md.',
  )
}
try {
  validateReviewRecord(packet, JSON.parse(readFileSync(recordPath, 'utf8')))
} catch (error) {
  const detail = error instanceof Error ? error.message : 'unknown review record error'
  throw new Error(`F-08 release blocked: ${detail}`)
}
