/**
 * Plan 108: the notes Loro's written rules work out for a phrase (ported from the app's
 * `src/shared/notes/notes.test.ts`, whose rules these are).
 */
import { LibraryNotesSchema } from '@loro/core/api/library'
import { V2_COURSES, V2_ICON_NAMES, V2_NATIVES } from '@loro/content/v2'
import { describe, expect, it } from 'vitest'
import { knownStress, transcribeBulgarian } from './bg.js'
import { KNOWN_PHRASES, type PhraseNotes } from './content.js'
import { transcribeSpanish } from './es.js'
import { BULGARIAN_GRAMMAR, SPANISH_GRAMMAR } from './grammar.js'
import { DEVICE_NOTE_LANGUAGES, deviceNotes } from './index.js'
import { memoryNote, pieces } from './memory.js'
import { bulgarianNumber, spanishNumber } from './numbers.js'
import { pictureFor, WORD_ICONS } from './picture.js'

const LORO = KNOWN_PHRASES

/** The notes as a phrase may carry them: every note present, the IPA in [square brackets]. */
function validNotes(notes: PhraseNotes): boolean {
  return LibraryNotesSchema.safeParse(notes).success && /^\[.+\]$/.test(notes.pronunciation.ipa)
}

/** One to three icons, each one the app can draw. */
function validImage(image: string[]): boolean {
  return image.length >= 1 && image.length <= 3 && image.every((i) => V2_ICON_NAMES.includes(i))
}

/**
 * Where the rules and the course's own transcriptions differ, each read and kept on purpose: the
 * corpus is inconsistent with itself there, or wrong. Any other difference fails, as does one of
 * these disappearing (update the list).
 */
const REVIEWED: Record<string, string> = {
  'cafe-05':
    'n before a consonant takes its place across words too (the corpus does it in «un cortado», not here)',
  'transit-04': 'the same n assimilation',
  'bank-airport-es-06': 'the same n assimilation',
  'bank-booking-es-02': 'the same n assimilation',
  'tapas-04': 'b after a vowel is soft [β]; the corpus has [b]',
  'market-04':
    'a comma is a pause, so g starts hard; the corpus is soft here and hard in «mirando, gracias»',
  'sobremesa-02': '«hemos» is stressed HE-mos; the corpus has [eˈmos]',
  'bank-hotel-es-05': 's isn’t voiced before m, as everywhere else in the corpus',
  'bank-meeting-es-05': 'd after s is soft [ð], as the corpus has in «desde»',
  'bank-work-es-05': 'a falling i glide is [j], as in the rest of the corpus',
  'bg-kafene-01':
    'the stress mark sits before the last consonant of a cluster that isn’t stop + r/l; the corpus varies',
  'bank-hotel-bg-03': 'the same syllable boundary',
  'bank-airport-bg-04': 'the same syllable boundary',
  'bank-airport-bg-05': 'the same syllable boundary',
  'bank-work-bg-02': 'the same syllable boundary',
  'bank-phone-bg-05': 'the same syllable boundary',
  'bg-kafene-03':
    'a word’s last consonant is voiceless unless a voiced one follows: «без» [bɛs] before л',
  'bg-kafene-04': 'unstressed о is [o], as in the corpus’s «Много е студено»',
  'bg-grad-03': 'unstressed а is [ɐ]',
  'bg-grad-04':
    'a word of one syllable that isn’t a clitic is stressed, as the corpus has «тук» elsewhere',
  'bank-work-bg-05': 'the same: «днес» is stressed, as elsewhere in the corpus',
  'bank-health-bg-02': '-ие without an inserted [j], as in the corpus’s «управление»',
  'bank-clothes-bg-01':
    'a hyphened comparative is one word with secondary stress, as the corpus writes «по-бавно»',
  'bank-help-bg-04': 'the same',
  'bank-phone-bg-04': 'the same',
  'bank-meeting-bg-02': 'в after к stays [v], as in the corpus’s «свободна»',
}

describe('the device’s sound rules', () => {
  it('transcribe Loro’s own phrases as the course does, but for reviewed differences', () => {
    const differ = LORO.filter(
      (p) =>
        (p.targetLang === 'es-ES' ? transcribeSpanish(p.target) : transcribeBulgarian(p.target))
          .ipa !== p.notes.pronunciation.ipa,
    )
    expect(differ.map((p) => p.id).sort()).toEqual(Object.keys(REVIEWED).sort())
    expect(LORO.length - differ.length, 'most phrases match exactly').toBeGreaterThanOrEqual(140)
  })

  it('Spanish: stress from the spelling, glides, soft consonants and n before the next consonant', () => {
    expect(transcribeSpanish('Me pone un cortado, por favor').ipa).toBe(
      '[me ˈpo.ne uŋ koɾˈta.ðo poɾ faˈβoɾ]',
    )
    expect(transcribeSpanish('ciudad').ipa, 'ends in d: the last syllable').toBe('[θjuˈðað]')
    expect(transcribeSpanish('árbol').ipa, 'a written accent wins; b after r is soft').toBe(
      '[ˈaɾ.βol]',
    )
    expect(transcribeSpanish('país').ipa, 'an accented i breaks the diphthong').toBe('[paˈis]')
    expect(transcribeSpanish('hay').ipa).toBe('[ˈaj]')
    expect(transcribeSpanish('guerra, pingüino').ipa).toBe('[ˈɡe.ra piŋˈɡwi.no]')
    expect(transcribeSpanish('taxi').ipa).toBe('[ˈtak.si]')
    expect(transcribeSpanish('Está libre').respelling).toBe('es-TAH LEE-breh')
    expect(transcribeSpanish('¿Va a llover?').respelling, 'b and v keep their letter').toBe(
      'VAH ah yoh-VER',
    )
  })

  it('Bulgarian: known stress only, and voicing', () => {
    expect(knownStress('сметката')).toBe(0)
    expect(knownStress('сметка'), 'the word without its article keeps the stress').toBe(0)
    expect(knownStress('резервацията'), 'ре-зер-ВА-ци-я-та').toBe(2)
    expect(knownStress('струва'), 'learned from the course').toBe(0)
    expect(knownStress('трае')).toBeNull()
    const t = transcribeBulgarian('Искам хляб, трае ли?')
    expect(t.ipa, 'no guessed stress; хляб devoiced before the pause').toBe(
      '[ˈiskɐm ˈxʎap traɛ li]',
    )
    expect(t.words.filter((w) => w.stressUnknown).map((w) => w.token.word)).toEqual(['трае'])
    expect(transcribeBulgarian('вкъщи').ipa, 'в before к; щ is ʃt').toBe('[ˈfkɤʃti]')
    expect(transcribeBulgarian('друг ден').ipa, 'voiced before voiced').toBe('[ˈdruɡ ˈdɛn]')
  })
})

describe('notes worked out by the rules', () => {
  it('cover every course language', () => {
    for (const lang of V2_COURSES)
      expect(DEVICE_NOTE_LANGUAGES.includes(lang), `${lang} has no sound rules yet`).toBe(true)
  })

  it('give every phrase, as any learner could type it, a picture and all three notes', () => {
    for (const phrase of LORO) {
      for (const nativeLang of V2_NATIVES.filter((l) => l !== phrase.targetLang)) {
        const native = phrase.translations[nativeLang] ?? phrase.translations['en-GB'] ?? ''
        const made = deviceNotes({
          target: phrase.target,
          native,
          targetLang: phrase.targetLang,
          nativeLang,
        })
        expect(validNotes(made.notes), `${phrase.id}: ${JSON.stringify(made.notes)}`).toBe(true)
        expect(validImage(made.image), `${phrase.id}: ${made.image.join(', ')}`).toBe(true)
        for (const kind of ['mnemonic', 'grammar', 'pronunciation'] as const) {
          const versions = made.noteTranslations[kind] ?? {}
          expect(phrase.targetLang in versions, 'never in the phrase’s own language').toBe(false)
          for (const code of V2_NATIVES.filter((l) => l !== 'en-GB' && l !== phrase.targetLang)) {
            expect(
              Boolean(versions[code]?.title && versions[code].text),
              `${phrase.id} ${kind} in ${code}`,
            ).toBe(true)
          }
        }
      }
    }
  })

  it('whatever is typed, numbers said as words; a text with nothing to say still has notes', () => {
    const odd = [
      'OK',
      '123 abc',
      'Hola 👋',
      'x-y-z',
      'Здравей, ok?',
      'ññññ',
      'яяя',
      'щ',
      '10:30',
      '2',
      '1000000',
      '007',
    ]
    for (const target of odd) {
      for (const targetLang of V2_COURSES) {
        const made = deviceNotes({ target, native: target, targetLang, nativeLang: 'en-GB' })
        expect(validNotes(made.notes), `${target} in ${targetLang}`).toBe(true)
        expect(made.image.length).toBeGreaterThan(0)
      }
    }
    expect(transcribeSpanish('Mesa para 2').ipa).toBe('[ˈme.sa ˈpa.ɾa ˈðos]')
    expect(transcribeSpanish('21000 y 101').ipa).toBe('[bejnˈtjum ˈmil i ˈθjen.to ˈu.no]')
    expect(transcribeBulgarian('В 10 часа').ipa).toBe('[v ˈdɛsɛt t͡ʃɐˈsa]')
    expect(bulgarianNumber(125)).toBe('сто двадесет и пет')
    expect(bulgarianNumber(21000)).toBe('двадесет и една хиляди')
    expect(spanishNumber(1999)).toBe('mil novecientos noventa y nueve')
    for (const text of ['?', '¡¡¡!!!', '👋', '  ']) {
      const made = deviceNotes({
        target: text,
        native: 'x',
        targetLang: 'es-ES',
        nativeLang: 'en-GB',
      })
      expect(validNotes(made.notes), `«${text}» still never breaks`).toBe(true)
    }
  })

  it('are what a phrase the learner typed gets, until the bank or the writer has better', () => {
    const made = deviceNotes({
      target: 'Quiero un zumo de naranja',
      native: 'I’d like an orange juice',
      targetLang: 'es-ES',
      nativeLang: 'en-GB',
    })
    expect(made.notes.grammar.title).toBe('«Quiero»: asking for something')
    expect(made.notes.pronunciation.ipa).toBe('[ˈkje.ɾo un ˈθu.mo ðe naˈɾaŋ.xa]')
    expect(made.image.slice(0, 2)).toEqual(['local_drink', 'nutrition'])
  })
})

describe('the grammar rule', () => {
  const pick = (rules: typeof SPANISH_GRAMMAR, text: string) =>
    rules.find((r) => r.find(text) !== null)?.id
  it('names the construction the phrase shows, or a rule true of any', () => {
    expect(pick(SPANISH_GRAMMAR, 'Me gustan los perros')).toBe('gustar')
    expect(pick(SPANISH_GRAMMAR, 'Tengo que irme')).toBe('tener-que')
    expect(pick(SPANISH_GRAMMAR, 'Voy a comer')).toBe('ir-a')
    expect(pick(SPANISH_GRAMMAR, 'Estoy leyendo')).toBe('progressive')
    expect(pick(SPANISH_GRAMMAR, 'Del mercado')).toBe('al-del')
    expect(pick(SPANISH_GRAMMAR, 'Gracias')).toBe('gender')
    expect(pick(BULGARIAN_GRAMMAR, 'Ще дойда утре')).toBe('shte')
    expect(pick(BULGARIAN_GRAMMAR, 'Няма да дойда')).toBe('nyama-da')
    expect(pick(BULGARIAN_GRAMMAR, 'Искам да отида')).toBe('da')
    expect(pick(BULGARIAN_GRAMMAR, 'Сметката')).toBe('article')
    expect(pick(BULGARIAN_GRAMMAR, 'Вземи си чадър'), '«си» here isn’t «to be»').toBe('no-cases')
    expect(pick(BULGARIAN_GRAMMAR, 'Благодаря')).toBe('no-cases')
  })
})

describe('the memory hint', () => {
  const hint = (
    target: string,
    native: string,
    targetLang: 'es-ES' | 'bg-BG' = 'es-ES',
    nativeLang: 'en-GB' | 'ru-RU' = 'en-GB',
  ) =>
    memoryNote({
      target,
      native,
      targetLang,
      nativeLang,
      sound: targetLang === 'es-ES' ? transcribeSpanish(target) : transcribeBulgarian(target),
    })
  it('hangs the phrase on what it resembles or shares, else on its shape', () => {
    expect(hint('La farmacia', 'The pharmacy').en.title).toBe('«farmacia» and «pharmacy»')
    expect(hint('Искам хляб', 'Хочу хлеб', 'bg-BG', 'ru-RU').ru.title).toBe('«хляб» и «хлеб»')
    expect(hint('Un cortado doble', 'A double cortado… espresso').en.title).toMatch(/cortado/)
    expect(hint('Riega las plantas del balcón', 'Do the watering outside').en.text).toBe(
      'Learn it in pieces: «Riega las plantas» · «del balcón». Say each one twice, then join them up.',
    )
    expect(hint('Vale', 'OK').en.title).toBe('Tap out «Vale»')
    expect(
      hint('Чудесно', 'Wonderful', 'bg-BG').en.text,
      'stress unknown to Loro: no capitals',
    ).toBe('Say it slowly, one beat at a time — Чу·дес·но — then at full speed.')
  })
  it('splits a phrase into pieces that end on a meaningful word', () => {
    expect(pieces('Me pone un cortado, por favor')).toEqual(['Me pone', 'un cortado', 'por favor'])
  })
})

describe('the picture', () => {
  it('uses registry icons, and speech bubbles when nothing matches', () => {
    for (const icon of Object.values(WORD_ICONS)) expect(V2_ICON_NAMES, icon).toContain(icon)
    expect(pictureFor('Qwerty', 'Zxcv')).toEqual(['forum'])
    expect(pictureFor('¿Dónde está la farmacia?', 'Where is the pharmacy?')[0]).toBe(
      'local_pharmacy',
    )
    expect(pictureFor('Искам хляб', 'Хочу хлеб')[0]).toBe('bakery_dining')
  })
})
