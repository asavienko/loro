/**
 * A learner's progress in their account (plan 106, F-04). The app owns the model: its learner state
 * (a compact review log, likes, own phrases and sets, the profile) merges as a union of logs with
 * last-writer-wins fields, on the device. The server keeps the merged copy and a revision, and
 * refuses a write based on an older revision, so a device always merges what another wrote first.
 */
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Injectable,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { z } from 'zod'
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js'
import { SERVER_CLOCK, type ServerClock } from '../common/clock.js'
import { LoroError } from '../common/errors.js'
import { parseContract } from '../common/parse.js'
import { DATABASE, type SqlDatabase } from '../database/database.js'

/** Within the API's 1 MB JSON limit, with room for the envelope. */
export const MAX_PROGRESS_BYTES = 900_000

const ProgressWriteSchema = z.strictObject({
  /** The app's learner state; its shape is the app's to check (sanitizeLearner). */
  progress: z.record(z.string(), z.unknown()),
  /** The revision this write was merged onto; 0 when the account had none. */
  baseRevision: z.int().min(0),
})

export interface ProgressWire {
  progress: Record<string, unknown> | null
  revision: number
  updatedAt: number | null
}

@Injectable()
export class ProgressService {
  constructor(
    @Inject(DATABASE) private readonly db: SqlDatabase,
    @Inject(SERVER_CLOCK) private readonly clock: ServerClock,
  ) {}

  async read(userId: string): Promise<ProgressWire> {
    const row = (
      await this.db.query<{ body: Record<string, unknown>; revision: number; updated_at: string }>(
        'SELECT body, revision, updated_at FROM library_progress WHERE user_id = $1',
        [userId],
      )
    ).rows[0]
    return row
      ? { progress: row.body, revision: row.revision, updatedAt: Number(row.updated_at) }
      : { progress: null, revision: 0, updatedAt: null }
  }

  /** Writes the merged progress, or refuses (409) when another device wrote since `baseRevision`. */
  async write(userId: string, body: unknown): Promise<{ revision: number }> {
    const input = parseContract(ProgressWriteSchema, body)
    const json = JSON.stringify(input.progress)
    if (Buffer.byteLength(json, 'utf8') > MAX_PROGRESS_BYTES) {
      throw new LoroError('VALIDATION_FAILED', 'Progress is too large')
    }
    const now = this.clock.now()
    const written =
      input.baseRevision === 0
        ? await this.db.query<{ revision: number }>(
            `INSERT INTO library_progress(user_id, revision, body, updated_at) VALUES ($1, 1, $2, $3)
             ON CONFLICT (user_id) DO NOTHING RETURNING revision`,
            [userId, json, now],
          )
        : await this.db.query<{ revision: number }>(
            `UPDATE library_progress SET revision = revision + 1, body = $2, updated_at = $3
             WHERE user_id = $1 AND revision = $4 RETURNING revision`,
            [userId, json, now, input.baseRevision],
          )
    const revision = written.rows[0]?.revision
    if (revision === undefined)
      throw new LoroError('CURSOR_EXPIRED', 'Progress changed on another device')
    return { revision }
  }
}

@Controller('library/progress')
@UseGuards(AuthGuard)
export class ProgressController {
  constructor(@Inject(ProgressService) private readonly progress: ProgressService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  read(@Req() request: AuthenticatedRequest) {
    return this.progress.read(request.principal.userId)
  }

  @Post()
  @HttpCode(200)
  write(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.progress.write(request.principal.userId, body)
  }
}
