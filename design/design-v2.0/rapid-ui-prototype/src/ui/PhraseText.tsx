import { RefObject, useId, useLayoutEffect, useRef, useState } from 'react';
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

/** A row of the hidden target: the words on it and the width they take. */
export interface WrappedRow {
  text: string;
  width: number;
}

/**
 * Wraps `words` as the browser wraps the revealed phrase: a row takes words while they fit in
 * `max`, and a word too wide for any row gets one of its own (never split, clamped to `max`).
 * So the slot has the revealed text's line count and line widths, and no sliver of a row.
 */
export function wrapRows(words: string[], max: number, measure: (text: string) => number): WrappedRow[] {
  const rows: WrappedRow[] = [];
  let line = '';
  for (const word of words) {
    const longer = line ? `${line} ${word}` : word;
    if (line && measure(longer) > max) {
      rows.push({ text: line, width: Math.min(measure(line), max) });
      line = word;
    } else line = longer;
  }
  if (line) rows.push({ text: line, width: Math.min(measure(line), max) });
  return rows;
}

/** The phrase's words, split where the revealed heading can break: a glossed unit ('por favor') stays whole. */
export function breakUnits(phrase: Phrase, native: LanguageCode): string[] {
  return tokenize(phrase, native)
    .map((t) => (t.gloss ? t.text.replace(/ /g, '\u00a0') : t.text))
    .join('')
    .split(/ +/)
    .filter(Boolean)
    .map((w) => w.replace(/\u00a0/g, ' '));
}

/** Rows of `words` at `el`'s width in its own font, kept up to date as the width or the font changes. */
function useWrappedRows(el: RefObject<HTMLElement | null>, words: string[]): WrappedRow[] | null {
  const [rows, setRows] = useState<WrappedRow[] | null>(null);
  const key = words.join('\n');
  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    const list = key.split('\n');
    const measure = () => {
      const style = getComputedStyle(node);
      const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const width = (text: string) => textWidth(text, font);
      setRows(wrapRows(list, node.clientWidth || width(list.join(' ')), width));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    void document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [el, key]);
  return rows;
}

const SLOT = 'block max-w-full rounded-md border-[1.5px] border-dashed border-outline forced-colors:border-2';

/**
 * The hidden target: a dashed slot exactly as wide as the phrase will render, wrapped by
 * words where the revealed phrase wraps, so it hints at the length honestly. It says
 * "the phrase goes here" without outweighing the prompt the learner is recalling from.
 */
export function HiddenPhrase({ phrase, className, label }: { phrase: Phrase; className: string; label: string }) {
  const { state } = useStore();
  const probe = useRef<HTMLHeadingElement>(null);
  const rows = useWrappedRows(probe, breakUnits(phrase, state.learner.profile.nativeLang));
  return (
    <h2 ref={probe} className={className}>
      <span className='sr-only'>{label}</span>
      <span aria-hidden='true' data-hidden-slot className='flex flex-col gap-1 py-0.5'>
        {(rows ?? [{ text: phrase.target, width: 0 }]).map((row, i) => (
          <span key={i} className={`${SLOT} h-3`} style={{ width: rows ? row.width : '100%' }} />
        ))}
      </span>
    </h2>
  );
}

/**
 * The hidden target in a list row: dashed lines as wide as the phrase would be in `className`'s
 * font, wrapped by words at the row's width, with `label` for screen readers. For rows about to be recalled.
 */
export function HiddenLine({ text, className, label }: { text: string; className: string; label: string }) {
  const probe = useRef<HTMLSpanElement>(null);
  const rows = useWrappedRows(probe, text.split(/\s+/).filter(Boolean));
  return (
    <span ref={probe} className={`block ${className}`}>
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" data-hidden-slot className="flex flex-col gap-1 my-1">
        {(rows ?? [{ text, width: 0 }]).map((row, i) => (
          <span key={i} className={`${SLOT} h-3`} style={{ width: rows ? row.width : '60%' }} />
        ))}
      </span>
    </span>
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
