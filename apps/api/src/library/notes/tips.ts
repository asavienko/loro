// The sound to practise in a phrase of a course without sound rules (English, Russian), found from
// its spelling alone: each tip finds a word whose letters certainly carry a sound learners of that
// course find hard, and says how to make it. The first that finds a word wins; the last of each
// language applies to any phrase. The IPA is shown beside the tip, from Loro's own phrases.
import { word } from './grammar.js'
import type { NoteLocale, NoteText } from './locale.js'

/** A sound worth practising, found from the spelling of a word of the phrase. */
export interface SoundTip {
  id: string
  /** The word (as written in the phrase) that has the sound, or null when no word has it. */
  find: (text: string) => string | null
  say: Partial<Record<NoteLocale, (w: string) => NoteText>>
}

// ---------------------------------------------------------------------------------------------
// British English (en-GB), for Bulgarian and Russian readers. Written 2026-10-01; awaits native
// review (Q-23).
// ---------------------------------------------------------------------------------------------

/** The words whose «th» is voiced (this, the, mother…): the ones that start with «th» and aren't voiceless. */
const VOICED_TH = String.raw`the|this|that|these|those|they|them|their|theirs|then|there\p{L}*|than|though|thus|themselves`

const thVoiceless = word(
  String.raw`(?!(?:${VOICED_TH}|thomas|thompson|thomson|thames|thai|thailand|thyme|theresa)(?![\p{L}]))th\p{L}*` +
    String.raw`|(?:some|any|no|every)thing|both|bath|months?|north|south|tooth|teeth|birth|birthday|fourth|fifth|sixth|seventh|eighth|ninth|tenth|health|healthy|worth|earth|path|cloth|growth|youth|truth|length|width|depth|warmth|death|breath|myth|author|athlete|method|bathroom|toothbrush|toothpaste`,
)

const thVoiced = word(
  String.raw`${VOICED_TH}|(?:mother|father|brother|other|another|together|weather|whether|rather|either|neither|further|leather|gather|feather|bother|northern|southern)s?|although|breathe|bathe|smooth|worthy`,
)

// «-tion» is «sh» after any letter but s («question» ends in «ch»); «-ssion» and «-cian» are «sh» too.
const shEnding = word(String.raw`\p{L}*(?:(?<!s)tion|ssion|cian)\p{L}*`)

const silentLetterWord = word(
  String.raw`kn\p{L}*|wr\p{L}*|\p{L}*mbs?|(?:c|sh|w)ould|\p{L}*igh\p{L}*|(?:walk|talk|chalk|stalk)(?:s|ed|ing|er)?|half|halves|calm|palm|wednesday|island|listen|answer|receipt|two|hours?|honest|honestly|castle|christmas`,
)
/** The letter of a word found by `silentLetterWord` that is written but not said. */
const silentLetter = (w: string) => {
  const s = w.toLowerCase()
  if (s.startsWith('kn')) return 'k'
  if (s.startsWith('wr') || s === 'answer' || s === 'two') return 'w'
  if (/mbs?$/.test(s)) return 'b'
  if (s.includes('igh')) return 'gh'
  if (/^hour|^honest/.test(s)) return 'h'
  if (s === 'wednesday') return 'd'
  if (s === 'island') return 's'
  if (s === 'receipt') return 'p'
  if (s === 'listen' || s === 'castle' || s === 'christmas') return 't'
  return 'l'
}

// Initial «w» before a vowel; «who», «whole» (wh + o), «wr-» and the silent w of «two» are not here.
const wSound = word(String.raw`w[aeio]\p{L}*|wh[aeiy]\p{L}*`)

// Initial «h» before a vowel, but not the silent h of «hour», «honest», «heir», and not the small
// words he, him, his, her, has, have, had, which lose their h in a sentence.
const hSound = word(
  String.raw`(?!(?:hour|honest|honou?r|heir)\p{L}*)(?!(?:he|him|his|her|has|have|had)(?![\p{L}]))h[aeiouy]\p{L}*`,
)

const ngEnd = word(String.raw`\p{L}*[aeiouy]ngs?`)

// «r» before a vowel (red), or after a vowel and before a consonant (park); a «rr» is left out.
const rSound = word(String.raw`r[aeiou]\p{L}*|\p{L}*[aeiou]r[bcdfghjklmnpqstvwxz]\p{L}*`)

const edWord = word(
  String.raw`asked|called|changed|cleaned|closed|cooked|decided|enjoyed|finished|helped|hoped|invited|learned|liked|listened|lived|looked|loved|missed|moved|needed|opened|ordered|played|rained|received|repeated|started|stayed|stopped|studied|talked|tried|turned|visited|waited|walked|wanted|washed|watched|worked|booked|arrived|answered|offered|prepared|remembered|reserved|returned|shopped|texted|travelled|traveled`,
)

// A word that ends in b, d or g (but not -mb, -ed, -ng) and isn't a small word said weakly.
const finalVoiced = word(
  String.raw`(?!(?:and|had|did|would|could|should)(?![\p{L}]))\p{L}+(?:(?<!m)b|(?<!e)d|(?<!n)g)`,
)

const cant = word(String.raw`can['’]t`)

export const ENGLISH_SOUND_TIPS: SoundTip[] = [
  {
    id: 'th-voiceless',
    find: thVoiceless,
    say: {
      en: (w) => ({
        title: `«${w}»: the th sound`,
        text: `In «${w}», th isn’t s, t or f: put the tip of your tongue lightly between your teeth and blow air over it, with no voice. Bulgarian and Russian don’t have this sound.`,
      }),
      bg: (w) => ({
        title: `«${w}»: звукът th`,
        text: `В «${w}» th не е „с“, „т“ или „ф“: поставете върха на езика леко между зъбите и издухайте въздух, без глас. В българския и в руския няма такъв звук.`,
      }),
      ru: (w) => ({
        title: `«${w}»: звук th`,
        text: `В «${w}» th — не «с», «т» и не «ф»: кончик языка слегка между зубами, воздух выдувается, без голоса. Такого звука нет ни в русском, ни в болгарском.`,
      }),
    },
  },
  {
    id: 'sh-ending',
    find: shEnding,
    say: {
      en: (w) => ({
        title: `«${w}»: the sh ending`,
        text: `The ending of «${w}» is said «shun»: a quick sh and a weak vowel, not «ti-on» and not «tsiya» like the Bulgarian and Russian «-ция».`,
      }),
      bg: (w) => ({
        title: `«${w}»: краят „шън“`,
        text: `Краят на «${w}» се чете „шън“ — бързо «sh» и слаб гласен звук, — а не „ти-он“ и не „ция“, както в българското „-ция“.`,
      }),
      ru: (w) => ({
        title: `«${w}»: окончание «шн»`,
        text: `Окончание в «${w}» читается как «шн» — быстрое «ш» и слабый гласный звук, — а не «ти-он» и не «ция», как в русском «-ция».`,
      }),
    },
  },
  {
    id: 'silent-letter',
    find: silentLetterWord,
    say: {
      en: (w) => ({
        title: `«${w}»: a letter you don’t say`,
        text: `In «${w}», «${silentLetter(w)}» is written but not said. English spelling keeps many letters like this, so learn how a word sounds, not only how it is written.`,
      }),
      bg: (w) => ({
        title: `«${w}»: буква, която не се чете`,
        text: `В «${w}» «${silentLetter(w)}» се пише, но не се произнася. Английският правопис пази много такива букви, затова учете как звучи думата, а не само как се пише.`,
      }),
      ru: (w) => ({
        title: `«${w}»: буква, которую не читают`,
        text: `В «${w}» «${silentLetter(w)}» пишется, но не произносится. В английской орфографии много таких букв, поэтому запоминайте, как звучит слово, а не только как оно пишется.`,
      }),
    },
  },
  {
    id: 'w',
    find: wSound,
    say: {
      en: (w) => ({
        title: `«${w}»: w, not v`,
        text: `In «${w}», w is made with rounded lips, as for «oo», and the lower lip doesn’t touch the upper teeth. It isn’t v: «west» is not «vest».`,
      }),
      bg: (w) => ({
        title: `«${w}»: w, а не „в“`,
        text: `В «${w}» w не е „в“: закръглете устните като за „у“ и не допирайте долната устна до горните зъби. «West» не е «vest».`,
      }),
      ru: (w) => ({
        title: `«${w}»: w, а не «в»`,
        text: `В «${w}» w — не «в»: округлите губы, как для «у», и не касайтесь нижней губой верхних зубов. «West» — не «vest».`,
      }),
    },
  },
  {
    id: 'h',
    find: hSound,
    say: {
      en: (w) => ({
        title: `«${w}»: a soft h`,
        text: `In «${w}», h is a soft breath from the throat, as when you mist a mirror, not the rough Bulgarian or Russian «х». Don’t leave it out.`,
      }),
      bg: (w) => ({
        title: `«${w}»: меко h`,
        text: `В «${w}» h е лек дъх от гърлото, като когато замъглявате огледало — не е грубото българско „х“. Не го пропускайте.`,
      }),
      ru: (w) => ({
        title: `«${w}»: мягкое h`,
        text: `В «${w}» h — лёгкий выдох из горла, как когда дышат на зеркало, а не жёсткое русское «х». Не пропускайте его.`,
      }),
    },
  },
  {
    id: 'ng',
    find: ngEnd,
    say: {
      en: (w) => ({
        title: `«${w}»: the ng sound`,
        text: `In «${w}», ng is one sound, made with the back of the tongue against the soft palate. Don’t add a hard «g» after it, and don’t shrink it to «n».`,
      }),
      bg: (w) => ({
        title: `«${w}»: звукът ng`,
        text: `В «${w}» ng е един звук, който се образува със задната част на езика до мекото небце. Не добавяйте „г“ след него и не го превръщайте в „н“.`,
      }),
      ru: (w) => ({
        title: `«${w}»: звук ng`,
        text: `В «${w}» ng — один звук, он образуется задней частью языка у мягкого нёба. Не добавляйте «г» после него и не заменяйте его на «н».`,
      }),
    },
  },
  {
    id: 'r',
    find: rSound,
    say: {
      en: (w) =>
        /^r[aeiou]/i.test(w)
          ? {
              title: `«${w}»: the English r`,
              text: `In «${w}», r isn’t rolled: pull the tongue back and let its tip hang free, without touching the roof of the mouth. Bulgarian and Russian «р» is a trill; the English r is not.`,
            }
          : {
              title: `«${w}»: r after a vowel`,
              text: `In British English an «r» after a vowel and before a consonant is not pronounced. Bulgarian and Russian «р» is always said and rolled, so hold it back in «${w}».`,
            },
      bg: (w) =>
        /^r[aeiou]/i.test(w)
          ? {
              title: `«${w}»: английското r`,
              text: `В «${w}» r не е трептящо: изтеглете езика назад и оставете върха му свободен, без да докосва небцето. Българското „р“ е трептящо, а английското r — не.`,
            }
          : {
              title: `«${w}»: r след гласна`,
              text: `В британския английски «r» след гласна и пред съгласна не се произнася. Българското и руското „р“ винаги се казват и се търкалят, затова в «${w}» го задръжте.`,
            },
      ru: (w) =>
        /^r[aeiou]/i.test(w)
          ? {
              title: `«${w}»: английское r`,
              text: `В «${w}» r не раскатывается: отведите язык назад, кончик не должен касаться нёба. Русское «р» раскатистое, а английское r — нет.`,
            }
          : {
              title: `«${w}»: r после гласной`,
              text: `В британском английском «r» после гласной и перед согласной не произносится. Русское и болгарское «р» всегда произносятся и раскатываются, поэтому в «${w}» сдержите его.`,
            },
    },
  },
  {
    id: 'ed',
    find: edWord,
    say: {
      en: (w) => ({
        title: `«${w}»: the ending -ed`,
        text: `The ending -ed of «${w}» is said three ways, by the sound before it: a quick «t» after k, p, s, sh, ch or f (walked), a quick «d» after other sounds (played), and a separate syllable «id» only after t or d (wanted).`,
      }),
      bg: (w) => ({
        title: `«${w}»: окончанието -ed`,
        text: `Окончанието -ed в «${w}» се произнася по три начина според звука пред него: бърз „т“ след k, p, s, sh, ch или f (walked), бърз „д“ след другите звуци (played) и отделна сричка „ид“ само след t или d (wanted).`,
      }),
      ru: (w) => ({
        title: `«${w}»: окончание -ed`,
        text: `Окончание -ed в «${w}» произносится тремя способами, по звуку перед ним: быстрое «т» после k, p, s, sh, ch или f (walked), быстрое «д» после остальных звуков (played) и отдельный слог «ид» только после t или d (wanted).`,
      }),
    },
  },
  {
    id: 'final-voiced',
    find: finalVoiced,
    say: {
      en: (w) => ({
        title: `«${w}»: keep the last sound voiced`,
        text: `At the end of «${w}», the last sound stays voiced: Bulgarian and Russian turn a final «b», «d», «g» into «p», «t», «k», but «bag» is not «back» and «bed» is not «bet». Keep your voice on; lengthen the vowel before it.`,
      }),
      bg: (w) => ({
        title: `«${w}»: звучен краен звук`,
        text: `В края на «${w}» последният звук остава звучен: в българския и руския краен „б“, „д“, „г“ се оглушават до „п“, „т“, „к“, но «bag» не е «back», а «bed» не е «bet». Запазете гласа и удължете гласната пред него.`,
      }),
      ru: (w) => ({
        title: `«${w}»: звонкий конец`,
        text: `В конце «${w}» последний звук остаётся звонким: в русском и болгарском конечные «б», «д», «г» оглушаются до «п», «т», «к», а «bag» — не «back», «bed» — не «bet». Сохраняйте голос и удлиняйте гласную перед ним.`,
      }),
    },
  },
  {
    id: 'th-voiced',
    find: thVoiced,
    say: {
      en: (w) => ({
        title: `«${w}»: the voiced th`,
        text: `In «${w}», put the tip of your tongue lightly between your teeth and let your voice hum while the air passes. It isn’t «z», «d» or «v».`,
      }),
      bg: (w) => ({
        title: `«${w}»: звучното th`,
        text: `В «${w}» поставете върха на езика леко между зъбите и оставете гласа да бръмчи, докато минава въздухът. Това не е „з“, „д“ или „в“.`,
      }),
      ru: (w) => ({
        title: `«${w}»: звонкое th`,
        text: `В «${w}» кончик языка слегка между зубами, а голос звучит, пока проходит воздух. Это не «з», не «д» и не «в».`,
      }),
    },
  },
  {
    id: 'cant',
    find: cant,
    say: {
      en: (w) => ({
        title: `«${w}»: can’t, not can`,
        text: `In «${w}», the vowel is long and strong, like “ah”, in standard British English. The plain «can» in a statement is weak and short, so the vowel is the main difference between «I can swim» and «I can’t swim».`,
      }),
      bg: (w) => ({
        title: `«${w}»: can’t, не can`,
        text: `В «${w}» гласната е дълга и силна, като проточено „а“, в стандартния британски английски. Обикновеното «can» в утвърдително изречение е слабо и кратко, затова гласната отличава «I can swim» от «I can’t swim».`,
      }),
      ru: (w) => ({
        title: `«${w}»: can’t, а не can`,
        text: `В «${w}» гласная долгая и сильная, как протяжное «а», в стандартном британском английском. Простое «can» в утверждении слабое и короткое, поэтому именно гласная отличает «I can swim» от «I can’t swim».`,
      }),
    },
  },
  {
    id: 'rhythm',
    find: () => '',
    say: {
      en: () => ({
        title: 'Beat and small words',
        text: 'English has a strong beat: the important words are long and clear, and small words like «a», «the», «to», «of», «for» and «can» are squeezed into a short, weak «uh». Say the key words clearly and let the small ones slip by.',
      }),
      bg: () => ({
        title: 'Ритъм и малките думи',
        text: 'Английският има силен ритъм: важните думи са дълги и ясни, а малките — «a», «the», «to», «of», «for», «can» — се свиват до къс, слаб звук, като неясно „ъ“. Казвайте ясно важните думи и оставяйте малките да се изплъзват.',
      }),
      ru: () => ({
        title: 'Ритм и маленькие слова',
        text: 'В английском сильный ритм: важные слова долгие и чёткие, а маленькие — «a», «the», «to», «of», «for», «can» — сжимаются до короткого слабого звука вроде неясного «э». Главные слова произносите чётко, малые — быстро.',
      }),
    },
  },
]

// ---------------------------------------------------------------------------------------------
// Russian (ru-RU), for English and Bulgarian readers. Written 2026-10-01; awaits native review.
// ---------------------------------------------------------------------------------------------

/** Words ending in -ого or -его, whose г is said as в, except the few where it stays г. */
const OGO_KEEPS_G = /^(?:(?:не|на)?много|(?:не|по)?дорого|строго|убого|лого|ого)$/iu
const findOgoEgo = (text: string) => {
  for (const m of text.matchAll(/(?<![\p{L}])\p{L}*(?:ого|его)(?![\p{L}])/giu)) {
    if (!OGO_KEEPS_G.test(m[0])) return m[0]
  }
  return null
}

export const RUSSIAN_SOUND_TIPS: SoundTip[] = [
  {
    id: 'shch',
    find: word(String.raw`\p{L}*щ\p{L}*`),
    say: {
      en: (w) => ({
        title: `«${w}»: щ`,
        text: 'Щ is one long, soft sound, like the sh of “sheep” held a little longer, with the tongue raised closer to the palate.',
      }),
      bg: (w) => ({
        title: `«${w}»: щ`,
        text: 'Руското «щ» не е „шт“ като в българския, а един дълъг, мек звук като „ш“, с език, вдигнат по-близо до небцето.',
      }),
    },
  },
  {
    id: 'yery',
    find: word(String.raw`\p{L}*ы\p{L}*`),
    say: {
      en: (w) => ({
        title: `«${w}»: ы`,
        text: 'Ы is a vowel of its own: start to say “i” as in “bit”, then draw the tongue back and keep the lips relaxed. The consonant before it is always hard.',
      }),
      bg: (w) => ({
        title: `«${w}»: ы`,
        text: 'Ы е отделна гласна, каквато българският няма: кажете „и“, но с издърпан назад език и отпуснати устни. Не я заменяйте с „и“ или „ъ“. Съгласната пред нея е винаги твърда.',
      }),
    },
  },
  {
    id: 'yo',
    find: word(String.raw`\p{L}*ё\p{L}*`),
    say: {
      en: (w) => ({
        title: `«${w}»: ё`,
        text: 'Ё sounds like “yo” in “yonder”, and after ж or ш like a plain “o”. It is always the stressed vowel of its word, so it shows where the stress falls.',
      }),
      bg: (w) => ({
        title: `«${w}»: ё`,
        text: '«Ё» е „йо“ („ьо“ след съгласна, като в „синьо“), а след «ж» или «ш» — просто „о“. Тя винаги е ударена, затова показва къде е ударението.',
      }),
    },
  },
  {
    id: 'tsya',
    find: word(String.raw`\p{L}+ть?ся`),
    say: {
      en: (w) => ({
        title: `«${w}»: -ться, -тся`,
        text: 'In the endings -ться and -тся the т and с run together into one long «ц»: «учиться» is said «учицца».',
      }),
      bg: (w) => ({
        title: `«${w}»: -ться, -тся`,
        text: 'В края -ться и -тся «т» и «с» се сливат в едно дълго «ц»: «учиться» се чете „учицца“. «-ся» е руското „се“, залепено за края на глагола.',
      }),
    },
  },
  {
    id: 'soft-sign',
    find: word(String.raw`\p{L}*[бвгдзклмнпрстфх]ь\p{L}*`),
    say: {
      en: (w) => ({
        title: `«${w}»: the soft sign ь`,
        text: 'Ь has no sound of its own. It softens the consonant before it: press the middle of the tongue towards the palate, as if a very quick “y” followed.',
      }),
      bg: (w) => ({
        title: `«${w}»: меката буква ь`,
        text: 'Ь няма свой звук. Смекчава съгласната пред себе си — като „я“ и „ю“ в „ня“ и „ню“, но без гласна след нея.',
      }),
    },
  },
  {
    id: 'zhi-shi-tsi',
    find: word(String.raw`\p{L}*[жшц]и\p{L}*`),
    say: {
      en: (w) => ({
        title: `«${w}»: и after ж, ш, ц`,
        text: 'After ж, ш and ц the letter и is said as «ы»: «жи», «ши» and «ци» sound like «жы», «шы» and «цы».',
      }),
      bg: (w) => ({
        title: `«${w}»: и след ж, ш, ц`,
        text: 'След ж, ш и ц буквата и се чете като «ы»: «жи», «ши» и «ци» звучат като «жы», «шы» и «цы». В български „жи“ и „ши“ остават с „и“.',
      }),
    },
  },
  {
    id: 'ogo-ego',
    find: findOgoEgo,
    say: {
      en: (w) => ({
        title: `«${w}»: г said as в`,
        text: 'In the endings -ого and -его the letter г is said as в: «его» sounds like «ево», «ничего» like «ничево».',
      }),
      bg: (w) => ({
        title: `«${w}»: г се чете като в`,
        text: 'В окончанията -ого и -его буквата г се чете като «в»: «его» звучи като «ево», «ничего» — като «ничево».',
      }),
    },
  },
  {
    id: 'kh',
    find: word(String.raw`\p{L}*х\p{L}*`),
    say: {
      en: (w) => ({
        title: `«${w}»: х`,
        text: 'Х is a rasp at the back of the throat, like ch in Scottish “loch”, never the soft breath of the h in “hat”.',
      }),
      bg: (w) => ({
        title: `«${w}»: х`,
        text: 'Като българското «х»: груб звук от задната част на гърлото; не го отслабвайте до тихо издишване.',
      }),
    },
  },
  {
    id: 'final-devoicing',
    find: word(String.raw`\p{L}+[бвгджз]`),
    say: {
      en: (w) => ({
        title: `«${w}»: the last consonant`,
        text: 'At the end of a word б, в, г, д, ж and з lose their voice: they are said as п, ф, к, т, ш and с, so «хлеб» is said «хлеп». Before a voiced б, г, д, ж or з at the start of the next word, the voice can stay.',
      }),
      bg: (w) => ({
        title: `«${w}»: последната съгласна`,
        text: 'Както в български, в края на думата б, в, г, д, ж и з стават беззвучни — п, ф, к, т, ш и с: «хлеб» се чете «хлеп». Ако следващата дума започва с б, г, д, ж или з, звучността може да се запази.',
      }),
    },
  },
  {
    id: 'rolled-r',
    find: word(String.raw`\p{L}*р\p{L}*`),
    say: {
      en: (w) => ({
        title: `«${w}»: a rolled р`,
        text: 'Р is rolled: the tip of the tongue taps or trills against the ridge behind the upper teeth. It is never the English r, and it is said at the end of a word too.',
      }),
      bg: (w) => ({
        title: `«${w}»: трептящо р`,
        text: 'Като в български, «р» е трептящо: върхът на езика се удря във венеца зад горните зъби. Казва се и в края на думата.',
      }),
    },
  },
  {
    id: 'stress',
    find: () => '',
    say: {
      en: () => ({
        title: 'Stress and weak vowels',
        text: 'Russian stress is not marked in spelling and can fall on any syllable, and it can shift between forms of one word. Away from the stress о is said like а («молоко» sounds like «малако»), and е and я weaken towards и.',
      }),
      bg: () => ({
        title: 'Ударение и слаби гласни',
        text: 'Ударението в руския не се отбелязва в правописа, може да падне на всяка сричка и да се мести между формите на една дума. Без ударение «о» се чете като «а» («молоко» → „малако“), а «е» и «я» отслабват към „и“.',
      }),
    },
  },
]
