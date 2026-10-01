// Notes by spelling for Polish phrases (pl-PL), for Bulgarian, Russian, English and Czech readers:
// the grammar rule and the sound to practise, chosen from the phrase's words and spelling alone
// (the same pattern as ENGLISH_GRAMMAR / RUSSIAN_SOUND_TIPS). Each rule speaks en, bg, ru and cs —
// never pl, the phrase's own language.
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

export const POLISH_GRAMMAR: GrammarRule[] = [
  {
    id: 'pan-pani',
    find: word('pan|pani|państwo|panie|panu|panią|panów|pań'),
    say: say({
      en: [
        '{w}: polite address',
        'To be polite, Poles say «pan» (to a man) and «pani» (to a woman) and put the verb in the third person: «Czy pan może…?» is “Can you…?”. With friends they say «ty» and use the second person.',
      ],
      bg: [
        '{w}: учтиво обръщение',
        'За учтивост поляците казват «pan» (на мъж) и «pani» (на жена) и слагат глагола в трето лице: «Czy pan może…?» е „Можете ли…?“. С приятели казват «ty» и говорят във второ лице.',
      ],
      ru: [
        '{w}: вежливое обращение',
        'Вежливо поляки говорят «pan» (мужчине) и «pani» (женщине) и ставят глагол в третье лицо: «Czy pan może…?» — «Вы можете…?». С друзьями — «ty» и второе лицо.',
      ],
      cs: [
        '{w}: zdvořilé oslovení',
        'Zdvořile Poláci říkají «pan» (muži) a «pani» (ženě) a sloveso dávají do 3. osoby: «Czy pan może…?» je „Můžete…?“. Přátelům říkají «ty» a mluví ve 2. osobě.',
      ],
    }),
  },
  {
    id: 'greetings',
    find: word('dzień dobry|dobry wieczór|dobranoc|cześć|do widzenia|do zobaczenia|na razie|witam'),
    say: say({
      en: [
        '{w}: a set greeting',
        'Greetings are learned whole. «Dzień dobry» works from morning to evening, «cześć» is for friends (hello and goodbye), and «do widzenia» is the polite goodbye.',
      ],
      bg: [
        '{w}: готов поздрав',
        'Поздравите се учат цели. «Dzień dobry» се казва от сутрин до вечер, «cześć» е за приятели (и „здравей“, и „чао“), а «do widzenia» е учтивото сбогуване.',
      ],
      ru: [
        '{w}: готовое приветствие',
        'Приветствия учат целиком. «Dzień dobry» говорят с утра до вечера, «cześć» — для друзей (и «привет», и «пока»), «do widzenia» — вежливое прощание.',
      ],
      cs: [
        '{w}: ustálený pozdrav',
        'Pozdravy se učí vcelku. «Dzień dobry» platí od rána do večera, «cześć» je pro přátele (ahoj i čau) a «do widzenia» je zdvořilé loučení.',
      ],
    }),
  },
  {
    id: 'thanks',
    find: word('dziękuję|dziękujemy|dzięki'),
    say: say({
      en: [
        '{w}: thanking',
        '«Dziękuję» is “thank you” and «dzięki» the casual “thanks”. The answer is «proszę» (“you’re welcome”) or «nie ma za co» (“don’t mention it”).',
      ],
      bg: [
        '{w}: благодарност',
        '«Dziękuję» е „благодаря“, а «dzięki» — по-свободното „мерси“. Отговорът е «proszę» („моля“) или «nie ma za co» („няма защо“).',
      ],
      ru: [
        '{w}: благодарность',
        '«Dziękuję» — «спасибо», а «dzięki» — небрежное «благодарю/спасибо». Ответ — «proszę» («пожалуйста») или «nie ma za co» («не за что»).',
      ],
      cs: [
        '{w}: poděkování',
        '«Dziękuję» je „děkuji“ a «dzięki» je neformální „díky“. Odpovídá se «proszę» („prosím“) nebo «nie ma za co» („není zač“).',
      ],
    }),
  },
  {
    id: 'sorry',
    find: word('przepraszam|przepraszamy|wybacz|wybaczy|proszę pana|proszę pani'),
    say: say({
      en: [
        '{w}: sorry, excuse me',
        '«Przepraszam» means both “sorry” and “excuse me” (to get attention or to pass). Politely: «przepraszam pana» or «przepraszam panią», with the person in the accusative.',
      ],
      bg: [
        '{w}: съжалявам, извинете',
        '«Przepraszam» значи и „съжалявам“, и „извинете“ (за да привлечете вниманието или да минете). Учтиво: «przepraszam pana» или «przepraszam panią», с човека във винителен падеж.',
      ],
      ru: [
        '{w}: извините',
        '«Przepraszam» значит и «простите», и «извините» (чтобы привлечь внимание или пройти). Вежливо: «przepraszam pana» или «przepraszam panią», человек — в винительном падеже.',
      ],
      cs: [
        '{w}: promiňte',
        '«Przepraszam» znamená „promiňte“ i „pardon“ (upoutat pozornost nebo projít). Zdvořile: «przepraszam pana» nebo «przepraszam panią», osoba je v akuzativu.',
      ],
    }),
  },
  {
    id: 'poproszę',
    find: word('poproszę|proszę'),
    say: say({
      en: [
        '{w}: asking politely',
        '«Poproszę» (“I’ll ask for”) is the usual way to order: «poproszę kawę». The thing wanted takes the accusative (kawa → kawę). «Proszę» alone is “please”, “here you are” and “you’re welcome”.',
      ],
      bg: [
        '{w}: учтива молба',
        '«Poproszę» („ще помоля за“) е обичайният начин да поръчате: «poproszę kawę». Желаното е във винителен падеж (kawa → kawę). «Proszę» само е „моля“, „заповядайте“ и „няма защо“.',
      ],
      ru: [
        '{w}: вежливая просьба',
        '«Poproszę» («попрошу») — обычный способ заказать: «poproszę kawę». Желаемое стоит в винительном падеже (kawa → kawę). «Proszę» само — «пожалуйста», «вот, возьмите» и «не за что».',
      ],
      cs: [
        '{w}: zdvořilá prosba',
        '«Poproszę» („poprosím o“) je běžný způsob objednávky: «poproszę kawę». Chtěná věc je v akuzativu (kawa → kawę). Samotné «proszę» je „prosím“, „tady máte“ i „není zač“.',
      ],
    }),
  },
  {
    id: 'name',
    find: word('nazyw\\p{L}+ się|ma(?:m|sz) na imię'),
    say: say({
      en: [
        '{w}: saying a name',
        '«Nazywam się…» (“I’m called…”) and «mam na imię…» (“my first name is…”) both give a name. «Się» is the reflexive “self” and stays near the verb: «jak się pan nazywa?».',
      ],
      bg: [
        '{w}: как се казвате',
        '«Nazywam się…» („казвам се…“) и «mam na imię…» („името ми е…“) назовават име. «Się» е възвратната частица и стои до глагола: «jak się pan nazywa?».',
      ],
      ru: [
        '{w}: как зовут',
        '«Nazywam się…» («меня зовут…») и «mam na imię…» («моё имя…») называют имя. «Się» — возвратная частица, она стоит рядом с глаголом: «jak się pan nazywa?».',
      ],
      cs: [
        '{w}: jak se jmenujete',
        '«Nazywam się…» („jmenuji se…“) i «mam na imię…» („mé jméno je…“) říkají jméno. «Się» je zvratné „se“ a stojí u slovesa: «jak się pan nazywa?».',
      ],
    }),
  },
  {
    id: 'how-are-you',
    find: word('jak się (?:masz|pan ma|pani ma|państwo mają|czujesz|miewasz)|co słychać'),
    say: say({
      en: [
        '{w}: how are you',
        '«Jak się masz?» is “how are you?” to a friend; to someone you call «pan/pani» say «jak się pan ma?». The usual answer is «dobrze, dziękuję» (“fine, thanks”).',
      ],
      bg: [
        '{w}: как сте',
        '«Jak się masz?» е „как си?“ към приятел; на «pan/pani» се казва «jak się pan ma?». Обичайният отговор е «dobrze, dziękuję» („добре, благодаря“).',
      ],
      ru: [
        '{w}: как дела',
        '«Jak się masz?» — «как дела?» другу; к «pan/pani» говорят «jak się pan ma?». Обычный ответ — «dobrze, dziękuję» («хорошо, спасибо»).',
      ],
      cs: [
        '{w}: jak se máte',
        '«Jak się masz?» je „jak se máš?“ příteli; k «pan/pani» se říká «jak się pan ma?». Obvyklá odpověď je «dobrze, dziękuję» („dobře, děkuju“).',
      ],
    }),
  },
  {
    id: 'would-like',
    find: word('chcia[łl](?:bym|abym|byś|abyś|byśmy|abyśmy)|chc(?:ę|esz|emy|ecie|ą)'),
    say: say({
      en: [
        '{w}: wanting, would like',
        '«Chciałbym» (a man) and «chciałabym» (a woman) are “I would like”, politer than «chcę» (“I want”). After it comes a noun in the accusative or a dictionary-form verb: «chciałbym kawę».',
      ],
      bg: [
        '{w}: бих искал',
        '«Chciałbym» (мъж) и «chciałabym» (жена) са „бих искал/искала“, по-учтиво от «chcę» („искам“). След него идва съществително във винителен или инфинитив: «chciałbym kawę».',
      ],
      ru: [
        '{w}: хотел бы',
        '«Chciałbym» (мужчина) и «chciałabym» (женщина) — «я хотел(а) бы», вежливее, чем «chcę» («хочу»). Дальше — существительное в винительном или инфинитив: «chciałbym kawę».',
      ],
      cs: [
        '{w}: chtěl bych',
        '«Chciałbym» (muž) a «chciałabym» (žena) je „chtěl/chtěla bych“, zdvořileji než «chcę» („chci“). Pak následuje podstatné jméno v akuzativu nebo infinitiv: «chciałbym kawę».',
      ],
    }),
  },
  {
    id: 'nie-ma',
    find: word('nie (?:ma|mam|masz|mamy|macie|mają)'),
    say: say({
      en: [
        '{w}: there is no…',
        'After «nie ma» (“there is no”) and «nie mam» (“I don’t have”) the thing goes in the genitive: «mam czas» but «nie mam czasu»; «jest kawa» but «nie ma kawy».',
      ],
      bg: [
        '{w}: няма…',
        'След «nie ma» („няма“) и «nie mam» („нямам“) нещото е в родителен падеж: «mam czas», но «nie mam czasu»; «jest kawa», но «nie ma kawy».',
      ],
      ru: [
        '{w}: нет…',
        'После «nie ma» («нет») и «nie mam» («у меня нет») вещь стоит в родительном падеже: «mam czas», но «nie mam czasu»; «jest kawa», но «nie ma kawy».',
      ],
      cs: [
        '{w}: není…',
        'Po «nie ma» („není“) a «nie mam» („nemám“) je věc v genitivu: «mam czas», ale «nie mam czasu»; «jest kawa», ale «nie ma kawy».',
      ],
    }),
  },
  {
    id: 'nie',
    find: word('nie|nic|nikt|nigdy|nigdzie'),
    say: say({
      en: [
        '{w}: negation',
        '«Nie» goes right before the verb: «nie rozumiem». Polish piles up negatives: «nikt nic nie wie» is “nobody knows anything”. The object of a negated verb often goes genitive: «nie piję kawy».',
      ],
      bg: [
        '{w}: отрицание',
        '«Nie» стои точно пред глагола: «nie rozumiem». Полският трупа отрицания: «nikt nic nie wie» е „никой нищо не знае“. Допълнението при отрицание често е в родителен: «nie piję kawy».',
      ],
      ru: [
        '{w}: отрицание',
        '«Nie» стоит прямо перед глаголом: «nie rozumiem». Отрицания накапливаются: «nikt nic nie wie» — «никто ничего не знает». Дополнение при отрицании часто в родительном: «nie piję kawy».',
      ],
      cs: [
        '{w}: záporu',
        '«Nie» stojí těsně před slovesem: «nie rozumiem». Záporů se hromadí: «nikt nic nie wie» je „nikdo nic neví“. Předmět záporného slovesa bývá v genitivu: «nie piję kawy».',
      ],
    }),
  },
  {
    id: 'have',
    find: word('mam|masz|mamy|macie|mają|ma'),
    say: say({
      en: [
        '{w}: to have',
        '«Mieć» (have): mam, masz, ma, mamy, macie, mają. The pronoun is dropped, so «mam» alone is “I have”. What you have is the object, in the accusative: «mam brata», «mam kawę».',
      ],
      bg: [
        '{w}: да имам',
        '«Mieć» („имам“): mam, masz, ma, mamy, macie, mają. Местоимението се пропуска: «mam» е „имам“. Притежаваното е допълнение във винителен: «mam brata», «mam kawę».',
      ],
      ru: [
        '{w}: иметь',
        '«Mieć» («иметь»): mam, masz, ma, mamy, macie, mają. Местоимение опускают: «mam» — «у меня есть». Имеющееся — дополнение в винительном: «mam brata», «mam kawę».',
      ],
      cs: [
        '{w}: mít',
        '«Mieć» („mít“): mam, masz, ma, mamy, macie, mają. Zájmeno se vynechává: «mam» je „mám“. Co máme, je předmět v akuzativu: «mam brata», «mam kawę».',
      ],
    }),
  },
  {
    id: 'be',
    find: word('jestem|jesteś|jest|jesteśmy|jesteście|są'),
    say: say({
      en: [
        '{w}: to be',
        '«Być» (be): jestem, jesteś, jest, jesteśmy, jesteście, są. The pronoun is usually dropped. A job or role after it goes in the instrumental: «jestem lekarzem», not «jestem lekarz».',
      ],
      bg: [
        '{w}: да съм',
        '«Być» („съм“): jestem, jesteś, jest, jesteśmy, jesteście, są. Местоимението обикновено се пропуска. Професия или роля след него е в творителен падеж: «jestem lekarzem», не «jestem lekarz».',
      ],
      ru: [
        '{w}: быть',
        '«Być» («быть»): jestem, jesteś, jest, jesteśmy, jesteście, są. Местоимение обычно опускают. Профессия или роль после него — в творительном: «jestem lekarzem», а не «jestem lekarz».',
      ],
      cs: [
        '{w}: být',
        '«Być» („být“): jestem, jesteś, jest, jesteśmy, jesteście, są. Zájmeno se obvykle vynechává. Povolání nebo role po něm stojí v instrumentálu: «jestem lekarzem», ne «jestem lekarz».',
      ],
    }),
  },
  {
    id: 'past',
    find: word('\\p{L}+(?:łem|łam|łeś|łaś|liśmy|łyśmy|liście|łyście)|był[aoy]?|byli'),
    say: say({
      en: [
        '{w}: the past tense',
        'The past is the stem + -ł- + an ending showing who and which gender: «robiłem» (I, a man), «robiłam» (I, a woman), «robiłeś/robiłaś» (you). So the verb itself shows the speaker’s gender.',
      ],
      bg: [
        '{w}: минало време',
        'Миналото е основа + -ł- + окончание, което показва лицето и рода: «robiłem» (аз, мъж), «robiłam» (аз, жена), «robiłeś/robiłaś» (ти). Така глаголът показва пола на говорещия.',
      ],
      ru: [
        '{w}: прошедшее время',
        'Прошедшее — основа + -ł- + окончание, показывающее лицо и род: «robiłem» (я, муж.), «robiłam» (я, жен.), «robiłeś/robiłaś» (ты). Глагол сам показывает пол говорящего.',
      ],
      cs: [
        '{w}: minulý čas',
        'Minulý čas je kmen + -ł- + koncovka s osobou a rodem: «robiłem» (já, muž), «robiłam» (já, žena), «robiłeś/robiłaś» (ty). Sloveso tedy samo ukazuje pohlaví mluvčího.',
      ],
    }),
  },
  {
    id: 'future',
    find: word('będ(?:ę|ziesz|zie|ziemy|ziecie|ą)'),
    say: say({
      en: [
        '{w}: the future',
        '«Będę», «będziesz»… with an infinitive make the future of an ongoing action: «będę pracować». A perfective verb needs no helper: its present endings mean the future, «zrobię» (“I’ll do”).',
      ],
      bg: [
        '{w}: бъдеще време',
        '«Będę», «będziesz»… с инфинитив правят бъдеще на продължаващо действие: «będę pracować». Свършеният вид не иска помощен глагол: настоящите му окончания значат бъдеще, «zrobię» („ще направя“).',
      ],
      ru: [
        '{w}: будущее время',
        '«Będę», «będziesz»… с инфинитивом — будущее длящегося действия: «będę pracować». Глагол совершенного вида обходится без помощника: его формы настоящего значат будущее, «zrobię» («сделаю»).',
      ],
      cs: [
        '{w}: budoucí čas',
        '«Będę», «będziesz»… s infinitivem tvoří budoucnost trvajícího děje: «będę pracować». Dokonavé sloveso pomocné nepotřebuje: jeho tvary přítomného znamenají budoucnost, «zrobię» („udělám“).',
      ],
    }),
  },
  {
    id: 'can',
    find: word('mog(?:ę|ą)|możesz|może|możemy|możecie|można'),
    say: say({
      en: [
        '{w}: can, may',
        '«Móc» (can): mogę, możesz, może, możemy, możecie, mogą, with a dictionary-form verb: «czy mogę zapytać?». «Można» is the impersonal “one may”: «czy można tu zapłacić kartą?».',
      ],
      bg: [
        '{w}: мога, може',
        '«Móc» („мога“): mogę, możesz, może, możemy, możecie, mogą, с инфинитив: «czy mogę zapytać?». «Można» е безличното „може се“: «czy można tu zapłacić kartą?».',
      ],
      ru: [
        '{w}: могу, можно',
        '«Móc» («мочь»): mogę, możesz, może, możemy, możecie, mogą, с инфинитивом: «czy mogę zapytać?». «Można» — безличное «можно»: «czy można tu zapłacić kartą?».',
      ],
      cs: [
        '{w}: moci, lze',
        '«Móc» („moci“): mogę, możesz, może, możemy, możecie, mogą, s infinitivem: «czy mogę zapytać?». «Można» je neosobní „lze, dá se“: «czy można tu zapłacić kartą?».',
      ],
    }),
  },
  {
    id: 'must',
    find: word('muszę|musisz|musi|musimy|musicie|muszą|trzeba'),
    say: say({
      en: [
        '{w}: must, need to',
        '«Muszę» (I must) goes with a dictionary-form verb: «muszę iść». «Trzeba» is impersonal, “one needs to”: «trzeba zapłacić»; it doesn’t say who has to.',
      ],
      bg: [
        '{w}: трябва',
        '«Muszę» („трябва да“) върви с инфинитив: «muszę iść». «Trzeba» е безлично, „трябва“: «trzeba zapłacić»; не казва кой е длъжен.',
      ],
      ru: [
        '{w}: должен, нужно',
        '«Muszę» («я должен») идёт с инфинитивом: «muszę iść». «Trzeba» — безличное «нужно»: «trzeba zapłacić»; не говорит, кто должен.',
      ],
      cs: [
        '{w}: musím, je třeba',
        '«Muszę» („musím“) jde s infinitivem: «muszę iść». «Trzeba» je neosobní „je třeba“: «trzeba zapłacić»; neříká, kdo to má udělat.',
      ],
    }),
  },
  {
    id: 'czy',
    find: word('czy'),
    say: say({
      en: [
        '{w}: a yes/no question',
        '«Czy» opens a yes/no question and changes nothing else: «Czy pan mówi po angielsku?». In speech it is often left out and the voice just rises.',
      ],
      bg: [
        '{w}: въпрос „да/не“',
        '«Czy» започва въпрос с отговор „да“ или „не“ и нищо друго не променя: «Czy pan mówi po angielsku?». В говор често се пропуска, а гласът просто се вдига.',
      ],
      ru: [
        '{w}: вопрос «да/нет»',
        '«Czy» открывает вопрос с ответом «да/нет» и больше ничего не меняет: «Czy pan mówi po angielsku?». В речи его часто опускают, а голос просто поднимается.',
      ],
      cs: [
        '{w}: otázka ano/ne',
        '«Czy» uvádí otázku na ano/ne a nic jiného nemění: «Czy pan mówi po angielsku?». V řeči se často vynechává a hlas jen stoupá.',
      ],
    }),
  },
  {
    id: 'numbers',
    find: word('ile|dwa|dwie|trzy|cztery|pięć|sześć|siedem|osiem|dziewięć|dziesięć'),
    say: say({
      en: [
        '{w}: counting',
        'After 2, 3 and 4 the noun is nominative plural («dwa piwa»); from 5 up it is genitive plural («pięć piw»). «Ile» (how many/much) also takes the genitive: «ile masz lat?».',
      ],
      bg: [
        '{w}: броене',
        'След 2, 3 и 4 съществителното е в именителен множествено («dwa piwa»); от 5 нагоре — в родителен множествено («pięć piw»). «Ile» („колко“) също иска родителен: «ile masz lat?».',
      ],
      ru: [
        '{w}: счёт',
        'После 2, 3 и 4 существительное в именительном множественного («dwa piwa»); с 5 — в родительном множественного («pięć piw»). «Ile» («сколько») тоже требует родительного: «ile masz lat?».',
      ],
      cs: [
        '{w}: počítání',
        'Po 2, 3 a 4 je podstatné jméno v nominativu množného čísla («dwa piwa»); od 5 v genitivu množného čísla («pięć piw»). «Ile» („kolik“) také žádá genitiv: «ile masz lat?».',
      ],
    }),
  },
  {
    id: 'with',
    find: word('(?:z|ze) \\p{L}+(?:em|ą|ami|ymi|imi)'),
    say: say({
      en: [
        '{w}: with',
        '«Z» / «ze» (with) takes the instrumental: «z mlekiem» (with milk), «z cukrem», «ze mną» (with me). Masculine and neuter nouns end in -em, feminine in -ą, plural in -ami.',
      ],
      bg: [
        '{w}: с',
        '«Z» / «ze» („с“) иска творителен падеж: «z mlekiem» (с мляко), «z cukrem», «ze mną» (с мен). Мъжки и среден род завършват на -em, женски на -ą, множествено на -ami.',
      ],
      ru: [
        '{w}: с',
        '«Z» / «ze» («с») требует творительного падежа: «z mlekiem» (с молоком), «z cukrem», «ze mną» (со мной). Мужской и средний род — на -em, женский — на -ą, множественное — на -ami.',
      ],
      cs: [
        '{w}: s',
        '«Z» / «ze» („s“) žádá instrumentál: «z mlekiem» (s mlékem), «z cukrem», «ze mną» (se mnou). Mužský a střední rod končí na -em, ženský na -ą, množné číslo na -ami.',
      ],
    }),
  },
  {
    id: 'where',
    find: word('(?:w|we|na) \\p{L}+'),
    say: say({
      en: [
        '{w}: saying where',
        'After «w» and «na» a place that answers “where?” goes in the locative: «w Warszawie», «na stacji». For “where to?” the same words take the accusative: «idę na stację». «Na» is for open places and events.',
      ],
      bg: [
        '{w}: къде',
        'След «w» и «na» място, което отговаря на „къде?“, е в местен падеж: «w Warszawie», «na stacji». За „накъде?“ същите думи иска винителен: «idę na stację». «Na» е за открити места и събития.',
      ],
      ru: [
        '{w}: где',
        'После «w» и «na» место на вопрос «где?» стоит в предложном падеже: «w Warszawie», «na stacji». На вопрос «куда?» те же слова требуют винительного: «idę na stację». «Na» — для открытых мест и событий.',
      ],
      cs: [
        '{w}: kde',
        'Po «w» a «na» je místo odpovídající na „kde?“ v lokálu: «w Warszawie», «na stacji». Na „kam?“ tytéž předložky žádají akuzativ: «idę na stację». «Na» je pro otevřená místa a akce.',
      ],
    }),
  },
  {
    id: 'genitive-prepositions',
    find: word('(?:do|z|ze|od|bez|dla|u|koło|obok) \\p{L}+'),
    say: say({
      en: [
        '{w}: a preposition and the genitive',
        '«Do», «z», «od», «bez», «dla» and «u» take the genitive: «do domu», «bez cukru», «dla mnie». «Do» is where to, «z» where from.',
      ],
      bg: [
        '{w}: предлог и родителен падеж',
        '«Do», «z», «od», «bez», «dla» и «u» искат родителен падеж: «do domu», «bez cukru», «dla mnie». «Do» е накъде, «z» — откъде.',
      ],
      ru: [
        '{w}: предлог и родительный',
        '«Do», «z», «od», «bez», «dla» и «u» требуют родительного падежа: «do domu», «bez cukru», «dla mnie». «Do» — куда, «z» — откуда.',
      ],
      cs: [
        '{w}: předložka a genitiv',
        '«Do», «z», «od», «bez», «dla» a «u» žádají genitiv: «do domu», «bez cukru», «dla mnie». «Do» je kam, «z» odkud.',
      ],
    }),
  },
  {
    id: 'accusative',
    find: word(
      '(?:poproszę|chcę|mam|lubię|piję|jem|kupuję|widzę|znam|kocham|szukam|potrzebuję) (?:\\p{L}+ )?\\p{L}+[ęą]',
    ),
    say: say({
      en: [
        '{w}: the object',
        'The thing acted on takes the accusative, which turns feminine -a into -ę: «kawa» → «poproszę kawę», «muzyka» → «lubię muzykę». Masculine things without life and neuter nouns look the same as the dictionary form.',
      ],
      bg: [
        '{w}: допълнение',
        'Предметът на действието е във винителен падеж, който променя женското -a на -ę: «kawa» → «poproszę kawę», «muzyka» → «lubię muzykę». Неодушевените мъжки и средните съществителни не се променят.',
      ],
      ru: [
        '{w}: дополнение',
        'Объект действия стоит в винительном падеже, где женское -a становится -ę: «kawa» → «poproszę kawę», «muzyka» → «lubię muzykę». Неодушевлённые мужские и средние существительные не меняются.',
      ],
      cs: [
        '{w}: předmět',
        'Předmět děje je v akuzativu, kde ženské -a mění v -ę: «kawa» → «poproszę kawę», «muzyka» → «lubię muzykę». Neživotná mužská a střední jména se nemění.',
      ],
    }),
  },
  {
    id: 'aspect',
    find: word(
      'kupić|kupię|kupisz|zrobić|zrobię|zapłacić|zapłacę|zamówić|zamówię|napisać|napiszę|powiedzieć|powiem|wypić|wypiję|zjeść|zjem|otworzyć|otworzę|pomóc|pomogę|wziąć|wezmę',
    ),
    say: say({
      en: [
        '{w}: a finished action',
        'Most Polish verbs come in pairs: imperfective for an ongoing or repeated action («kupować») and perfective for a finished one («kupić»). A perfective verb in the present endings means the future: «kupię» is “I’ll buy”.',
      ],
      bg: [
        '{w}: свършено действие',
        'Повечето полски глаголи са по двойки: несвършен вид за продължаващо или повтарящо се действие («kupować») и свършен за завършено («kupić»). Свършеният вид в сегашни окончания значи бъдеще: «kupię» е „ще купя“.',
      ],
      ru: [
        '{w}: завершённое действие',
        'Большинство польских глаголов идут парами: несовершенный вид — действие длится или повторяется («kupować»), совершенный — завершено («kupić»). Совершенный вид с окончаниями настоящего значит будущее: «kupię» — «куплю».',
      ],
      cs: [
        '{w}: dokončený děj',
        'Většina polských sloves tvoří páry: nedokonavé pro trvající či opakovaný děj («kupować») a dokonavé pro dokončený («kupić»). Dokonavé sloveso s koncovkami přítomného znamená budoucnost: «kupię» je „koupím“.',
      ],
    }),
  },
  {
    id: 'sie',
    find: word('się'),
    say: say({
      en: [
        '{w}: the reflexive «się»',
        '«Się» is the reflexive “self”. It is never stressed and sits next to the verb or after the question word: «jak się masz?», «uczę się polskiego». Some verbs always have it: «bać się», «cieszyć się».',
      ],
      bg: [
        '{w}: възвратното «się»',
        '«Się» е възвратната частица. Никога не е ударена и стои до глагола или след въпросната дума: «jak się masz?», «uczę się polskiego». Някои глаголи винаги го имат: «bać się», «cieszyć się».',
      ],
      ru: [
        '{w}: возвратное «się»',
        '«Się» — возвратная частица. Она безударна и стоит рядом с глаголом или после вопросительного слова: «jak się masz?», «uczę się polskiego». Некоторые глаголы всегда с ней: «bać się», «cieszyć się».',
      ],
      cs: [
        '{w}: zvratné «się»',
        '«Się» je zvratné „se“. Nikdy nemá přízvuk a stojí u slovesa nebo za tázacím slovem: «jak się masz?», «uczę się polskiego». Některá slovesa ho mají vždy: «bać się», «cieszyć się».',
      ],
    }),
  },
  {
    id: 'cases',
    find: () => '',
    say: say({
      en: [
        'Endings change with the role',
        'Polish nouns, adjectives and pronouns change their endings with their role (seven cases): «kawa», «poproszę kawę», «bez kawy», «z kawą». There are no articles, and word order is free because endings show who does what.',
      ],
      bg: [
        'Окончания според ролята',
        'Полските съществителни, прилагателни и местоимения променят окончанията си според ролята (седем падежа): «kawa», «poproszę kawę», «bez kawy», «z kawą». Няма членове, а редът на думите е свободен, защото окончанията показват кой какво прави.',
      ],
      ru: [
        'Окончания меняются по роли',
        'Польские существительные, прилагательные и местоимения меняют окончания по роли в предложении (семь падежей): «kawa», «poproszę kawę», «bez kawy», «z kawą». Артиклей нет, порядок слов свободный: окончания показывают, кто что делает.',
      ],
      cs: [
        'Koncovky podle role',
        'Polská podstatná jména, přídavná jména a zájmena mění koncovky podle role ve větě (sedm pádů): «kawa», «poproszę kawę», «bez kawy», «z kawą». Členy nejsou a slovosled je volný, protože koncovky ukazují, kdo co dělá.',
      ],
    }),
  },
]

// ---------------------------------------------------------------------------------------------
// Sounds: each tip finds a word whose letters certainly carry a sound learners find hard.
// ---------------------------------------------------------------------------------------------

export const POLISH_SOUND_TIPS: SoundTip[] = [
  {
    id: 'nasal',
    find: word('\\p{L}*[ąę]\\p{L}*'),
    say: say({
      en: [
        '{w}: ą and ę',
        'Ą and ę are nasal vowels, like “on” and “en” said partly through the nose. Before p or b they sound like «om» and «em»; at the end of a word «ę» is a plain, lightly nasal e.',
      ],
      bg: [
        '{w}: ą и ę',
        '«Ą» и «ę» са носови гласни, като „он“ и „ен“, изговорени отчасти през носа. Пред p и b звучат като «om» и «em»; в края на дума «ę» е обикновено, леко носово е.',
      ],
      ru: [
        '{w}: ą и ę',
        '«Ą» и «ę» — носовые гласные, как «он» и «эн», сказанные отчасти через нос. Перед p и b они звучат как «om» и «em»; в конце слова «ę» — простое слегка носовое «е».',
      ],
      cs: [
        '{w}: ą a ę',
        '«Ą» a «ę» jsou nosové samohlásky, jako „on“ a „en“ řečené částečně nosem. Před p a b zní jako «om» a «em»; na konci slova je «ę» obyčejné, lehce nosové e.',
      ],
    }),
  },
  {
    id: 'retroflex',
    find: word('\\p{L}*(?:sz|cz|dż)\\p{L}*'),
    say: say({
      en: [
        '{w}: sz, cz, dż',
        '«Sz» and «cz» are harder than English “sh” and “ch”: the tongue tip curls back a little. «Dż» is the same as «cz» but voiced, like the j of “jam”.',
      ],
      bg: [
        '{w}: sz, cz, dż',
        '«Sz» и «cz» са по-плътни от „ш“ и „ч“: върхът на езика е леко извит назад. «Dż» е като «cz», но звучно — като „дж“.',
      ],
      ru: [
        '{w}: sz, cz, dż',
        '«Sz» и «cz» твёрже русских «ш» и «ч»: кончик языка слегка загнут назад. «Dż» — то же, что «cz», но звонкое, как «дж».',
      ],
      cs: [
        '{w}: sz, cz, dż',
        '«Sz» a «cz» jsou tvrdší než české „š“ a „č“: špička jazyka je lehce zakroucená dozadu. «Dż» je jako «cz», ale znělé, jako „dž“.',
      ],
    }),
  },
  {
    id: 'rz-zh',
    find: word('\\p{L}*(?:rz|ż)\\p{L}*'),
    say: say({
      en: [
        '{w}: rz and ż',
        '«Rz» and «ż» are the same sound, like the s of “measure” (the tongue tip curled back). After p, t, k or ch, «rz» goes voiceless like «sz»: «przepraszam».',
      ],
      bg: [
        '{w}: rz и ż',
        '«Rz» и «ż» са един и същ звук — като „ж“, но с леко извит назад език. След p, t, k или ch «rz» става беззвучно като «sz»: «przepraszam».',
      ],
      ru: [
        '{w}: rz и ż',
        '«Rz» и «ż» — один и тот же звук, как «ж» с чуть загнутым назад языком. После p, t, k, ch «rz» глохнет, как «sz»: «przepraszam».',
      ],
      cs: [
        '{w}: rz a ż',
        '«Rz» a «ż» jsou tentýž zvuk, jako „ž“ s lehce zakrouceným jazykem. Po p, t, k nebo ch ztrácí «rz» znělost jako «sz»: «przepraszam». Není to české ř.',
      ],
    }),
  },
  {
    id: 'l-stroke',
    find: word('\\p{L}*ł\\p{L}*'),
    say: say({
      en: [
        '{w}: ł',
        'Barred «ł» is said like English “w” in “water”, not like an l. The plain «l» is the clear l of “leaf”, never the dark l of “milk”.',
      ],
      bg: [
        '{w}: ł',
        'Задрасканото «ł» се чете като кратко „у“ (английско w), не като „л“. Обикновеното «l» е ясно „л“ като в „лято“.',
      ],
      ru: [
        '{w}: ł',
        'Перечёркнутое «ł» читается как короткое «у» (английское w), а не как «л». Обычное «l» — чистое «л», как в слове «лес» перед «е».',
      ],
      cs: [
        '{w}: ł',
        'Přeškrtnuté «ł» se čte jako krátké „u“ (anglické w), ne jako „l“. Obyčejné «l» je čisté české „l“.',
      ],
    }),
  },
  {
    id: 'soft',
    find: word('\\p{L}*(?:ś|ć|ź|dź|ń)\\p{L}*'),
    say: say({
      en: [
        '{w}: ś, ć, ź, dź, ń',
        'The accented letters are soft: the middle of the tongue rises to the palate. «Ś» is a soft “sh”, «ć» a soft “ch”, «ź» a soft “zh”, «dź» a soft “j”, «ń» like the ny of “canyon”.',
      ],
      bg: [
        '{w}: ś, ć, ź, dź, ń',
        'Буквите с чертица са меки: средата на езика се вдига към небцето. «Ś» е меко „ш“, «ć» меко „ч“, «ź» меко „ж“, «dź» меко „дж“, «ń» — „нь“ като в „конь“.',
      ],
      ru: [
        '{w}: ś, ć, ź, dź, ń',
        'Буквы с чёрточкой мягкие: середина языка поднимается к нёбу. «Ś» — мягкое «ш», «ć» — мягкое «ч», «ź» — мягкое «ж», «dź» — мягкое «дж», «ń» — как «нь» в «конь».',
      ],
      cs: [
        '{w}: ś, ć, ź, dź, ń',
        'Písmena s čárkou jsou měkká: střed jazyka se zvedá k patru. «Ś» je měkké „š“, «ć» měkké „č“, «ź» měkké „ž“, «dź» měkké „dž“, «ń» jako české „ň“.',
      ],
    }),
  },
  {
    id: 'soft-i',
    find: word('\\p{L}*(?:ni|ci|si|zi|dzi)[aeouąę]\\p{L}*'),
    say: say({
      en: [
        '{w}: i as a softener',
        'An «i» between a consonant and another vowel is not a vowel but a mark of softness: «nie» is “nyeh”, «siostra» is “shostra” with a soft sh, «dziękuję» starts with a soft “j”.',
      ],
      bg: [
        '{w}: i като омекотител',
        '«I» между съгласна и гласна не е гласна, а знак за мекота: «nie» е „нье“, «siostra» е с меко „ш“, «dziękuję» започва с меко „дж“.',
      ],
      ru: [
        '{w}: i как знак мягкости',
        '«I» между согласной и гласной — не гласная, а знак мягкости: «nie» — «нье», «siostra» с мягким «ш», «dziękuję» начинается с мягкого «дж».',
      ],
      cs: [
        '{w}: i jako změkčení',
        '«I» mezi souhláskou a samohláskou není samohláska, ale značka měkkosti: «nie» je „ňe“, «siostra» má měkké „š“, «dziękuję» začíná měkkým „dž“.',
      ],
    }),
  },
  {
    id: 'ch-h',
    find: word('\\p{L}*(?:ch|h)\\p{L}*'),
    say: say({
      en: [
        '{w}: ch and h',
        '«Ch» and «h» are the same sound: a rough h from the back of the mouth, like “ch” in Scottish “loch”. Don’t confuse «ch» with «cz», which is “ch” as in “church”.',
      ],
      bg: [
        '{w}: ch и h',
        '«Ch» и «h» са един звук: същото „х“ като в български, отзад в устата. Не бъркайте «ch» с «cz», което е „ч“.',
      ],
      ru: [
        '{w}: ch и h',
        '«Ch» и «h» — один звук, обычное русское «х». Не путайте «ch» с «cz», это «ч».',
      ],
      cs: [
        '{w}: ch a h',
        '«Ch» a «h» jsou tentýž zvuk, jako české „ch“, vzadu v ústech. Nepleťte «ch» s «cz», což je „č“.',
      ],
    }),
  },
  {
    id: 'o-acute',
    find: word('\\p{L}*ó\\p{L}*'),
    say: say({
      en: [
        '{w}: ó',
        '«Ó» is said exactly like «u», as in “moon”. It is just an old spelling, so «któ-» sounds like «ktu-». It is not a long or an open o.',
      ],
      bg: [
        '{w}: ó',
        '«Ó» се чете точно като «u» — „у“. Това е само старо правописно наследство, така че «któ-» звучи като «ktu-». Не е нито дълго, нито отворено „о“.',
      ],
      ru: [
        '{w}: ó',
        '«Ó» читается точно как «u» — «у». Это лишь старое написание: «któ-» звучит как «ktu-». Это не долгое и не открытое «о».',
      ],
      cs: [
        '{w}: ó',
        '«Ó» se čte přesně jako «u» — „u“. Je to jen starý pravopis, takže «któ-» zní jako «ktu-». Není to dlouhé ani otevřené o.',
      ],
    }),
  },
  {
    id: 'y',
    find: word('\\p{L}*y\\p{L}*'),
    say: say({
      en: [
        '{w}: y',
        '«Y» is a vowel of its own, between “i” of “bit” and a pulled-back “e”: say “i” with the tongue drawn back. «Y» and «i» are different sounds, and «i» is brighter.',
      ],
      bg: [
        '{w}: y',
        '«Y» е отделна гласна между „и“ и „ъ“: кажете „и“ с изтеглен назад език. «Y» и «i» са различни звукове — «i» е по-светло.',
      ],
      ru: [
        '{w}: y',
        '«Y» читается как русское «ы»: «и» с оттянутым назад языком. «Y» и «i» — разные звуки, «i» светлее.',
      ],
      cs: [
        '{w}: y',
        'V polštině se «y» a «i» liší, na rozdíl od češtiny: «y» je samohláska mezi „i“ a „e“, vyslovená s jazykem staženým dozadu, «i» je světlejší.',
      ],
    }),
  },
  {
    id: 'clusters',
    find: word('\\p{L}*[^aeiouyąęó\\P{L}]{4,}\\p{L}*'),
    say: say({
      en: [
        '{w}: a run of consonants',
        'Polish stacks consonants: «wszystko», «przepraszam». Say each one, quickly, without slipping a vowel between them, and keep the voiceless ones («sz», «cz») voiceless.',
      ],
      bg: [
        '{w}: ред съгласни',
        'Полският трупа съгласни: «wszystko», «przepraszam». Кажете всяка бързо, без да вмъквате гласна между тях, а беззвучните («sz», «cz») запазете беззвучни.',
      ],
      ru: [
        '{w}: скопление согласных',
        'В польском много согласных подряд: «wszystko», «przepraszam». Произносите каждую быстро, не вставляя гласной, а глухие («sz», «cz») оставляйте глухими.',
      ],
      cs: [
        '{w}: řada souhlásek',
        'Polština řadí souhlásky za sebou: «wszystko», «przepraszam». Vyslovte každou rychle, bez vložené samohlásky, a neznělé («sz», «cz») nechte neznělé.',
      ],
    }),
  },
  {
    id: 'rolled-r',
    find: word('\\p{L}*r\\p{L}*'),
    say: say({
      en: [
        '{w}: r',
        'Polish «r» is a tongue-tip tap or trill, as in Spanish “pero”. It is never the English r, and it is said at the end of a word too.',
      ],
      bg: [
        '{w}: r',
        'Полското «r» е трептящо, с върха на езика, като българското „р“. Казва се и в края на думата.',
      ],
      ru: [
        '{w}: r',
        'Польское «r» — раскатистое, кончиком языка, как русское «р». Оно произносится и в конце слова.',
      ],
      cs: [
        '{w}: r',
        'Polské «r» je jazykové vibrované r, jako české „r“. Vyslovuje se i na konci slova.',
      ],
    }),
  },
  {
    id: 'final-devoicing',
    find: word('\\p{L}+(?:b|d|g|w|z|ż|dz)'),
    say: say({
      en: [
        '{w}: a word’s last consonant',
        'At the end of a word a voiced consonant goes voiceless: «chleb» is said «chlep», «ząb» «zomp», «pod» «pot». Spelling keeps the voiced letter.',
      ],
      bg: [
        '{w}: последната съгласна',
        'В края на думата звучната съгласна оглушава, както в български: «chleb» се чете «chlep», «ząb» — «zomp», «pod» — «pot». Правописът запазва звучната буква.',
      ],
      ru: [
        '{w}: последняя согласная',
        'В конце слова звонкая согласная оглушается, как в русском: «chleb» читается «chlep», «ząb» — «zomp», «pod» — «pot». Написание сохраняет звонкую букву.',
      ],
      cs: [
        '{w}: poslední souhláska',
        'Na konci slova se znělá souhláska stává neznělou, jako v češtině: «chleb» se čte «chlep», «ząb» «zomp», «pod» «pot». Pravopis si znělé písmeno ponechává.',
      ],
    }),
  },
  {
    id: 'stress',
    find: () => '',
    say: say({
      en: [
        'Stress on the next-to-last syllable',
        'Polish words are almost always stressed on the second syllable from the end: «dzięKUję», «poPROszę». Don’t reduce the unstressed vowels: «a», «e» and «o» keep their full sound.',
      ],
      bg: [
        'Ударение на предпоследната сричка',
        'Полските думи почти винаги са ударени на предпоследната сричка: «dzięKUję», «poPROszę». Не редуцирайте неударените гласни: «a», «e» и «o» запазват пълния си звук.',
      ],
      ru: [
        'Ударение на предпоследнем слоге',
        'Польские слова почти всегда ударяются на предпоследнем слоге: «dzięKUję», «poPROszę». Безударные гласные не редуцируются: «a», «e» и «o» звучат полностью.',
      ],
      cs: [
        'Přízvuk na předposlední slabice',
        'Polská slova mají téměř vždy přízvuk na předposlední slabice: «dzięKUję», «poPROszę». Nepřízvučné samohlásky se nezkracují: «a», «e» a «o» znějí plně.',
      ],
    }),
  },
]
