import type { SetView } from '../state/catalog';
import { SetProgress } from '../state/selectors';
import { useCopy } from '../state/store';
import { Icon } from './Icon';
import { SetCover } from './SetCover';

const BADGE = {
  new: 'bg-primary-fixed text-on-primary-fixed',
  'in-progress': 'bg-secondary-container text-on-secondary-fixed',
  learned: 'bg-tertiary-fixed text-on-tertiary-fixed',
} as const;

/**
 * A set tile: cover, serif title, status and count. The quick-play button sits quietly on the
 * cover's corner (terracotta fill is for the one Play per screen). The card is a container, so
 * the button finds the square cover's bottom whatever the card's width.
 */
export function SetCard({ view, progress, onOpen, onPlay, wide = false }: { view: SetView; progress: SetProgress; onOpen: () => void; onPlay: () => void; wide?: boolean }) {
  const c = useCopy();
  return (
    <div className={`@container relative ${wide ? '' : 'w-40'}`}>
      <button type="button" onClick={onOpen} className="w-full text-left">
        <SetCover set={view} size="md" className="w-full aspect-square rounded-2xl shadow-cover" />
        <span className="flex items-start gap-1.5 mt-2">
          <span lang={view.targetLang} className="font-serif text-row font-semibold leading-snug line-clamp-2 break-words">{view.title}</span>
          {view.level && <span className="shrink-0 text-caption font-bold text-secondary mt-0.5">{view.level}</span>}
        </span>
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5">
          <span className={`text-caption font-bold px-1.5 py-0.5 rounded-lg ${BADGE[progress.status]}`}>{c.status.set[progress.status]}</span>
          <span className="text-label text-secondary">{c.common.phrases(progress.total)}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={onPlay}
        aria-label={c.explore.quickPlay(view.title)}
        className="absolute top-[calc(100cqi-3.25rem)] right-2 w-11 h-11 rounded-full bg-surface/90 text-primary-container shadow-card flex items-center justify-center active:scale-95 transition-transform"
      >
        <Icon name="play_arrow" fill className="text-icon-lg" />
      </button>
    </div>
  );
}
