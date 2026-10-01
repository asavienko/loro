// The grammar rule a phrase shows (plan 105), for a phrase the learner typed. Each rule is written
// out, in every language a learner of that course reads, and names the construction it's about;
// only which rule applies is worked out, from the phrase's own words. The first that matches wins;
// the last of each language matches any phrase, so every phrase has one.
import type { NoteLocale, NoteText } from './locale.js'

export interface GrammarRule {
  id: string
  /** The words the rule is about, quoted back in its title, or null when it doesn't apply. */
  find: (text: string) => string | null
  say: Partial<Record<NoteLocale, (w: string) => NoteText>>
}

export const word = (pattern: string) => {
  const re = new RegExp(`(?<![\\p{L}])(?:${pattern})(?![\\p{L}])`, 'iu')
  return (text: string) => text.match(re)?.[0] ?? null
}

export const SPANISH_GRAMMAR: GrammarRule[] = [
  {
    id: 'gustar',
    find: word('(?:me|te|le|nos|os|les) gust(?:a|an|aría|ó|aba)'),
    say: {
      en: (w) => ({
        title: `«${w}»: gustar works backwards`,
        text: 'The thing liked is the subject: «me gusta» is “it pleases me”, and «me gustan» when it’s more than one thing.',
      }),
      bg: (w) => ({
        title: `«${w}»: като „харесва ми“`,
        text: 'Харесваното нещо е подлогът: «me gusta» е „харесва ми“, а «me gustan» — когато нещата са повече.',
      }),
      ru: (w) => ({
        title: `«${w}»: как «нравится»`,
        text: 'То, что нравится, — подлежащее: «me gusta» — «мне нравится», а «me gustan» — когда вещей несколько.',
      }),
    },
  },
  {
    id: 'progressive',
    find: word('(?:estoy|estás|está|estamos|estáis|están) \\p{L}+(?:ando|iendo|yendo)'),
    say: {
      en: (w) => ({
        title: `«${w}»: happening now`,
        text: 'Estar with a verb ending in -ando or -iendo is what’s going on right now, like English “-ing”.',
      }),
      bg: (w) => ({
        title: `«${w}»: сега`,
        text: 'Estar с глагол на -ando или -iendo е нещо, което става точно сега.',
      }),
      ru: (w) => ({
        title: `«${w}»: прямо сейчас`,
        text: 'Estar с глаголом на -ando или -iendo — то, что происходит прямо сейчас.',
      }),
    },
  },
  {
    id: 'perfect',
    find: word('(?:he|has|ha|hemos|habéis|han) (?:\\p{L}+ )?\\p{L}+(?:ado|ido|to|cho)'),
    say: {
      en: (w) => ({
        title: `«${w}»: what has happened`,
        text: 'Haber with a past participle is what has happened, like English “I have…”. In Spain it’s the usual way to tell what happened today.',
      }),
      bg: (w) => ({
        title: `«${w}»: вече се е случило`,
        text: 'Haber с минало причастие казва какво се е случило, като „съм направил“. В Испания така се разказва случилото се днес.',
      }),
      ru: (w) => ({
        title: `«${w}»: уже случилось`,
        text: 'Haber с причастием прошедшего времени — то, что уже произошло. В Испании так обычно рассказывают о сегодняшнем.',
      }),
    },
  },
  {
    id: 'tener-que',
    find: word('(?:tengo|tienes|tiene|tenemos|tenéis|tienen) que'),
    say: {
      en: (w) => ({
        title: `«${w}»: have to`,
        text: 'Tener que with a verb in its dictionary form means “have to”. Only tener changes: tengo que, tienes que, tiene que.',
      }),
      bg: (w) => ({
        title: `«${w}»: трябва да`,
        text: 'Tener que с инфинитив значи „трябва да“. Променя се само tener: tengo que, tienes que, tiene que.',
      }),
      ru: (w) => ({
        title: `«${w}»: должен`,
        text: 'Tener que с инфинитивом значит «должен, нужно». Меняется только tener: tengo que, tienes que, tiene que.',
      }),
    },
  },
  {
    id: 'hay-que',
    find: word('hay que'),
    say: {
      en: (w) => ({
        title: `«${w}»: one has to`,
        text: 'Hay que with a verb in its dictionary form says what must be done, without saying by whom. It never changes.',
      }),
      bg: (w) => ({
        title: `«${w}»: трябва`,
        text: 'Hay que с инфинитив казва какво трябва да се направи, без да казва от кого. Никога не се променя.',
      }),
      ru: (w) => ({
        title: `«${w}»: нужно`,
        text: 'Hay que с инфинитивом говорит, что нужно сделать, не уточняя кому. Никогда не меняется.',
      }),
    },
  },
  {
    id: 'ir-a',
    find: word('(?:voy|vas|va|vamos|vais|van) a \\p{L}+(?:ar|er|ir)'),
    say: {
      en: (w) => ({
        title: `«${w}»: going to`,
        text: 'Ir a with a verb in its dictionary form is the everyday future: «voy a…» is “I’m going to…”.',
      }),
      bg: (w) => ({
        title: `«${w}»: ще`,
        text: 'Ir a с инфинитив е всекидневното бъдеще: «voy a…» е „ще…“, „тъкмо ще…“.',
      }),
      ru: (w) => ({
        title: `«${w}»: собираюсь`,
        text: 'Ir a с инфинитивом — обычное будущее: «voy a…» — «я собираюсь…».',
      }),
    },
  },
  {
    id: 'querer',
    find: word('quisiera|quería|querría|quiero|quieres|quiere|queremos|quieren'),
    say: {
      en: (w) => ({
        title: `«${w}»: asking for something`,
        text: '«Quiero» is “I want”. «Quería» and «quisiera» soften it to “I’d like”, the polite way to ask.',
      }),
      bg: (w) => ({
        title: `«${w}»: молба`,
        text: '«Quiero» е „искам“. «Quería» и «quisiera» го смекчават до „бих искал“ — учтивият начин да помолите.',
      }),
      ru: (w) => ({
        title: `«${w}»: просьба`,
        text: '«Quiero» — «я хочу». «Quería» и «quisiera» смягчают до «я бы хотел» — вежливый способ попросить.',
      }),
    },
  },
  {
    id: 'poder',
    find: word('puedo|puedes|puede|podemos|podéis|pueden|podría|podrías|podríamos|podrían'),
    say: {
      en: (w) => ({
        title: `«${w}»: can`,
        text: 'Poder takes the next verb in its dictionary form. «¿Puede…?» asks politely, as “could you…?” does.',
      }),
      bg: (w) => ({
        title: `«${w}»: мога`,
        text: 'След poder следващият глагол е в инфинитив. «¿Puede…?» е учтива молба, като „бихте ли…?“.',
      }),
      ru: (w) => ({
        title: `«${w}»: мочь`,
        text: 'После poder следующий глагол стоит в инфинитиве. «¿Puede…?» — вежливая просьба, как «не могли бы вы…?».',
      }),
    },
  },
  {
    id: 'llamarse',
    find: word('(?:me|te|se|nos) llam(?:o|as|a|amos|an)'),
    say: {
      en: (w) => ({
        title: `«${w}»: names`,
        text: 'Spanish says “I call myself”: «me llamo…», «¿cómo te llamas?». The small word before the verb changes with the person.',
      }),
      bg: (w) => ({
        title: `«${w}»: казвам се`,
        text: 'Испанският казва „наричам се“: «me llamo…», «¿cómo te llamas?». Малката дума пред глагола се сменя с лицето.',
      }),
      ru: (w) => ({
        title: `«${w}»: меня зовут`,
        text: 'По-испански «я зову себя»: «me llamo…», «¿cómo te llamas?». Маленькое слово перед глаголом меняется по лицам.',
      }),
    },
  },
  {
    id: 'hay',
    find: word('hay'),
    say: {
      en: (w) => ({
        title: `«${w}»: there is, there are`,
        text: 'One word for both, whatever follows: «hay un…», «hay dos…». It’s a form of haber.',
      }),
      bg: (w) => ({
        title: `«${w}»: има`,
        text: 'Една дума и за единствено, и за множествено число: «hay un…», «hay dos…». Това е форма на haber.',
      }),
      ru: (w) => ({
        title: `«${w}»: есть, имеется`,
        text: 'Одно слово и для единственного, и для множественного числа: «hay un…», «hay dos…». Это форма глагола haber.',
      }),
    },
  },
  {
    id: 'question-word',
    find: word(
      'qué|dónde|adónde|cuándo|cuánto|cuánta|cuántos|cuántas|cómo|quién|quiénes|cuál|cuáles',
    ),
    say: {
      en: (w) => ({
        title: `«${w}»: a question word`,
        text: 'Question words carry a written accent (qué, dónde, cuánto) and come first; the verb follows them.',
      }),
      bg: (w) => ({
        title: `«${w}»: въпросителна дума`,
        text: 'Въпросителните думи се пишат с ударение (qué, dónde, cuánto) и стоят първи; глаголът е след тях.',
      }),
      ru: (w) => ({
        title: `«${w}»: вопросительное слово`,
        text: 'Вопросительные слова пишутся с ударением (qué, dónde, cuánto) и стоят первыми; глагол — после них.',
      }),
    },
  },
  {
    id: 'estar',
    find: word('estoy|estás|está|estamos|estáis|están'),
    say: {
      en: (w) => ({
        title: `«${w}»: estar`,
        text:
          'Estar says where something is and how it is right now; ser says what it is. «' +
          w +
          '» is estar.',
      }),
      bg: (w) => ({
        title: `«${w}»: estar`,
        text:
          'Estar казва къде е нещо и какво е в момента; ser казва какво е. «' + w + '» е от estar.',
      }),
      ru: (w) => ({
        title: `«${w}»: estar`,
        text:
          'Estar говорит, где что-то находится и какое оно сейчас; ser — что это такое. «' +
          w +
          '» — от estar.',
      }),
    },
  },
  {
    id: 'usted',
    find: word('usted|ustedes'),
    say: {
      en: (w) => ({
        title: `«${w}»: the polite you`,
        text: 'Usted takes the verb’s he-and-she form: «¿usted tiene…?». Ustedes is you, more than one.',
      }),
      bg: (w) => ({
        title: `«${w}»: учтивото „вие“`,
        text: 'Usted се съчетава с глагола в трето лице: «¿usted tiene…?». Ustedes е „вие“ за повече хора.',
      }),
      ru: (w) => ({
        title: `«${w}»: вежливое «вы»`,
        text: 'Usted требует глагола в третьем лице: «¿usted tiene…?». Ustedes — «вы» для нескольких человек.',
      }),
    },
  },
  {
    id: 'ser',
    find: word('soy|eres|es|somos|sois|son'),
    say: {
      en: (w) => ({
        title: `«${w}»: ser`,
        text: 'Ser says what something is: who, what, where from. For where it is or how it is now, Spanish uses estar.',
      }),
      bg: (w) => ({
        title: `«${w}»: ser`,
        text: 'Ser казва какво е нещо: кой, какво, откъде. За къде е и какво е сега испанският използва estar.',
      }),
      ru: (w) => ({
        title: `«${w}»: ser`,
        text: 'Ser говорит, что это такое: кто, что, откуда. Для «где» и «какое сейчас» в испанском есть estar.',
      }),
    },
  },
  {
    id: 'para',
    find: word('para \\p{L}+(?:ar|er|ir)'),
    say: {
      en: (w) => ({
        title: `«${w}»: in order to`,
        text: 'Para with a verb in its dictionary form says what for: «para pagar» is “to pay”.',
      }),
      bg: (w) => ({
        title: `«${w}»: за да`,
        text: 'Para с инфинитив казва за какво: «para pagar» е „за да платя“.',
      }),
      ru: (w) => ({
        title: `«${w}»: чтобы`,
        text: 'Para с инфинитивом говорит, зачем: «para pagar» — «чтобы заплатить».',
      }),
    },
  },
  {
    id: 'al-del',
    find: word('al|del'),
    say: {
      en: (w) => ({
        title: `«${w}»: a + el, de + el`,
        text: 'A and de join the article el in one word, al and del. They don’t join la: «a la», «de la».',
      }),
      bg: (w) => ({
        title: `«${w}»: a + el, de + el`,
        text: 'A и de се сливат с члена el в една дума: al, del. С la не се сливат: «a la», «de la».',
      }),
      ru: (w) => ({
        title: `«${w}»: a + el, de + el`,
        text: 'A и de сливаются с артиклем el в одно слово: al, del. С la — нет: «a la», «de la».',
      }),
    },
  },
  {
    id: 'no',
    find: word('no \\p{L}+'),
    say: {
      en: (w) => ({
        title: `«${w}»: no before the verb`,
        text: 'No goes straight before the verb, and before any me, te or lo in front of it: «no me gusta».',
      }),
      bg: (w) => ({
        title: `«${w}»: no пред глагола`,
        text: 'No стои точно пред глагола и пред me, te или lo пред него: «no me gusta».',
      }),
      ru: (w) => ({
        title: `«${w}»: no перед глаголом`,
        text: 'No ставится прямо перед глаголом и перед me, te или lo перед ним: «no me gusta».',
      }),
    },
  },
  {
    id: 'article',
    find: word('(?:el|la|los|las|un|una|unos|unas) \\p{L}+'),
    say: {
      en: (w) => ({
        title: `«${w}»: el or la`,
        text: 'Every noun is masculine or feminine, and “the” and “a” agree: el, un for masculine, la, una for feminine. Most nouns in -o are masculine, most in -a feminine.',
      }),
      bg: (w) => ({
        title: `«${w}»: el или la`,
        text: 'Всяко съществително е от мъжки или женски род и членът се съгласува: el, un за мъжки, la, una за женски. Повечето на -o са мъжки, на -a — женски.',
      }),
      ru: (w) => ({
        title: `«${w}»: el или la`,
        text: 'Каждое существительное мужского или женского рода, и артикль согласуется: el, un — мужской, la, una — женский. Большинство слов на -o мужского рода, на -a — женского.',
      }),
    },
  },
  {
    id: 'question',
    find: (text) => (/[¿?]/.test(text) ? '¿…?' : null),
    say: {
      en: (w) => ({
        title: `${w}: a question`,
        text: 'Spanish opens a question with ¿ as well as closing it. A yes-or-no question keeps the order of a statement: only the voice rises at the end.',
      }),
      bg: (w) => ({
        title: `${w}: въпрос`,
        text: 'Испанският отваря въпроса с ¿, а не само го затваря. Въпросът с „да“ или „не“ пази реда на думите — само гласът се качва в края.',
      }),
      ru: (w) => ({
        title: `${w}: вопрос`,
        text: 'В испанском вопрос открывается знаком ¿, а не только закрывается. В вопросе «да или нет» порядок слов как в утверждении — только голос повышается в конце.',
      }),
    },
  },
  {
    id: 'exclamation',
    find: (text) => (/[¡!]/.test(text) ? '¡…!' : null),
    say: {
      en: (w) => ({
        title: `${w}: an exclamation`,
        text: 'Like a question, an exclamation opens with its mark upside down, so you know how to say it from the start.',
      }),
      bg: (w) => ({
        title: `${w}: възклицание`,
        text: 'Като въпроса, възклицанието се отваря с обърнат знак, за да знаете още отначало как да го кажете.',
      }),
      ru: (w) => ({
        title: `${w}: восклицание`,
        text: 'Как и вопрос, восклицание открывается перевёрнутым знаком, чтобы с самого начала было ясно, как его произносить.',
      }),
    },
  },
  {
    id: 'gender',
    find: () => '',
    say: {
      en: () => ({
        title: 'Masculine or feminine',
        text: 'Every Spanish noun is masculine or feminine, and the words with it agree: el, un, bueno with a masculine noun; la, una, buena with a feminine one.',
      }),
      bg: () => ({
        title: 'Мъжки или женски род',
        text: 'Всяко испанско съществително е от мъжки или женски род и думите около него се съгласуват: el, un, bueno с мъжки; la, una, buena с женски.',
      }),
      ru: () => ({
        title: 'Мужской или женский род',
        text: 'Каждое испанское существительное мужского или женского рода, и слова рядом согласуются: el, un, bueno — с мужским; la, una, buena — с женским.',
      }),
    },
  },
]

export const BULGARIAN_GRAMMAR: GrammarRule[] = [
  {
    id: 'comparative',
    find: word('(?:по|най)-\\p{L}+'),
    say: {
      en: (w) => ({
        title: `«${w}»: more, most`,
        text: 'По- before an adjective or adverb makes it “more”: по-голям is bigger, по-бавно more slowly. Най- makes it “most”.',
      }),
      ru: (w) => ({
        title: `«${w}»: сравнение`,
        text: 'По- перед прилагательным или наречием даёт сравнительную степень: по-голям — больше, по-бавно — медленнее. Най- — превосходную.',
      }),
    },
  },
  {
    id: 'nyama-da',
    find: word('няма да'),
    say: {
      en: (w) => ({
        title: `«${w}»: won’t`,
        text: 'The future in the negative is няма да and a verb: “won’t”. Not не ще.',
      }),
      ru: (w) => ({
        title: `«${w}»: не буду`,
        text: 'Будущее с отрицанием — няма да и глагол: «не буду, не стану». Не «не ще».',
      }),
    },
  },
  {
    id: 'shte',
    find: word('ще'),
    say: {
      en: (w) => ({
        title: `«${w}»: the future`,
        text: 'Ще before a verb in the present makes it future, and ще never changes: ще отида — I’ll go, ще отидем — we’ll go.',
      }),
      ru: (w) => ({
        title: `«${w}»: будущее`,
        text: 'Ще перед глаголом в настоящем времени даёт будущее, и ще не меняется: ще отида — пойду, ще отидем — пойдём.',
      }),
    },
  },
  {
    id: 'mozhe-li',
    find: word('може ли'),
    say: {
      en: (w) => ({
        title: `«${w}»: may I`,
        text: 'Literally “is it possible?”: the everyday polite request, with a noun or with да and a verb.',
      }),
      ru: (w) => ({
        title: `«${w}»: можно?`,
        text: 'Буквально «можно ли?»: обычная вежливая просьба — с существительным или с да и глаголом.',
      }),
    },
  },
  {
    id: 'bih',
    find: word('бих'),
    say: {
      en: (w) => ({
        title: `«${w}»: would`,
        text: 'Бих with a past form makes it polite: бих искал (бих искала) is “I would like”.',
      }),
      ru: (w) => ({
        title: `«${w}»: бы`,
        text: 'Бих с формой прошедшего времени — вежливое «бы»: бих искал (бих искала) — «я бы хотел(а)».',
      }),
    },
  },
  {
    id: 'tryabva',
    find: word('трябва'),
    say: {
      en: (w) => ({
        title: `«${w}»: must`,
        text: 'Трябва never changes: трябва да and a verb is “I must”, “you must”, “we must” alike.',
      }),
      ru: (w) => ({
        title: `«${w}»: нужно`,
        text: 'Трябва не изменяется: трябва да и глагол — «мне нужно», «тебе нужно», «нам нужно».',
      }),
    },
  },
  {
    id: 'da',
    find: word('да \\p{L}+'),
    say: {
      en: (w) => ({
        title: `«${w}»: да, not an infinitive`,
        text: 'Bulgarian has no infinitive: after искам, мога or трябва comes да and a verb with its own ending — искам да отида, “I want that I go”.',
      }),
      ru: (w) => ({
        title: `«${w}»: да вместо инфинитива`,
        text: 'В болгарском нет инфинитива: после искам, мога, трябва идёт да и глагол в личной форме — искам да отида, «хочу, чтобы я пошёл».',
      }),
    },
  },
  {
    id: 'question-word',
    find: word('къде|откъде|докъде|кога|колко|какво|какъв|каква|какви|кой|коя|кое|кои|как|защо'),
    say: {
      en: (w) => ({
        title: `«${w}»: a question word`,
        text: 'A question word comes first and needs no ли: къде е…? — where is…?',
      }),
      ru: (w) => ({
        title: `«${w}»: вопросительное слово`,
        text: 'Вопросительное слово стоит первым, и ли не нужно: къде е…? — где…?',
      }),
    },
  },
  {
    id: 'li',
    find: word('\\p{L}+ ли'),
    say: {
      en: (w) => ({
        title: `«${w}»: a yes-or-no question`,
        text: 'Ли makes the question and comes straight after the word it asks about, usually the verb: имате ли…? — do you have…?',
      }),
      ru: (w) => ({
        title: `«${w}»: вопрос «да или нет»`,
        text: 'Частица ли делает вопрос и стоит сразу после слова, о котором спрашивают, обычно после глагола: имате ли…? — у вас есть…?',
      }),
    },
  },
  {
    id: 'article',
    find: word('\\p{L}{3,}(?:ът|ката|тата|цата|ото|ето)'),
    say: {
      en: (w) => ({
        title: `«${w}»: “the” at the end`,
        text: 'Bulgarian puts “the” on the end of the noun: сметка, a bill, becomes сметката, the bill.',
      }),
      ru: (w) => ({
        title: `«${w}»: артикль в конце`,
        text: 'В болгарском есть определённый артикль, и он присоединяется к концу слова: сметка — «счёт», сметката — «этот счёт».',
      }),
    },
  },
  {
    id: 'imam',
    find: word('имам|имаш|има|имаме|имате|имат'),
    say: {
      en: (w) => ({
        title: `«${w}»: to have, there is`,
        text: 'Имам is “I have”, and the plain има also means “there is”: има ли…? — is there…?',
      }),
      ru: (w) => ({
        title: `«${w}»: иметь`,
        text: 'По-болгарски «я имею»: имам — «у меня есть». Просто има значит и «есть, имеется»: има ли…? — есть ли…?',
      }),
    },
  },
  {
    id: 'nyama',
    find: word('нямам|нямаш|няма|нямаме|нямате|нямат'),
    say: {
      en: (w) => ({
        title: `«${w}»: there isn’t`,
        text: 'Няма is “there isn’t”, нямам “I don’t have”: one word, without не.',
      }),
      ru: (w) => ({
        title: `«${w}»: нет`,
        text: 'Няма — «нет, не имеется», нямам — «у меня нет»: одно слово, без не.',
      }),
    },
  },
  {
    id: 'se',
    find: word('\\p{L}+ се|се \\p{L}+'),
    say: {
      en: (w) => ({
        title: `«${w}»: се with the verb`,
        text: 'Many verbs come with се, which stays next to the verb: казвам се — I’m called, виждаме се — we see each other.',
      }),
      ru: (w) => ({
        title: `«${w}»: се с глаголом`,
        text: 'Многие глаголы употребляются с се, и оно стоит рядом с глаголом: казвам се — меня зовут, виждаме се — видимся.',
      }),
    },
  },
  {
    id: 'short-pronoun',
    find: word('\\p{L}+ (?:ме|ми|те|ти|го|му|ѝ|ни|ви|им|ги)'),
    say: {
      en: (w) => ({
        title: `«${w}»: a short pronoun`,
        text: 'Short pronouns (ме, ми, те, го…) sit next to the verb and never start a sentence: «Боли ме» — it hurts (me).',
      }),
      ru: (w) => ({
        title: `«${w}»: краткое местоимение`,
        text: 'Краткие местоимения (ме, ми, те, го…) стоят рядом с глаголом и никогда не начинают предложение: «Боли ме» — мне больно.',
      }),
    },
  },
  {
    id: 'ne',
    find: word('не \\p{L}+'),
    say: {
      en: (w) => ({
        title: `«${w}»: не before the verb`,
        text: 'Не goes straight before the verb, and before a short pronoun in front of it: не ме боли.',
      }),
      ru: (w) => ({
        title: `«${w}»: не перед глаголом`,
        text: 'Не ставится прямо перед глаголом и перед кратким местоимением перед ним: не ме боли.',
      }),
    },
  },
  {
    id: 'sam',
    find: word('съм|е|сме|сте|са'),
    say: {
      en: (w) => ({
        title: `«${w}»: to be`,
        text: 'Съм, to be, has short forms that lean on the word before: аз съм, ти си, той е, ние сме, вие сте, те са. They never start a sentence.',
      }),
      ru: (w) => ({
        title: `«${w}»: быть`,
        text: 'В отличие от русского, «быть» в настоящем не опускается: аз съм, ти си, той е, ние сме, вие сте, те са. Эти формы не начинают предложение.',
      }),
    },
  },
  {
    id: 'na',
    find: word('на \\p{L}+'),
    say: {
      en: (w) => ({
        title: `«${w}»: на instead of cases`,
        text: 'Bulgarian nouns have no cases: на says both “of” and “to” — името на…, the name of…; дайте на мен, give (to) me.',
      }),
      ru: (w) => ({
        title: `«${w}»: на вместо падежей`,
        text: 'В болгарском нет падежей: на передаёт и родительный, и дательный — името на… (имя кого-то), дайте на мен (дайте мне).',
      }),
    },
  },
  {
    id: 'no-cases',
    find: () => '',
    say: {
      en: () => ({
        title: 'No cases',
        text: 'Bulgarian nouns don’t change for their role in the sentence: word order and prepositions such as на, за, в and с do that work.',
      }),
      ru: () => ({
        title: 'Без падежей',
        text: 'Болгарские существительные не склоняются по падежам: их роль показывают порядок слов и предлоги на, за, в, с.',
      }),
    },
  },
]

// ---------------------------------------------------------------------------------------------
// British English (en-GB) for Bulgarian and Russian speakers: the grammar rule and the sound tip a
// phrase the learner typed shows (plan 105). Same contract as grammar.ts and pronunciation.ts: the
// first rule that matches wins, the last matches any phrase, and every explanation is true of any
// phrase its pattern can match.

/**
 * Like `word`, but the words must open the phrase or a clause (after punctuation, or after «excuse
 * me», «sorry», «and»…), where they can only be a question or a request: «May I» opens a request,
 * but «in May I went» does not.
 */
const LEAD = String.raw`(?:^\s*|[.,;:!?…"“”(—–-]\s*|\b(?:excuse me|sorry|please|and|but|so|well|then|hello|hi)\s+)`
const at = (pattern: string) => {
  const re = new RegExp(`(?<=${LEAD})(?:${pattern})(?![\\p{L}])`, 'iu')
  return (text: string) => text.match(re)?.[0] ?? null
}

// -- patterns for the grammar rules -------------------------------------------------------------

const wouldLike = word(
  String.raw`(?:I|you|we|they|he|she)(?:['’]d|\s+would)\s+like|would\s+you\s+like`,
)

const request = at(String.raw`(?:could|can|may)\s+(?:I|we)|(?:could|can)\s+you`)

/** Past participles that cannot be mistaken for an adjective straight after «have». */
const PARTICIPLE =
  'been|gone|seen|had|done|lost|left|forgotten|eaten|taken|given|found|made|met|heard|read|written|bought|brought|come|drunk|flown|known|paid|said|sold|sent|spoken|stolen|told|thought|understood|worn|won|broken|chosen|driven|begun|run|sung|swum|slept|felt|kept|built|caught|fallen|held|visited|tried|finished|lived|worked|studied|booked|arrived|waited|started|opened|closed|called|asked|played|watched|looked|wanted|needed|helped|moved|changed|cooked|travelled|traveled|ordered|decided|missed|liked|loved|tasted|stayed'
const ADVERB = String.raw`(?:\s+(?:ever|never|already|just|not|yet|also|still|always|recently|finally|really))?`
const perfect = word(
  String.raw`(?<!\b(?:do|does|did|don['’]t|doesn['’]t|didn['’]t)\s+)(?:` +
    String.raw`(?:I|you|we|they)(?:['’]ve|\s+have|\s+haven['’]t)${ADVERB}\s+(?:${PARTICIPLE})` +
    String.raw`|(?:he|she|it)(?:\s+has|\s+hasn['’]t)${ADVERB}\s+(?:${PARTICIPLE})` +
    String.raw`|(?:he|she|it)['’]s${ADVERB}\s+been` +
    String.raw`|(?:have|haven['’]t)\s+(?:you|we|they|I)${ADVERB}\s+(?:${PARTICIPLE})` +
    String.raw`|(?:has|hasn['’]t)\s+(?:he|she|it)${ADVERB}\s+(?:${PARTICIPLE}))`,
)

/** Verbs that can follow «going to» without being mistaken for a place or a noun («going to work»). */
const GOING_VERB =
  'be|have|get|buy|see|visit|meet|take|make|do|eat|drink|stay|call|ask|try|leave|wait|play|watch|read|write|learn|help|travel|cook|book|order|pay|start|stop|need|say|tell|give|bring|find|rain|snow|study|sleep|come|walk|swim|drive|fly|sit|phone|show|send|open|close|use|wear|change|move|live|pick|look|think|know|go'
const goingTo = word(
  String.raw`(?:I['’]m|you['’]re|we['’]re|they['’]re|he['’]s|she['’]s|it['’]s|(?:am|are|is)(?:\s+(?:you|we|they|he|she|it|I))?)\s+going\s+to\s+(?:${GOING_VERB})`,
)

const thereWord = word(
  String.raw`there['’]s|there\s+(?:is|are|was|were|isn['’]t|aren['’]t|wasn['’]t|weren['’]t)`,
)
const thereQuestion = at(
  String.raw`(?:is|are|was|were|isn['’]t|aren['’]t|wasn['’]t|weren['’]t)\s+there`,
)

const howMuchMany = word(String.raw`how\s+(?:much|many)`)

const lets = word(String.raw`let['’]s`)

const TAG_RE =
  /,\s*((?:isn['’]t|aren['’]t|wasn['’]t|weren['’]t|doesn['’]t|don['’]t|didn['’]t|haven['’]t|hasn['’]t|can['’]t|couldn['’]t|won['’]t|wouldn['’]t|shouldn['’]t)\s+(?:it|he|she|you|they|we|I|there|that)\s*\?)/iu

/** Nouns that can't be taken for a verb or an adjective after «'s» («Tom’s tired» is not possession). */
const OWNED =
  'book|bag|house|car|phone|name|friend|sister|brother|mother|father|wife|husband|family|room|office|key|passport|ticket|birthday|dog|cat|coat|money|address|number|job|flat|apartment|hotel|son|daughter|parents|party|shop|table|seat|luggage|suitcase|glasses|wallet|jacket|bike|hat|girlfriend|boyfriend|teacher|boss|wedding|children|kids'
const possessive = word(
  String.raw`(?!(?:it|he|she|that|there|here|what|where|who|when|how|why|let|this|one)['’]s)\p{L}+['’]s\s+(?:${OWNED})s?`,
)

const doQuestion = at(
  String.raw`(?:(?:what|where|when|why|how|who|which)(?:\s+\p{L}+)?\s+)?(?:do\s+(?:you|I|we|they)|did\s+(?:you|I|we|they|he|she|it)|does\s+\p{L}+)`,
)
const doNegative = word(String.raw`don['’]t|doesn['’]t|didn['’]t|do\s+not|does\s+not|did\s+not`)

const WH = 'what|where|when|why|who|whose|whom|which|how'
const SUBJECT_OR_DETERMINER = String.raw`(?:I|you|he|she|it|we|they|the|a|an|my|your|his|her|our|their)(?![\p{L}])`
const whStart = at(String.raw`(?:${WH})(?!\s+${SUBJECT_OR_DETERMINER})`)
const whAux = at(
  String.raw`(?:${WH})(?:\s+(?!${SUBJECT_OR_DETERMINER})\p{L}+)?\s+(?:is|are|was|were|am|do|does|did|can|could|will|would|should|shall|may|have|has)(?![\p{L}])`,
)

const someAny = word('some|any')

const article = word(String.raw`(?:a|an|the)\s+\p{L}+`)

export const ENGLISH_GRAMMAR: GrammarRule[] = [
  {
    id: 'would-like',
    find: wouldLike,
    say: {
      en: (w) => ({
        title: `«${w}»: the polite “want”`,
        text: 'Would like is the polite way to say what you want: «I’d like a coffee», «I’d like to pay». «Would you like…?» offers the same thing to someone else; a plain “I want” can sound blunt.',
      }),
      bg: (w) => ({
        title: `«${w}»: учтивото „искам“`,
        text: '«Would like» е учтивият начин да кажете какво искате, като „бих искал“: «I’d like a coffee», «I’d like to pay». «Would you like…?» предлага същото на другия, а простото «I want» може да прозвучи рязко.',
      }),
      ru: (w) => ({
        title: `«${w}»: вежливое «хочу»`,
        text: '«Would like» — вежливый способ сказать, чего вы хотите, как «я бы хотел»: «I’d like a coffee», «I’d like to pay». «Would you like…?» предлагает то же собеседнику, а простое «I want» может прозвучать резко.',
      }),
    },
  },
  {
    id: 'request',
    find: request,
    say: {
      en: (w) => ({
        title: `«${w}»: asking politely`,
        text: '«Could I…?», «Can I…?», «May I…?» and «Could you…?» open a question, often a polite request. «Could» is softer than «can», and «may» is the most formal. The verb after them has no “to”: «Could you repeat that?»',
      }),
      bg: (w) => ({
        title: `«${w}»: учтива молба`,
        text: '«Could I…?», «Can I…?», «May I…?» и «Could you…?» откриват въпрос, често учтива молба („може ли…“, „бихте ли…“). «Could» е по-мек от «can», а «may» е най-официалното. Следващият глагол е без «to» и без „да“: «Could you repeat that?»',
      }),
      ru: (w) => ({
        title: `«${w}»: вежливая просьба`,
        text: '«Could I…?», «Can I…?», «May I…?» и «Could you…?» открывают вопрос, часто вежливую просьбу («можно…?», «не могли бы вы…?»). «Could» мягче, чем «can», а «may» — самое официальное. Следующий глагол — без «to»: «Could you repeat that?»',
      }),
    },
  },
  {
    id: 'perfect',
    find: perfect,
    say: {
      en: (w) => ({
        title: `«${w}»: what has happened`,
        text: '«Have» or «has» with a past participle tells what has happened, with a link to now: «I’ve lost my passport» (so I haven’t got it), «Have you ever been to London?». With a finished time (yesterday, last year) use the simple past: «I lost it yesterday».',
      }),
      bg: (w) => ({
        title: `«${w}»: вече се е случило`,
        text: '«Have» или «has» и минало причастие казват какво се е случило и още има значение сега: «I’ve lost my passport» — загубил съм си паспорта (и още го нямам), «Have you ever been to London?». При завършено време (вчера, миналата година) се ползва простото минало: «I lost it yesterday».',
      }),
      ru: (w) => ({
        title: `«${w}»: уже случилось`,
        text: '«Have» или «has» с причастием говорят о том, что уже случилось и важно сейчас: «I’ve lost my passport» — «я потерял паспорт» (и его до сих пор нет). Такого времени в русском нет. Если время названо и закончилось (вчера, в прошлом году), нужно простое прошедшее: «I lost it yesterday».',
      }),
    },
  },
  {
    id: 'going-to',
    find: goingTo,
    say: {
      en: (w) => ({
        title: `«${w}»: going to`,
        text: '«Going to» and a verb in its basic form says what you plan to do or what is about to happen: «I’m going to visit my aunt», «It’s going to rain». Only «am, is, are» changes; «going to» stays.',
      }),
      bg: (w) => ({
        title: `«${w}»: смятам да, ще`,
        text: '«Going to» и глагол в основна форма (без «to») казват какво смятате да направите или какво предстои: «I’m going to visit my aunt» — „ще посетя леля си“, «It’s going to rain» — „ще вали“. Променя се само «am, is, are».',
      }),
      ru: (w) => ({
        title: `«${w}»: собираюсь`,
        text: '«Going to» и глагол в начальной форме (без «to») говорят о плане или о том, что вот-вот случится: «I’m going to visit my aunt» — «я собираюсь навестить тётю», «It’s going to rain» — «будет дождь». Меняется только «am, is, are».',
      }),
    },
  },
  {
    id: 'there-is',
    find: (text) => thereWord(text) ?? thereQuestion(text),
    say: {
      en: (w) => ({
        title: `«${w}»: there is, there are`,
        text: '«There is» says that one thing exists or is somewhere, «there are» says it of several: «There is a bank near here», «Are there any rooms?». «There» doesn’t mean “over there” here, and the verb agrees with the thing that follows.',
      }),
      bg: (w) => ({
        title: `«${w}»: има`,
        text: '«There is» и «there are» значат „има“, но английският сменя глагола: «There is a bank near here» (една), «There are two banks» (повече). «There» тук не е „там“: «Is there a bank?» е „Има ли банка?“.',
      }),
      ru: (w) => ({
        title: `«${w}»: есть`,
        text: '«There is» и «there are» — «есть, имеется», но глагол меняется по числу: «There is a bank near here» (одна), «There are two banks» (несколько). «There» здесь не значит «там»: «Is there a bank?» — «Есть ли банк?».',
      }),
    },
  },
  {
    id: 'how-much-many',
    find: howMuchMany,
    say: {
      en: (w) => ({
        title: `«${w}»: how much or how many`,
        text: '«How many» goes with things you can count, in the plural: «How many people?». «How much» goes with things you can’t count, and asks a price: «How much is it?»',
      }),
      bg: (w) => ({
        title: `«${w}»: колко`,
        text: 'За „колко“ английският има две думи: «how many» за неща, които се броят, с множествено число: «How many people?», и «how much» за неброими неща и за цена: «How much is it?»',
      }),
      ru: (w) => ({
        title: `«${w}»: сколько`,
        text: 'Для «сколько» в английском две формы: «how many» для того, что можно посчитать, с множественным числом: «How many people?», и «how much» для того, что не считают, и для цены: «How much is it?»',
      }),
    },
  },
  {
    id: 'lets',
    find: lets,
    say: {
      en: (w) => ({
        title: `«${w}»: let’s`,
        text: '«Let’s» is “let us” and suggests doing something together. A verb in its basic form follows, with no «to»: «Let’s eat», «Let’s not wait».',
      }),
      bg: (w) => ({
        title: `«${w}»: хайде да`,
        text: '«Let’s» значи „хайде да“ и предлага нещо да се направи заедно. След него идва глагол в основна форма, без «to»: «Let’s eat» — „Хайде да ядем“, «Let’s not wait» — „Да не чакаме“.',
      }),
      ru: (w) => ({
        title: `«${w}»: давайте`,
        text: '«Let’s» — «давайте», предложение сделать что-то вместе. Дальше идёт глагол в начальной форме, без «to»: «Let’s eat» — «давайте поедим», «Let’s not wait» — «не будем ждать».',
      }),
    },
  },
  {
    id: 'tag-question',
    find: (text) => TAG_RE.exec(text)?.[1] ?? null,
    say: {
      en: (w) => ({
        title: `«${w}»: a question tag`,
        text: 'A short question on the end, such as «isn’t it?» or «don’t you?», asks the listener to agree. It repeats the helper verb of the sentence, usually turned the other way: «It’s cold, isn’t it?», «You like tea, don’t you?»',
      }),
      bg: (w) => ({
        title: `«${w}»: като „нали“`,
        text: 'Кратък въпрос в края, като «isn’t it?» или «don’t you?», търси съгласие, подобно на „нали“. Но не е една дума: повтаря помощния глагол на изречението, обикновено в обратна форма: «It’s cold, isn’t it?», «You like tea, don’t you?»',
      }),
      ru: (w) => ({
        title: `«${w}»: как «не так ли?»`,
        text: 'Короткий вопрос в конце, вроде «isn’t it?» или «don’t you?», просит собеседника согласиться, как «правда?» или «не так ли?». Но это не одно слово: он повторяет вспомогательный глагол предложения, обычно в противоположной форме: «It’s cold, isn’t it?», «You like tea, don’t you?»',
      }),
    },
  },
  {
    id: 'possessive-s',
    find: possessive,
    say: {
      en: (w) => ({
        title: `«${w}»: whose it is`,
        text: '«’s» on the owner shows whose something is: «my sister’s book» is “the book of my sister”. The owner comes first and takes «’s», then comes the thing, with no «of».',
      }),
      bg: (w) => ({
        title: `«${w}»: чие е`,
        text: '«’s» след притежателя казва чие е нещо: «my sister’s book» е „книгата на сестра ми“. Първо е притежателят със «’s», после нещото, без предлог.',
      }),
      ru: (w) => ({
        title: `«${w}»: чьё это`,
        text: '«’s» у владельца показывает, чьё это: «my sister’s book» — «книга моей сестры». Сначала владелец с «’s», потом вещь; предлога и падежа нет.',
      }),
    },
  },
  {
    id: 'do-support',
    find: (text) => doQuestion(text) ?? doNegative(text),
    say: {
      en: (w) => ({
        title: `«${w}»: do, does, did`,
        text: 'With most verbs, questions and negatives need «do», «does» or «did»: «Do you speak English?», «I don’t understand». It shows the person («does» for he, she, it) and the tense («did» for the past), so the main verb stays in its basic form.',
      }),
      bg: (w) => ({
        title: `«${w}»: do, does, did`,
        text: 'С повечето глаголи въпросът и отрицанието искат «do», «does» или «did» (вместо „ли“): «Do you speak English?», «I don’t understand». То показва лицето («does» за he, she, it) и времето («did» — минало), затова основният глагол остава в основна форма.',
      }),
      ru: (w) => ({
        title: `«${w}»: do, does, did`,
        text: 'С большинством глаголов вопрос и отрицание требуют «do», «does» или «did» (в русском хватает интонации): «Do you speak English?», «I don’t understand». Оно показывает лицо («does» для he, she, it) и время («did» — прошедшее), поэтому основной глагол остаётся в начальной форме.',
      }),
    },
  },
  {
    id: 'question-word',
    find: (text) => {
      if (/!\s*$/.test(text)) return null
      return text.includes('?') ? whStart(text) : whAux(text)
    },
    say: {
      en: (w) => ({
        title: `«${w}»: a question word`,
        text: 'A question word comes first, and the verb or its helper goes before the subject: «Where is the bank?», «Where do you live?». When the question word is itself the subject, nothing is added: «Who lives here?»',
      }),
      bg: (w) => ({
        title: `«${w}»: въпросителна дума`,
        text: 'Въпросителната дума е първа, а глаголът или помощният му глагол стои пред подлога: «Where is the bank?», «Where do you live?». Когато въпросителната дума е самият подлог, нищо не се добавя: «Who lives here?»',
      }),
      ru: (w) => ({
        title: `«${w}»: вопросительное слово`,
        text: 'Вопросительное слово стоит первым, а глагол или его помощник — перед подлежащим: «Where is the bank?», «Where do you live?». Если вопросительное слово само подлежащее, ничего не добавляется: «Who lives here?»',
      }),
    },
  },
  {
    id: 'some-any',
    find: someAny,
    say: {
      en: (w) => ({
        title: `«${w}»: some or any`,
        text: '«Some» is for statements, offers and requests: «I’d like some water», «Would you like some tea?». «Any» is for negatives and most questions: «I don’t have any money», «Do you have any rooms?». English doesn’t double the negative: «I don’t have any», not «I don’t have no».',
      }),
      bg: (w) => ({
        title: `«${w}»: some или any`,
        text: '«Some» е за утвърдителни изречения, предложения и молби: «I’d like some water». «Any» е за отрицания и повечето въпроси: «I don’t have any money», «Do you have any rooms?». Английският не удвоява отрицанието като българския („нямам никакви пари“): след «don’t» идва «any», не «no».',
      }),
      ru: (w) => ({
        title: `«${w}»: some или any`,
        text: '«Some» — для утверждений, предложений и просьб: «I’d like some water». «Any» — для отрицаний и большинства вопросов: «I don’t have any money», «Do you have any rooms?». Английский не удваивает отрицание, как русский («у меня нет никаких денег»): после «don’t» ставится «any», а не «no».',
      }),
    },
  },
  {
    id: 'article',
    find: article,
    say: {
      en: (w) => ({
        title: `«${w}»: a, an or the`,
        text: '«A» or «an» means “one”, any one: «a table»; use «an» before a vowel sound («an apple», «an hour»). «The» is the one you both know: «the table by the window». A singular noun you can count usually has one of them, or a word like «my» or «this».',
      }),
      bg: (w) => ({
        title: `«${w}»: a, an или the`,
        text: '«A» или «an» значи „един, някакъв“: «a table»; «an» е пред гласен звук («an apple», «an hour»). «The» е онзи, който и двамата знаете: «the table». В „масата“ членът е накрая, а «the» е пред думата. Броимо съществително в единствено число обикновено има a, an, the или «my», «this».',
      }),
      ru: (w) => ({
        title: `«${w}»: a, an или the`,
        text: '«A» или «an» значит «один, любой»: «a table»; «an» ставится перед гласным звуком («an apple», «an hour»). «The» — тот, что известен обоим: «the table». В русском артиклей нет, а в английском перед исчисляемым существительным в единственном числе обычно нужен a, an, the или «my», «this».',
      }),
    },
  },
  {
    id: 'word-order',
    find: () => '',
    say: {
      en: () => ({
        title: 'Order does the work',
        text: 'English words hardly change, so their order shows who does what: «Anna sees Tom» is not «Tom sees Anna». In a statement the subject comes first, before the verb, and is always said, even when it means nothing: «It’s cold».',
      }),
      bg: () => ({
        title: 'Редът на думите',
        text: 'Английските думи почти не се променят, затова редът им показва кой какво прави: «Anna sees Tom» не е «Tom sees Anna». В изявителното изречение подлогът е пръв, пред глагола, и винаги се казва, дори когато нищо не значи: «It’s cold» („Студено е“).',
      }),
      ru: () => ({
        title: 'Порядок слов',
        text: 'В английском слова почти не меняются, поэтому порядок слов показывает, кто что делает: «Anna sees Tom» — не то же, что «Tom sees Anna». В утверждении подлежащее стоит первым, перед глаголом, и его нельзя пропускать, даже когда оно ничего не значит: «It’s cold» («Холодно»).',
      }),
    },
  },
]

// ---------------------------------------------------------------------------------------------
// Russian (ru-RU), for English and Bulgarian readers: every note in `en` and `bg` only, since a
// Russian speaker doesn't learn Russian. Written 2026-10-01; awaits native review (Q-23).
// ---------------------------------------------------------------------------------------------
// Finders that need more than one pattern. Each returns the words the rule is about, or null.
// ---------------------------------------------------------------------------------------------

/** «меня зовут Анна», «как вас зовут»; not «меня зовут в кино» (“they invite me”). */
const ZOVUT = /(?<![\p{L}])(?:как )?(?:меня|тебя|вас|его|её|ее|нас|их) зовут(?![\p{L}])/iu
const ZOVUT_INVITES =
  /^\s+(?:в|во|на|к|ко|с|со|за|по|домой|гулять|обедать|ужинать|пить|смотреть|играть|пойти)(?![\p{L}])/iu
const findZovut = (text: string) => {
  const m = ZOVUT.exec(text)
  if (!m) return null
  return ZOVUT_INVITES.test(text.slice(m.index + m[0].length)) ? null : m[0]
}

/** A negative word and «не» or «нет» together: «я ничего не знаю», «никого нет», «не знаю ничего». */
const NEGATIVES =
  'никто|никого|никому|никем|ничего|ничто|ничему|ничем|никогда|нигде|никуда|ниоткуда'
const NEGATIVE_FIRST = new RegExp(
  String.raw`(?<![\p{L}])(?:${NEGATIVES})(?:\s+\p{L}+){0,2}\s+(?:не|нет)(?![\p{L}])`,
  'iu',
)
const NEGATIVE_LAST = new RegExp(
  String.raw`(?<![\p{L}])(?:не|нет)(?:\s+\p{L}+){0,3}\s+(?:${NEGATIVES})(?![\p{L}])`,
  'iu',
)
const findDoubleNegative = (text: string) =>
  NEGATIVE_FIRST.exec(text)?.[0] ?? NEGATIVE_LAST.exec(text)?.[0] ?? null

/** «нет» followed by the thing that is missing: not a preposition, a pronoun or an adverb. */
const AFTER_NET_NOT_A_THING =
  'в|во|на|к|ко|с|со|у|из|за|по|для|от|до|о|об|при|про|без|над|под|перед|через|между|около|после|' +
  'я|ты|вы|мы|он|она|они|оно|не|нет|да|спасибо|это|так|здесь|там|тут|ещё|еще|больше|уже|сейчас|' +
  'пока|совсем|сегодня|вообще|вовсе|точно|конечно|и|а|но|или|же|ли|бы|ни|то'
const findNetGenitive = word(String.raw`нет (?!(?:${AFTER_NET_NOT_A_THING})(?![\p{L}]))\p{L}+`)

/** Commands whose form is never also a present or future form (so «скажите» but not «говорите»). */
const COMMANDS = [
  'скажи',
  'дай',
  'покажи',
  'подскажи',
  'извини',
  'прости',
  'подожди',
  'принеси',
  'помоги',
  'повтори',
  'возьми',
  'открой',
  'закрой',
  'запиши',
  'напиши',
  'слушай',
  'подумай',
  'сделай',
  'налей',
  'проверь',
  'зайди',
  'подай',
  'приезжай',
  'будь',
]
  .map((c) => `${c}(?:те)?`)
  .join('|')
// «давай мне билет» is “give me a ticket”, not “let’s”.
const LETS = String.raw`давай(?:те)?(?! (?:мне|нам|ему|ей|им|сюда)(?![\p{L}]))`
const findCommand = word(`${COMMANDS}|идите|иди|${LETS}`)

/** After 2, 3, 4: not a conjunction or a preposition, so the next word is the noun or its adjective. */
const AFTER_NUMBER_NOT_A_NOUN = 'или|и|а|но|да|в|во|на|с|со|из|до|от|по|к|за|для|не|же|ли|бы'
const findFewNouns = word(
  String.raw`(?:два|две|три|четыре) (?!(?:${AFTER_NUMBER_NOT_A_NOUN})(?![\p{L}]))\p{L}+`,
)

/** «я студент», «мы дома», «я из Болгарии», «это мой друг»: a whole clause with no verb at all. */
const BE_PRONOUN = 'я|ты|он|она|мы|вы|они'
const BE_PREDICATES = [
  'студент',
  'студентка',
  'врач',
  'учитель',
  'учительница',
  'турист',
  'туристка',
  'англичанин',
  'англичанка',
  'болгарин',
  'болгарка',
  'американец',
  'американка',
  'испанец',
  'испанка',
  'друг',
  'подруга',
  'дома',
  'готов',
  'готова',
  'готовы',
  'рад',
  'рада',
  'рады',
  'голоден',
  'голодна',
  'голодны',
  'женат',
  'замужем',
  'свободен',
  'свободна',
  'свободны',
  'занят',
  'занята',
  'заняты',
  'согласен',
  'согласна',
  'согласны',
  'прав',
  'права',
  'правы',
  'устал',
  'устала',
  'устали',
  'болен',
  'больна',
  'больны',
].join('|')
const BE_POSSESSIVE =
  'мой|моя|моё|мое|мои|твой|твоя|твоё|твое|твои|наш|наша|наше|наши|ваш|ваша|ваше|ваши'
// The clause has to end after the match, so «я здесь работаю» (a verb follows) is left alone.
const CLAUSE_END = String.raw`(?=\s*(?:[.,!?…;:]|$))`
const NO_BE = new RegExp(
  String.raw`(?<![\p{L}])(?:(?:${BE_PRONOUN}) (?:из [\p{L}-]+(?: [\p{L}-]+)?|(?:${BE_PREDICATES}))` +
    String.raw`|это (?:${BE_POSSESSIVE}) [\p{L}-]+)${CLAUSE_END}`,
  'iu',
)
const findNoBe = (text: string) => NO_BE.exec(text)?.[0] ?? null

/**
 * «в» or «на» and a word ending in -е: a place in the prepositional case. Skips neuter adjectives
 * and pronouns (в прошлое, на ваше, в это) and words that are not nouns of place.
 */
const PLACE_E_SKIP =
  /(?:ое|ее|ие|ье)$|^(?:все|всё|тоже|ещё|еще|это|то|одно|другое|свое|своё|мое|моё|твое|твоё|мне|тебе|себе)$/iu
const findPlaceE = (text: string) => {
  for (const m of text.matchAll(/(?<![\p{L}])(?:в|во|на) ([\p{L}-]{2,}е)(?![\p{L}])/giu)) {
    if (!PLACE_E_SKIP.test(m[1] ?? '')) return m[0]
  }
  return null
}

// ---------------------------------------------------------------------------------------------
// Grammar rules
// ---------------------------------------------------------------------------------------------

export const RUSSIAN_GRAMMAR: GrammarRule[] = [
  {
    id: 'zovut',
    find: findZovut,
    say: {
      en: (w) => ({
        title: `«${w}»: saying your name`,
        text: 'Russian says “they call me”, not “I am called”: «меня зовут Анна». The person takes a changed form («я» → «меня», «ты» → «тебя», «вы» → «вас», «он» → «его», «она» → «её»), and the name stays as it is.',
      }),
      bg: (w) => ({
        title: `«${w}»: казвам се`,
        text: 'Руският казва „наричат ме“, а не „казвам се“: «меня зовут Анна». Лицето е в друга форма («я» → «меня», «ты» → «тебя», «вы» → «вас», «он» → «его», «она» → «её»), а името не се променя.',
      }),
    },
  },
  {
    id: 'skolko-stoit',
    find: word('сколько (?:это |он |она |оно |они |всё |все )?(?:стоит|стоят)'),
    say: {
      en: (w) => ({
        title: `«${w}»: asking the price`,
        text: '«Сколько стоит…?» asks the price of one thing and «сколько стоят…?» of several: the verb agrees with what is bought, as in «сколько стоит билет?» and «сколько стоят билеты?».',
      }),
      bg: (w) => ({
        title: `«${w}»: цената`,
        text: '«Сколько стоит…?» е „колко струва…?“ за едно нещо, а «сколько стоят…?» е „колко струват…?“ за няколко: глаголът се съгласува със стоката, както в български — «сколько стоит билет?», «сколько стоят билеты?».',
      }),
    },
  },
  {
    id: 'double-negative',
    find: findDoubleNegative,
    say: {
      en: (w) => ({
        title: `«${w}»: two negatives`,
        text: 'Russian keeps «не» (or «нет») together with a negative word: «я ничего не знаю» is “I know nothing”, literally “I nothing don’t know”. Leaving «не» out is a mistake.',
      }),
      bg: (w) => ({
        title: `«${w}»: двойно отрицание`,
        text: 'Руският пази «не» (или «нет») заедно с отрицателната дума, точно както българският: «я ничего не знаю» е „нищо не знам“. Без «не» изречението е грешно.',
      }),
    },
  },
  {
    id: 'net-genitive',
    find: findNetGenitive,
    say: {
      en: (w) => ({
        title: `«${w}»: what is missing`,
        text: 'After «нет» (“there isn’t”) the thing that is missing takes a changed ending, the genitive: «нет сахара», «нет времени», «у меня нет денег». Most nouns change; «кофе» and «такси» don’t.',
      }),
      bg: (w) => ({
        title: `«${w}»: каквото липсва`,
        text: 'След «нет» („няма“) липсващото нещо получава променено окончание, родителен падеж: «нет сахара», «нет времени», «у меня нет денег». Повечето съществителни се променят, «кофе» и «такси» — не. В български „няма захар“ остава без промяна.',
      }),
    },
  },
  {
    id: 'where',
    find: word('где|куда|откуда'),
    say: {
      en: (w) => ({
        title: `«${w}»: three kinds of “where”`,
        text: 'Russian has three “where” words: «где» asks where something is, «куда» where it’s going, «откуда» where it’s from: «Где метро?», «Куда вы идёте?», «Откуда вы?».',
      }),
      bg: (w) => ({
        title: `«${w}»: къде, накъде, откъде`,
        text: 'Руският разграничава местоположение и посока: «где» е „къде е“, «куда» е „накъде“ („къде отиваш“), «откуда» е „откъде“. Глагол за „е“ не се добавя: «Где метро?» е „Къде е метрото?“.',
      }),
    },
  },
  {
    id: 'u-menya',
    find: word('у (?:меня|тебя|него|неё|нее|нас|вас|них)'),
    say: {
      en: (w) => ({
        title: `«${w}»: having`,
        text: 'Russian has no everyday “I have”. It says “at me” and “there is”: «у меня есть…», «у вас есть…?». «Есть» can be left out when the thing is described: «у меня новая машина».',
      }),
      bg: (w) => ({
        title: `«${w}»: имам`,
        text: 'Руският няма всекидневно „имам“. Казва „при мен“ и „има“: «у меня есть…» е „имам…“, «у вас есть…?» е „имате ли…?“. «Есть» може да се пропусне, когато нещото се описва: «у меня новая машина».',
      }),
    },
  },
  {
    id: 'khochu',
    find: word('хочу|хочешь|хочет|хотим|хотите|хотят|хотел бы|хотела бы|хотели бы'),
    say: {
      en: (w) => ({
        title: `«${w}»: wanting`,
        text: '«Хотеть», “to want”: «хочу», «хочешь», «хочет», «хотим», «хотите», «хотят». It is followed by a noun or a verb in its dictionary form: «хочу кофе», «хочу пить». «Хотел бы», «хотела бы» (said by a man, by a woman) is the polite “I would like”.',
      }),
      bg: (w) => ({
        title: `«${w}»: искам`,
        text: 'Глаголът «хотеть» е „искам“: «хочу», «хочешь», «хочет», «хотим», «хотите», «хотят». След него идва съществително или глагол в инфинитив, без „да“: «хочу пить» е „искам да пия“. «Хотел бы» и «хотела бы» (казва ги мъж или жена) е учтивото „бих искал(а)“.',
      }),
    },
  },
  {
    id: 'nado-mozhno',
    find: word(
      String.raw`(?:(?:мне|тебе|вам|нам|ему|ей|им) )?(?:надо|нужно|нужен|нужна|нужны|можно|нельзя)`,
    ),
    say: {
      en: (w) => ({
        title: `«${w}»: needing, being allowed`,
        text: '«Надо», «нужно» (“must, need”), «можно» (“may”) and «нельзя» (“mustn’t”) never change. The person takes a changed form («я» → «мне»), and a verb after them stays in its dictionary form: «мне надо идти». «Нужен», «нужна», «нужны» agree with the thing needed: «мне нужен билет».',
      }),
      bg: (w) => ({
        title: `«${w}»: трябва, може`,
        text: '«Надо» и «нужно» са „трябва“, «можно» — „може“, «нельзя» — „не бива“; не се променят. Лицето е в друга форма («я» → «мне»), а глаголът след тях е в инфинитив, без „да“: «мне надо идти» е „трябва да вървя“. «Нужен», «нужна», «нужны» се съгласуват с нужното: «мне нужен билет».',
      }),
    },
  },
  {
    id: 'commands',
    find: findCommand,
    say: {
      en: (w) => ({
        title: `«${w}»: commands`,
        text: 'A command to a friend is the short form («скажи», «покажи»); to someone you call «вы», or to several people, it ends in -те: «скажите», «покажите». «Давай», or «давайте» to «вы», before a verb means “let’s”: «давайте пойдём».',
      }),
      bg: (w) => ({
        title: `«${w}»: повелително наклонение`,
        text: 'Към приятел повелителната форма е кратка («скажи», «покажи»); към „вие“ или към повече хора се добавя -те: «скажите», «покажите» — както „кажи“ и „кажете“. «Давай», а към „вие“ «давайте», пред глагол значи „хайде да…“: «давайте пойдём» е „хайде да отидем“.',
      }),
    },
  },
  {
    id: 'few-nouns',
    find: findFewNouns,
    say: {
      en: (w) => ({
        title: `«${w}»: after two, three, four`,
        text: 'After «два», «три» and «четыре» the noun takes its genitive singular form: «два билета», «три часа». «Два» becomes «две» before a feminine noun: «две минуты». From five to twenty it is the genitive plural: «пять билетов».',
      }),
      bg: (w) => ({
        title: `«${w}»: след два, три, четири`,
        text: 'След «два», «три» и «четыре» съществителното е в родителен падеж, единствено число: «два билета», «три часа». «Два» става «две» пред съществително от женски род: «две минуты». От пет до двадесет е родителен падеж, множествено число: «пять билетов».',
      }),
    },
  },
  {
    id: 'vy',
    find: word('вы|вас|вам|вами'),
    say: {
      en: (w) => ({
        title: `«${w}»: the polite “you”`,
        text: '«Вы» is “you” for several people and the polite “you” for one, and its verb is always plural: «вы говорите». To a friend, a child or family it is «ты». The other forms are «вас», «вам», «вами».',
      }),
      bg: (w) => ({
        title: `«${w}»: учтивото „вие“`,
        text: '«Вы» е „вие“ за повече хора и учтивото „вие“ за един човек, като в български, и глаголът е винаги в множествено число: «вы говорите». На приятел, дете или близък се казва «ты» („ти“). Другите форми са «вас», «вам», «вами».',
      }),
    },
  },
  {
    id: 'no-be',
    find: findNoBe,
    say: {
      en: (w) => ({
        title: `«${w}»: no “am, is, are”`,
        text: 'In the present Russian leaves out “am, is, are”: «я студент» is “I’m a student”, «мы дома» “we’re at home”, «я из Болгарии» “I’m from Bulgaria”. There is nothing to put between the two parts.',
      }),
      bg: (w) => ({
        title: `«${w}»: без „съм, си, е“`,
        text: 'За разлика от български, руският пропуска „съм, си, е“ в сегашно време: «я студент» е „аз съм студент“, «мы дома» — „ние сме вкъщи“, «я из Болгарии» — „аз съм от България“. Между двете части няма нищо.',
      }),
    },
  },
  {
    id: 'v-na',
    find: findPlaceE,
    say: {
      en: (w) => ({
        title: `«${w}»: saying where something is`,
        text: 'After «в» and «на» the noun’s ending shows the question. Where? takes the prepositional form, usually -е: «в школе», «на улице», «в Москве». Where to? takes the accusative: «иду в школу».',
      }),
      bg: (w) => ({
        title: `«${w}»: къде е нещо`,
        text: 'След «в» и «на» окончанието показва въпроса. „Къде?“ е предложен падеж, обикновено на -е: «в школе», «на улице», «в Москве». „Накъде?“ е винителен: «иду в школу». В български формата е една и съща: „в училище“.',
      }),
    },
  },
  {
    id: 'cases',
    find: () => '',
    say: {
      en: () => ({
        title: 'Endings change with the role',
        text: 'Russian nouns, adjectives and pronouns change their endings with their role in the sentence (six cases): «книга» is the book, «читаю книгу» the thing read, «нет книги» the thing missing. English does this almost only with pronouns (“I”, “me”).',
      }),
      bg: () => ({
        title: 'Окончания, които се менят',
        text: 'Руските съществителни, прилагателни и местоимения променят окончанията си според ролята в изречението (шест падежа): «книга» е книгата, «читаю книгу» — прочетеното, «нет книги» — липсващото. В български падежи има почти само при личните местоимения („аз — мен“).',
      }),
    },
  },
]
