import { useState } from 'react';
import { getSet, getTopic, phrasesOfSet } from '../content';
import type { Navigation } from '../App';
import { PhraseRow } from '../components/PhraseRow';
import { SetCover } from '../components/SetCover';
import { Sheet, SheetOption } from '../components/Sheet';
import { floatingChip } from '../lib/feedback';
import { progressLabel } from '../lib/progressLabel';
import { phraseProgress, PhraseProgress, setProgress } from '../state/selectors';
import { useCurrentPhraseId, useNow, useStore } from '../state/store';

type SortKey = 'set' | 'az' | 'due' | 'weakest';

const SORTS: { id: SortKey; label: string; icon: string }[] = [
  { id: 'set', label: 'Set order', icon: 'format_list_numbered' },
  { id: 'az', label: 'A–Z', icon: 'sort_by_alpha' },
  { id: 'due', label: 'Due first', icon: 'schedule' },
  { id: 'weakest', label: 'Lowest recall first', icon: 'trending_down' },
];

const STATUS_RANK: Record<PhraseProgress['status'], number> = { due: 0, learning: 1, new: 2, learned: 3 };

export function SetScreen({ setId, nav }: { setId: string; nav: Navigation }) {
  const { state, actions } = useStore();
  const now = useNow(30_000);
  const currentId = useCurrentPhraseId();
  const [sort, setSort] = useState<SortKey>('set');
  const [sortOpen, setSortOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const set = getSet(setId);
  const topic = getTopic(set.topicId);
  const progress = setProgress(state.learner, setId, now);
  const liked = state.learner.likedSetIds.includes(setId);
  const isThisSet = state.player.setId === setId;
  const playing = isThisSet && state.player.status === 'playing';

  const rows = phrasesOfSet(setId).map((phrase, i) => ({
    phrase,
    position: i + 1,
    progress: phraseProgress(state.learner, phrase.id, now),
  }));
  const sorted = [...rows].sort((a, b) => {
    switch (sort) {
      case 'az':
        return a.phrase.target.text.localeCompare(b.phrase.target.text, a.phrase.target.lang);
      case 'due':
        return STATUS_RANK[a.progress.status] - STATUS_RANK[b.progress.status] || a.position - b.position;
      case 'weakest':
        return (a.progress.retention ?? -1) - (b.progress.retention ?? -1) || a.position - b.position;
      default:
        return a.position - b.position;
    }
  });
  const sortedIds = sorted.map((r) => r.phrase.id);

  const onPlay = () => {
    if (isThisSet && playing) actions.pause();
    else if (isThisSet && currentId) actions.play();
    else actions.load(sortedIds, setId, 0);
  };

  const share = async (anchor: HTMLElement) => {
    const text = `${set.title} — ${set.subtitle}`;
    try {
      if (navigator.share) await navigator.share({ title: set.title, text });
      else {
        await navigator.clipboard.writeText(text);
        floatingChip(anchor, 'Copied', 'info');
      }
    } catch {
      // The learner cancelled the share sheet.
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <section className="px-4 pt-4 pb-5 bg-surface-container-low border-b border-surface-container-high">
        <div className="flex gap-4 items-center">
          <SetCover set={set} size="md" className="w-32 h-32 rounded-2xl shadow-md shrink-0" />
          <div className="min-w-0">
            {topic && (
              <p className="text-xs font-semibold text-secondary flex items-center gap-1">
                <span aria-hidden="true" className="material-symbols-outlined text-[16px]">{topic.icon}</span>
                {topic.title}
              </p>
            )}
            <h1 className="font-serif text-[28px] font-bold leading-tight">{set.title}</h1>
            <p className="text-sm text-secondary">{set.subtitle}</p>
          </div>
        </div>
        <p className="text-sm text-secondary mt-4">
          {progress.total} phrases · {progress.learned} learned
          {progress.due > 0 ? ` · ${progress.due} due` : ''}
        </p>
        <div className="flex items-center gap-1 mt-2">
          <button
            type="button"
            aria-label={liked ? 'Remove set from your library' : 'Add set to your library'}
            aria-pressed={liked}
            onClick={() => actions.toggleLikeSet(setId)}
            className="w-11 h-11 -ml-2 flex items-center justify-center rounded-full text-primary-container active:bg-surface-container"
          >
            <span aria-hidden="true" className={`material-symbols-outlined text-[26px] ${liked ? 'material-symbols-fill' : ''}`}>favorite</span>
          </button>
          <button
            type="button"
            aria-label="More options"
            onClick={() => setMoreOpen(true)}
            className="w-11 h-11 flex items-center justify-center rounded-full text-secondary active:bg-surface-container"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[26px]">more_horiz</span>
          </button>
          <span className="flex-1" />
          <button
            type="button"
            aria-label="Shuffle"
            aria-pressed={state.player.shuffle}
            onClick={actions.toggleShuffle}
            className={`w-11 h-11 flex items-center justify-center rounded-full active:bg-surface-container ${
              state.player.shuffle ? 'text-primary-container' : 'text-secondary'
            }`}
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[26px]">shuffle</span>
          </button>
          <button
            type="button"
            aria-label={playing ? `Pause ${set.title}` : `Play ${set.title}`}
            onClick={onPlay}
            className="w-14 h-14 rounded-full bg-primary-container text-on-primary flex items-center justify-center shadow-md active:scale-95 transition-transform"
          >
            <span aria-hidden="true" className="material-symbols-outlined material-symbols-fill text-[34px]">{playing ? 'pause' : 'play_arrow'}</span>
          </button>
        </div>
      </section>

      <section className="px-2 pt-3" aria-labelledby="phrases-heading">
        <div className="flex items-center justify-between px-2 mb-1">
          <h2 id="phrases-heading" className="font-serif text-xl font-bold">Phrases</h2>
          <button
            type="button"
            onClick={() => setSortOpen(true)}
            className="min-h-11 px-3 -mr-2 rounded-full text-sm font-semibold text-primary-container flex items-center gap-1 active:bg-surface-container"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">sort</span>
            {SORTS.find((s) => s.id === sort)!.label}
          </button>
        </div>
        <ul>
          {sorted.map(({ phrase, position, progress: p }, i) => {
            const isCurrent = isThisSet && currentId === phrase.id;
            return (
              <li key={phrase.id}>
                <PhraseRow
                  phrase={phrase}
                  leading={String(position)}
                  detail={progressLabel(p, now)}
                  isCurrent={isCurrent}
                  isPlaying={isCurrent && playing}
                  onPlay={() => actions.load(sortedIds, setId, i)}
                  onMore={() => nav.showDetails(phrase.id)}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <Sheet open={sortOpen} title="Sort phrases" onClose={() => setSortOpen(false)}>
        <div role="radiogroup" aria-label="Sort phrases">
          {SORTS.map((s) => (
            <SheetOption
              key={s.id}
              icon={s.icon}
              label={s.label}
              selected={sort === s.id}
              onClick={() => {
                setSort(s.id);
                setSortOpen(false);
              }}
            />
          ))}
        </div>
      </Sheet>

      <Sheet open={moreOpen} title={set.title} onClose={() => setMoreOpen(false)}>
        <SheetOption
          icon="queue_music"
          label="Add to queue"
          onClick={(e) => {
            actions.enqueue(sortedIds, setId);
            floatingChip(e.currentTarget, 'Added to queue', 'info');
            setMoreOpen(false);
          }}
        />
        <SheetOption icon="share" label="Share" onClick={(e) => share(e.currentTarget)} />
      </Sheet>
    </div>
  );
}

