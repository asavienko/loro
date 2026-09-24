import { useLayoutEffect, useRef, useState } from 'react';
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
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className="flex flex-col gap-1.5 py-1">
        {lines.map((width, i) => (
          <span key={i} className="block h-6 rounded-md bg-surface-container-highest" style={{ width }} />
        ))}
      </span>
    </h2>
  );
}

type Token = { text: string; gloss: string | null };

/** Splits the target into glossed units, longest match first ("por favor" before "por"). */
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

/** The revealed target, with each glossed word tappable to show its meaning. */
export function GlossedPhrase({ phrase, className }: { phrase: Phrase; className: string }) {
  const c = useCopy();
  const { state } = useStore();
  const [open, setOpen] = useState<number | null>(null);
  const tokens = tokenize(phrase, state.learner.profile.nativeLang);
  const openToken = open === null ? null : tokens[open];
  return (
    <div>
      <h2 lang={phrase.targetLang} className={className}>
        {tokens.map((t, i) =>
          t.gloss ? (
            <button
              key={i}
              type="button"
              aria-expanded={open === i}
              onClick={() => setOpen(open === i ? null : i)}
              className={`inline rounded-md underline decoration-dotted decoration-outline underline-offset-4 ${open === i ? 'bg-primary-fixed/60' : ''}`}
            >
              {t.text}
            </button>
          ) : (
            <span key={i}>{t.text}</span>
          ),
        )}
      </h2>
      <p aria-live="polite" className="min-h-5 text-body text-on-surface-variant mt-1">
        {openToken?.gloss ? c.phrase.wordMeaning(openToken.text, openToken.gloss) : ''}
      </p>
    </div>
  );
}
