// The grammar rule a phrase shows (plan 105), for a phrase the learner typed. Each rule is written
// out, in every language a learner of that course reads, and names the construction it's about;
// only which rule applies is worked out, from the phrase's own words. The first that matches wins;
// the last of each language matches any phrase, so every phrase has one.
import type { NoteLocale, NoteText } from './locale';

export interface GrammarRule {
  id: string;
  /** The words the rule is about, quoted back in its title, or null when it doesn't apply. */
  find: (text: string) => string | null;
  say: Partial<Record<NoteLocale, (w: string) => NoteText>>;
}

const word = (pattern: string) => {
  const re = new RegExp(`(?<![\\p{L}])(?:${pattern})(?![\\p{L}])`, 'iu');
  return (text: string) => text.match(re)?.[0] ?? null;
};

export const SPANISH_GRAMMAR: GrammarRule[] = [
  {
    id: 'gustar',
    find: word('(?:me|te|le|nos|os|les) gust(?:a|an|aría|ó|aba)'),
    say: {
      en: (w) => ({ title: `«${w}»: gustar works backwards`, text: 'The thing liked is the subject: «me gusta» is “it pleases me”, and «me gustan» when it’s more than one thing.' }),
      bg: (w) => ({ title: `«${w}»: като „харесва ми“`, text: 'Харесваното нещо е подлогът: «me gusta» е „харесва ми“, а «me gustan» — когато нещата са повече.' }),
      ru: (w) => ({ title: `«${w}»: как «нравится»`, text: 'То, что нравится, — подлежащее: «me gusta» — «мне нравится», а «me gustan» — когда вещей несколько.' }),
    },
  },
  {
    id: 'progressive',
    find: word('(?:estoy|estás|está|estamos|estáis|están) \\p{L}+(?:ando|iendo|yendo)'),
    say: {
      en: (w) => ({ title: `«${w}»: happening now`, text: 'Estar with a verb ending in -ando or -iendo is what’s going on right now, like English “-ing”.' }),
      bg: (w) => ({ title: `«${w}»: сега`, text: 'Estar с глагол на -ando или -iendo е нещо, което става точно сега.' }),
      ru: (w) => ({ title: `«${w}»: прямо сейчас`, text: 'Estar с глаголом на -ando или -iendo — то, что происходит прямо сейчас.' }),
    },
  },
  {
    id: 'perfect',
    find: word('(?:he|has|ha|hemos|habéis|han) (?:\\p{L}+ )?\\p{L}+(?:ado|ido|to|cho)'),
    say: {
      en: (w) => ({ title: `«${w}»: what has happened`, text: 'Haber with a past participle is what has happened, like English “I have…”. In Spain it’s the usual way to tell what happened today.' }),
      bg: (w) => ({ title: `«${w}»: вече се е случило`, text: 'Haber с минало причастие казва какво се е случило, като „съм направил“. В Испания така се разказва случилото се днес.' }),
      ru: (w) => ({ title: `«${w}»: уже случилось`, text: 'Haber с причастием прошедшего времени — то, что уже произошло. В Испании так обычно рассказывают о сегодняшнем.' }),
    },
  },
  {
    id: 'tener-que',
    find: word('(?:tengo|tienes|tiene|tenemos|tenéis|tienen) que'),
    say: {
      en: (w) => ({ title: `«${w}»: have to`, text: 'Tener que with a verb in its dictionary form means “have to”. Only tener changes: tengo que, tienes que, tiene que.' }),
      bg: (w) => ({ title: `«${w}»: трябва да`, text: 'Tener que с инфинитив значи „трябва да“. Променя се само tener: tengo que, tienes que, tiene que.' }),
      ru: (w) => ({ title: `«${w}»: должен`, text: 'Tener que с инфинитивом значит «должен, нужно». Меняется только tener: tengo que, tienes que, tiene que.' }),
    },
  },
  {
    id: 'hay-que',
    find: word('hay que'),
    say: {
      en: (w) => ({ title: `«${w}»: one has to`, text: 'Hay que with a verb in its dictionary form says what must be done, without saying by whom. It never changes.' }),
      bg: (w) => ({ title: `«${w}»: трябва`, text: 'Hay que с инфинитив казва какво трябва да се направи, без да казва от кого. Никога не се променя.' }),
      ru: (w) => ({ title: `«${w}»: нужно`, text: 'Hay que с инфинитивом говорит, что нужно сделать, не уточняя кому. Никогда не меняется.' }),
    },
  },
  {
    id: 'ir-a',
    find: word('(?:voy|vas|va|vamos|vais|van) a \\p{L}+(?:ar|er|ir)'),
    say: {
      en: (w) => ({ title: `«${w}»: going to`, text: 'Ir a with a verb in its dictionary form is the everyday future: «voy a…» is “I’m going to…”.' }),
      bg: (w) => ({ title: `«${w}»: ще`, text: 'Ir a с инфинитив е всекидневното бъдеще: «voy a…» е „ще…“, „тъкмо ще…“.' }),
      ru: (w) => ({ title: `«${w}»: собираюсь`, text: 'Ir a с инфинитивом — обычное будущее: «voy a…» — «я собираюсь…».' }),
    },
  },
  {
    id: 'querer',
    find: word('quisiera|quería|querría|quiero|quieres|quiere|queremos|quieren'),
    say: {
      en: (w) => ({ title: `«${w}»: asking for something`, text: '«Quiero» is “I want”. «Quería» and «quisiera» soften it to “I’d like”, the polite way to ask.' }),
      bg: (w) => ({ title: `«${w}»: молба`, text: '«Quiero» е „искам“. «Quería» и «quisiera» го смекчават до „бих искал“ — учтивият начин да помолите.' }),
      ru: (w) => ({ title: `«${w}»: просьба`, text: '«Quiero» — «я хочу». «Quería» и «quisiera» смягчают до «я бы хотел» — вежливый способ попросить.' }),
    },
  },
  {
    id: 'poder',
    find: word('puedo|puedes|puede|podemos|podéis|pueden|podría|podrías|podríamos|podrían'),
    say: {
      en: (w) => ({ title: `«${w}»: can`, text: 'Poder takes the next verb in its dictionary form. «¿Puede…?» asks politely, as “could you…?” does.' }),
      bg: (w) => ({ title: `«${w}»: мога`, text: 'След poder следващият глагол е в инфинитив. «¿Puede…?» е учтива молба, като „бихте ли…?“.' }),
      ru: (w) => ({ title: `«${w}»: мочь`, text: 'После poder следующий глагол стоит в инфинитиве. «¿Puede…?» — вежливая просьба, как «не могли бы вы…?».' }),
    },
  },
  {
    id: 'llamarse',
    find: word('(?:me|te|se|nos) llam(?:o|as|a|amos|an)'),
    say: {
      en: (w) => ({ title: `«${w}»: names`, text: 'Spanish says “I call myself”: «me llamo…», «¿cómo te llamas?». The small word before the verb changes with the person.' }),
      bg: (w) => ({ title: `«${w}»: казвам се`, text: 'Испанският казва „наричам се“: «me llamo…», «¿cómo te llamas?». Малката дума пред глагола се сменя с лицето.' }),
      ru: (w) => ({ title: `«${w}»: меня зовут`, text: 'По-испански «я зову себя»: «me llamo…», «¿cómo te llamas?». Маленькое слово перед глаголом меняется по лицам.' }),
    },
  },
  {
    id: 'hay',
    find: word('hay'),
    say: {
      en: (w) => ({ title: `«${w}»: there is, there are`, text: 'One word for both, whatever follows: «hay un…», «hay dos…». It’s a form of haber.' }),
      bg: (w) => ({ title: `«${w}»: има`, text: 'Една дума и за единствено, и за множествено число: «hay un…», «hay dos…». Това е форма на haber.' }),
      ru: (w) => ({ title: `«${w}»: есть, имеется`, text: 'Одно слово и для единственного, и для множественного числа: «hay un…», «hay dos…». Это форма глагола haber.' }),
    },
  },
  {
    id: 'question-word',
    find: word('qué|dónde|adónde|cuándo|cuánto|cuánta|cuántos|cuántas|cómo|quién|quiénes|cuál|cuáles'),
    say: {
      en: (w) => ({ title: `«${w}»: a question word`, text: 'Question words carry a written accent (qué, dónde, cuánto) and come first; the verb follows them.' }),
      bg: (w) => ({ title: `«${w}»: въпросителна дума`, text: 'Въпросителните думи се пишат с ударение (qué, dónde, cuánto) и стоят първи; глаголът е след тях.' }),
      ru: (w) => ({ title: `«${w}»: вопросительное слово`, text: 'Вопросительные слова пишутся с ударением (qué, dónde, cuánto) и стоят первыми; глагол — после них.' }),
    },
  },
  {
    id: 'estar',
    find: word('estoy|estás|está|estamos|estáis|están'),
    say: {
      en: (w) => ({ title: `«${w}»: estar`, text: 'Estar says where something is and how it is right now; ser says what it is. «' + w + '» is estar.' }),
      bg: (w) => ({ title: `«${w}»: estar`, text: 'Estar казва къде е нещо и какво е в момента; ser казва какво е. «' + w + '» е от estar.' }),
      ru: (w) => ({ title: `«${w}»: estar`, text: 'Estar говорит, где что-то находится и какое оно сейчас; ser — что это такое. «' + w + '» — от estar.' }),
    },
  },
  {
    id: 'usted',
    find: word('usted|ustedes'),
    say: {
      en: (w) => ({ title: `«${w}»: the polite you`, text: 'Usted takes the verb’s he-and-she form: «¿usted tiene…?». Ustedes is you, more than one.' }),
      bg: (w) => ({ title: `«${w}»: учтивото „вие“`, text: 'Usted се съчетава с глагола в трето лице: «¿usted tiene…?». Ustedes е „вие“ за повече хора.' }),
      ru: (w) => ({ title: `«${w}»: вежливое «вы»`, text: 'Usted требует глагола в третьем лице: «¿usted tiene…?». Ustedes — «вы» для нескольких человек.' }),
    },
  },
  {
    id: 'ser',
    find: word('soy|eres|es|somos|sois|son'),
    say: {
      en: (w) => ({ title: `«${w}»: ser`, text: 'Ser says what something is: who, what, where from. For where it is or how it is now, Spanish uses estar.' }),
      bg: (w) => ({ title: `«${w}»: ser`, text: 'Ser казва какво е нещо: кой, какво, откъде. За къде е и какво е сега испанският използва estar.' }),
      ru: (w) => ({ title: `«${w}»: ser`, text: 'Ser говорит, что это такое: кто, что, откуда. Для «где» и «какое сейчас» в испанском есть estar.' }),
    },
  },
  {
    id: 'para',
    find: word('para \\p{L}+(?:ar|er|ir)'),
    say: {
      en: (w) => ({ title: `«${w}»: in order to`, text: 'Para with a verb in its dictionary form says what for: «para pagar» is “to pay”.' }),
      bg: (w) => ({ title: `«${w}»: за да`, text: 'Para с инфинитив казва за какво: «para pagar» е „за да платя“.' }),
      ru: (w) => ({ title: `«${w}»: чтобы`, text: 'Para с инфинитивом говорит, зачем: «para pagar» — «чтобы заплатить».' }),
    },
  },
  {
    id: 'al-del',
    find: word('al|del'),
    say: {
      en: (w) => ({ title: `«${w}»: a + el, de + el`, text: 'A and de join the article el in one word, al and del. They don’t join la: «a la», «de la».' }),
      bg: (w) => ({ title: `«${w}»: a + el, de + el`, text: 'A и de се сливат с члена el в една дума: al, del. С la не се сливат: «a la», «de la».' }),
      ru: (w) => ({ title: `«${w}»: a + el, de + el`, text: 'A и de сливаются с артиклем el в одно слово: al, del. С la — нет: «a la», «de la».' }),
    },
  },
  {
    id: 'no',
    find: word('no \\p{L}+'),
    say: {
      en: (w) => ({ title: `«${w}»: no before the verb`, text: 'No goes straight before the verb, and before any me, te or lo in front of it: «no me gusta».' }),
      bg: (w) => ({ title: `«${w}»: no пред глагола`, text: 'No стои точно пред глагола и пред me, te или lo пред него: «no me gusta».' }),
      ru: (w) => ({ title: `«${w}»: no перед глаголом`, text: 'No ставится прямо перед глаголом и перед me, te или lo перед ним: «no me gusta».' }),
    },
  },
  {
    id: 'article',
    find: word('(?:el|la|los|las|un|una|unos|unas) \\p{L}+'),
    say: {
      en: (w) => ({ title: `«${w}»: el or la`, text: 'Every noun is masculine or feminine, and “the” and “a” agree: el, un for masculine, la, una for feminine. Most nouns in -o are masculine, most in -a feminine.' }),
      bg: (w) => ({ title: `«${w}»: el или la`, text: 'Всяко съществително е от мъжки или женски род и членът се съгласува: el, un за мъжки, la, una за женски. Повечето на -o са мъжки, на -a — женски.' }),
      ru: (w) => ({ title: `«${w}»: el или la`, text: 'Каждое существительное мужского или женского рода, и артикль согласуется: el, un — мужской, la, una — женский. Большинство слов на -o мужского рода, на -a — женского.' }),
    },
  },
  {
    id: 'question',
    find: (text) => (/[¿?]/.test(text) ? '¿…?' : null),
    say: {
      en: (w) => ({ title: `${w}: a question`, text: 'Spanish opens a question with ¿ as well as closing it. A yes-or-no question keeps the order of a statement: only the voice rises at the end.' }),
      bg: (w) => ({ title: `${w}: въпрос`, text: 'Испанският отваря въпроса с ¿, а не само го затваря. Въпросът с „да“ или „не“ пази реда на думите — само гласът се качва в края.' }),
      ru: (w) => ({ title: `${w}: вопрос`, text: 'В испанском вопрос открывается знаком ¿, а не только закрывается. В вопросе «да или нет» порядок слов как в утверждении — только голос повышается в конце.' }),
    },
  },
  {
    id: 'exclamation',
    find: (text) => (/[¡!]/.test(text) ? '¡…!' : null),
    say: {
      en: (w) => ({ title: `${w}: an exclamation`, text: 'Like a question, an exclamation opens with its mark upside down, so you know how to say it from the start.' }),
      bg: (w) => ({ title: `${w}: възклицание`, text: 'Като въпроса, възклицанието се отваря с обърнат знак, за да знаете още отначало как да го кажете.' }),
      ru: (w) => ({ title: `${w}: восклицание`, text: 'Как и вопрос, восклицание открывается перевёрнутым знаком, чтобы с самого начала было ясно, как его произносить.' }),
    },
  },
  {
    id: 'gender',
    find: () => '',
    say: {
      en: () => ({ title: 'Masculine or feminine', text: 'Every Spanish noun is masculine or feminine, and the words with it agree: el, un, bueno with a masculine noun; la, una, buena with a feminine one.' }),
      bg: () => ({ title: 'Мъжки или женски род', text: 'Всяко испанско съществително е от мъжки или женски род и думите около него се съгласуват: el, un, bueno с мъжки; la, una, buena с женски.' }),
      ru: () => ({ title: 'Мужской или женский род', text: 'Каждое испанское существительное мужского или женского рода, и слова рядом согласуются: el, un, bueno — с мужским; la, una, buena — с женским.' }),
    },
  },
];

export const BULGARIAN_GRAMMAR: GrammarRule[] = [
  {
    id: 'comparative',
    find: word('(?:по|най)-\\p{L}+'),
    say: {
      en: (w) => ({ title: `«${w}»: more, most`, text: 'По- before an adjective or adverb makes it “more”: по-голям is bigger, по-бавно more slowly. Най- makes it “most”.' }),
      ru: (w) => ({ title: `«${w}»: сравнение`, text: 'По- перед прилагательным или наречием даёт сравнительную степень: по-голям — больше, по-бавно — медленнее. Най- — превосходную.' }),
    },
  },
  {
    id: 'nyama-da',
    find: word('няма да'),
    say: {
      en: (w) => ({ title: `«${w}»: won’t`, text: 'The future in the negative is няма да and a verb: “won’t”. Not не ще.' }),
      ru: (w) => ({ title: `«${w}»: не буду`, text: 'Будущее с отрицанием — няма да и глагол: «не буду, не стану». Не «не ще».' }),
    },
  },
  {
    id: 'shte',
    find: word('ще'),
    say: {
      en: (w) => ({ title: `«${w}»: the future`, text: 'Ще before a verb in the present makes it future, and ще never changes: ще отида — I’ll go, ще отидем — we’ll go.' }),
      ru: (w) => ({ title: `«${w}»: будущее`, text: 'Ще перед глаголом в настоящем времени даёт будущее, и ще не меняется: ще отида — пойду, ще отидем — пойдём.' }),
    },
  },
  {
    id: 'mozhe-li',
    find: word('може ли'),
    say: {
      en: (w) => ({ title: `«${w}»: may I`, text: 'Literally “is it possible?”: the everyday polite request, with a noun or with да and a verb.' }),
      ru: (w) => ({ title: `«${w}»: можно?`, text: 'Буквально «можно ли?»: обычная вежливая просьба — с существительным или с да и глаголом.' }),
    },
  },
  {
    id: 'bih',
    find: word('бих'),
    say: {
      en: (w) => ({ title: `«${w}»: would`, text: 'Бих with a past form makes it polite: бих искал (бих искала) is “I would like”.' }),
      ru: (w) => ({ title: `«${w}»: бы`, text: 'Бих с формой прошедшего времени — вежливое «бы»: бих искал (бих искала) — «я бы хотел(а)».' }),
    },
  },
  {
    id: 'tryabva',
    find: word('трябва'),
    say: {
      en: (w) => ({ title: `«${w}»: must`, text: 'Трябва never changes: трябва да and a verb is “I must”, “you must”, “we must” alike.' }),
      ru: (w) => ({ title: `«${w}»: нужно`, text: 'Трябва не изменяется: трябва да и глагол — «мне нужно», «тебе нужно», «нам нужно».' }),
    },
  },
  {
    id: 'da',
    find: word('да \\p{L}+'),
    say: {
      en: (w) => ({ title: `«${w}»: да, not an infinitive`, text: 'Bulgarian has no infinitive: after искам, мога or трябва comes да and a verb with its own ending — искам да отида, “I want that I go”.' }),
      ru: (w) => ({ title: `«${w}»: да вместо инфинитива`, text: 'В болгарском нет инфинитива: после искам, мога, трябва идёт да и глагол в личной форме — искам да отида, «хочу, чтобы я пошёл».' }),
    },
  },
  {
    id: 'question-word',
    find: word('къде|откъде|докъде|кога|колко|какво|какъв|каква|какви|кой|коя|кое|кои|как|защо'),
    say: {
      en: (w) => ({ title: `«${w}»: a question word`, text: 'A question word comes first and needs no ли: къде е…? — where is…?' }),
      ru: (w) => ({ title: `«${w}»: вопросительное слово`, text: 'Вопросительное слово стоит первым, и ли не нужно: къде е…? — где…?' }),
    },
  },
  {
    id: 'li',
    find: word('\\p{L}+ ли'),
    say: {
      en: (w) => ({ title: `«${w}»: a yes-or-no question`, text: 'Ли makes the question and comes straight after the word it asks about, usually the verb: имате ли…? — do you have…?' }),
      ru: (w) => ({ title: `«${w}»: вопрос «да или нет»`, text: 'Частица ли делает вопрос и стоит сразу после слова, о котором спрашивают, обычно после глагола: имате ли…? — у вас есть…?' }),
    },
  },
  {
    id: 'article',
    find: word('\\p{L}{3,}(?:ът|ката|тата|цата|ото|ето)'),
    say: {
      en: (w) => ({ title: `«${w}»: “the” at the end`, text: 'Bulgarian puts “the” on the end of the noun: сметка, a bill, becomes сметката, the bill.' }),
      ru: (w) => ({ title: `«${w}»: артикль в конце`, text: 'В болгарском есть определённый артикль, и он присоединяется к концу слова: сметка — «счёт», сметката — «этот счёт».' }),
    },
  },
  {
    id: 'imam',
    find: word('имам|имаш|има|имаме|имате|имат'),
    say: {
      en: (w) => ({ title: `«${w}»: to have, there is`, text: 'Имам is “I have”, and the plain има also means “there is”: има ли…? — is there…?' }),
      ru: (w) => ({ title: `«${w}»: иметь`, text: 'По-болгарски «я имею»: имам — «у меня есть». Просто има значит и «есть, имеется»: има ли…? — есть ли…?' }),
    },
  },
  {
    id: 'nyama',
    find: word('нямам|нямаш|няма|нямаме|нямате|нямат'),
    say: {
      en: (w) => ({ title: `«${w}»: there isn’t`, text: 'Няма is “there isn’t”, нямам “I don’t have”: one word, without не.' }),
      ru: (w) => ({ title: `«${w}»: нет`, text: 'Няма — «нет, не имеется», нямам — «у меня нет»: одно слово, без не.' }),
    },
  },
  {
    id: 'se',
    find: word('\\p{L}+ се|се \\p{L}+'),
    say: {
      en: (w) => ({ title: `«${w}»: се with the verb`, text: 'Many verbs come with се, which stays next to the verb: казвам се — I’m called, виждаме се — we see each other.' }),
      ru: (w) => ({ title: `«${w}»: се с глаголом`, text: 'Многие глаголы употребляются с се, и оно стоит рядом с глаголом: казвам се — меня зовут, виждаме се — видимся.' }),
    },
  },
  {
    id: 'short-pronoun',
    find: word('\\p{L}+ (?:ме|ми|те|ти|го|му|ѝ|ни|ви|им|ги)'),
    say: {
      en: (w) => ({ title: `«${w}»: a short pronoun`, text: 'Short pronouns (ме, ми, те, го…) sit next to the verb and never start a sentence: «Боли ме» — it hurts (me).' }),
      ru: (w) => ({ title: `«${w}»: краткое местоимение`, text: 'Краткие местоимения (ме, ми, те, го…) стоят рядом с глаголом и никогда не начинают предложение: «Боли ме» — мне больно.' }),
    },
  },
  {
    id: 'ne',
    find: word('не \\p{L}+'),
    say: {
      en: (w) => ({ title: `«${w}»: не before the verb`, text: 'Не goes straight before the verb, and before a short pronoun in front of it: не ме боли.' }),
      ru: (w) => ({ title: `«${w}»: не перед глаголом`, text: 'Не ставится прямо перед глаголом и перед кратким местоимением перед ним: не ме боли.' }),
    },
  },
  {
    id: 'sam',
    find: word('съм|е|сме|сте|са'),
    say: {
      en: (w) => ({ title: `«${w}»: to be`, text: 'Съм, to be, has short forms that lean on the word before: аз съм, ти си, той е, ние сме, вие сте, те са. They never start a sentence.' }),
      ru: (w) => ({ title: `«${w}»: быть`, text: 'В отличие от русского, «быть» в настоящем не опускается: аз съм, ти си, той е, ние сме, вие сте, те са. Эти формы не начинают предложение.' }),
    },
  },
  {
    id: 'na',
    find: word('на \\p{L}+'),
    say: {
      en: (w) => ({ title: `«${w}»: на instead of cases`, text: 'Bulgarian nouns have no cases: на says both “of” and “to” — името на…, the name of…; дайте на мен, give (to) me.' }),
      ru: (w) => ({ title: `«${w}»: на вместо падежей`, text: 'В болгарском нет падежей: на передаёт и родительный, и дательный — името на… (имя кого-то), дайте на мен (дайте мне).' }),
    },
  },
  {
    id: 'no-cases',
    find: () => '',
    say: {
      en: () => ({ title: 'No cases', text: 'Bulgarian nouns don’t change for their role in the sentence: word order and prepositions such as на, за, в and с do that work.' }),
      ru: () => ({ title: 'Без падежей', text: 'Болгарские существительные не склоняются по падежам: их роль показывают порядок слов и предлоги на, за, в, с.' }),
    },
  },
];
