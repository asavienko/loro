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
      pl: (w) => ({
        title: `«${w}»: dźwięk th`,
        text: `W «${w}» th to nie s, t ani f: przyłóż koniuszek języka lekko między zęby i wydmuchnij powietrze, bez głosu. W polskim nie ma takiego dźwięku.`,
      }),
      cs: (w) => ({
        title: `«${w}»: hláska th`,
        text: `V «${w}» th není s, t ani f: přiložte špičku jazyka lehce mezi zuby a vydechněte vzduch bez hlasu. V češtině taková hláska není.`,
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
      pl: (w) => ({
        title: `«${w}»: końcówka „szyn”`,
        text: `Końcówkę «${w}» czyta się «shun»: szybkie sh i słaba samogłoska, a nie «ti-on» ani «cja», jak w polskim „-cja”.`,
      }),
      cs: (w) => ({
        title: `«${w}»: koncovka „šn“`,
        text: `Koncovka v «${w}» se čte «shun»: rychlé „š“ a slabá samohláska, ne «ti-on» a ne «cia», jako v české „-ce“.`,
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
      pl: (w) => ({
        title: `«${w}»: litera, której się nie wymawia`,
        text: `W «${w}» «${silentLetter(w)}» się pisze, ale nie wymawia. Angielska pisownia zachowuje wiele takich liter, więc ucz się, jak słowo brzmi, a nie tylko jak się je pisze.`,
      }),
      cs: (w) => ({
        title: `«${w}»: písmeno, které se nečte`,
        text: `V «${w}» se «${silentLetter(w)}» píše, ale nečte. Anglický pravopis zachovává mnoho takových písmen, proto se učte, jak slovo zní, a ne jen jak se píše.`,
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
      pl: (w) => ({
        title: `«${w}»: w, a nie „w”`,
        text: `W «${w}» w to nie polskie „w”: zaokrąglij wargi jak do „ł”, a dolna warga nie dotyka górnych zębów. «West» to nie «vest».`,
      }),
      cs: (w) => ({
        title: `«${w}»: w, ne „v“`,
        text: `V «${w}» není w české „v“: zakulaťte rty jako pro „u“ a spodní ret se nedotýká horních zubů. «West» není «vest».`,
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
      pl: (w) => ({
        title: `«${w}»: miękkie h`,
        text: `W «${w}» h to lekki wydech z gardła, jak gdy chuchasz na lustro, a nie twarde polskie „ch”. Nie pomijaj go.`,
      }),
      cs: (w) => ({
        title: `«${w}»: měkké h`,
        text: `V «${w}» je h lehký výdech z hrdla, jako když dýcháte na zrcadlo, ne drsné české „ch“. Nevynechávejte ho.`,
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
      pl: (w) => ({
        title: `«${w}»: dźwięk ng`,
        text: `W «${w}» ng to jeden dźwięk, tworzony tylnią częścią języka przy podniebieniu miękkim. Nie dodawaj po nim twardego „g” i nie zamieniaj go na „n”.`,
      }),
      cs: (w) => ({
        title: `«${w}»: hláska ng`,
        text: `V «${w}» je ng jedna hláska, tvořená zadní částí jazyka u měkkého patra. Nepřidávejte za ni tvrdé „g“ a nezkracujte ji na „n“.`,
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
      pl: (w) =>
        /^r[aeiou]/i.test(w)
          ? {
              title: `«${w}»: angielskie r`,
              text: `W «${w}» r nie jest drżące: cofnij język i zostaw jego czubek swobodnie, bez dotykania podniebienia. Polskie „r” jest drżące, angielskie r — nie.`,
            }
          : {
              title: `«${w}»: r po samogłosce`,
              text: `W brytyjskim angielskim «r» po samogłosce i przed spółgłoską się nie wymawia. Polskie „r” zawsze się wymawia i drży, więc w «${w}» je wstrzymaj.`,
            },
      cs: (w) =>
        /^r[aeiou]/i.test(w)
          ? {
              title: `«${w}»: anglické r`,
              text: `V «${w}» se r nevibruje: stáhněte jazyk dozadu a nechte jeho špičku volně, bez doteku s patrem. České „r“ je vibrující, anglické r ne.`,
            }
          : {
              title: `«${w}»: r po samohlásce`,
              text: `V britské angličtině se «r» po samohlásce a před souhláskou nevyslovuje. České „r“ se vyslovuje vždy a vibruje, proto ho v «${w}» zadržte.`,
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
      pl: (w) => ({
        title: `«${w}»: końcówka -ed`,
        text: `Końcówkę -ed w «${w}» wymawia się na trzy sposoby, zależnie od dźwięku przed nią: szybkie «t» po k, p, s, sh, ch lub f (walked), szybkie «d» po innych dźwiękach (played) i osobna sylaba «id» tylko po t lub d (wanted).`,
      }),
      cs: (w) => ({
        title: `«${w}»: koncovka -ed`,
        text: `Koncovka -ed ve «${w}» se vyslovuje třemi způsoby podle hlásky před ní: rychlé «t» po k, p, s, sh, ch nebo f (walked), rychlé «d» po jiných hláskách (played) a samostatná slabika «id» jen po t nebo d (wanted).`,
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
      pl: (w) => ({
        title: `«${w}»: dźwięczny koniec`,
        text: `Na końcu «${w}» ostatni dźwięk pozostaje dźwięczny: w polskim końcowe „b”, „d”, „g” ogłuszają się do „p”, „t”, „k”, ale «bag» to nie «back», a «bed» to nie «bet». Zachowaj głos i wydłuż samogłoskę przed nim.`,
      }),
      cs: (w) => ({
        title: `«${w}»: znělý konec`,
        text: `Na konci «${w}» zůstává poslední hláska znělá: v češtině se koncové „b“, „d“, „g“ ztrácejí v „p“, „t“, „k“, ale «bag» není «back» a «bed» není «bet». Udržte hlas a prodlužte samohlásku před ní.`,
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
      pl: (w) => ({
        title: `«${w}»: dźwięczne th`,
        text: `W «${w}» przyłóż koniuszek języka lekko między zęby i pozwól głosowi brzmieć, gdy przepływa powietrze. To nie „z”, „d” ani „w”.`,
      }),
      cs: (w) => ({
        title: `«${w}»: znělé th`,
        text: `V «${w}» přiložte špičku jazyka lehce mezi zuby a nechte hlas znít, zatímco proudí vzduch. Není to „z“, „d“ ani „v“.`,
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
      pl: (w) => ({
        title: `«${w}»: can’t, a nie can`,
        text: `W «${w}» samogłoska jest długa i mocna, jak przeciągłe „a”, w standardowym brytyjskim angielskim. Zwykłe «can» w zdaniu twierdzącym jest słabe i krótkie, więc to samogłoska odróżnia «I can swim» od «I can’t swim».`,
      }),
      cs: (w) => ({
        title: `«${w}»: can’t, ne can`,
        text: `V «${w}» je samohláska dlouhá a silná, jako protažené „á“, ve standardní britské angličtině. Obyčejné «can» v oznamovací větě je slabé a krátké, proto právě samohláska odlišuje «I can swim» od «I can’t swim».`,
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
      pl: () => ({
        title: 'Rytm i małe słowa',
        text: 'Angielski ma mocny rytm: ważne słowa są długie i wyraźne, a małe — «a», «the», «to», «of», «for», «can» — ściskają się do krótkiego, słabego „e”. Ważne słowa mów wyraźnie, a małe niech prześlizgują się szybko.',
      }),
      cs: () => ({
        title: 'Rytmus a malá slova',
        text: 'Angličtina má silný rytmus: důležitá slova jsou dlouhá a zřetelná, kdežto malá — «a», «the», «to», «of», «for», «can» — se stlačí do krátkého slabého „e“. Důležitá slova říkejte zřetelně a malá nechte proklouznout.',
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
      pl: (w) => ({
        title: `«${w}»: щ`,
        text: 'Щ to jeden długi, miękki dźwięk, jak polskie „szcz” wymówione razem, z językiem uniesionym bliżej podniebienia.',
      }),
      cs: (w) => ({
        title: `«${w}»: щ`,
        text: 'Щ je jedna dlouhá, měkká hláska, jako české „šč“ vyslovené dohromady, s jazykem zdviženým blíž k patru.',
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
      pl: (w) => ({
        title: `«${w}»: ы`,
        text: 'Ы to polskie „y” (jak w „syn”): osobna samogłoska z językiem cofniętym i rozluźnionymi wargami. Nie zamieniaj jej na „i”. Spółgłoska przed nią jest zawsze twarda.',
      }),
      cs: (w) => ({
        title: `«${w}»: ы`,
        text: 'Ы je samostatná samohláska, kterou čeština nemá (české „y“ se čte jako „i“): řekněte „i“, ale s jazykem stáhnutým dozadu a uvolněnými rty. Nezaměňujte ji za „i“. Souhláska před ní je vždy tvrdá.',
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
      pl: (w) => ({
        title: `«${w}»: ё`,
        text: '«Ё» to „jo” („io” po spółgłosce, jak w „niosę”), a po «ж» lub «ш» zwykłe „o”. Zawsze jest akcentowana, więc pokazuje, gdzie pada akcent.',
      }),
      cs: (w) => ({
        title: `«${w}»: ё`,
        text: '«Ё» je „jo“ (změkčující předchozí souhlásku), a po «ж» nebo «ш» obyčejné „o“. Je vždy přízvučné, takže ukazuje, kam padá přízvuk.',
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
      pl: (w) => ({
        title: `«${w}»: -ться, -тся`,
        text: 'W końcówkach -ться i -тся «т» i «с» zlewają się w jedno długie «ц»: «учиться» czyta się «учицца». «-ся» to rosyjskie „się”, doklejone do końca czasownika.',
      }),
      cs: (w) => ({
        title: `«${w}»: -ться, -тся`,
        text: 'V koncovkách -ться a -тся se «т» a «с» slévají v jedno dlouhé «ц»: «учиться» se čte «учицца». «-ся» je ruské „se“, přilepené na konec slovesa.',
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
      pl: (w) => ({
        title: `«${w}»: miękki znak ь`,
        text: 'Ь nie ma własnego dźwięku. Zmiękcza spółgłoskę przed sobą, jak „ń” w „koń” albo „i” w „nie”, ale bez samogłoski po niej.',
      }),
      cs: (w) => ({
        title: `«${w}»: měkký znak ь`,
        text: 'Ь nemá vlastní hlásku. Změkčuje souhlásku před sebou, jako „ď“ v „děd“ nebo „ň“ v „kůň“, ale bez samohlásky po ní.',
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
      pl: (w) => ({
        title: `«${w}»: и po ж, ш, ц`,
        text: 'Po ж, ш i ц litera и czytana jest jak «ы»: «жи», «ши» i «ци» brzmią jak «жы», «шы» i «цы» — podobnie jak polskie „szy”, „cy”.',
      }),
      cs: (w) => ({
        title: `«${w}»: и po ж, ш, ц`,
        text: 'Po ж, ш a ц se písmeno и čte jako «ы»: «жи», «ши» a «ци» zní jako «жы», «шы» a «цы». V češtině se „ži“, „ši“ čtou s „i“.',
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
      pl: (w) => ({
        title: `«${w}»: г czytane jak в`,
        text: 'W końcówkach -ого i -его litera г czytana jest jak «в»: «его» brzmi jak «ево», «ничего» jak «ничево».',
      }),
      cs: (w) => ({
        title: `«${w}»: г čtené jako в`,
        text: 'V koncovkách -ого a -его se písmeno г čte jako «в»: «его» zní jako «ево», «ничего» jako «ничево».',
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
      pl: (w) => ({
        title: `«${w}»: х`,
        text: 'Jak polskie „ch”: szorstki dźwięk z tyłu gardła; nie osłabiaj go do cichego wydechu.',
      }),
      cs: (w) => ({
        title: `«${w}»: х`,
        text: 'Jako české „ch“: drsná hláska vzadu v krku; neoslabujte ji na tichý výdech.',
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
      pl: (w) => ({
        title: `«${w}»: ostatnia spółgłoska`,
        text: 'Tak jak w polskim, na końcu wyrazu б, в, г, д, ж i з tracą dźwięczność: czyta się je jak п, ф, к, т, ш i с, więc «хлеб» czyta się «хлеп». Przed dźwięczną spółgłoską następnego wyrazu dźwięczność może zostać.',
      }),
      cs: (w) => ({
        title: `«${w}»: poslední souhláska`,
        text: 'Stejně jako v češtině se na konci slova б, в, г, д, ж a з vyslovují neznělě: jako п, ф, к, т, ш a с, takže «хлеб» se čte «хлеп». Před znělou souhláskou dalšího slova může znělost zůstat.',
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
      pl: (w) => ({
        title: `«${w}»: drżące р`,
        text: 'Tak jak w polskim, «р» jest drżące: czubek języka uderza o wałek dziąsłowy za górnymi zębami. Wymawia się je także na końcu wyrazu.',
      }),
      cs: (w) => ({
        title: `«${w}»: vibrující р`,
        text: 'Stejně jako v češtině je «р» vibrující: špička jazyka se chvěje o dásně za horními zuby. Vyslovuje se i na konci slova.',
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
      pl: () => ({
        title: 'Akcent i słabe samogłoski',
        text: 'W rosyjskim akcent nie jest zaznaczany w pisowni, może paść na każdą sylabę i przesuwać się między formami jednego wyrazu. Bez akcentu «о» czyta się jak «а» («молоко» brzmi jak «малако»), a «е» i «я» słabną w stronę „i”.',
      }),
      cs: () => ({
        title: 'Přízvuk a slabé samohlásky',
        text: 'V ruštině se přízvuk v pravopisu neznačí, může padnout na kteroukoli slabiku a posouvat se mezi tvary jednoho slova. Bez přízvuku se «о» čte jako «а» («молоко» zní jako «малако») a «е» a «я» slábnou k „i“.',
      }),
    },
  },
]
