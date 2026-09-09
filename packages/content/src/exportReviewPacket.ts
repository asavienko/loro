/** F-08: pipe to a new durable review record; no source or approval mutations. */
import { buildReviewPacket } from './reviewPacket.js'
process.stdout.write(`${JSON.stringify(buildReviewPacket(), null, 2)}\n`)
