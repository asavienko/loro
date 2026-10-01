/**
 * The library (plan 106): Loro's pre-generated sets and albums, what learners make with AI, and how
 * it is shared. Requests are checked here; responses are the API's own camelCase shapes, which the
 * app reads without zod.
 */
import { z } from 'zod'
import { MUSIC_STYLE_IDS } from '../domain/lyric-plan.js'

/**
 * The languages and courses the library accepts: those of `packages/content/v2/languages.json`,
 * which `GET /v1/library/languages` serves (literal here for zod; content's v2 test keeps them equal).
 */
export const LIBRARY_LANGUAGES = ['en-GB', 'es-ES', 'bg-BG', 'ru-RU'] as const
export const LIBRARY_COURSES = ['es-ES', 'bg-BG'] as const
export const LibraryLanguageSchema = z.enum(LIBRARY_LANGUAGES)
export const LibraryCourseSchema = z.enum(LIBRARY_COURSES)
/** `private`: only its owner. `link`: anyone holding its share code. `public`: listed in Community. */
export const VisibilitySchema = z.enum(['private', 'link', 'public'])
export const LevelSchema = z.enum(['A1', 'A2', 'B1'])
/** The server's ids, and the ones a device gave a learner's phrases and sets before upload (plan 108). */
export const LibraryIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9.-]{2,95}$/)
  .refine((id) => !id.includes('..'))
export const PhraseIdSchema = LibraryIdSchema
/** The id a device gave a learner's phrase or set, kept when it is uploaded so its progress stays. */
const DevicePhraseIdSchema = z.string().regex(/^mine-p-[a-z0-9][a-z0-9.-]{2,80}$/)
const DeviceSetIdSchema = z.string().regex(/^mine-s-[a-z0-9][a-z0-9.-]{2,80}$/)
export const ShareCodeSchema = z.string().regex(/^[a-z0-9]{10}$/)
export const IconNameSchema = z.string().regex(/^[a-z0-9_]{1,40}$/)

/** The same limits the app's forms and notes use (apps/mobile/src/shared/state/limits.ts). */
export const LIBRARY_TEXT = {
  phrase: 120,
  title: 60,
  description: 120,
  noteTitle: 60,
  noteText: 300,
}

/** Links are how spam travels; nothing a learner names or describes here needs one. */
const SCHEME = /https?:\/\/|\bwww\./i
/** A domain: a label, a common top-level domain, then the end, a space or a path. */
const DOMAIN = /\b[a-z0-9-]{2,}\.(?:com|net|org|io|ru|xyz|info|biz|top|link|click)(?=[\s/:?#)]|$)/

/**
 * Whether text holds a link. A full stop straight before a capital starts a sentence
 * ("Unit 3.Top phrases"), not a domain, so it counts as one with a space.
 */
export function hasLink(text: string): boolean {
  return SCHEME.test(text) || DOMAIN.test(text.replace(/\.(?=[A-Z])/g, '. ').toLowerCase())
}

/** Text other learners may read (titles, descriptions, names): trimmed, bounded, without links. */
export const shownText = (max: number, min = 0) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((text) => !hasLink(text), { message: 'Links are not allowed here' })

const NoteSchema = z.strictObject({
  title: z.string().trim().min(1).max(LIBRARY_TEXT.noteTitle),
  text: z.string().trim().min(1).max(LIBRARY_TEXT.noteText),
})
export const LibraryNotesSchema = z.strictObject({
  mnemonic: NoteSchema,
  grammar: NoteSchema,
  pronunciation: NoteSchema.extend({
    ipa: z.string().trim().min(3).max(LIBRARY_TEXT.noteText),
    respelling: z.string().trim().min(1).max(LIBRARY_TEXT.noteText),
  }),
})

/** Where a phrase in a learner's set came from, shown beside it. */
export const PhraseSourceSchema = z.enum(['ai', 'bank', 'course', 'written'])

/** Who wrote a learner's phrase's notes: Claude, or Loro's written rules (plan 108). */
export const NotesBySchema = z.enum(['ai', 'rules'])

export const NewPhraseSchema = z.strictObject({
  /** A phrase uploaded from a device keeps the device's id (plan 108). */
  id: DevicePhraseIdSchema.optional(),
  target: z.string().trim().min(1).max(LIBRARY_TEXT.phrase),
  native: z.string().trim().min(1).max(LIBRARY_TEXT.phrase),
  /** Without a picture and notes, the server writes both by its rules (plan 108). */
  image: z.array(IconNameSchema).min(1).max(3).optional(),
  notes: LibraryNotesSchema.optional(),
  notesBy: NotesBySchema.optional(),
  source: PhraseSourceSchema,
  /** The phrase bank's phrase it is: the set keeps the bank's notes and their translations. */
  bankId: z
    .string()
    .regex(/^bank-[a-z0-9-]{3,60}$/)
    .optional(),
})

/**
 * A phrase already in the library, listed by a learner's set rather than copied (plan 108): one of
 * Loro's, or one of the learner's own. It keeps one progress wherever it is listed.
 */
export const PhraseRefSchema = z.strictObject({ ref: PhraseIdSchema })

/** What a learner's set lists: a phrase it holds, or a reference to one held elsewhere. */
export const SetItemSchema = z.union([PhraseRefSchema, NewPhraseSchema])

export const MAX_SET_PHRASES = 40

export const CreateSetSchema = z
  .strictObject({
    /** A set uploaded from a device keeps the device's id; uploading it again changes nothing. */
    id: DeviceSetIdSchema.optional(),
    title: shownText(LIBRARY_TEXT.title, 1),
    description: shownText(LIBRARY_TEXT.description).optional(),
    targetLang: LibraryCourseSchema,
    nativeLang: LibraryLanguageSchema,
    level: LevelSchema.default('A2'),
    topicId: z
      .string()
      .regex(/^[a-z-]{2,40}$/)
      .optional(),
    coverIcon: IconNameSchema.optional(),
    coverId: LibraryIdSchema.optional(),
    visibility: VisibilitySchema.default('private'),
    /** May be empty: a new set is filled afterwards. */
    phrases: z.array(SetItemSchema).max(MAX_SET_PHRASES),
  })
  .refine((set) => set.targetLang !== set.nativeLang, {
    message: 'A course is never in the learner’s own language',
    path: ['nativeLang'],
  })

export const UpdateSetSchema = z.strictObject({
  title: shownText(LIBRARY_TEXT.title, 1).optional(),
  description: shownText(LIBRARY_TEXT.description).nullable().optional(),
  level: LevelSchema.optional(),
  visibility: VisibilitySchema.optional(),
  coverId: LibraryIdSchema.nullable().optional(),
  /** Appended at the end, in order. */
  addPhrases: z.array(SetItemSchema).max(MAX_SET_PHRASES).optional(),
  removePhraseIds: z.array(PhraseIdSchema).max(MAX_SET_PHRASES).optional(),
  /** The set's phrases in their new order, after what is added and removed. */
  order: z.array(PhraseIdSchema).max(MAX_SET_PHRASES).optional(),
})

/** A learner's phrase with new words: notes and picture written again unless sent. */
export const EditPhraseSchema = z.strictObject({
  target: z.string().trim().min(1).max(LIBRARY_TEXT.phrase),
  native: z.string().trim().min(1).max(LIBRARY_TEXT.phrase),
  image: z.array(IconNameSchema).min(1).max(3).optional(),
  notes: LibraryNotesSchema.optional(),
  notesBy: NotesBySchema.optional(),
})

/**
 * A phrase the learner adds on its own (plan 108): into one of their sets, or without one into their
 * "My phrases" set for the course, made the first time with `inboxTitle`.
 */
export const AddPhraseSchema = z
  .strictObject({
    phrase: NewPhraseSchema,
    targetLang: LibraryCourseSchema,
    nativeLang: LibraryLanguageSchema,
    setId: LibraryIdSchema.optional(),
    inboxTitle: shownText(LIBRARY_TEXT.title, 1),
  })
  .refine((r) => r.targetLang !== r.nativeLang, {
    message: 'A course is never in the learner’s own language',
    path: ['nativeLang'],
  })

export const CreateAlbumSchema = z.strictObject({
  title: shownText(LIBRARY_TEXT.title, 1),
  description: shownText(LIBRARY_TEXT.description).optional(),
  targetLang: LibraryCourseSchema,
  coverId: LibraryIdSchema.optional(),
  visibility: VisibilitySchema.default('private'),
})

export const UpdateAlbumSchema = z.strictObject({
  title: shownText(LIBRARY_TEXT.title, 1).optional(),
  description: shownText(LIBRARY_TEXT.description).nullable().optional(),
  visibility: VisibilitySchema.optional(),
  coverId: LibraryIdSchema.nullable().optional(),
  removeSongIds: z.array(LibraryIdSchema).max(100).optional(),
})

export const SaveSchema = z.strictObject({
  kind: z.enum(['set', 'album']),
  id: LibraryIdSchema,
})

/** Why a learner reports a public set or album. */
export const ReportSchema = z.strictObject({
  kind: z.enum(['set', 'album']),
  id: LibraryIdSchema,
  reason: z.enum(['offensive', 'wrong', 'spam', 'other']),
})

export const ProfileSchema = z.strictObject({
  displayName: shownText(40, 1),
})

export const SUGGEST_MODES = ['topic', 'keywords', 'text'] as const
/** How long each kind of request may be, as the app's Make a set form allows. */
export const SUGGEST_INPUT_LIMITS = { topic: 80, keywords: 200, text: 2000 } as const
export const DECK_SIZE = 12

export const GeneratePhrasesSchema = z
  .strictObject({
    mode: z.enum(SUGGEST_MODES),
    input: z.string().trim().min(2).max(SUGGEST_INPUT_LIMITS.text),
    targetLang: LibraryCourseSchema,
    nativeLang: LibraryLanguageSchema,
    count: z.int().min(1).max(DECK_SIZE).default(DECK_SIZE),
    /** Phrases the learner has or has already seen: not to be written again. */
    avoid: z.array(z.string().max(LIBRARY_TEXT.phrase)).max(100).default([]),
  })
  .refine((r) => r.input.length <= SUGGEST_INPUT_LIMITS[r.mode], {
    message: 'Input too long',
    path: ['input'],
  })
  .refine((r) => r.targetLang !== r.nativeLang, {
    message: 'A course is never in the learner’s own language',
    path: ['nativeLang'],
  })

/** Notes and a picture for a phrase the learner wrote themselves. */
export const GenerateNotesSchema = z
  .strictObject({
    target: z.string().trim().min(1).max(LIBRARY_TEXT.phrase),
    native: z.string().trim().min(1).max(LIBRARY_TEXT.phrase),
    targetLang: LibraryCourseSchema,
    nativeLang: LibraryLanguageSchema,
  })
  .refine((r) => r.targetLang !== r.nativeLang, {
    message: 'A course is never in the learner’s own language',
    path: ['nativeLang'],
  })

export const GenerateCoverSchema = z.strictObject({
  kind: z.enum(['set', 'album']),
  title: shownText(LIBRARY_TEXT.title, 1),
  description: shownText(200).optional(),
  /** The learner's set or album to put the cover on once drawn. */
  attachTo: LibraryIdSchema.optional(),
})

export const GenerateSongSchema = z.strictObject({
  /** Any set the learner can read: Loro's, theirs, or a shared one. */
  setId: LibraryIdSchema,
  styleId: z.enum(MUSIC_STYLE_IDS),
  nativeLang: LibraryLanguageSchema,
  title: shownText(LIBRARY_TEXT.title, 1).optional(),
  /** The learner's album to add it to; without one, a new album named after the set. */
  albumId: LibraryIdSchema.optional(),
})

/** Trying a failed song again: the language its lines are glossed in, as when it was made. */
export const RetrySongSchema = z.strictObject({ nativeLang: LibraryLanguageSchema })

export type Visibility = z.infer<typeof VisibilitySchema>
export type LibraryLanguage = z.infer<typeof LibraryLanguageSchema>
export type LibraryCourse = z.infer<typeof LibraryCourseSchema>
export type LibraryNotes = z.infer<typeof LibraryNotesSchema>
export type NewPhrase = z.infer<typeof NewPhraseSchema>
export type SetItem = z.infer<typeof SetItemSchema>
export type PhraseSource = z.infer<typeof PhraseSourceSchema>
export type CreateSetRequest = z.infer<typeof CreateSetSchema>
export type UpdateSetRequest = z.infer<typeof UpdateSetSchema>
export type CreateAlbumRequest = z.infer<typeof CreateAlbumSchema>
export type UpdateAlbumRequest = z.infer<typeof UpdateAlbumSchema>
export type GeneratePhrasesRequest = z.infer<typeof GeneratePhrasesSchema>
export type GenerateCoverRequest = z.infer<typeof GenerateCoverSchema>
export type GenerateNotesRequest = z.infer<typeof GenerateNotesSchema>
export type GenerateSongRequest = z.infer<typeof GenerateSongSchema>
