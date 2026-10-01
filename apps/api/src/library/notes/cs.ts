// Notes by spelling for Czech phrases (cs-CZ), for Bulgarian, Russian, English and Polish readers:
// the grammar rule and the sound to practise, chosen from the phrase's words and spelling alone
// (the same pattern as ENGLISH_GRAMMAR / RUSSIAN_SOUND_TIPS). Each rule speaks en, bg, ru and pl —
// never cs, the phrase's own language.
//
// Written by AI on 2026-10-02; every rule and tip awaits native-speaker review (Q-23).
import type { GrammarRule } from './grammar.js'
import { word } from './grammar.js'
import type { SoundTip } from './tips.js'

/** Note texts by language as [title, text]; «{w}» in a title is the quoted word found. */
type Texts = Record<string, [string, string]>

function say(texts: Texts): GrammarRule['say'] {
  return Object.fromEntries(
    Object.entries(texts).map(([locale, [title, text]]) => [
      locale,
      (w: string) => ({ title: title.replaceAll('{w}', `«${w}»`), text }),
    ]),
  )
}

export const CZECH_GRAMMAR: GrammarRule[] = [
  {
    id: 'vykani',
    find: word('pan|paní|pane|slečno|slečna|vy|vás|vám|váš|vaše'),
    say: say({
      en: [
        '{w}: polite address',
        'To be polite, Czechs say «vy» (the plural) to one person and «pan» / «paní» with a name or title: «Můžete mi pomoct?». Friends say «ty». The verb after «vy» is plural («jste»).',
      ],
      bg: [
        '{w}: учтиво обръщение',
        'За учтивост чехите казват «vy» (множествено) на един човек и «pan» / «paní» с име или титла: «Můžete mi pomoct?». На приятели казват «ty». Глаголът след «vy» е в множествено число («jste»).',
      ],
      ru: [
        '{w}: вежливое обращение',
        'Вежливо чехи говорят «vy» (множественное) одному человеку и «pan» / «paní» с именем или званием: «Můžete mi pomoct?». С друзьями — «ty». Глагол после «vy» стоит во множественном («jste»).',
      ],
      pl: [
        '{w}: zwrot grzecznościowy',
        'Grzecznie Czesi mówią «vy» (liczba mnoga) do jednej osoby oraz «pan» / «paní» z nazwiskiem lub tytułem: «Můžete mi pomoct?». Do przyjaciół: «ty». Czasownik po «vy» jest w liczbie mnogiej («jste»).',
      ],
    }),
  },
  {
    id: 'greetings',
    find: word(
      'dobrý den|dobrý večer|dobré ráno|dobrou noc|ahoj|čau|nazdar|na shledanou|nashledanou|na viděnou|zdravím',
    ),
    say: say({
      en: [
        '{w}: a set greeting',
        'Greetings are learned whole. «Dobrý den» is the polite hello all day, «ahoj» is hello and goodbye between friends, «na shledanou» is the polite goodbye and «dobrou noc» is “good night”.',
      ],
      bg: [
        '{w}: готов поздрав',
        'Поздравите се учат цели. «Dobrý den» е учтивото „добър ден“ през целия ден, «ahoj» е „здравей“ и „чао“ между приятели, «na shledanou» е учтивото сбогуване, «dobrou noc» — „лека нощ“.',
      ],
      ru: [
        '{w}: готовое приветствие',
        'Приветствия учат целиком. «Dobrý den» — вежливое «здравствуйте» в течение дня, «ahoj» — «привет» и «пока» между друзьями, «na shledanou» — вежливое «до свидания», «dobrou noc» — «спокойной ночи».',
      ],
      pl: [
        '{w}: gotowe powitanie',
        'Powitań uczymy się w całości. «Dobrý den» to grzeczne „dzień dobry” przez cały dzień, «ahoj» to „cześć” między przyjaciółmi, «na shledanou» to grzeczne „do widzenia”, «dobrou noc» to „dobranoc”.',
      ],
    }),
  },
  {
    id: 'prosim',
    find: word('prosím'),
    say: say({
      en: [
        '{w}: many meanings',
        '«Prosím» is “please”, “you’re welcome” and “here you are”. With a rising voice, «prosím?» means “pardon?”, and a waiter’s «prosím?» means “what can I get you?”.',
      ],
      bg: [
        '{w}: много значения',
        '«Prosím» е „моля“, „няма защо“ и „заповядайте“. С възходящ глас «prosím?» значи „как, моля?“, а при сервитьор — „какво желаете?“.',
      ],
      ru: [
        '{w}: много значений',
        '«Prosím» — «пожалуйста», «не за что» и «вот, возьмите». С поднимающейся интонацией «prosím?» значит «простите?», а у официанта — «что желаете?».',
      ],
      pl: [
        '{w}: wiele znaczeń',
        '«Prosím» to „proszę”, „nie ma za co” i „proszę bardzo”. Z rosnącą intonacją «prosím?» znaczy „słucham?”, a u kelnera — „co podać?”.',
      ],
    }),
  },
  {
    id: 'thanks',
    find: word('děkuji|děkuju|děkujeme|díky|dík'),
    say: say({
      en: [
        '{w}: thanking',
        '«Děkuji» is the careful “thank you”; «děkuju» and «díky» are what people say. The answer is «prosím» or «není zač» (“don’t mention it”).',
      ],
      bg: [
        '{w}: благодарност',
        '«Děkuji» е внимателното „благодаря“; «děkuju» и «díky» са това, което хората казват в говор. Отговорът е «prosím» или «není zač» („няма защо“).',
      ],
      ru: [
        '{w}: благодарность',
        '«Děkuji» — аккуратное «благодарю»; «děkuju» и «díky» говорят в обычной речи. Ответ — «prosím» или «není zač» («не за что»).',
      ],
      pl: [
        '{w}: podziękowanie',
        '«Děkuji» to staranne „dziękuję”; «děkuju» i «díky» mówi się na co dzień. Odpowiedź to «prosím» lub «není zač» („nie ma za co”).',
      ],
    }),
  },
  {
    id: 'sorry',
    find: word('promiňte|promiň|pardon|omlouvám se|odpusťte'),
    say: say({
      en: [
        '{w}: sorry, excuse me',
        '«Promiňte» (polite) and «promiň» (to a friend) mean both “sorry” and “excuse me”; «omlouvám se» is “I apologise”. Use «promiňte» to get someone’s attention.',
      ],
      bg: [
        '{w}: съжалявам, извинете',
        '«Promiňte» (учтиво) и «promiň» (на приятел) значат и „съжалявам“, и „извинете“; «omlouvám se» е „извинявам се“. С «promiňte» привличате вниманието.',
      ],
      ru: [
        '{w}: извините',
        '«Promiňte» (вежливо) и «promiň» (другу) значат и «простите», и «извините»; «omlouvám se» — «приношу извинения». С «promiňte» привлекают внимание.',
      ],
      pl: [
        '{w}: przepraszam',
        '«Promiňte» (grzecznie) i «promiň» (do przyjaciela) znaczą „przepraszam” i „proszę wybaczyć”; «omlouvám se» to „przepraszam”. Z «promiňte» zwracamy na siebie uwagę.',
      ],
    }),
  },
  {
    id: 'name',
    find: word('jmenuj\\p{L}+ se|jmenuju se|jak se jmenuj\\p{L}+'),
    say: say({
      en: [
        '{w}: saying a name',
        '«Jmenuju se…» (“I’m called…”) gives a name; ask «jak se jmenuješ?» or politely «jak se jmenujete?». The little word «se» takes second place in the clause, not always next to the verb.',
      ],
      bg: [
        '{w}: как се казвате',
        '«Jmenuju se…» („казвам се…“) назовава име; питаме «jak se jmenuješ?» или учтиво «jak se jmenujete?». Малката дума «se» заема второто място в изречението, не винаги до глагола.',
      ],
      ru: [
        '{w}: как зовут',
        '«Jmenuju se…» («меня зовут…») называет имя; спрашивают «jak se jmenuješ?» или вежливо «jak se jmenujete?». Маленькое слово «se» занимает второе место во фразе, не всегда рядом с глаголом.',
      ],
      pl: [
        '{w}: jak masz na imię',
        '«Jmenuju se…» („nazywam się…”) podaje imię; pytamy «jak se jmenuješ?» albo grzecznie «jak se jmenujete?». Małe słowo «se» zajmuje drugie miejsce w zdaniu, niekoniecznie obok czasownika.',
      ],
    }),
  },
  {
    id: 'how-are-you',
    find: word('jak se (?:máš|máte|daří)|co nového'),
    say: say({
      en: [
        '{w}: how are you',
        '«Jak se máš?» is “how are you?” to a friend and «jak se máte?» is the polite form. The usual answer is «dobře, děkuju» or «ujde to» (“so-so”).',
      ],
      bg: [
        '{w}: как сте',
        '«Jak se máš?» е „как си?“ към приятел, а «jak se máte?» е учтивата форма. Обичайният отговор е «dobře, děkuju» или «ujde to» („така-така“).',
      ],
      ru: [
        '{w}: как дела',
        '«Jak se máš?» — «как дела?» другу, а «jak se máte?» — вежливая форма. Обычный ответ — «dobře, děkuju» или «ujde to» («так себе»).',
      ],
      pl: [
        '{w}: jak się masz',
        '«Jak se máš?» to „jak się masz?” do przyjaciela, a «jak se máte?» to forma grzeczna. Zwykła odpowiedź: «dobře, děkuju» albo «ujde to» („jakoś leci”).',
      ],
    }),
  },
  {
    id: 'dam-si',
    find: word('dám si|dáme si|dáš si|dáte si|dal bych si|dala bych si|dali bychom si'),
    say: say({
      en: [
        '{w}: ordering',
        '«Dám si…» (“I’ll have…”) is how Czechs order: «dám si kávu». The thing wanted is in the accusative (káva → kávu). «Dal bych si» (a man) and «dala bych si» (a woman) are politer.',
      ],
      bg: [
        '{w}: поръчка',
        '«Dám si…» („ще взема…“) е начинът да поръчате: «dám si kávu». Желаното е във винителен (káva → kávu). «Dal bych si» (мъж) и «dala bych si» (жена) са по-учтиви.',
      ],
      ru: [
        '{w}: заказ',
        '«Dám si…» («возьму…») — так заказывают: «dám si kávu». Желаемое стоит в винительном (káva → kávu). «Dal bych si» (муж.) и «dala bych si» (жен.) вежливее.',
      ],
      pl: [
        '{w}: zamawianie',
        '«Dám si…» („wezmę…”) to zwykłe zamówienie: «dám si kávu». To, co chcemy, jest w bierniku (káva → kávu). «Dal bych si» (mężczyzna) i «dala bych si» (kobieta) są grzeczniejsze.',
      ],
    }),
  },
  {
    id: 'would-like',
    find: word('chtěl bych|chtěla bych|chtěli bychom|chci|chceš|chce|chceme|chcete|chtějí'),
    say: say({
      en: [
        '{w}: wanting, would like',
        '«Chtěl bych» (a man) and «chtěla bych» (a woman) are “I would like”, politer than «chci» (“I want”). The l-ending shows the speaker’s gender; «bych» is the conditional.',
      ],
      bg: [
        '{w}: бих искал',
        '«Chtěl bych» (мъж) и «chtěla bych» (жена) са „бих искал/искала“, по-учтиво от «chci» („искам“). Окончанието с l показва пола на говорещия; «bych» е условното.',
      ],
      ru: [
        '{w}: хотел бы',
        '«Chtěl bych» (мужчина) и «chtěla bych» (женщина) — «я хотел(а) бы», вежливее, чем «chci» («хочу»). Окончание с l показывает пол говорящего; «bych» — условное наклонение.',
      ],
      pl: [
        '{w}: chciałbym',
        '«Chtěl bych» (mężczyzna) i «chtěla bych» (kobieta) to „chciałbym/chciałabym”, grzeczniej niż «chci» („chcę”). Końcówka z l pokazuje płeć mówiącego; «bych» to tryb warunkowy.',
      ],
    }),
  },
  {
    id: 'negation',
    find: word(
      'nic|nikdo|nikdy|nikde|nikam|žádný|žádná|žádné|ne(?:mám|máš|má|máme|máte|mají|chci|chceš|chce|chceme|chcete|vím|víš|ví|rozumím|jsem|jsi|jsme|jste|jsou|můžu|může|umím|znám)|není',
    ),
    say: say({
      en: [
        '{w}: negation',
        'Czech negates the verb with the prefix ne-: «nemám», «nechci», «nevím», «není». Negatives pile up: «nikdy nic nechci» is “I never want anything”, and a single negative isn’t enough.',
      ],
      bg: [
        '{w}: отрицание',
        'Чешкият отрича глагола с представка ne-: «nemám», «nechci», «nevím», «není». Отрицанията се натрупват: «nikdy nic nechci» е „никога нищо не искам“; едно отрицание не стига.',
      ],
      ru: [
        '{w}: отрицание',
        'В чешском глагол отрицают приставкой ne-: «nemám», «nechci», «nevím», «není». Отрицания накапливаются: «nikdy nic nechci» — «никогда ничего не хочу»; одного отрицания мало.',
      ],
      pl: [
        '{w}: przeczenie',
        'Po czesku czasownik neguje się przedrostkiem ne-: «nemám», «nechci», «nevím», «není». Przeczenia się kumulują: «nikdy nic nechci» to „nigdy niczego nie chcę”; jedno nie wystarcza.',
      ],
    }),
  },
  {
    id: 'have',
    find: word('mám|máš|má|máme|máte|mají'),
    say: say({
      en: [
        '{w}: to have',
        '«Mít» (have): mám, máš, má, máme, máte, mají. The pronoun is dropped. What you have is in the accusative: «mám bratra». Czech also uses it for feelings: «mám hlad» is “I’m hungry”.',
      ],
      bg: [
        '{w}: да имам',
        '«Mít» („имам“): mám, máš, má, máme, máte, mají. Местоимението се пропуска. Притежаваното е във винителен: «mám bratra». Чешкият го ползва и за чувства: «mám hlad» е „гладен съм“.',
      ],
      ru: [
        '{w}: иметь',
        '«Mít» («иметь»): mám, máš, má, máme, máte, mají. Местоимение опускают. Имеющееся — в винительном: «mám bratra». Глагол используют и для состояний: «mám hlad» — «я голоден».',
      ],
      pl: [
        '{w}: mieć',
        '«Mít» („mieć”): mám, máš, má, máme, máte, mají. Zaimek się pomija. To, co mamy, stoi w bierniku: «mám bratra». Używa się go też do stanów: «mám hlad» to „jestem głodny”.',
      ],
    }),
  },
  {
    id: 'be',
    find: word('jsem|jsi|je|jsme|jste|jsou'),
    say: say({
      en: [
        '{w}: to be',
        '«Být» (be): jsem, jsi, je, jsme, jste, jsou. The pronoun is dropped, so «jsem» alone is “I am”. A noun after it stays in the nominative: «jsem student».',
      ],
      bg: [
        '{w}: да съм',
        '«Být» („съм“): jsem, jsi, je, jsme, jste, jsou. Местоимението се пропуска: «jsem» е „аз съм“. Съществително след него остава в именителен: «jsem student».',
      ],
      ru: [
        '{w}: быть',
        '«Být» («быть»): jsem, jsi, je, jsme, jste, jsou. Местоимение опускают: «jsem» — «я есть». Существительное после него остаётся в именительном: «jsem student».',
      ],
      pl: [
        '{w}: być',
        '«Být» („być”): jsem, jsi, je, jsme, jste, jsou. Zaimek się pomija: «jsem» to „jestem”. Rzeczownik po nim zostaje w mianowniku: «jsem student», inaczej niż po polsku.',
      ],
    }),
  },
  {
    id: 'past',
    find: word(
      '\\p{L}{2,}l[aoiy]? (?:jsem|jsi|jsme|jste)|(?:jsem|jsi|jsme|jste) \\p{L}{2,}l[aoiy]?|byl[aoiy]?',
    ),
    say: say({
      en: [
        '{w}: the past tense',
        'The past is the l-form of the verb + «jsem/jsi/jsme/jste»: «byl jsem», «byla jsem». In the third person only the l-form is left: «byl», «byla». The ending (-l, -la) shows gender.',
      ],
      bg: [
        '{w}: минало време',
        'Миналото е l-формата на глагола + «jsem/jsi/jsme/jste»: «byl jsem», «byla jsem». В трето лице остава само l-формата: «byl», «byla». Окончанието (-l, -la) показва рода.',
      ],
      ru: [
        '{w}: прошедшее время',
        'Прошедшее — l-форма глагола + «jsem/jsi/jsme/jste»: «byl jsem», «byla jsem». В третьем лице остаётся одна l-форма: «byl», «byla». Окончание (-l, -la) показывает род.',
      ],
      pl: [
        '{w}: czas przeszły',
        'Czas przeszły to forma na -l + «jsem/jsi/jsme/jste»: «byl jsem», «byla jsem». W 3. osobie zostaje sama forma na -l: «byl», «byla». Końcówka (-l, -la) pokazuje rodzaj.',
      ],
    }),
  },
  {
    id: 'future',
    find: word('budu|budeš|bude|budeme|budete|budou'),
    say: say({
      en: [
        '{w}: the future',
        '«Budu», «budeš»… with an infinitive make the future of an ongoing action: «budu pracovat». A perfective verb needs no helper: its present endings mean the future, «udělám» (“I’ll do”).',
      ],
      bg: [
        '{w}: бъдеще време',
        '«Budu», «budeš»… с инфинитив правят бъдеще на продължаващо действие: «budu pracovat». Свършеният вид не иска помощник: настоящите му окончания значат бъдеще, «udělám» („ще направя“).',
      ],
      ru: [
        '{w}: будущее время',
        '«Budu», «budeš»… с инфинитивом дают будущее длящегося действия: «budu pracovat». Совершенный вид обходится без помощника: формы настоящего значат будущее, «udělám» («сделаю»).',
      ],
      pl: [
        '{w}: czas przyszły',
        '«Budu», «budeš»… z bezokolicznikiem tworzą przyszłość czynności trwającej: «budu pracovat». Czasownik dokonany nie potrzebuje pomocnika: jego formy teraźniejsze znaczą przyszłość, «udělám» („zrobię”).',
      ],
    }),
  },
  {
    id: 'can',
    find: word('můžu|mohu|můžeš|může|můžeme|můžete|mohou|můžou'),
    say: say({
      en: [
        '{w}: can, may',
        '«Moct» (can): můžu, můžeš, může, můžeme, můžete, můžou, with a dictionary-form verb: «můžu se zeptat?» (“may I ask?”). The formal «mohu» is for writing.',
      ],
      bg: [
        '{w}: мога',
        '«Moct» („мога“): můžu, můžeš, může, můžeme, můžete, můžou, с инфинитив: «můžu se zeptat?» („мога ли да попитам?“). Официалното «mohu» е за писане.',
      ],
      ru: [
        '{w}: могу',
        '«Moct» («мочь»): můžu, můžeš, může, můžeme, můžete, můžou, с инфинитивом: «můžu se zeptat?» («можно спросить?»). Официальное «mohu» — для письма.',
      ],
      pl: [
        '{w}: móc',
        '«Moct» („móc”): můžu, můžeš, může, můžeme, můžete, můžou, z bezokolicznikiem: «můžu se zeptat?» („czy mogę zapytać?”). Oficjalne «mohu» jest do pisania.',
      ],
    }),
  },
  {
    id: 'must',
    find: word('musím|musíš|musí|musíme|musíte|musejí'),
    say: say({
      en: [
        '{w}: must',
        '«Musím» (I must) goes with a dictionary-form verb: «musím jít». Only the first verb changes with the person: «musíš jít», «musíme jít». «Nemusím» means “I don’t have to”, not “I must not”.',
      ],
      bg: [
        '{w}: трябва',
        '«Musím» („трябва да“) върви с инфинитив: «musím jít». Променя се само първият глагол: «musíš jít», «musíme jít». «Nemusím» значи „не е нужно“, не „забранено е“.',
      ],
      ru: [
        '{w}: должен',
        '«Musím» («должен») идёт с инфинитивом: «musím jít». Меняется только первый глагол: «musíš jít», «musíme jít». «Nemusím» значит «не обязан», а не «нельзя».',
      ],
      pl: [
        '{w}: muszę',
        '«Musím» („muszę”) idzie z bezokolicznikiem: «musím jít». Zmienia się tylko pierwszy czasownik: «musíš jít», «musíme jít». «Nemusím» znaczy „nie muszę”, a nie „nie wolno”.',
      ],
    }),
  },
  {
    id: 'numbers',
    find: word('kolik|dva|dvě|tři|čtyři|pět|šest|sedm|osm|devět|deset'),
    say: say({
      en: [
        '{w}: counting',
        'After 2, 3 and 4 the noun is nominative plural («dvě piva»); from 5 up it is genitive plural («pět piv»). «Kolik» (how many/much) takes the genitive: «kolik to stojí?».',
      ],
      bg: [
        '{w}: броене',
        'След 2, 3 и 4 съществителното е в именителен множествено («dvě piva»); от 5 нагоре — в родителен множествено («pět piv»). «Kolik» („колко“) иска родителен: «kolik to stojí?».',
      ],
      ru: [
        '{w}: счёт',
        'После 2, 3 и 4 существительное в именительном множественного («dvě piva»); с 5 — в родительном множественного («pět piv»). «Kolik» («сколько») требует родительного: «kolik to stojí?».',
      ],
      pl: [
        '{w}: liczenie',
        'Po 2, 3 i 4 rzeczownik jest w mianowniku liczby mnogiej («dvě piva»); od 5 w dopełniaczu liczby mnogiej («pět piv»). «Kolik» („ile”) wymaga dopełniacza: «kolik to stojí?».',
      ],
    }),
  },
  {
    id: 'question-words',
    find: word('kde|kam|kdy|jak|co|kdo|proč|který|která|které|jaký|jaká|jaké|odkud'),
    say: say({
      en: [
        '{w}: a question word',
        'A Czech question word comes first and the rest keeps its order: «kde je nádraží?». Czech separates “where” («kde») from “where to” («kam») and “where from” («odkud»).',
      ],
      bg: [
        '{w}: въпросителна дума',
        'Чешката въпросителна дума е първа, а останалото запазва реда си: «kde je nádraží?». Чешкият различава „къде“ («kde»), „накъде“ («kam») и „откъде“ («odkud»).',
      ],
      ru: [
        '{w}: вопросительное слово',
        'Чешское вопросительное слово стоит первым, остальное сохраняет порядок: «kde je nádraží?». Чешский различает «где» («kde»), «куда» («kam») и «откуда» («odkud»).',
      ],
      pl: [
        '{w}: słowo pytające',
        'Czeskie słowo pytające stoi na początku, reszta zachowuje szyk: «kde je nádraží?». Czeski rozróżnia „gdzie” («kde»), „dokąd” («kam») i „skąd” («odkud»).',
      ],
    }),
  },
  {
    id: 'with',
    find: word('(?:s|se) \\p{L}+(?:em|ou|mi|í)'),
    say: say({
      en: [
        '{w}: with',
        '«S» / «se» (with) takes the instrumental: «s mlékem» (with milk), «s cukrem», «se mnou» (with me). Masculine and neuter nouns end in -em, feminine in -ou, plural in -mi.',
      ],
      bg: [
        '{w}: с',
        '«S» / «se» („с“) иска творителен падеж: «s mlékem» (с мляко), «s cukrem», «se mnou» (с мен). Мъжки и среден род завършват на -em, женски на -ou, множествено на -mi.',
      ],
      ru: [
        '{w}: с',
        '«S» / «se» («с») требует творительного падежа: «s mlékem» (с молоком), «s cukrem», «se mnou» (со мной). Мужской и средний род — на -em, женский — на -ou, множественное — на -mi.',
      ],
      pl: [
        '{w}: z',
        '«S» / «se» („z”) wymaga narzędnika: «s mlékem» (z mlekiem), «s cukrem», «se mnou» (ze mną). Rzeczowniki męskie i nijakie mają -em, żeńskie -ou, liczba mnoga -mi.',
      ],
    }),
  },
  {
    id: 'where',
    find: word('(?:v|ve|na) \\p{L}+'),
    say: say({
      en: [
        '{w}: saying where',
        'After «v» and «na» a place that answers “where?” goes in the locative: «v Praze», «na nádraží». For “where to?” «na» takes the accusative («jdu na nádraží») and «do» the genitive («jedu do Prahy»).',
      ],
      bg: [
        '{w}: къде',
        'След «v» и «na» място, отговарящо на „къде?“, е в местен падеж: «v Praze», «na nádraží». За „накъде?“ «na» иска винителен («jdu na nádraží»), а «do» — родителен («jedu do Prahy»).',
      ],
      ru: [
        '{w}: где',
        'После «v» и «na» место на вопрос «где?» стоит в предложном падеже: «v Praze», «na nádraží». На «куда?» «na» требует винительного («jdu na nádraží»), а «do» — родительного («jedu do Prahy»).',
      ],
      pl: [
        '{w}: gdzie',
        'Po «v» i «na» miejsce odpowiadające na „gdzie?” stoi w miejscowniku: «v Praze», «na nádraží». Na „dokąd?” «na» wymaga biernika («jdu na nádraží»), a «do» dopełniacza («jedu do Prahy»).',
      ],
    }),
  },
  {
    id: 'genitive-prepositions',
    find: word('(?:do|z|ze|od|bez|u|kolem|vedle) \\p{L}+'),
    say: say({
      en: [
        '{w}: a preposition and the genitive',
        '«Do», «z», «od», «bez», «u» and «vedle» take the genitive: «do domu», «bez cukru», «u nás». «Do» is where to, «z» where from.',
      ],
      bg: [
        '{w}: предлог и родителен падеж',
        '«Do», «z», «od», «bez», «u» и «vedle» искат родителен падеж: «do domu», «bez cukru», «u nás». «Do» е накъде, «z» — откъде.',
      ],
      ru: [
        '{w}: предлог и родительный',
        '«Do», «z», «od», «bez», «u» и «vedle» требуют родительного падежа: «do domu», «bez cukru», «u nás». «Do» — куда, «z» — откуда.',
      ],
      pl: [
        '{w}: przyimek i dopełniacz',
        '«Do», «z», «od», «bez», «u» i «vedle» wymagają dopełniacza: «do domu», «bez cukru», «u nás». «Do» to dokąd, «z» skąd.',
      ],
    }),
  },
  {
    id: 'dative',
    find: word('(?:k|ke) \\p{L}+|líbí se mi|chutná mi|chutnají mi|mi|ti|vám|nám'),
    say: say({
      en: [
        '{w}: the dative',
        '«K» / «ke» and the short pronouns «mi, ti, mu, jí, nám, vám» take the dative. “I like it” is «líbí se mi to» (“it pleases to-me”): the thing liked is the subject.',
      ],
      bg: [
        '{w}: дателен падеж',
        '«K» / «ke» и кратките местоимения «mi, ti, mu, jí, nám, vám» искат дателен падеж. „Харесва ми“ е «líbí se mi to»: харесваното нещо е подлогът.',
      ],
      ru: [
        '{w}: дательный падеж',
        '«K» / «ke» и краткие местоимения «mi, ti, mu, jí, nám, vám» требуют дательного падежа. «Мне нравится» — «líbí se mi to»: то, что нравится, — подлежащее.',
      ],
      pl: [
        '{w}: celownik',
        '«K» / «ke» i krótkie zaimki «mi, ti, mu, jí, nám, vám» wymagają celownika. „Podoba mi się” to «líbí se mi to»: rzecz, która się podoba, jest podmiotem.',
      ],
    }),
  },
  {
    id: 'accusative',
    find: word(
      '(?:chci|mám|vidím|znám|miluju|piju|kupuju|hledám|potřebuju|potřebuji) (?:\\p{L}+ )?\\p{L}+u',
    ),
    say: say({
      en: [
        '{w}: the object',
        'The thing acted on takes the accusative, which turns feminine -a into -u: «káva» → «chci kávu», «voda» → «piju vodu». Masculine things without life and neuter nouns keep their dictionary form.',
      ],
      bg: [
        '{w}: допълнение',
        'Предметът на действието е във винителен падеж, който променя женското -a на -u: «káva» → «chci kávu», «voda» → «piju vodu». Неодушевените мъжки и средните съществителни не се променят.',
      ],
      ru: [
        '{w}: дополнение',
        'Объект действия стоит в винительном падеже, где женское -a становится -u: «káva» → «chci kávu», «voda» → «piju vodu». Неодушевлённые мужские и средние существительные не меняются.',
      ],
      pl: [
        '{w}: dopełnienie',
        'Przedmiot czynności stoi w bierniku, gdzie żeńskie -a zmienia się w -u: «káva» → «chci kávu», «voda» → «piju vodu». Rzeczy męskie nieżywotne i nijakie nie zmieniają formy.',
      ],
    }),
  },
  {
    id: 'aspect',
    find: word(
      'koupit|koupím|koupíš|udělat|udělám|zaplatit|zaplatím|objednat|objednám|napsat|napíšu|říct|řeknu|vypít|vypiju|sníst|sním|otevřít|otevřu|pomoct|pomůžu|vzít|vezmu|dát|dám',
    ),
    say: say({
      en: [
        '{w}: a finished action',
        'Most Czech verbs come in pairs: imperfective for an ongoing or repeated action («kupovat») and perfective for a finished one («koupit»). A perfective verb in the present endings means the future: «koupím» is “I’ll buy”.',
      ],
      bg: [
        '{w}: свършено действие',
        'Повечето чешки глаголи са по двойки: несвършен вид за продължаващо или повтарящо се действие («kupovat») и свършен за завършено («koupit»). Свършеният вид в сегашни окончания значи бъдеще: «koupím» е „ще купя“.',
      ],
      ru: [
        '{w}: завершённое действие',
        'Большинство чешских глаголов идут парами: несовершенный вид — действие длится или повторяется («kupovat»), совершенный — завершено («koupit»). Совершенный вид с окончаниями настоящего значит будущее: «koupím» — «куплю».',
      ],
      pl: [
        '{w}: czynność dokonana',
        'Większość czeskich czasowników tworzy pary: niedokonane dla czynności trwającej lub powtarzanej («kupovat») i dokonane dla zakończonej («koupit»). Dokonany z końcówkami teraźniejszymi znaczy przyszłość: «koupím» to „kupię”.',
      ],
    }),
  },
  {
    id: 'se-si',
    find: word('se|si'),
    say: say({
      en: [
        '{w}: the little words se and si',
        '«Se» and «si» are weak words with no stress that take second place in the clause: «dám si kávu», «jak se máš?». Some verbs always have one: «bát se», «líbit se».',
      ],
      bg: [
        '{w}: малките думи se и si',
        '«Se» и «si» са слаби безударни думи, които заемат второто място в изречението: «dám si kávu», «jak se máš?». Някои глаголи винаги имат една от тях: «bát se», «líbit se».',
      ],
      ru: [
        '{w}: малые слова se и si',
        '«Se» и «si» — слабые безударные слова, занимающие второе место во фразе: «dám si kávu», «jak se máš?». Некоторые глаголы всегда с одним из них: «bát se», «líbit se».',
      ],
      pl: [
        '{w}: małe słowa se i si',
        '«Se» i «si» to słabe, nieakcentowane słowa zajmujące drugie miejsce w zdaniu: «dám si kávu», «jak se máš?». Niektóre czasowniki zawsze je mają: «bát se», «líbit se».',
      ],
    }),
  },
  {
    id: 'cases',
    find: () => '',
    say: say({
      en: [
        'Endings change with the role',
        'Czech nouns, adjectives and pronouns change their endings with their role (seven cases): «káva», «chci kávu», «bez kávy», «s kávou». There are no articles, and word order is flexible because endings show who does what.',
      ],
      bg: [
        'Окончания според ролята',
        'Чешките съществителни, прилагателни и местоимения променят окончанията си според ролята (седем падежа): «káva», «chci kávu», «bez kávy», «s kávou». Няма членове, а редът на думите е гъвкав, защото окончанията показват кой какво прави.',
      ],
      ru: [
        'Окончания меняются по роли',
        'Чешские существительные, прилагательные и местоимения меняют окончания по роли в предложении (семь падежей): «káva», «chci kávu», «bez kávy», «s kávou». Артиклей нет, порядок слов гибкий: окончания показывают, кто что делает.',
      ],
      pl: [
        'Końcówki zależą od roli',
        'Czeskie rzeczowniki, przymiotniki i zaimki zmieniają końcówki zależnie od roli w zdaniu (siedem przypadków): «káva», «chci kávu», «bez kávy», «s kávou». Nie ma rodzajników, a szyk jest swobodny, bo końcówki pokazują, kto co robi.',
      ],
    }),
  },
]

// ---------------------------------------------------------------------------------------------
// Sounds: each tip finds a word whose letters certainly carry a sound learners find hard.
// ---------------------------------------------------------------------------------------------

export const CZECH_SOUND_TIPS: SoundTip[] = [
  {
    id: 'r-hacek',
    find: word('\\p{L}*ř\\p{L}*'),
    say: say({
      en: [
        '{w}: ř',
        '«Ř» is unique to Czech: say a rolled r and a «ž» (the s of “measure”) at once, so the tongue trills while the air hisses. After p, t, k, ch it goes voiceless, like «š».',
      ],
      bg: [
        '{w}: ř',
        '«Ř» има само чешкият: кажете трептящо „р“ и „ж“ едновременно — езикът трепти, а въздухът свисти. След p, t, k, ch оглушава, като «š».',
      ],
      ru: [
        '{w}: ř',
        '«Ř» есть только в чешском: произнесите раскатистое «р» и «ж» одновременно — язык дрожит, а воздух шипит. После p, t, k, ch оно глохнет, как «š».',
      ],
      pl: [
        '{w}: ř',
        '«Ř» jest tylko w czeskim: wymów jednocześnie drżące „r” i „ż”, język drży, a powietrze syczy. Po p, t, k, ch traci dźwięczność jak «š». To nie polskie «rz».',
      ],
    }),
  },
  {
    id: 'e-hacek',
    find: word('\\p{L}*ě\\p{L}*'),
    say: say({
      en: [
        '{w}: ě',
        'After b, p, v, f, m the letter «ě» is said «je»: «věc» is “vyets”. After d, t, n it softens them (dě → ďe, tě → ťe, ně → ňe); after other consonants it is just «e».',
      ],
      bg: [
        '{w}: ě',
        'След b, p, v, f, m буквата «ě» се чете «je»: «věc» е „вйец“. След d, t, n ги омекотява (dě → ďe, tě → ťe, ně → ňe); след други съгласни е просто «e».',
      ],
      ru: [
        '{w}: ě',
        'После b, p, v, f, m буква «ě» читается «je»: «věc» — «вьец». После d, t, n она смягчает их (dě → ďe, tě → ťe, ně → ňe); после остальных согласных — просто «e».',
      ],
      pl: [
        '{w}: ě',
        'Po b, p, v, f, m litera «ě» czyta się «je»: «věc» to „wjec”. Po d, t, n zmiękcza je (dě → ďe, tě → ťe, ně → ňe); po innych spółgłoskach to zwykłe «e».',
      ],
    }),
  },
  {
    id: 'soft-dtn',
    find: word('\\p{L}*(?:ď|ť|ň|di|ti|ni|dí|tí|ní)\\p{L}*'),
    say: say({
      en: [
        '{w}: soft ď, ť, ň',
        '«Ď», «ť», «ň» are soft: the middle of the tongue touches the palate (ň is the ny of “canyon”). Before i / í, plain «d», «t», «n» are soft too: «dítě», «ticho».',
      ],
      bg: [
        '{w}: меки ď, ť, ň',
        '«Ď», «ť», «ň» са меки: средата на езика допира небцето («ň» е „нь“). Пред i / í обикновените «d», «t», «n» също са меки: «dítě», «ticho».',
      ],
      ru: [
        '{w}: мягкие ď, ť, ň',
        '«Ď», «ť», «ň» мягкие: середина языка касается нёба («ň» — как «нь»). Перед i / í обычные «d», «t», «n» тоже мягкие: «dítě», «ticho».',
      ],
      pl: [
        '{w}: miękkie ď, ť, ň',
        '«Ď», «ť», «ň» są miękkie: środek języka dotyka podniebienia («ň» to polskie «ń»). Przed i / í zwykłe «d», «t», «n» też są miękkie: «dítě», «ticho».',
      ],
    }),
  },
  {
    id: 'hacek',
    find: word('\\p{L}*[čšž]\\p{L}*'),
    say: say({
      en: [
        '{w}: č, š, ž',
        '«Č» is “ch” as in “church”, «š» is “sh” and «ž» is the s of “measure”. They are lighter and farther forward than the Polish «cz, sz, ż», with no curled tongue.',
      ],
      bg: [
        '{w}: č, š, ž',
        '«Č» е „ч“, «š» е „ш“, «ž» е „ж“, като в български. Звучат по-леко и по-напред от полските «cz, sz, ż», без извит език.',
      ],
      ru: [
        '{w}: č, š, ž',
        '«Č» — «ч», «š» — «ш», «ž» — «ж», как в русском. Звучат легче и ближе к зубам, чем польские «cz, sz, ż», без загнутого языка.',
      ],
      pl: [
        '{w}: č, š, ž',
        '«Č» to „cz”, «š» to „sz”, «ž» to „ż”, lecz lżejsze i bardziej przesunięte do przodu niż polskie «cz, sz, ż» — bez zawiniętego języka.',
      ],
    }),
  },
  {
    id: 'ch',
    find: word('\\p{L}*ch\\p{L}*'),
    say: say({
      en: [
        '{w}: ch',
        '«Ch» is one letter in the Czech alphabet and one sound: a rough h from the back of the mouth, like “ch” in Scottish “loch”. It is not “ch” as in “church” (that is «č»).',
      ],
      bg: [
        '{w}: ch',
        '«Ch» е една буква в чешката азбука и един звук: същото „х“ като в български. Не е „ч“ — то е «č».',
      ],
      ru: [
        '{w}: ch',
        '«Ch» — одна буква чешского алфавита и один звук: обычное русское «х». Это не «ч» — оно пишется «č».',
      ],
      pl: [
        '{w}: ch',
        '«Ch» to jedna litera czeskiego alfabetu i jeden dźwięk: takie samo „ch” jak po polsku. To nie „cz” — to jest «č».',
      ],
    }),
  },
  {
    id: 'h-voiced',
    find: word('\\p{L}*h\\p{L}*'),
    say: say({
      en: [
        '{w}: h',
        'Czech «h» is voiced, a breathy “h” made with the vocal cords working, as in the soft Ukrainian г; it is not the voiceless «ch». Compare «hrad» (castle) and «chrám» (church).',
      ],
      bg: [
        '{w}: h',
        'Чешкото «h» е звучно, дъхово „г“ с работещи гласни струни, като в украинското г; не е беззвучното «ch». Сравнете «hrad» (замък) и «chrám» (храм).',
      ],
      ru: [
        '{w}: h',
        'Чешское «h» звонкое, придыхательное «г» с работающими связками, как в украинском г; это не глухое «ch». Сравните «hrad» (замок) и «chrám» (храм).',
      ],
      pl: [
        '{w}: h',
        'Czeskie «h» jest dźwięczne, to „h” z pracującymi wiązadłami głosowymi; nie jest to bezdźwięczne «ch». Porównaj «hrad» (zamek) i «chrám» (świątynia).',
      ],
    }),
  },
  {
    id: 'long-vowels',
    find: word('\\p{L}*[áéíóúůý]\\p{L}*'),
    say: say({
      en: [
        '{w}: long vowels',
        'The acute accent (á é í ó ú ý) and the ring on «ů» make a vowel long, about twice as long as a short one. Length changes the word: «sýr» (cheese) vs «sir». It isn’t stress.',
      ],
      bg: [
        '{w}: дълги гласни',
        'Острият знак (á é í ó ú ý) и кръгчето на «ů» правят гласната дълга, около два пъти по-дълга от кратката. Дължината сменя думата: «sýr» (сирене) и «sir». Не е ударение.',
      ],
      ru: [
        '{w}: долгие гласные',
        'Знак акцента (á é í ó ú ý) и кружок над «ů» делают гласную долгой, примерно вдвое длиннее краткой. Долгота меняет слово: «sýr» (сыр) и «sir». Это не ударение.',
      ],
      pl: [
        '{w}: długie samogłoski',
        'Kreska (á é í ó ú ý) i kółko nad «ů» wydłużają samogłoskę, mniej więcej dwukrotnie. Długość zmienia słowo: «sýr» (ser) i «sir». To nie jest akcent.',
      ],
    }),
  },
  {
    id: 'syllabic',
    find: word('\\p{L}*[^aeiouyáéěíóúůý\\P{L}][rl][^aeiouyáéěíóúůý\\P{L}]\\p{L}*'),
    say: say({
      en: [
        '{w}: r and l as vowels',
        'Between consonants Czech «r» and «l» can be the syllable itself, with no vowel: «krk» (neck), «vlk» (wolf), «prst» (finger). Hold the r/l a little longer and don’t add a vowel.',
      ],
      bg: [
        '{w}: r и l като гласни',
        'Между съгласни чешките «r» и «l» могат да бъдат самата сричка, без гласна: «krk» (врат), «vlk» (вълк), «prst» (пръст). Удължете малко r/l и не добавяйте гласна.',
      ],
      ru: [
        '{w}: r и l как гласные',
        'Между согласными чешские «r» и «l» могут быть самим слогом, без гласной: «krk» (шея), «vlk» (волк), «prst» (палец). Протяните r/l чуть дольше и не вставляйте гласную.',
      ],
      pl: [
        '{w}: r i l jako samogłoski',
        'Między spółgłoskami czeskie «r» i «l» mogą tworzyć sylabę bez samogłoski: «krk» (szyja), «vlk» (wilk), «prst» (palec). Przedłuż r/l i nie dodawaj samogłoski.',
      ],
    }),
  },
  {
    id: 'ou',
    find: word('\\p{L}*(?:ou|au)\\p{L}*'),
    say: say({
      en: [
        '{w}: ou and au',
        'The diphthongs «ou» (a short “oh”, as in “go”) and «au» are said in one syllable: «dobrou noc», «auto». Don’t split them into two vowels.',
      ],
      bg: [
        '{w}: ou и au',
        'Дифтонгите «ou» (кратко „оу“) и «au» се казват в една сричка: «dobrou noc», «auto». Не ги разделяйте на две гласни.',
      ],
      ru: [
        '{w}: ou и au',
        'Дифтонги «ou» (короткое «оу») и «au» произносятся в одном слоге: «dobrou noc», «auto». Не разделяйте их на две гласные.',
      ],
      pl: [
        '{w}: ou i au',
        'Dyftongi «ou» (krótkie „ou”) i «au» wymawia się w jednej sylabie: «dobrou noc», «auto». Nie rozdzielaj ich na dwie samogłoski.',
      ],
    }),
  },
  {
    id: 'y-i',
    find: word('\\p{L}*[yý]\\p{L}*'),
    say: say({
      en: [
        '{w}: y is just i',
        'In Czech «y» and «i» sound the same (the vowel of “bit”); the spelling only shows the word’s history. There is no separate pulled-back vowel, as in Polish or Russian.',
      ],
      bg: [
        '{w}: y е просто i',
        'В чешкия «y» и «i» звучат еднакво (като „и“); правописът само показва историята на думата. Няма отделна гласна с изтеглен назад език, както в полския или руския.',
      ],
      ru: [
        '{w}: y — то же, что i',
        'В чешском «y» и «i» звучат одинаково (как «и»); написание лишь показывает историю слова. Отдельного звука «ы», как в русском или польском, нет.',
      ],
      pl: [
        '{w}: y to samo co i',
        'W czeskim «y» i «i» brzmią tak samo (jak „i”); pisownia tylko pokazuje historię wyrazu. Nie ma tu osobnego dźwięku jak polskie «y».',
      ],
    }),
  },
  {
    id: 'glued-prepositions',
    find: word('(?:v|z|s|k) \\p{L}+'),
    say: say({
      en: [
        '{w}: one-letter words',
        'Czech «v», «z», «s», «k» have no vowel: they are said together with the next word, as one unit: «v práci» sounds like «fprátsi». Don’t pause after them.',
      ],
      bg: [
        '{w}: думи от една буква',
        'Чешките «v», «z», «s», «k» нямат гласна: казват се заедно със следващата дума като едно цяло: «v práci» звучи като «fprátsi». Не правете пауза след тях.',
      ],
      ru: [
        '{w}: слова из одной буквы',
        'Чешские «v», «z», «s», «k» без гласной: произносятся вместе со следующим словом как одно целое: «v práci» звучит как «fprátsi». Не делайте после них паузу.',
      ],
      pl: [
        '{w}: słowa z jednej litery',
        'Czeskie «v», «z», «s», «k» nie mają samogłoski: wymawia się je razem z następnym słowem jak jedną całość: «v práci» brzmi jak «fprátsi». Nie rób po nich pauzy.',
      ],
    }),
  },
  {
    id: 'final-devoicing',
    find: word('\\p{L}+(?:b|d|ď|g|v|z|ž|h)'),
    say: say({
      en: [
        '{w}: a word’s last consonant',
        'At the end of a word a voiced consonant goes voiceless: «chléb» is said «chlép», «hrad» «hrat», «muž» «muš». Before a voiced consonant in the next word the voice stays.',
      ],
      bg: [
        '{w}: последната съгласна',
        'В края на думата звучната съгласна оглушава, както в български: «chléb» се чете «chlép», «hrad» — «hrat», «muž» — «muš». Пред звучна съгласна в следващата дума звучността остава.',
      ],
      ru: [
        '{w}: последняя согласная',
        'В конце слова звонкая согласная оглушается, как в русском: «chléb» читается «chlép», «hrad» — «hrat», «muž» — «muš». Перед звонкой согласной следующего слова звонкость сохраняется.',
      ],
      pl: [
        '{w}: ostatnia spółgłoska',
        'Na końcu wyrazu spółgłoska dźwięczna ogłusza się, jak po polsku: «chléb» czytamy «chlép», «hrad» «hrat», «muž» «muš». Przed dźwięczną spółgłoską następnego słowa dźwięczność zostaje.',
      ],
    }),
  },
  {
    id: 'stress',
    find: () => '',
    say: say({
      en: [
        'Stress on the first syllable',
        'In Czech the stress is always on the first syllable of a word, whatever its length: «DObrý den», «DĚkuji». A little word before it joins it: «v PRAze». Don’t mistake a long vowel for stress.',
      ],
      bg: [
        'Ударение на първата сричка',
        'В чешкия ударението е винаги на първата сричка на думата, независимо от дължината ѝ: «DObrý den», «DĚkuji». Малка дума пред нея се слива с нея: «v PRAze». Не бъркайте дългата гласна с ударение.',
      ],
      ru: [
        'Ударение на первом слоге',
        'В чешском ударение всегда на первом слоге слова, какой бы длины оно ни было: «DObrý den», «DĚkuji». Короткое слово перед ним сливается с ним: «v PRAze». Не путайте долготу гласной с ударением.',
      ],
      pl: [
        'Akcent na pierwszej sylabie',
        'W czeskim akcent pada zawsze na pierwszą sylabę wyrazu, niezależnie od jego długości: «DObrý den», «DĚkuji». Mały wyraz przed nim łączy się z nim: «v PRAze». Nie myl długiej samogłoski z akcentem.',
      ],
    }),
  },
]
