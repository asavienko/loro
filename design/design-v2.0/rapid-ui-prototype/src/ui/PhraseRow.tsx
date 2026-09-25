import type { Phrase } from '../content';
import { promptOf } from '../state/catalog';
import { useCopy, useStore } from '../state/store';
import { languageName } from '../copy';
import { Icon } from './Icon';
import { btnIcon } from './button';

interface PhraseRowProps {
  phrase: Phrase;
  /** Second line after the prompt, e.g. the real progress label. */
  detail?: string;
  leading?: string;
  isCurrent?: boolean;
  isPlaying?: boolean;
  /** Recall rule: while the learner is recalling it, show the prompt, not the answer. */
  hideTarget?: boolean;
  onPlay: () => void;
  playLabel?: string;
  onMore: () => void;
}

/** Two-line track row: target text, then prompt · detail. */
export function PhraseRow({ phrase, detail, leading, isCurrent = false, isPlaying = false, hideTarget = false, onPlay, playLabel, onMore }: PhraseRowProps) {
  const c = useCopy();
  const { state } = useStore();
  const prompt = promptOf(phrase, state.learner.profile.nativeLang);
  const title = hideTarget ? prompt.text : phrase.target;
  // Your own phrase says so in words, not with an icon that looks like a button.
  const status = [detail, phrase.own && c.phrase.yoursShort].filter(Boolean).join(' · ');
  return (
    // A container: at large text on a small phone the position number gives its room to the phrase.
    <div className={`@container flex items-center gap-1 rounded-2xl ${isCurrent ? 'bg-primary-fixed/40' : ''}`}>
      <button
        type="button"
        onClick={onPlay}
        aria-current={isCurrent ? 'true' : undefined}
        aria-label={playLabel ?? c.phrase.play(title)}
        className="flex-1 min-w-0 min-h-14 flex items-center gap-3 pl-2 py-2 text-left rounded-2xl active:bg-surface-container"
      >
        {leading !== undefined && (
          <span className="w-6 shrink-0 flex items-center justify-center text-label font-bold text-secondary tabular-nums @max-[13rem]:hidden">
            {isPlaying ? (
              <span className="flex items-end gap-[2px] h-4" aria-hidden="true">
                <span className="w-[3px] bg-primary-container rounded-full eq-bar-1" />
                <span className="w-[3px] bg-primary-container rounded-full eq-bar-2" />
                <span className="w-[3px] bg-primary-container rounded-full eq-bar-3" />
              </span>
            ) : (
              leading
            )}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span
            lang={hideTarget ? prompt.lang : phrase.targetLang}
            className={`block leading-snug break-words text-row ${hideTarget ? 'font-medium' : 'font-serif italic'} ${
              isCurrent ? 'text-primary-container font-semibold' : 'text-on-surface font-medium'
            }`}
          >
            {title}
          </span>
          {/* Only the prompt truncates. The status is a real figure and is never cut: when the two
              don't fit on one line, it takes the next (and wraps there if it must). */}
          <span className="flex flex-wrap gap-x-1 text-label text-secondary mt-0.5">
            <span className="max-w-full truncate">
              {hideTarget ? (
                c.player.hidden(languageName(phrase.targetLang, c.locale))
              ) : (
                <span lang={prompt.lang}>{prompt.text}</span>
              )}
              {/* The space keeps the line's text one sentence; at the end of the line it takes no room. */}
              {status && ' · '}
            </span>
            {status && <span className="min-w-0 text-on-surface-variant">{status}</span>}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onMore}
        aria-label={c.phrase.details(title)}
        className={`${btnIcon} text-secondary`}
      >
        <Icon name="more_vert" className="text-icon" />
      </button>
    </div>
  );
}
