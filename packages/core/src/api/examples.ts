/** Illustrative wire examples only, never learner state or a provider fallback. */
import type { Operation } from './operation.js'
export interface WireExample {
  request?: unknown
  responses: Readonly<Record<number, unknown>>
}
const id = '0197a001-0000-7000-8000-000000000001'
const replyId = '0197a001-0000-7000-8000-000000000002'
const hash = 'a'.repeat(64)
const hlc = '1721558400123:0007:device_1'
const health = { status: 'ok', version: '0.0.0' }
const ready = { status: 'ok', checks: { content: 'ok', merge: 'ok' } }
const unready = { status: 'degraded', checks: { content: 'ok', merge: 'unavailable' } }
const line = { es: 'Un café, por favor.', en: 'A coffee, please.' }
const scene = {
  place: 'Café',
  city: 'Madrid',
  emoji: '☕',
  role: 'Camarero',
  turns: Array.from({ length: 3 }, () => ({
    npc: line,
    options: [
      { ...line, best: true, tip: 'A natural way to order.' },
      { es: '¿Qué me recomienda?', en: 'What do you recommend?', tip: 'A useful question to ask.' },
      { es: '¿Tienen leche?', en: 'Do you have milk?', tip: 'Ask about available milk.' },
    ],
  })),
  closer: line,
}
const sceneResponse = { scene_id: 'scene_example', cached: false, fallback: true, scene }
const manifest = {
  catalog_version: 0,
  lang: 'es-ES',
  phrase_count: 0,
  packs: [],
  scenarios: [],
  audio_base: 'https://cdn.loro.app/audio/',
  min_app_version: '1.0.0',
}
const diff = { from: 0, to: 0, upserts: [], deprecations: [], full_resync_required: true }
const pack = { id: 'example', label: 'Illustrative empty pack', promised_count: 0, phrases: [] }
const pushed = {
  accepted: [],
  rejected: [],
  conflicts: [],
  server_hlc: hlc,
  server_time: 1721558400123,
}
const pulled = { changes: [], next: hlc, has_more: false, server_hlc: hlc }
const signIn = {
  identity_token: 'illustrative-provider-token',
  anon_id: id,
  device: { installation_id: id, platform: 'ios', app_version: '1.0.0+1' },
}
const tokens = {
  access_token: 'illustrative-access-token',
  refresh_token: 'illustrative-refresh-token',
  expires_in: 900,
}
const user = { id: 'user_example', created_at: 1721558400123 }
const claim = { performed: true, mode: 'bind', claim_id: 'claim_example', upload_required: false }
const signedIn = { ...tokens, user, device_id: 'device_example', claim }
const accepted = { status: 'accepted' }
export const currentExamples: Readonly<Record<string, WireExample>> = {
  oauthProviders: { responses: { 200: { providers: ['google', 'apple'] } } },
  oauthStart: {
    request: { redirect_uri: 'loro://account', code_challenge: 'a'.repeat(43) },
    responses: {
      200: {
        authorization_url: 'https://accounts.google.com/o/oauth2/v2/auth',
        state: 'b'.repeat(43),
      },
    },
  },
  oauthCallbackGet: { responses: { 303: 'Redirecting to the registered application.' } },
  oauthCallbackPost: { responses: { 303: 'Redirecting to the registered application.' } },
  oauthExchange: {
    request: {
      ticket: 'a'.repeat(43),
      code_verifier: 'b'.repeat(43),
      device: signIn.device,
      anon_id: id,
    },
    responses: {
      200: {
        ...signedIn,
        claim: { ...claim, performed: false, mode: null, upload_required: true },
      },
    },
  },
  oauthMe: { responses: { 200: user } },
  health: { responses: { 200: health } },
  readiness: {
    responses: {
      200: { ...ready, checks: { ...ready.checks, database: 'ok' } },
      503: { ...unready, checks: { ...unready.checks, database: 'unavailable' } },
    },
  },
  contentManifest: { responses: { 200: manifest } },
  contentDiff: { responses: { 200: diff } },
  contentPack: { responses: { 200: pack } },
  authCapabilities: { responses: { 200: { apple: false, google: false, email: false } } },
  authApple: {
    request: signIn,
    responses: {
      200: {
        ...signedIn,
        claim: { ...claim, performed: false, mode: null, upload_required: true },
      },
    },
  },
  authGoogle: {
    request: signIn,
    responses: {
      200: {
        ...signedIn,
        claim: { ...claim, performed: false, mode: null, upload_required: true },
      },
    },
  },
  authMagicLink: { request: { email: 'learner@example.com' }, responses: { 202: accepted } },
  authMagicVerify: {
    request: { email: 'learner@example.com', code: '123456', anon_id: id, device: signIn.device },
    responses: {
      200: {
        ...signedIn,
        claim: { ...claim, performed: false, mode: null, upload_required: true },
      },
    },
  },
  authRefresh: { request: { refresh_token: tokens.refresh_token }, responses: { 200: tokens } },
  authLogout: { request: { refresh_token: tokens.refresh_token }, responses: {} },
  authClaim: {
    request: { anon_id: id, device_id: 'device_example', request_id: id },
    responses: {
      200: { performed: false, mode: null, claim_id: 'claim_example', upload_required: true },
    },
  },
  accountRead: { responses: { 200: { user, device_id: 'device_example' } } },
  syncPush: {
    request: { client_hlc: hlc, ops: [] },
    responses: { 200: { ...pushed, aliases: [] } },
  },
  syncPull: {
    request: { since: null, limit: 500 },
    responses: { 200: { ...pulled, next: 'opaque_cursor_example', aliases: [] } },
  },
  syncStatus: { responses: { 200: { merge: 'loro-core (wasm)', entities: 0 } } },
  aiScene: { request: { theme: 'Café' }, responses: { 201: sceneResponse } },
  aiThemes: { responses: { 200: { themes: ['Café', 'Hotel'], provider: 'stub' } } },
}
export const targetExamples: Readonly<Record<string, WireExample>> = {
  contentReleaseManifest: {
    responses: {
      200: {
        manifestVersion: 1,
        catalogVersion: 1,
        lang: 'es-ES',
        phraseCount: 1,
        minAppVersion: '1.0.0',
        resources: [
          {
            id: 'catalog-es-ES',
            kind: 'catalog',
            version: 1,
            uri: `sha256/${hash}.json`,
            sha256: hash,
            bytes: 1,
          },
        ],
        signature: { algorithm: 'ed25519', keyId: 'release-1', value: 'illustrative-signature' },
      },
    },
  },
  health: { responses: { 200: health } },
  readiness: { responses: { 200: ready, 503: unready } },
  authApple: { request: signIn, responses: { 200: signedIn } },
  authGoogle: { request: signIn, responses: { 200: signedIn } },
  authMagicLink: { request: { email: 'learner@example.com' }, responses: { 202: accepted } },
  authMagicVerify: {
    request: { email: 'learner@example.com', code: '123456', anon_id: id, device: signIn.device },
    responses: { 200: signedIn },
  },
  authRefresh: { request: { refresh_token: tokens.refresh_token }, responses: { 200: tokens } },
  authClaim: {
    request: { anon_id: id, device_id: 'device_example', request_id: id },
    responses: { 200: claim },
  },
  syncPush: { request: { client_hlc: hlc, ops: [] }, responses: { 200: pushed } },
  syncPull: {
    request: { since: null, limit: 500 },
    responses: { 200: { ...pulled, next: 'opaque_cursor_example' } },
  },
  contentManifest: {
    responses: {
      200: {
        ...manifest,
        resource_base: 'https://cdn.loro.app/resources/',
        full_catalog: { uri: `sha256/${hash}`, sha256: hash, bytes: 0 },
        resources: [],
      },
    },
  },
  contentDiff: { responses: { 200: diff } },
  contentPack: { responses: { 200: { ...pack, catalog_version: 0 } } },
  aiScene: {
    request: {
      theme: 'Café',
      level: 'some',
      tag_profile: { pron: 0, remember: 0, useful: 0, words: 0 },
      phrase_ids: ['cafe1'],
      locale: 'es-ES',
    },
    responses: { 200: { ...sceneResponse, provenance: 'bundled' } },
  },
  aiThemes: { responses: { 200: { themes: ['Café', 'Hotel'] } } },
  aiCoach: {
    request: {
      scene_id: 'scene_example',
      turn_index: 0,
      npc: line,
      learner_text: line.es,
      locale: 'es-ES',
    },
    responses: {
      200: { status: 'unavailable', reason: 'provider_unavailable', provenance: 'unavailable' },
    },
  },
  aiTranslate: {
    request: { lines: [line.es], source: 'es', target: 'en' },
    responses: {
      200: {
        results: [
          {
            status: 'unavailable',
            index: 0,
            es: line.es,
            en: null,
            confidence: null,
            needs_review: true,
            provenance: 'unavailable',
          },
        ],
      },
    },
  },
  aiEnrich: {
    request: { phrase: line, locale: 'es-ES' },
    responses: {
      200: {
        resp: 'oon kah-FEH por fah-VOR',
        words: [{ es: 'café', gloss: 'coffee' }],
        example: line,
        hint: 'Café also names the place serving coffee.',
        register: 'neutral',
        provenance: 'live',
        review_required: true,
      },
    },
  },
  accountExport: { responses: { 202: { job_id: 'export_example', status: 'queued' } } },
  accountExportStatus: { responses: { 200: { job_id: 'export_example', status: 'running' } } },
  accountDelete: {
    request: { confirm: 'DELETE' },
    responses: { 202: { scheduled_for: 1721644800123 } },
  },
  analyticsBatch: { request: { events: [] }, responses: { 202: { accepted: 0, rejected: [] } } },
}
const entitlements = {
  schema_version: 1,
  entitlements: [],
  expires_at: null,
  grace_until: null,
  issued_at: 1721558400123,
  source: 'app_store',
  key_id: 'unresolved_example_key',
  signature: 'illustrative-not-a-valid-signature',
}
const purchase = {
  platform: 'ios',
  receipt: 'illustrative-not-a-store-receipt',
  product_id: 'unresolved_example_product',
}
export const draftExamples: Readonly<Record<string, WireExample>> = {
  chatTurn: {
    request: {
      request_id: id,
      thread_id: id,
      topic_id: 'cafe',
      pace: 'natural',
      locale: 'es-ES',
      turns: [{ id, speaker: 'learner', text: line.es }],
    },
    responses: {
      200: {
        request_id: id,
        provenance: 'bundled',
        degraded: true,
        safety: 'ok',
        reply: { ...line, id: replyId },
        suggestions: [],
        feedback: [],
      },
    },
  },
  phraseSuggest: {
    request: { target_locale: 'es-ES', native_language: 'en', query: 'pharmacy' },
    responses: {
      200: {
        fallback: true,
        provenance: 'bundled',
        candidates: [
          {
            target_text: '¿Dónde está la farmacia de guardia?',
            translation: 'Where is the all-night pharmacy?',
            theme: 'Survival',
            emoji: '💊',
            provenance: 'bundled',
            source: 'generated',
            needs_review: true,
          },
        ],
      },
    },
  },
  ttsRender: {
    request: {
      text: line.es,
      lang: 'es-ES',
      phrase_hash: hash,
      voice_id: 'listening_voice_a',
      model_id: 'eleven_multilingual_v2',
      asset_class: 'listening',
      codec: 'aac-64k-mono-24k',
      phrase_id: 'cafe1',
    },
    responses: {
      200: {
        uri: `sha256/${hash}`,
        sha256: hash,
        ms: 1420,
        cached: true,
        download_url: 'https://cdn.loro.test/sha256/' + hash + '.m4a',
        voice_id: 'listening_voice_a',
        model_id: 'eleven_multilingual_v2',
        asset_class: 'listening',
      },
    },
  },
  billingVerify: { request: purchase, responses: { 200: entitlements } },
  billingEntitlements: { responses: { 200: entitlements } },
  billingRestore: { request: { purchases: [purchase] }, responses: { 200: entitlements } },
  billingWebhook: { responses: { 202: accepted } },
  accountRead: { responses: { 200: { ...user, deletion_scheduled_for: null } } },
  accountDevices: { responses: { 200: { devices: [], next: null } } },
  deviceRevoke: { responses: { 202: accepted } },
  authLogout: { responses: { 202: accepted } },
  configuration: {
    responses: {
      200: {
        version: 0,
        expires_at: 1721558400123,
        flags: { live_chat: false, loop_experiment: false, run: false },
        assignments: [],
      },
    },
  },
  musicLyrics: {
    request: {
      target_locale: 'es-ES',
      meaning_language: 'en',
      catalog_phrase_ids: ['cafe1', 'cafe2', 'cafe3'],
      tag_profile: { pron: 1, remember: 0, useful: 2, words: 0 },
    },
    responses: {
      200: {
        lyric_document_id: 'lyric_example',
        document: {
          schema_version: 1,
          target_locale: 'es-ES',
          meaning_language: 'en',
          catalog_version: 1,
          phrase_ids: ['cafe1', 'cafe2', 'cafe3'],
          title: { target: 'Me pone un cortado, por favor', translation: 'A cortado, please' },
          sections: [
            {
              name: 'Verse 1',
              lines: ['Me pone un cortado, por favor', '¿Tienen leche de avena?'],
            },
            { name: 'Chorus', lines: ['Me pone un cortado, por favor'] },
            { name: 'Verse 2', lines: ['Para llevar, por favor'] },
          ],
          used_phrases: [
            {
              catalog_phrase_id: 'cafe1',
              target_text: 'Me pone un cortado, por favor',
              section_name: 'Verse 1',
              line_index: 0,
              match: 'exact_line',
            },
            {
              catalog_phrase_id: 'cafe2',
              target_text: '¿Tienen leche de avena?',
              section_name: 'Verse 1',
              line_index: 1,
              match: 'exact_line',
            },
            {
              catalog_phrase_id: 'cafe3',
              target_text: 'Para llevar, por favor',
              section_name: 'Verse 2',
              line_index: 0,
              match: 'exact_line',
            },
          ],
          gloss_lines: [
            { target: 'Me pone un cortado, por favor', translation: 'A cortado, please' },
            { target: '¿Tienen leche de avena?', translation: 'Do you have oat milk?' },
            { target: 'Para llevar, por favor', translation: 'To go, please' },
          ],
        },
        provenance: 'bundled',
        fallback: true,
        cached: false,
      },
    },
  },
  musicRenders: {
    request: {
      lyric_document_id: 'lyric_example',
      style_ids: ['acoustic_folk', 'modern_pop', 'gentle_ballad'],
    },
    responses: {
      200: {
        lyric_document_id: 'lyric_example',
        jobs: [
          {
            job_id: 'job_folk',
            style_id: 'acoustic_folk',
            status: 'ready',
            error_code: null,
            track_id: 'track_folk',
            duration_ms: 400,
          },
          {
            job_id: 'job_pop',
            style_id: 'modern_pop',
            status: 'ready',
            error_code: null,
            track_id: 'track_pop',
            duration_ms: 400,
          },
          {
            job_id: 'job_ballad',
            style_id: 'gentle_ballad',
            status: 'failed',
            error_code: 'invalid_audio',
            track_id: null,
            duration_ms: null,
          },
        ],
      },
    },
  },
  musicTrack: {
    responses: {
      200: {
        track_id: 'track_folk',
        style_id: 'acoustic_folk',
        sha256: hash,
        byte_length: 128,
        duration_ms: 400,
        content_type: 'audio/wav',
        generated: true,
        download_path: '/music/tracks/track_folk/content',
      },
    },
  },
}
/** Adds examples to the registry itself so docs and tests consume identical metadata. */
export function withExamples(
  operations: readonly Operation[],
  examples: Readonly<Record<string, WireExample>>,
): readonly Operation[] {
  return operations.map((op) => {
    const example = examples[op.id]
    if (!example) throw new Error(`Missing examples for ${op.id}`)
    return {
      ...op,
      ...(op.request && example.request !== undefined
        ? {
            request: {
              ...op.request,
              examples: [{ name: 'illustrative', value: example.request }],
            },
          }
        : {}),
      responses: Object.fromEntries(
        Object.entries(op.responses).map(([status, response]) => [
          status,
          {
            ...response,
            ...(Object.hasOwn(example.responses, Number(status))
              ? { examples: [{ name: 'illustrative', value: example.responses[Number(status)] }] }
              : {}),
          },
        ]),
      ),
    }
  })
}
