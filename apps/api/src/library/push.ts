/**
 * A word to the learner's phone when their song is ready (plan 113), through Expo's push service.
 * The app registers an Expo push token with the UI language it showed; the server keeps it by
 * account and sends one message per finished song, in that language, and forgets a token the
 * service reports as gone. The token is the only device identifier kept, and it goes with the
 * account. `PUSH_PROVIDER=off` sends nothing; `EXPO_PUSH_ACCESS_TOKEN` is optional.
 */
import { Inject, Injectable, Logger, Optional } from '@nestjs/common'
import { PushTokenSchema, type PushLang } from '@loro/core/api/library'
import { SERVER_CLOCK, type ServerClock } from '../common/clock.js'
import { config } from '../common/config.js'
import { parseContract } from '../common/parse.js'
import { DATABASE, type SqlDatabase } from '../database/database.js'
import { boundedJson, isRecord } from '../integrations/bounded-body.js'

/** What a learner is told, in their UI language. The title is the song's. */
const COPY: Record<
  PushLang,
  { ready: [string, (title: string) => string]; failed: [string, (title: string) => string] }
> = {
  en: {
    ready: ['Your song is ready', (t) => `“${t}” is ready to play.`],
    failed: [
      'A song couldn’t be made',
      (t) => `“${t}” couldn’t be made. You can try again from its album.`,
    ],
  },
  bg: {
    ready: ['Песента ви е готова', (t) => `„${t}“ е готова за слушане.`],
    failed: [
      'Песента не можа да се направи',
      (t) => `„${t}“ не можа да се направи. Можете да опитате отново от албума ѝ.`,
    ],
  },
  ru: {
    ready: ['Ваша песня готова', (t) => `«${t}» готова к прослушиванию.`],
    failed: [
      'Песню не удалось сделать',
      (t) => `«${t}» не удалось сделать. Можно попробовать ещё раз из её альбома.`,
    ],
  },
  pl: {
    ready: ['Twoja piosenka jest gotowa', (t) => `„${t}” jest gotowa do odtworzenia.`],
    failed: [
      'Nie udało się stworzyć piosenki',
      (t) => `„${t}” nie powstała. Możesz spróbować ponownie z jej albumu.`,
    ],
  },
  cs: {
    ready: ['Vaše písnička je hotová', (t) => `„${t}“ je připravena k přehrání.`],
    failed: [
      'Písničku se nepodařilo vytvořit',
      (t) => `„${t}“ se nepodařilo vytvořit. Můžete to zkusit znovu z jejího alba.`,
    ],
  },
}

/** Nest token for the transport, for tests; production uses fetch. */
export const PUSH_TRANSPORT = Symbol('PushTransport')

const MAX_REPLY_BYTES = 200_000
const TIMEOUT_MS = 15_000

export interface SongNotice {
  songId: string
  albumId: string
  title: string
  outcome: 'ready' | 'failed'
}

/** One message to Expo's service, as it is sent. */
export interface PushMessage {
  to: string
  title: string
  body: string
  data: { kind: 'song'; songId: string; albumId: string; outcome: 'ready' | 'failed' }
  sound: 'default'
}

@Injectable()
export class PushService {
  private readonly logger = new Logger('push')

  constructor(
    @Inject(DATABASE) private readonly db: SqlDatabase,
    @Inject(SERVER_CLOCK) private readonly clock: ServerClock,
    @Optional() @Inject(PUSH_TRANSPORT) private readonly transport?: typeof fetch,
  ) {}

  /** Keeps a device's token for the learner, with the language its messages are in. */
  async register(userId: string, body: unknown): Promise<{ registered: true }> {
    const input = parseContract(PushTokenSchema, body)
    const now = this.clock.now()
    // A token moves with its device: signing in as someone else on it re-homes it.
    await this.db.query(
      `INSERT INTO library_push_tokens(token, user_id, lang, platform, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$5)
       ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, lang = EXCLUDED.lang, platform = EXCLUDED.platform, updated_at = EXCLUDED.updated_at`,
      [input.token, userId, input.lang, input.platform ?? null, now],
    )
    return { registered: true }
  }

  /** Forgets a device's token (the learner signed out on it). Someone else's token is left alone. */
  async forget(userId: string, token: string): Promise<void> {
    await this.db.query('DELETE FROM library_push_tokens WHERE token = $1 AND user_id = $2', [
      token,
      userId,
    ])
  }

  /** Tells the learner's devices that a song is ready, or couldn't be made. Never throws. */
  async songFinished(userId: string, notice: SongNotice): Promise<void> {
    if (config.pushProvider() === 'off') return
    try {
      const tokens = (
        await this.db.query<{ token: string; lang: PushLang }>(
          'SELECT token, lang FROM library_push_tokens WHERE user_id = $1',
          [userId],
        )
      ).rows
      if (tokens.length === 0) return
      const messages = tokens.map((row) => messageFor(row.token, row.lang, notice))
      const gone = await this.deliver(messages)
      if (gone.length > 0)
        await this.db.query('DELETE FROM library_push_tokens WHERE token = ANY($1::text[])', [gone])
    } catch (error) {
      this.logger.warn(
        `push for song ${notice.songId} failed: ${error instanceof Error ? error.message : 'unknown'}`,
      )
    }
  }

  /** Sends the messages; returns the tokens the service says no longer exist. */
  private async deliver(messages: PushMessage[]): Promise<string[]> {
    const accessToken = config.expoPushAccessToken()
    const response = await (this.transport ?? fetch)(config.expoPushUrl(), {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(messages),
    })
    if (!response.ok) {
      await response.body?.cancel()
      throw new Error(`push service answered ${response.status}`)
    }
    const reply = await boundedJson(response, MAX_REPLY_BYTES, () => new Error('unreadable reply'))
    if (!isRecord(reply) || !Array.isArray(reply['data'])) throw new Error('unreadable reply')
    const gone: string[] = []
    for (const [i, ticket] of reply['data'].entries()) {
      if (!isRecord(ticket) || ticket['status'] !== 'error') continue
      const details = ticket['details']
      const to = messages[i]?.to
      if (isRecord(details) && details['error'] === 'DeviceNotRegistered' && to) gone.push(to)
      else {
        const message = ticket['message']
        this.logger.warn(
          `push ticket ${i} failed: ${typeof message === 'string' ? message : 'unknown'}`,
        )
      }
    }
    return gone
  }
}

/** The message for one device, in its language. */
export function messageFor(token: string, lang: PushLang, notice: SongNotice): PushMessage {
  const [title, body] = COPY[lang][notice.outcome]
  return {
    to: token,
    title,
    body: body(notice.title),
    data: { kind: 'song', songId: notice.songId, albumId: notice.albumId, outcome: notice.outcome },
    sound: 'default',
  }
}
