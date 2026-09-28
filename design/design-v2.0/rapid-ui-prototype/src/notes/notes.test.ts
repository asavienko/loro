import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BANK_PHRASES, CONTENT_PHRASES, NATIVE_LANGUAGES, TARGET_LANGUAGES } from '../content';
import { imageSchema, notesSchema } from '../content/schema';
import { ICON_NAMES } from '../ui/icons';
import { knownStress, transcribeBulgarian } from './bg';
import { transcribeSpanish } from './es';
import { BULGARIAN_GRAMMAR, SPANISH_GRAMMAR } from './grammar';
import { DEVICE_NOTE_LANGUAGES, deviceNotes } from './index';
import { memoryNote, pieces } from './memory';
import { bulgarianNumber, spanishNumber } from './numbers';
import { pictureFor, WORD_ICONS } from './picture';

const LORO = [...CONTENT_PHRASES, ...BANK_PHRASES];

/**
 * Where the rules and the course's own transcriptions differ, each read and kept on purpose: the
 * corpus is inconsistent with itself there, or wrong. Any other difference fails, as does one of
 * these disappearing (update the list).
 */
const REVIEWED: Record<string, string> = {
  'cafe-05': 'n before a consonant takes its place across words too (the corpus does it in «un cortado», not here)',
  'transit-04': 'the same n assimilation',
  'bank-airport-es-06': 'the same n assimilation',
  'bank-booking-es-02': 'the same n assimilation',
  'tapas-04': 'b after a vowel is soft [β]; the corpus has [b]',
  'market-04': 'a comma is a pause, so g starts hard; the corpus is soft here and hard in «mirando, gracias»',
  'sobremesa-02': '«hemos» is stressed HE-mos; the corpus has [eˈmos]',
  'bank-hotel-es-05': 's isn’t voiced before m, as everywhere else in the corpus',
  'bank-meeting-es-05': 'd after s is soft [ð], as the corpus has in «desde»',
  'bank-work-es-05': 'a falling i glide is [j], as in the rest of the corpus',
  'bg-kafene-01': 'the stress mark sits before the last consonant of a cluster that isn’t stop + r/l; the corpus varies',
  'bank-hotel-bg-03': 'the same syllable boundary',
  'bank-airport-bg-04': 'the same syllable boundary',
  'bank-airport-bg-05': 'the same syllable boundary',
  'bank-work-bg-02': 'the same syllable boundary',
  'bank-phone-bg-05': 'the same syllable boundary',
  'bg-kafene-03': 'a word’s last consonant is voiceless unless a voiced one follows: «без» [bɛs] before л',
  'bg-kafene-04': 'unstressed о is [o], as in the corpus’s «Много е студено»',
  'bg-grad-03': 'unstressed а is [ɐ]',
  'bg-grad-04': 'a word of one syllable that isn’t a clitic is stressed, as the corpus has «тук» elsewhere',
  'bank-work-bg-05': 'the same: «днес» is stressed, as elsewhere in the corpus',
  'bank-health-bg-02': '-ие without an inserted [j], as in the corpus’s «управление»',
  'bank-clothes-bg-01': 'a hyphened comparative is one word with secondary stress, as the corpus writes «по-бавно»',
  'bank-help-bg-04': 'the same',
  'bank-phone-bg-04': 'the same',
  'bank-meeting-bg-02': 'в after к stays [v], as in the corpus’s «свободна»',
};

describe('the device’s sound rules', () => {
  it('transcribe Loro’s own phrases as the course does, but for reviewed differences', () => {
    const differ = LORO.filter((p) => (p.targetLang === 'es-ES' ? transcribeSpanish(p.target) : transcribeBulgarian(p.target)).ipa !== p.notes!.pronunciation.ipa);
    assert.deepEqual(differ.map((p) => p.id).sort(), Object.keys(REVIEWED).sort());
    assert.ok(LORO.length - differ.length >= 140, 'most phrases match exactly');
  });

  it('Spanish: stress from the spelling, glides, soft consonants and n before the next consonant', () => {
    assert.equal(transcribeSpanish('Me pone un cortado, por favor').ipa, '[me ˈpo.ne uŋ koɾˈta.ðo poɾ faˈβoɾ]');
    assert.equal(transcribeSpanish('ciudad').ipa, '[θjuˈðað]', 'ends in d: the last syllable');
    assert.equal(transcribeSpanish('árbol').ipa, '[ˈaɾ.βol]', 'a written accent wins; b after r is soft');
    assert.equal(transcribeSpanish('país').ipa, '[paˈis]', 'an accented i breaks the diphthong');
    assert.equal(transcribeSpanish('hay').ipa, '[ˈaj]');
    assert.equal(transcribeSpanish('guerra, pingüino').ipa, '[ˈɡe.ra piŋˈɡwi.no]');
    assert.equal(transcribeSpanish('taxi').ipa, '[ˈtak.si]');
    assert.equal(transcribeSpanish('Está libre').respelling, 'es-TAH LEE-breh');
    assert.equal(transcribeSpanish('¿Va a llover?').respelling, 'VAH ah yoh-VER', 'b and v keep their letter');
  });

  it('Bulgarian: known stress only, and voicing', () => {
    assert.equal(knownStress('сметката'), 0);
    assert.equal(knownStress('сметка'), 0, 'the word without its article keeps the stress');
    assert.equal(knownStress('резервацията'), 2, 'ре-зер-ВА-ци-я-та');
    assert.equal(knownStress('струва'), null);
    const t = transcribeBulgarian('Искам хляб, струва ли?');
    assert.equal(t.ipa, '[ˈiskɐm ˈxʎap struva li]', 'no guessed stress; хляб devoiced before the pause');
    assert.deepEqual(t.words.filter((w) => w.stressUnknown).map((w) => w.token.word), ['струва']);
    assert.equal(transcribeBulgarian('вкъщи').ipa, '[ˈfkɤʃti]', 'в before к; щ is ʃt');
    assert.equal(transcribeBulgarian('друг ден').ipa, '[ˈdruɡ ˈdɛn]', 'voiced before voiced');
  });
});

describe('notes worked out on the device', () => {
  it('cover every course language', () => {
    for (const lang of TARGET_LANGUAGES) assert.ok(DEVICE_NOTE_LANGUAGES.includes(lang), `${lang} has no sound rules yet`);
  });

  it('give every phrase, as any learner could type it, a picture and all three notes', () => {
    for (const phrase of LORO) {
      for (const nativeLang of NATIVE_LANGUAGES.filter((l) => l !== phrase.targetLang)) {
        const native = phrase.translations[nativeLang] ?? phrase.translations['en-GB']!;
        const made = deviceNotes({ target: phrase.target, native, targetLang: phrase.targetLang, nativeLang });
        assert.ok(notesSchema.safeParse(made.notes).success, `${phrase.id}: ${JSON.stringify(made.notes)}`);
        assert.ok(imageSchema.safeParse(made.image).success);
        for (const icon of made.image) assert.ok((ICON_NAMES as readonly string[]).includes(icon), icon);
        for (const kind of ['mnemonic', 'grammar', 'pronunciation'] as const) {
          const versions = made.noteTranslations[kind] ?? {};
          assert.equal(phrase.targetLang in versions, false, 'never in the phrase’s own language');
          for (const code of NATIVE_LANGUAGES.filter((l) => l !== 'en-GB' && l !== phrase.targetLang)) {
            assert.ok(versions[code]?.title && versions[code]?.text, `${phrase.id} ${kind} in ${code}`);
          }
        }
      }
    }
  });

  it('whatever is typed, numbers said as words', () => {
    const odd = ['OK', '123 abc', 'Hola 👋', 'x-y-z', 'Здравей, ok?', 'ññññ', 'яяя', 'щ', '10:30', '2', '1000000', '007'];
    for (const target of odd) {
      for (const targetLang of TARGET_LANGUAGES) {
        const made = deviceNotes({ target, native: target, targetLang, nativeLang: 'en-GB' });
        assert.ok(notesSchema.safeParse(made.notes).success, `${target} in ${targetLang}`);
        assert.ok(made.image.length > 0);
      }
    }
    assert.equal(transcribeSpanish('Mesa para 2').ipa, '[ˈme.sa ˈpa.ɾa ˈðos]');
    assert.equal(transcribeSpanish('21000 y 101').ipa, '[bejnˈtjum ˈmil i ˈθjen.to ˈu.no]');
    assert.equal(transcribeBulgarian('В 10 часа').ipa, '[v ˈdɛsɛt t͡ʃɐˈsa]');
    assert.equal(bulgarianNumber(125), 'сто двадесет и пет');
    assert.equal(bulgarianNumber(21000), 'двадесет и една хиляди');
    assert.equal(spanishNumber(1999), 'mil novecientos noventa y nueve');
    for (const text of ['?', '¡¡¡!!!', '👋', '  ']) {
      assert.ok(notesSchema.safeParse(deviceNotes({ target: text, native: 'x', targetLang: 'es-ES', nativeLang: 'en-GB' }).notes).success, 'nothing to say never breaks it');
    }
  });
});

describe('the grammar rule', () => {
  const pick = (rules: typeof SPANISH_GRAMMAR, text: string) => rules.find((r) => r.find(text) !== null)!.id;
  it('names the construction the phrase shows, or a rule true of any', () => {
    assert.equal(pick(SPANISH_GRAMMAR, 'Me gustan los perros'), 'gustar');
    assert.equal(pick(SPANISH_GRAMMAR, 'Tengo que irme'), 'tener-que');
    assert.equal(pick(SPANISH_GRAMMAR, 'Voy a comer'), 'ir-a');
    assert.equal(pick(SPANISH_GRAMMAR, 'Estoy leyendo'), 'progressive');
    assert.equal(pick(SPANISH_GRAMMAR, 'Del mercado'), 'al-del');
    assert.equal(pick(SPANISH_GRAMMAR, 'Gracias'), 'gender');
    assert.equal(pick(BULGARIAN_GRAMMAR, 'Ще дойда утре'), 'shte');
    assert.equal(pick(BULGARIAN_GRAMMAR, 'Няма да дойда'), 'nyama-da');
    assert.equal(pick(BULGARIAN_GRAMMAR, 'Искам да отида'), 'da');
    assert.equal(pick(BULGARIAN_GRAMMAR, 'Сметката'), 'article');
    assert.equal(pick(BULGARIAN_GRAMMAR, 'Вземи си чадър'), 'no-cases', '«си» here isn’t «to be»');
    assert.equal(pick(BULGARIAN_GRAMMAR, 'Благодаря'), 'no-cases');
  });
});

describe('the memory hint', () => {
  const hint = (target: string, native: string, targetLang: 'es-ES' | 'bg-BG' = 'es-ES', nativeLang: 'en-GB' | 'ru-RU' = 'en-GB') =>
    memoryNote({ target, native, targetLang, nativeLang, sound: targetLang === 'es-ES' ? transcribeSpanish(target) : transcribeBulgarian(target) });
  it('hangs the phrase on what it resembles or shares, else on its shape', () => {
    assert.equal(hint('La farmacia', 'The pharmacy').en.title, '«farmacia» and «pharmacy»');
    assert.equal(hint('Искам хляб', 'Хочу хлеб', 'bg-BG', 'ru-RU').ru.title, '«хляб» и «хлеб»');
    assert.match(hint('Un cortado doble', 'A double cortado… espresso').en.title, /cortado/);
    assert.equal(hint('Riega las plantas del balcón', 'Do the watering outside').en.text, 'Learn it in pieces: «Riega las plantas» · «del balcón». Say each one twice, then join them up.');
    assert.equal(hint('Vale', 'OK').en.title, 'Tap out «Vale»');
    assert.equal(hint('Чудесно', 'Wonderful', 'bg-BG').en.text, 'Say it slowly, one beat at a time — Чу·дес·но — then at full speed.', 'stress unknown to Loro: no capitals');
  });
  it('splits a phrase into pieces that end on a meaningful word', () => {
    assert.deepEqual(pieces('Me pone un cortado, por favor'), ['Me pone', 'un cortado', 'por favor']);
  });
});

describe('the picture', () => {
  it('uses registry icons, and speech bubbles when nothing matches', () => {
    for (const icon of Object.values(WORD_ICONS)) assert.ok((ICON_NAMES as readonly string[]).includes(icon), icon);
    assert.deepEqual(pictureFor('Qwerty', 'Zxcv'), ['forum']);
    assert.equal(pictureFor('¿Dónde está la farmacia?', 'Where is the pharmacy?')[0], 'local_pharmacy');
    assert.equal(pictureFor('Искам хляб', 'Хочу хлеб')[0], 'bakery_dining');
  });
});
