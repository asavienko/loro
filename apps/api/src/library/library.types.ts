/**
 * The library's wire shapes (plan 106). camelCase, as the app's content JSON is, so the app reads a
 * pack into the same structures it reads its content into.
 */
import type { V2LanguageInfo, V2Localized, V2Topic } from '@loro/content/v2'
import type { LibraryNotes, PhraseSource, Visibility } from '@loro/core/api/library'
import type { SongSection, WrittenPhrase } from './writers.js'

/** Whose it is, from the reader's side. */
export type Owner = 'loro' | 'me' | 'other'

type Language = 'en-GB' | 'en-US' | 'es-ES' | 'bg-BG' | 'ru-RU' | 'pl-PL' | 'cs-CZ'
interface Note {
  title: string
  text: string
}

export interface SetWire {
  id: string
  title: string
  /** Loro's sets have one per UI language; a learner's set has a description instead. */
  subtitle: V2Localized | null
  description: string | null
  topicId: string
  level: 'A1' | 'A2' | 'B1'
  coverIcon: string
  /** Path under the API's `/v1`, e.g. `/library/covers/cover-x.svg`; null draws the topic cover. */
  coverUrl: string | null
  targetLang: Language
  phraseIds: string[]
  /** Songs sung from it that anyone may hear, or its maker: a cover shows a song icon when > 0. */
  songCount: number
  owner: Owner
  /** The maker's display name; null for Loro or a learner who has not given one. */
  author: string | null
  visibility: Visibility
  /** Only the owner, or anyone for a shared or public item. */
  shareCode: string | null
  saved: boolean
  /** The learner's "My phrases" set for the course, where phrases added on their own go (plan 108). */
  inbox?: true
  /** Only on the reader's own public item that reports took out of Community; absent otherwise. */
  hidden?: true
  /** In Community listings: how many learners keep it in their library. */
  savedBy?: number
  createdAt: number
  updatedAt: number
}

export interface PhraseWire {
  id: string
  setId: string
  target: string
  translations: Partial<Record<Language, string>>
  register: 'formal' | 'informal' | 'neutral'
  region: string
  tags: string[]
  image: string[]
  words: Record<string, Partial<Record<Language, string>>>
  notes: LibraryNotes
  /** Note titles and texts in other native languages, by note kind. */
  noteTranslations: Partial<Record<keyof LibraryNotes, Partial<Record<Language, Note>>>>
  source: PhraseSource | 'loro'
  /** Who wrote a learner's phrase's notes, when it isn't told by its source (plan 108). */
  notesBy?: 'ai' | 'rules'
  /** Clips by language, where this server's voices speak it (library/speech.ts). */
  audio?: Partial<Record<Language, string>>
}

export interface SongLineWire {
  text: string
  meaning: string
  phraseId: string | null
  /** When the line plays, where the audio's timing is known (the demo sound); null otherwise. */
  startMs: number | null
  endMs: number | null
}

export interface SongWire {
  id: string
  albumId: string
  setId: string
  title: string
  styleId: string
  status: 'rendering' | 'ready' | 'failed'
  sections: { name: SongSection['name']; lines: SongLineWire[] }[]
  /** `ai` (the text model), or `phrases`: the set's phrases arranged with nothing added. */
  lyricsBy: 'ai' | 'phrases'
  audioUrl: string | null
  /** `elevenlabs`, or `demo`: the server's instrumental, labelled "Demo sound". */
  audioBy: 'elevenlabs' | 'demo' | null
  /** The lines are spoken over the sound (the server's voice over a demo, or sung). */
  voiced: boolean
  durationMs: number | null
  error: string | null
  createdAt: number
}

export interface AlbumWire {
  id: string
  title: string
  description: string | null
  coverUrl: string | null
  targetLang: Language
  owner: Owner
  author: string | null
  visibility: Visibility
  shareCode: string | null
  saved: boolean
  /** Only on the reader's own public item that reports took out of Community; absent otherwise. */
  hidden?: true
  /** In Community listings: how many learners keep it in their library. */
  savedBy?: number
  songCount: number
  /** Null while a song's length is unknown (a sung song), rather than a total that leaves it out. */
  durationMs: number | null
  createdAt: number
  updatedAt: number
}

export interface BankThemeWire {
  id: string
  title: V2Localized
  keywords: string[]
}

export interface BankPhraseWire {
  id: string
  theme: string
  targetLang: Language
  target: string
  translations: Partial<Record<Language, string>>
  image: string[]
  notes: LibraryNotes
  noteTranslations: PhraseWire['noteTranslations']
  /** Its clips, in each language this server's voices speak (plan 108). */
  audio?: Partial<Record<Language, string>>
}

export interface PackWire {
  /** Changes whenever anything in the pack does, so the app can tell a stale copy. */
  version: string
  targetLang: Language
  topics: V2Topic[]
  sets: SetWire[]
  phrases: PhraseWire[]
  bank: { themes: BankThemeWire[]; phrases: BankPhraseWire[] }
  albums: AlbumWire[]
  /** The reader's own covers of the course's phrases and songs, by id; empty signed out. */
  covers: { phrases: Record<string, string>; songs: Record<string, string> }
}

/** The languages the app offers (plan 108), and a version that changes whenever they do. */
export interface LanguagesWire {
  version: string
  languages: readonly V2LanguageInfo[]
}

/**
 * A cover the learner asked for (plan 111): `rendering` while it is drawn in the background, then
 * `ready` at its address, or `failed` when the work broke. `provider` is who drew it: a model (`ai`),
 * or the server's labelled pattern.
 */
export interface CoverState {
  id: string
  status: 'rendering' | 'ready' | 'failed'
  url: string | null
  provider: 'ai' | 'pattern'
  /** The learner's new copy of one of Loro's sets or albums, which takes the cover once it is ready. */
  copy?: { kind: 'set' | 'album'; id: string }
}

/** A deck of suggestions: the model's (`ai`), or the phrase bank's, with themes when it had none. */
export interface DeckWire {
  provider: 'ai' | 'bank'
  phrases: WrittenPhrase[]
  themes: { id: string; title: V2Localized }[]
}

/**
 * A deck written in the background (plan 111): `writing`, then `ready` with the deck, or `failed`.
 * A deck the bank answered at once has no id.
 */
export type DeckJobWire =
  ({ id: string | null; status: 'ready' } & DeckWire) | { id: string; status: 'writing' | 'failed' }

export type UsageKind = 'phrases' | 'cover' | 'song'
export type KeptKind = 'sets' | 'albums' | 'songs'

export interface UsageWire {
  /** The UTC day the allowances count, and when the next one starts. */
  day: string
  resetsAt: number
  daily: Record<UsageKind, { used: number; limit: number }>
  kept: Record<KeptKind, { used: number; limit: number }>
  /** Who writes each kind here: a model, or the labelled fallback. */
  writers: {
    phrases: 'ai' | 'bank'
    cover: 'ai' | 'pattern'
    lyrics: 'ai' | 'phrases'
    music: 'elevenlabs' | 'demo'
  }
}
