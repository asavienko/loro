// Numbers as words, so a phrase's digits are transcribed as they're said (plan 105): «Mesa para 2»
// is [ˈme.sa ˈpa.ɾa ˈðos]. Cardinals below a million, in the counting forms (uno, едно); a longer
// number is read digit by digit.

const ES_UNITS = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const ES_TENS = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const ES_HUNDREDS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function spanishBelowThousand(n: number): string {
  if (n < 30) return ES_UNITS[n];
  if (n < 100) return ES_TENS[Math.floor(n / 10)] + (n % 10 ? ` y ${ES_UNITS[n % 10]}` : '');
  if (n === 100) return 'cien';
  return ES_HUNDREDS[Math.floor(n / 100)] + (n % 100 ? ` ${spanishBelowThousand(n % 100)}` : '');
}

export function spanishNumber(n: number): string {
  if (n < 1000) return spanishBelowThousand(n);
  const thousands = Math.floor(n / 1000);
  // «uno» shortens before mil: veintiún mil, un… (mil alone for one thousand).
  const lead = thousands === 1 ? '' : `${spanishBelowThousand(thousands).replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un')} `;
  return `${lead}mil${n % 1000 ? ` ${spanishBelowThousand(n % 1000)}` : ''}`;
}

const BG_UNITS = ['нула', 'едно', 'две', 'три', 'четири', 'пет', 'шест', 'седем', 'осем', 'девет', 'десет', 'единадесет', 'дванадесет', 'тринадесет', 'четиринадесет', 'петнадесет', 'шестнадесет', 'седемнадесет', 'осемнадесет', 'деветнадесет'];
const BG_TENS = ['', '', 'двадесет', 'тридесет', 'четиридесет', 'петдесет', 'шестдесет', 'седемдесет', 'осемдесет', 'деветдесет'];
const BG_HUNDREDS = ['', 'сто', 'двеста', 'триста', 'четиристотин', 'петстотин', 'шестстотин', 'седемстотин', 'осемстотин', 'деветстотин'];

/** Bulgarian joins the last part with «и»: сто двадесет и пет. */
function bulgarianBelowThousand(n: number): string {
  const parts: string[] = [];
  if (n >= 100) parts.push(BG_HUNDREDS[Math.floor(n / 100)]);
  const rest = n % 100;
  if (rest >= 20) {
    parts.push(BG_TENS[Math.floor(rest / 10)]);
    if (rest % 10) parts.push(BG_UNITS[rest % 10]);
  } else if (rest > 0 || parts.length === 0) parts.push(BG_UNITS[rest]);
  return parts.length > 1 ? `${parts.slice(0, -1).join(' ')} и ${parts[parts.length - 1]}` : parts[0];
}

export function bulgarianNumber(n: number): string {
  if (n < 1000) return bulgarianBelowThousand(n);
  const thousands = Math.floor(n / 1000);
  // Хиляда is feminine: двадесет и една хиляди.
  const lead = thousands === 1 ? 'хиляда' : `${bulgarianBelowThousand(thousands).replace(/(^| )едно$/, '$1една')} хиляди`;
  const rest = n % 1000;
  if (!rest) return lead;
  // The «и» goes before the last part: хиляда и пет, but хиляда двеста и пет.
  return rest < 100 || rest % 100 === 0 ? `${lead} и ${bulgarianBelowThousand(rest)}` : `${lead} ${bulgarianBelowThousand(rest)}`;
}

/** The stress of the Bulgarian number words, for the words the course's phrases don't have. */
export const BULGARIAN_NUMBER_STRESS: Record<string, number> = {
  нула: 0, едно: 1, една: 1, четири: 0, седем: 0, осем: 0, девет: 0, десет: 0, единадесет: 2, дванадесет: 1, тринадесет: 1,
  четиринадесет: 3, петнадесет: 1, шестнадесет: 1, седемнадесет: 2, осемнадесет: 2, деветнадесет: 2, двадесет: 0, тридесет: 0,
  четиридесет: 2, петдесет: 2, шестдесет: 2, седемдесет: 3, осемдесет: 3, деветдесет: 3, двеста: 0, триста: 0,
  четиристотин: 2, хиляда: 1, хиляди: 0,
};

/** The text with each run of digits written as words in the phrase's language. */
export function spellNumbers(text: string, lang: 'es-ES' | 'bg-BG'): string {
  const spell = lang === 'es-ES' ? spanishNumber : bulgarianNumber;
  return text.replace(/\d+/g, (digits) => {
    const n = Number(digits);
    if (digits.length <= 6 && !(digits.length > 1 && digits.startsWith('0'))) return ` ${spell(n)} `;
    return ` ${[...digits].map((d) => spell(Number(d))).join(' ')} `;
  });
}
