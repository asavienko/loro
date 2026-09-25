import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { LanguageCode, Phrase } from '../content';
import { useCopy, useStore } from '../state/store';

let canvas: HTMLCanvasElement | null = null;

/** Rendered width of `text` in `font`, via canvas text metrics. */
function textWidth(text: string, font: string): number {
  canvas ??= document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return text.length * 12;
  ctx.font = font;
  return ctx.measureText(text).width;
}

/**
 * The hidden target: a bar exactly as wide as the phrase will render, wrapped
 * to as many lines as the phrase takes, so it hints at the length honestly.
 */
export function HiddenPhrase({ text, className, label }: { text: string; className: string; label: string }) {
  const probe = useRef<HTMLHeadingElement>(null);
  const [lines, setLines] = useState<number[]>([]);
  useLayoutEffect(() => {
    const el = probe.current;
    if (!el) return;
    const measure = () => {
      const style = getComputedStyle(el);
      const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const full = textWidth(text, font);
      const max = el.clientWidth || full;
      const rows: number[] = [];
      for (let left = full; left > 0; left -= max) rows.push(Math.min(left, max));
      setLines(rows.length > 0 ? rows : [full]);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    void document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [text]);
  return (
    <h2 ref={probe} className={className}>
      <span className='sr-only'>{label}</span>
      <span aria-hidden='true' className='flex flex-col gap-1.5 py-1'>
        {lines.map((width, i) => (
          <span key={i} className='block h-6 rounded-md bg-surface-container-highest forced-colors:border-2 forced-colors:border-dashed' style={{ width }} />
        ))}
      </span>
    </h2>
  );
}

type Token = { text: string; gloss: string | null };

/** Splits the target into glossed units, longest match first ('por favor' before 'por'). */
export function tokenize(phrase: Phrase, native: LanguageCode): Token[] {
  const lang = phrase.targetLang;
  const units = Object.keys(phrase.words).sort((a, b) => b.length - a.length);
  const lower = phrase.target.toLocaleLowerCase(lang);
  const isLetter = (ch: string | undefined) => ch !== undefined && /\p{L}/u.test(ch);
  const tokens: Token[] = [];
  let plain = '';
  let i = 0;
  while (i < phrase.target.length) {
    const unit = !isLetter(lower[i - 1])
      ? units.find((u) => lower.startsWith(u, i) && !isLetter(lower[i + u.length]))
      : undefined;
    if (unit) {
      if (plain) tokens.push({ text: plain, gloss: null });
      plain = '';
      tokens.push({ text: phrase.target.slice(i, i + unit.length), gloss: phrase.words[unit][native] ?? null });
      i += unit.length;
    } else {
      plain += phrase.target[i];
      i++;
    }
  }
  if (plain) tokens.push({ text: plain, gloss: null });
  return tokens;
}

const LEADING_PUNCT = /^[^\s\p{L}]+/u;
const TRAILING_PUNCT = /[^\s\p{L}]+$/u;
const NOTHING = /(?!)/;

/** The revealed target, with each glossed word tappable to show its meaning. */
export function GlossedPhrase({ phrase, className }: { phrase: Phrase; className: string }) {
  const c = useCopy();
  const { state } = useStore();
  const [open, setOpen] = useState<number | null>(null);
  const meaningId = useId();
  const hintId = useId();
  const tokens = tokenize(phrase, state.learner.profile.nativeLang);
  const openToken = open === null ? null : tokens[open];
  return (
    <div>
      {/* Named by the phrase itself: from its content the word buttons would split the name's spacing. */}
      <h2 lang={phrase.targetLang} aria-label={phrase.target} className={className}>
        {tokens.map((t, i) => {
          // Punctuation touching a word ('¡Qué', 'pasado!') must not wrap onto a line of its own,
          // so it moves into the word's unbreakable span.
          if (!t.gloss) {
            const text = t.text
              .replace(i > 0 && tokens[i - 1].gloss ? LEADING_PUNCT : NOTHING, '')
              .replace(tokens[i + 1]?.gloss ? TRAILING_PUNCT : NOTHING, '');
            return <span key={i}>{text}</span>;
          }
          // A plain token between two words gives its leading punctuation to the word before it only.
          const previous = tokens[i - 1]?.gloss === null ? tokens[i - 1].text.replace(i > 1 && tokens[i - 2].gloss ? LEADING_PUNCT : NOTHING, '') : '';
          const before = TRAILING_PUNCT.exec(previous)?.[0] ?? '';
          const after = tokens[i + 1]?.gloss === null ? (LEADING_PUNCT.exec(tokens[i + 1].text)?.[0] ?? '') : '';
          return (
            <span key={i} className='whitespace-nowrap'>
              {before}
              <button
                type='button'
                aria-expanded={open === i}
                aria-controls={meaningId}
                aria-describedby={hintId}
                onClick={() => setOpen(open === i ? null : i)}
                className={`inline rounded-md underline decoration-dotted decoration-outline underline-offset-4 ${open === i ? 'bg-primary-fixed/60' : ''}`}
              >
                {t.text}
              </button>
              {after}
            </span>
          );
        })}
      </h2>
      <p id={hintId} hidden>
        {c.phrase.glossHint}
      </p>
      <p id={meaningId} aria-live='polite' className='min-h-5 text-body text-on-surface-variant mt-1'>
        {openToken?.gloss && (
          <>
            <span lang={phrase.targetLang}>{openToken.text}</span>: {openToken.gloss}
          </>
        )}
      </p>
    </div>
  );
}
