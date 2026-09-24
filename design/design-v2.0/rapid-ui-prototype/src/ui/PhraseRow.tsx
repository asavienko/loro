import type { Phrase } from '../content';
import { promptOf } from '../state/catalog';
import { useCopy, useStore } from '../state/store';
import { languageName } from '../copy';
import { Icon } from './Icon';

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
  return (
    <div className={`flex items-center gap-1 rounded-2xl ${isCurrent ? 'bg-primary-fixed/40' : ''}`}>
      <button
        type="button"
        onClick={onPlay}
        aria-current={isCurrent ? 'true' : undefined}
        aria-label={playLabel ?? c.phrase.play(title)}
        className="flex-1 min-w-0 min-h-14 flex items-center gap-3 pl-2 py-2 text-left rounded-2xl active:bg-surface-container"
      >
        {leading !== undefined && (
          <span className="w-6 shrink-0 flex items-center justify-center text-label font-bold text-secondary tabular-nums">
            {isPlaying ? (
              <span className="flex items-end gap-0.5 h-3.5" aria-hidden="true">
                <span className="w-0.5 bg-primary-container rounded-full eq-bar-1" />
                <span className="w-0.5 bg-primary-container rounded-full eq-bar-2" />
                <span className="w-0.5 bg-primary-container rounded-full eq-bar-3" />
              </span>
            ) : (
              leading
            )}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span
            lang={hideTarget ? prompt.lang : phrase.targetLang}
            className={`leading-snug line-clamp-2 break-words text-row ${hideTarget ? 'font-medium' : 'font-serif italic'} ${
              isCurrent ? 'text-primary-container font-semibold' : 'text-on-surface font-medium'
            }`}
          >
            {title}
          </span>
          <span className="block text-label text-secondary truncate mt-0.5">
            {hideTarget ? (
              c.player.hidden(languageName(phrase.targetLang, c.locale))
            ) : (
              <span lang={prompt.lang}>{prompt.text}</span>
            )}
            {detail && <span className="text-on-surface-variant"> · {detail}</span>}
          </span>
        </span>
        {phrase.own && <Icon name="edit_note" className="text-icon-sm text-secondary shrink-0" />}
      </button>
      <button
        type="button"
        onClick={onMore}
        aria-label={c.phrase.details(title)}
        className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full text-secondary active:bg-surface-container"
      >
        <Icon name="more_vert" className="text-icon" />
      </button>
    </div>
  );
}
