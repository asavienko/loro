import { Phrase } from '../content';

interface PhraseRowProps {
  phrase: Phrase;
  /** Second line after the translation, e.g. the real progress label. */
  detail?: string;
  leading?: string;
  isCurrent?: boolean;
  isPlaying?: boolean;
  onPlay: () => void;
  onMore: () => void;
}

/** Two-line track row: target text, then translation · detail. */
export function PhraseRow({ phrase, detail, leading, isCurrent = false, isPlaying = false, onPlay, onMore }: PhraseRowProps) {
  return (
    <div
      className={`flex items-center gap-1 rounded-2xl ${isCurrent ? 'bg-primary-fixed/40' : ''}`}
    >
      <button
        type="button"
        onClick={onPlay}
        aria-current={isCurrent ? 'true' : undefined}
        aria-label={`Play ${phrase.target.text}`}
        className="flex-1 min-w-0 min-h-14 flex items-center gap-3 pl-2 py-2 text-left rounded-2xl active:bg-surface-container"
      >
        {leading !== undefined && (
          <span className="w-6 shrink-0 flex items-center justify-center text-xs font-bold text-secondary tabular-nums">
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
            lang={phrase.target.lang}
            className={`block font-serif italic text-[15px] leading-snug truncate ${
              isCurrent ? 'text-primary-container font-semibold' : 'text-on-surface font-medium'
            }`}
          >
            {phrase.target.text}
          </span>
          <span className="block text-xs text-secondary truncate mt-0.5">
            {phrase.native.text}
            {detail && <span className="text-on-surface-variant"> · {detail}</span>}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onMore}
        aria-label={`Details for ${phrase.target.text}`}
        className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full text-secondary active:bg-surface-container"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[22px]">more_vert</span>
      </button>
    </div>
  );
}
