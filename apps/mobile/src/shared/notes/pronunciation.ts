// The sound to watch in a phrase the learner typed (plan 105): the first of the language's notable
// sounds the phrase has, shown on a word of it with that word's IPA. A Bulgarian word whose stress
// Loro doesn't know is named, rather than marked with a guess.
import { list, NoteLocale, NoteText } from './locale';
import { SoundWord, Transcription, wordIpa } from './sounds';

interface Feature {
  /** The first word with the sound, preferring a word that isn't a clitic. */
  has: (word: SoundWord) => boolean;
  say: Partial<Record<NoteLocale, (w: string, ipa: string) => NoteText>>;
}

const sounds = (w: SoundWord) => w.syllables.flat();
const hasSound = (...ipa: string[]) => (w: SoundWord) => sounds(w).some((s) => ipa.includes(s.ipa));

const SPANISH: Feature[] = [
  {
    has: hasSound('θ'),
    say: {
      en: (w, ipa) => ({ title: `«${w}»: the Castilian th`, text: `In Spain z, and c before e or i, sound like th in “think”: ${ipa}.` }),
      bg: (w, ipa) => ({ title: `«${w}»: кастилското th`, text: `В Испания z, както и c пред e или i, се произнасят като английското th в think: ${ipa}.` }),
      ru: (w, ipa) => ({ title: `«${w}»: кастильское th`, text: `В Испании z, а также c перед e или i, звучат как английское th в think: ${ipa}.` }),
    },
  },
  {
    has: hasSound('x'),
    say: {
      en: (w, ipa) => ({ title: `«${w}»: a rasp for j`, text: `J, and g before e or i, is a rasp at the back of the throat, like ch in Scottish “loch”: ${ipa}.` }),
      bg: (w, ipa) => ({ title: `«${w}»: j като х`, text: `J, както и g пред e или i, е гърлен звук като българското „х“: ${ipa}.` }),
      ru: (w, ipa) => ({ title: `«${w}»: j как х`, text: `J, а также g перед e или i, — звук вроде русского «х»: ${ipa}.` }),
    },
  },
  {
    has: hasSound('r'),
    say: {
      en: (w, ipa) => ({ title: `«${w}»: a rolled r`, text: `Rr, and r at the start of a word, is rolled: several quick taps of the tongue. A single r between vowels is one tap: ${ipa}.` }),
      bg: (w, ipa) => ({ title: `«${w}»: трептящо r`, text: `Rr, както и r в началото на думата, е трептящо — няколко бързи удара на езика; единичното r между гласни е един удар: ${ipa}.` }),
      ru: (w, ipa) => ({ title: `«${w}»: раскатистое r`, text: `Rr, а также r в начале слова, — раскатистое, несколько быстрых ударов языка; одиночное r между гласными — один удар: ${ipa}.` }),
    },
  },
  {
    has: hasSound('ð'),
    say: {
      en: (w, ipa) => ({ title: `«${w}»: a soft d`, text: `After a vowel, d is soft, close to th in “this”: ${ipa}.` }),
      bg: (w, ipa) => ({ title: `«${w}»: меко d`, text: `След гласна d е меко, близко до английското th в this: ${ipa}.` }),
      ru: (w, ipa) => ({ title: `«${w}»: мягкое d`, text: `После гласной d мягкое, близкое к английскому th в this: ${ipa}.` }),
    },
  },
  {
    has: hasSound('ɲ'),
    say: {
      en: (w, ipa) => ({ title: `«${w}»: ñ`, text: `Ñ is one sound, like ny in “canyon”: ${ipa}.` }),
      bg: (w, ipa) => ({ title: `«${w}»: ñ`, text: `Ñ е един звук, като „н“ в „ня“: ${ipa}.` }),
      ru: (w, ipa) => ({ title: `«${w}»: ñ`, text: `Ñ — один звук, как «нь» в слове «няня»: ${ipa}.` }),
    },
  },
  {
    has: hasSound('ʝ'),
    say: {
      en: (w, ipa) => ({ title: `«${w}»: ll and y`, text: `Ll, and y before a vowel, sound like y in “yes”, a little stronger: ${ipa}.` }),
      bg: (w, ipa) => ({ title: `«${w}»: ll и y`, text: `Ll, както и y пред гласна, звучат като „й“, малко по-силно: ${ipa}.` }),
      ru: (w, ipa) => ({ title: `«${w}»: ll и y`, text: `Ll, а также y перед гласной, звучат как «й», чуть сильнее: ${ipa}.` }),
    },
  },
  {
    has: hasSound('β'),
    say: {
      en: (w, ipa) => ({ title: `«${w}»: b and v are one sound`, text: `B and v sound the same. After a vowel the lips barely touch: ${ipa}.` }),
      bg: (w, ipa) => ({ title: `«${w}»: b и v звучат еднакво`, text: `B и v звучат еднакво; след гласна устните едва се допират: ${ipa}.` }),
      ru: (w, ipa) => ({ title: `«${w}»: b и v звучат одинаково`, text: `B и v звучат одинаково; после гласной губы едва смыкаются: ${ipa}.` }),
    },
  },
  {
    has: hasSound('ɣ'),
    say: {
      en: (w, ipa) => ({ title: `«${w}»: a soft g`, text: `After a vowel, g is soft: the back of the tongue barely touches the roof of the mouth: ${ipa}.` }),
      bg: (w, ipa) => ({ title: `«${w}»: меко g`, text: `След гласна g е меко — задната част на езика едва докосва небцето: ${ipa}.` }),
      ru: (w, ipa) => ({ title: `«${w}»: мягкое g`, text: `После гласной g мягкое — задняя часть языка едва касается нёба: ${ipa}.` }),
    },
  },
  {
    has: (w) => w.token.word.includes('h') && !w.token.word.includes('ch'),
    say: {
      en: (w, ipa) => ({ title: `«${w}»: a silent h`, text: `H is never said: ${ipa}.` }),
      bg: (w, ipa) => ({ title: `«${w}»: нямо h`, text: `H никога не се произнася: ${ipa}.` }),
      ru: (w, ipa) => ({ title: `«${w}»: немое h`, text: `H никогда не произносится: ${ipa}.` }),
    },
  },
];

/** Every Spanish word's stress follows from its spelling: said on the phrase's longest word. */
const SPANISH_STRESS: Feature['say'] = {
  en: (w, ipa) => ({ title: `«${w}»: where the stress falls`, text: `A word ending in a vowel, n or s is stressed on the syllable before last; any other on the last. A written accent overrides both: ${ipa}.` }),
  bg: (w, ipa) => ({ title: `«${w}»: къде е ударението`, text: `Дума, завършваща на гласна, n или s, е с ударение на предпоследната сричка, другите — на последната. Писменото ударение е над правилото: ${ipa}.` }),
  ru: (w, ipa) => ({ title: `«${w}»: где ударение`, text: `Слово на гласную, n или s ударно на предпоследнем слоге, остальные — на последнем. Письменное ударение важнее правила: ${ipa}.` }),
};

const BULGARIAN: Feature[] = [
  {
    has: (w) => w.token.word.includes('щ'),
    say: {
      en: (w, ipa) => ({ title: `«${w}»: щ`, text: `Щ is sh and t together: ${ipa}.` }),
      ru: (w, ipa) => ({ title: `«${w}»: щ`, text: `Болгарское щ — это «шт», а не русское «щ»: ${ipa}.` }),
    },
  },
  {
    has: (w) => w.token.word.includes('ъ'),
    say: {
      en: (w, ipa) => ({ title: `«${w}»: ъ`, text: `Ъ is a vowel of its own, a short “uh” as in “but”: ${ipa}.` }),
      ru: (w, ipa) => ({ title: `«${w}»: ъ`, text: `Ъ — отдельный гласный, средний между «а» и «ы»: ${ipa}.` }),
    },
  },
  {
    has: (w) => w.stress !== null && !w.stressUnknown && w.syllables.length > 1 && sounds(w).some((s) => s.ipa === 'o'),
    say: {
      en: (w, ipa) => ({ title: `«${w}»: о stays о`, text: `Away from the stress, о stays an o, only a little closer: ${ipa}.` }),
      ru: (w, ipa) => ({ title: `«${w}»: о остаётся о`, text: `Безударное о не превращается в «а», как в русском, — оно лишь чуть более закрытое: ${ipa}.` }),
    },
  },
  {
    has: (w) => sounds(w).some((s) => s.ipa === 'ɐ'),
    say: {
      en: (w, ipa) => ({ title: `«${w}»: unstressed а and ъ`, text: `Away from the stress, а and ъ meet in one short sound: ${ipa}.` }),
      ru: (w, ipa) => ({ title: `«${w}»: безударные а и ъ`, text: `Без ударения а и ъ сливаются в один краткий звук: ${ipa}.` }),
    },
  },
  {
    has: (w) => /[бвгджз]$/.test(w.token.word),
    say: {
      en: (w, ipa) => ({ title: `«${w}»: the last consonant`, text: `At the end of a word б, в, г, д, ж and з lose their voice, unless a voiced consonant follows: ${ipa}.` }),
      ru: (w, ipa) => ({ title: `«${w}»: последний согласный`, text: `На конце слова звонкие согласные оглушаются, как в русском: ${ipa}.` }),
    },
  },
  {
    has: (w) => sounds(w).some((s) => /[ʲʎɲ]/.test(s.ipa)),
    say: {
      en: (w, ipa) => ({ title: `«${w}»: я and ю soften`, text: `After a consonant, я and ю soften it: ${ipa}.` }),
      ru: (w, ipa) => ({ title: `«${w}»: я и ю смягчают`, text: `Я и ю после согласной смягчают её, как в русском: ${ipa}.` }),
    },
  },
];

const BULGARIAN_PLAIN: Feature['say'] = {
  en: (w, ipa) => ({ title: `«${w}»: read as written`, text: `Bulgarian is read as it’s written: each letter keeps its sound: ${ipa}.` }),
  ru: (w, ipa) => ({ title: `«${w}»: как пишется`, text: `Болгарский читается, как пишется: каждая буква сохраняет свой звук: ${ipa}.` }),
};

const UNKNOWN_STRESS: Record<NoteLocale, (words: string) => string> = {
  en: (words) => ` Loro doesn’t know where the stress falls in ${words} yet, so the vowels there are shown in full: listen for the strong syllable.`,
  bg: (words) => ` Loro още не знае къде е ударението в ${words}, затова гласните там са показани изцяло: чуйте силната сричка.`,
  ru: (words) => ` Loro пока не знает, где ударение в ${words}, поэтому гласные там показаны полностью: прислушайтесь к ударному слогу.`,
};

/** The phrase's pronunciation note in each language that has it, with IPA and respelling. */
export function pronunciationNote(lang: 'es-ES' | 'bg-BG', sound: Transcription): Partial<Record<NoteLocale, NoteText>> {
  const words = sound.words.filter((w) => w.syllables.flat().some((s) => s.kind === 'V'));
  const content = [...words].sort((a, b) => Number(a.stress === null) - Number(b.stress === null));
  const features = lang === 'es-ES' ? SPANISH : BULGARIAN;
  let chosen: { say: Feature['say']; word: SoundWord } | null = null;
  for (const feature of features) {
    const word = content.find(feature.has);
    if (word) {
      chosen = { say: feature.say, word };
      break;
    }
  }
  if (!chosen) {
    const longest = [...words].sort((a, b) => b.syllables.length - a.syllables.length)[0] ?? sound.words[0];
    chosen = { say: lang === 'es-ES' ? SPANISH_STRESS : BULGARIAN_PLAIN, word: longest };
  }
  const unknown = sound.words.filter((w) => w.stressUnknown).map((w) => w.token.written);
  const ipa = `[${wordIpa(chosen.word, lang === 'es-ES')}]`;
  const out: Partial<Record<NoteLocale, NoteText>> = {};
  for (const [locale, say] of Object.entries(chosen.say) as [NoteLocale, NonNullable<Feature['say'][NoteLocale]>][]) {
    const note = say(chosen.word.token.written, ipa);
    out[locale] = unknown.length > 0 ? { ...note, text: note.text + UNKNOWN_STRESS[locale](list(unknown, locale)) } : note;
  }
  return out;
}

