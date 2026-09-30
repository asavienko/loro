// A picture for a phrase the learner typed (plan 105): the icons of Loro's phrases that share its
// words — in the course language or in the learner's meaning — and of a word list for common
// things. A phrase that matches nothing gets speech bubbles: it is, at least, something to say.
import { KNOWN_PHRASES } from './content.js'
import { contentWords, tokenize } from './text.js'

/** Everyday words (in English, the words of most meanings) and the registry icon that draws them. */
export const WORD_ICONS: Record<string, string> = {
  coffee: 'coffee',
  tea: 'free_breakfast',
  breakfast: 'free_breakfast',
  cafe: 'local_cafe',
  drink: 'local_drink',
  water: 'water_drop',
  beer: 'sports_bar',
  wine: 'sports_bar',
  bar: 'sports_bar',
  food: 'restaurant',
  eat: 'restaurant',
  dinner: 'restaurant',
  lunch: 'restaurant',
  restaurant: 'restaurant',
  menu: 'restaurant_menu',
  table: 'table_restaurant',
  bread: 'bakery_dining',
  cake: 'cake',
  birthday: 'cake',
  fruit: 'nutrition',
  vegetables: 'nutrition',
  tapas: 'tapas',
  bill: 'receipt_long',
  receipt: 'receipt_long',
  pay: 'payments',
  money: 'payments',
  cash: 'payments',
  price: 'payments',
  card: 'credit_card',
  wallet: 'wallet',
  shop: 'storefront',
  store: 'storefront',
  market: 'storefront',
  buy: 'shopping_bag',
  shopping: 'shopping_bag',
  bag: 'shopping_bag',
  basket: 'shopping_basket',
  clothes: 'apparel',
  shirt: 'apparel',
  dress: 'apparel',
  size: 'straighten',
  kilo: 'scale',
  weight: 'scale',
  train: 'train',
  station: 'train',
  metro: 'subway',
  subway: 'subway',
  underground: 'subway',
  bus: 'directions_bus',
  car: 'directions_car',
  taxi: 'local_taxi',
  walk: 'directions_walk',
  run: 'directions_run',
  map: 'map',
  street: 'location_city',
  city: 'location_city',
  town: 'location_city',
  where: 'location_on',
  lost: 'wrong_location',
  ticket: 'confirmation_number',
  flight: 'flight',
  plane: 'flight',
  airport: 'flight_takeoff',
  luggage: 'luggage',
  suitcase: 'luggage',
  passport: 'badge',
  hotel: 'nights_stay',
  room: 'door_front',
  night: 'nights_stay',
  bed: 'nights_stay',
  key: 'key',
  towel: 'dry',
  shower: 'bathtub',
  bath: 'bathtub',
  doctor: 'stethoscope',
  hospital: 'medical_services',
  medicine: 'medication',
  pharmacy: 'local_pharmacy',
  chemist: 'local_pharmacy',
  pill: 'pill',
  pain: 'sick',
  ill: 'sick',
  sick: 'sick',
  headache: 'sick',
  allergy: 'allergy',
  allergic: 'allergy',
  ambulance: 'ambulance',
  police: 'local_police',
  help: 'support',
  phone: 'smartphone',
  mobile: 'smartphone',
  call: 'call',
  wifi: 'wifi_password',
  internet: 'wifi_password',
  password: 'wifi_password',
  battery: 'battery_alert',
  charger: 'charger',
  laptop: 'laptop',
  computer: 'laptop',
  email: 'send',
  message: 'send',
  work: 'work',
  office: 'work',
  meeting: 'groups',
  job: 'work',
  school: 'school',
  learn: 'school',
  study: 'school',
  class: 'school',
  book: 'menu_book',
  music: 'library_music',
  song: 'library_music',
  film: 'theater_comedy',
  theatre: 'theater_comedy',
  party: 'celebration',
  family: 'family_group',
  mother: 'woman',
  sister: 'woman',
  wife: 'woman',
  daughter: 'woman',
  father: 'boy',
  brother: 'boy',
  husband: 'boy',
  son: 'boy',
  child: 'child_care',
  children: 'child_care',
  baby: 'child_care',
  grandmother: 'elderly_woman',
  grandfather: 'elderly',
  friend: 'group',
  friends: 'group',
  people: 'people',
  hello: 'handshake',
  meet: 'handshake',
  love: 'favorite',
  like: 'thumb_up',
  weather: 'sunny',
  sun: 'sunny',
  sunny: 'sunny',
  hot: 'wb_sunny',
  rain: 'rainy',
  umbrella: 'umbrella',
  cloud: 'cloudy',
  cold: 'ac_unit',
  snow: 'ac_unit',
  park: 'park',
  beach: 'umbrella',
  mountain: 'landscape',
  hike: 'hiking',
  time: 'schedule',
  hour: 'schedule',
  late: 'schedule',
  today: 'today',
  tomorrow: 'event',
  week: 'calendar_month',
  weekend: 'calendar_month',
  home: 'home',
  house: 'home',
  language: 'language',
  english: 'language',
  spanish: 'language',
  speak: 'record_voice_over',
  say: 'record_voice_over',
  thanks: 'sentiment_satisfied',
  thank: 'sentiment_satisfied',
  sorry: 'sentiment_dissatisfied',
  juice: 'local_drink',
  milk: 'local_drink',
  orange: 'nutrition',
  apple: 'nutrition',
  cheese: 'nutrition',
  meat: 'restaurant',
  fish: 'restaurant',
  ice: 'ac_unit',
  // The commonest things in the course languages and the learners' own, as they're often typed.
  pan: 'bakery_dining',
  хляб: 'bakery_dining',
  хлеб: 'bakery_dining',
  agua: 'water_drop',
  вода: 'water_drop',
  café: 'coffee',
  кафе: 'coffee',
  кофе: 'coffee',
  té: 'free_breakfast',
  чай: 'free_breakfast',
  cerveza: 'sports_bar',
  бира: 'sports_bar',
  пиво: 'sports_bar',
  vino: 'sports_bar',
  вино: 'sports_bar',
  leche: 'local_drink',
  мляко: 'local_drink',
  молоко: 'local_drink',
  billete: 'confirmation_number',
  билет: 'confirmation_number',
  такси: 'local_taxi',
  хотел: 'nights_stay',
  отель: 'nights_stay',
  médico: 'stethoscope',
  лекар: 'stethoscope',
  врач: 'stethoscope',
  farmacia: 'local_pharmacy',
  аптека: 'local_pharmacy',
  dinero: 'payments',
  пари: 'payments',
  деньги: 'payments',
  tren: 'train',
  влак: 'train',
  поезд: 'train',
  autobús: 'directions_bus',
  автобус: 'directions_bus',
  playa: 'umbrella',
  плаж: 'umbrella',
  пляж: 'umbrella',
  casa: 'home',
  къща: 'home',
  дом: 'home',
  teléfono: 'smartphone',
  телефон: 'smartphone',
  música: 'library_music',
  музика: 'library_music',
  музыка: 'library_music',
  // Greetings and thanks, which the learner often types in their own language too.
  hi: 'handshake',
  gracias: 'sentiment_satisfied',
  благодаря: 'sentiment_satisfied',
  спасибо: 'sentiment_satisfied',
  hola: 'handshake',
  здравей: 'handshake',
  здравейте: 'handshake',
  привет: 'handshake',
  здравствуйте: 'handshake',
}

const FALLBACK = ['forum']

type Scores = Map<string, number>
let index: Map<string, Scores> | null = null

/**
 * Every word of Loro's phrases and their meanings, with the icons of the phrases it's in. A word in
 * many phrases says little about any one picture, so its points are shared out among them.
 */
function wordIndex(): Map<string, Scores> {
  if (index) return index
  const phrasesWith = new Map<string, { image: readonly string[] }[]>()
  for (const phrase of KNOWN_PHRASES) {
    const words = new Set(
      [phrase.target, ...Object.values(phrase.translations)].flatMap((text) => contentWords(text)),
    )
    for (const word of words) phrasesWith.set(word, [...(phrasesWith.get(word) ?? []), phrase])
  }
  index = new Map()
  for (const [word, phrases] of phrasesWith) {
    const scores = new Map<string, number>()
    for (const { image } of phrases)
      image.forEach((icon, i) =>
        scores.set(icon, (scores.get(icon) ?? 0) + (i === 0 ? 2 : 1) / phrases.length),
      )
    index.set(word, scores)
  }
  return index
}

const stem = (word: string) =>
  word.length > 4 ? word.replace(/(?:es|s|та|то|те|ът|а|я|и|ы|у|ю)$/u, '') : word

/** One to three icons for the phrase: its best match large, then up to two more it also matches. */
export function pictureFor(target: string, native: string): string[] {
  const scores: Scores = new Map()
  const add = (icon: string, points: number) => scores.set(icon, (scores.get(icon) ?? 0) + points)
  const known = wordIndex()
  const look = (words: string[], weight: number) => {
    for (const word of words) {
      const direct = WORD_ICONS[word] ?? WORD_ICONS[stem(word)]
      if (direct) add(direct, 3 * weight)
      const hits = known.get(word) ?? known.get(stem(word))
      hits?.forEach((points, icon) => add(icon, points * weight))
    }
  }
  look(contentWords(target), 2)
  look(
    tokenize(native)
      .map((t) => t.word)
      .filter((w) => w.length >= 3),
    1,
  )
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const top = ranked[0]
  if (!top) return FALLBACK
  return [
    top[0],
    ...ranked
      .slice(1)
      .filter(([, s]) => s >= Math.max(2, top[1] / 3))
      .map(([icon]) => icon),
  ].slice(0, 3)
}
